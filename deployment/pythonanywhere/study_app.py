"""Private SQLite collection service compatible with collection-site/lib/collection.mjs."""
import base64
from contextlib import contextmanager
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import hmac
import json
import math
import os
from pathlib import Path
import re
import secrets
import sqlite3
import uuid

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from flask import Flask, jsonify, request, send_file
from werkzeug.exceptions import HTTPException, RequestEntityTooLarge

CONSENT = 'central-research-2026-09-27-v1'
CONDITIONS = ['none', 'procedural', 'substantive', 'decisional']
CASES = ['natural', 'statutory']
RATINGS = ['fairness', 'control', 'clarity', 'judgeOwnership', 'aiTrust', 'legitimacy', 'acceptance', 'unease']
SUBJECTS = ['judge', 'court', 'provider', 'system']
BACKGROUNDS = {'judge': '法官／法官助理', 'lawyer': '律师', 'legal_other': '其他法律相关人员（法学生、法务、法学研究人员等）', 'other': '其他'}
BODY_LIMIT = 196608
VERSION = 'central-2026-09-28-v1'
SCHEMA = '''
CREATE TABLE IF NOT EXISTS answers(session_id TEXT NOT NULL,case_type TEXT NOT NULL,payload TEXT NOT NULL,digest TEXT NOT NULL,submitted_at TEXT NOT NULL,PRIMARY KEY(session_id,case_type));
CREATE TABLE IF NOT EXISTS blocks(role TEXT NOT NULL,test INTEGER NOT NULL,block INTEGER NOT NULL,permutation TEXT NOT NULL,PRIMARY KEY(role,test,block));
CREATE TABLE IF NOT EXISTS service_meta(key TEXT PRIMARY KEY NOT NULL,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY NOT NULL,token_hash TEXT NOT NULL,role TEXT NOT NULL,test INTEGER NOT NULL,sequence INTEGER NOT NULL,condition TEXT NOT NULL,background TEXT NOT NULL,first_case TEXT NOT NULL,created_at TEXT NOT NULL,completed_at TEXT,withdrawn_at TEXT,backup_key TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS sessions_token ON sessions(token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS sessions_sequence ON sessions(role,test,sequence);
'''


class InvalidRequest(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def fail(message, status=400):
    raise InvalidRequest(message, status)


def now():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def js_dumps(value):
    """Compact JS-style JSON, including UTF-16 lengths and integer-key order.

    Retry equality also checks normalized semantic content so imported Node digests
    do not rely on identical last-digit formatting for every IEEE-754 number.
    """
    if value is None:
        return 'null'
    if value is True:
        return 'true'
    if value is False:
        return 'false'
    if isinstance(value, str):
        text = json.dumps(value, ensure_ascii=False, separators=(',', ':'))
        return re.sub('[\ud800-\udfff]', lambda m: '\\u%04x' % ord(m[0]), text)
    if isinstance(value, (int, float)):
        if not math.isfinite(value):
            raise ValueError('non-finite number')
        if value == 0:
            return '0'
        if isinstance(value, int) and abs(value) < 1e21:
            return str(value)
        text = repr(float(value)).lower()
        if 1e-6 <= abs(value) < 1e21:
            text = format(Decimal(text), 'f')
            return text.rstrip('0').rstrip('.') if '.' in text else text
        mantissa, exponent = text.split('e') if 'e' in text else (text, '0')
        mantissa = mantissa.removesuffix('.0')
        exp = int(exponent)
        return mantissa + 'e' + ('+' if exp >= 0 else '-') + str(abs(exp))
    if isinstance(value, list):
        return '[' + ','.join(js_dumps(v) for v in value) + ']'
    if isinstance(value, dict):
        keys = list(value)
        indices = sorted((k for k in keys if re.fullmatch(r'0|[1-9][0-9]*', k) and int(k) < 4294967295), key=int)
        ordered = indices + [k for k in keys if k not in indices]
        return '{' + ','.join(js_dumps(k) + ':' + js_dumps(value[k]) for k in ordered) + '}'
    raise ValueError('unsupported JSON value')


def utf16len(text):
    return len(text.encode('utf-16-le', errors='surrogatepass')) // 2


def sha(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


@contextmanager
def database(path, write=False):
    db = sqlite3.connect(str(path), timeout=30, isolation_level=None)
    db.row_factory = sqlite3.Row
    try:
        db.execute('PRAGMA secure_delete=ON')
        db.execute('PRAGMA busy_timeout=30000')
        db.execute('BEGIN IMMEDIATE' if write else 'BEGIN')
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def initialize(path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd = os.open(path, os.O_CREAT | os.O_APPEND | os.O_WRONLY, 0o600)
    os.close(fd)
    os.chmod(path, 0o600)
    with sqlite3.connect(path) as db:
        db.execute('PRAGMA journal_mode=DELETE')
        db.execute('PRAGMA secure_delete=ON')
        db.executescript(SCHEMA)


def load_config(path):
    with open(path, encoding='utf-8') as stream:
        config = json.load(stream)
    if not isinstance(config, dict) or type(config.get('collectionOpen')) is not bool or not isinstance(config.get('backupToken'), str) or not re.fullmatch('[a-f0-9]{64}', config['backupToken']):
        raise ValueError('Invalid private configuration')
    if 'allowLocal' in config and type(config['allowLocal']) is not bool:
        raise ValueError('Invalid local origin configuration')
    return config


def assignment(s):
    choice = s['background']
    return dict(version='2.2.0', screeningVersion='four-choice-background-2026-09-20-v1',
                backgroundGroup=choice if choice in ['judge', 'lawyer'] else 'public', sessionId=s['id'],
                background=dict(backgroundChoice=choice, backgroundChoiceLabel=BACKGROUNDS[choice], legalIndustry='no' if choice == 'other' else 'yes',
                                legalOccupation='other' if choice == 'legal_other' else choice if choice in ['judge', 'lawyer'] else None,
                                practicingLawyer='yes' if choice == 'lawyer' else 'no'),
                role=s['role'], condition=s['condition'], caseType=s['first_case'], caseOrder=[s['first_case']] + [c for c in CASES if c != s['first_case']],
                roleAssignment='screened_' + choice if choice in ['judge', 'lawyer'] else 'randomized_perspective', preview=False,
                serverAssigned=True, assignmentProtocol='server-blocks-2026-09-28-v1', test=bool(s['test']), assignedAt=s['created_at'])


def record(db, s, provided=None):
    a = assignment(s)
    answers = provided if provided is not None else [json.loads(r['payload']) for r in db.execute('SELECT payload FROM answers WHERE session_id=? ORDER BY submitted_at,case_type', (s['id'],))]
    responses = [x for c in a['caseOrder'] for x in answers if x['caseType'] == c]
    return dict(version='2.2.0', protocol='two-cases-2026-09-08-v1', sessionId=s['id'], assignment=a,
                role=s['role'], condition=s['condition'], caseOrder=a['caseOrder'], caseIndex=1 if len(responses) == 2 else 0,
                responses=responses, completed=len(responses) == 2, preview=False, test=bool(s['test']), retained=True,
                submittedAt=responses[-1]['submittedAt'] if responses else None)


def prop(value, key):
    return value.get(key) if isinstance(value, dict) else None


def duration(value, minimum):
    return type(value) in [int, float] and math.isfinite(value) and minimum <= value <= 86400000


def integer(value, minimum, maximum):
    if type(value) not in [int, float] or not math.isfinite(value) or not minimum <= value <= maximum or int(value) != value:
        fail('请完成全部评分，分值需在规定范围内。')
    return int(value)


def js_number(value):
    if value is None:
        return 0
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, list):
        def array_string(v):
            if isinstance(v, list):
                return ','.join(array_string(x) for x in v)
            if v is None:
                return ''
            if isinstance(v, dict):
                return '[object Object]'
            return js_dumps(v) if not isinstance(v, str) else v
        value = array_string(value)
    if isinstance(value, str):
        value = value.strip('\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff')
        if not value:
            return 0
        if re.fullmatch(r'0[xX][a-fA-F0-9]+|0[bB][01]+|0[oO][0-7]+', value):
            try:
                return float(int(value, 0))
            except OverflowError:
                return math.inf
        if not re.fullmatch(r'[+-]?(?:Infinity|(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?)', value):
            return 0
    try:
        return float(value)
    except (ValueError, TypeError, OverflowError):
        return 0


def checked_answer(data, a):
    if data.get('preview') is not False or any(data.get(k) != a[k] for k in ['sessionId', 'role', 'condition']) or data.get('caseType') not in CASES:
        fail('答卷与本次分组不一致。')
    scores = {k: integer(prop(data.get('responsibilityScores'), k), 0, 100) for k in SUBJECTS}
    allocation = {k: integer(prop(data.get('responsibilityAllocation'), k), 0, 100) for k in SUBJECTS}
    if sum(allocation.values()) != 100:
        fail('责任分配必须合计 100 分。')
    ratings = {k: integer(prop(data.get('ratings'), k), 1, 7) for k in RATINGS}
    harm, involvement = integer(data.get('perceivedHarm'), 1, 7), integer(data.get('involvement'), 1, 7)
    if data.get('manipulationCheck') not in CONDITIONS + ['unsure'] or data.get('finalSigner') not in ['judge', 'ai', 'vendor', 'unsure']:
        fail('请完成材料理解题。')
    reading = data.get('reading')
    if data.get('replayCompleted') is not True or not all(prop(prop(reading, k), 'confirmed') is True and prop(prop(reading, k), 'reachedEnd') is True and duration(prop(prop(reading, k), 'visibleMs'), 5000) for k in ['overview', 'evidence', 'task']):
        fail('请完成三部分材料阅读。')
    if prop(data.get('orientation'), 'completed') is not True or not duration(prop(data.get('orientation'), 'visibleMs'), 3000) or prop(data.get('playback'), 'textReachedEnd') is not True or not duration(prop(data.get('playback'), 'textVisibleMs'), 8000):
        fail('请完成情境及裁判形成记录的阅读。')
    opened = data.get('openResponse')
    opened = '' if opened is None else opened
    if not isinstance(opened, str) or utf16len(opened) > 800:
        fail('开放回答不能超过 800 字。')
    result = {}
    for k in ['version', 'caseVersion', 'narrationVersion', 'participationPresentation', 'conditionLine', 'presentation', 'responsibilityMeasure', 'ratingPresentation']:
        if not isinstance(data.get(k), str) or utf16len(data[k]) > 600:
            fail('材料版本信息无效。')
        result[k] = data[k]
    for k in ['reading', 'orientation', 'playback', 'audio', 'speech']:
        value = data.get(k)
        if utf16len(js_dumps(value)) > 16000:
            fail('答卷记录过大。')
        result[k] = value
    order = data.get('responsibilityOrder')
    if not isinstance(order, list) or len(order) != 4 or not all(isinstance(x, str) and x in SUBJECTS for x in order) or len(set(order)) != 4:
        fail('责任主体记录无效。')
    exposure = js_number(data.get('replayExposureMs'))
    exposure = 0 if math.isnan(exposure) else min(86400000, max(0, exposure))
    result.update(sessionId=a['sessionId'], caseType=data['caseType'], role=a['role'], condition=a['condition'], preview=False, test=a['test'], assignment=a,
                  background=a['background'], backgroundGroup=a['backgroundGroup'], backgroundChoice=a['background']['backgroundChoice'],
                  backgroundChoiceLabel=a['background']['backgroundChoiceLabel'], screeningVersion=a['screeningVersion'], roleAssignment=a['roleAssignment'],
                  consent=dict(version=CONSENT, acceptedAt=a['assignedAt']), responsibilityScores=scores, responsibilityAllocation=allocation,
                  responsibilityAllocationTotal=100, responsibilityOrder=order, ratings=ratings, ratingStatus=dict.fromkeys(RATINGS + ['perceivedHarm'], 'answered'),
                  perceivedHarm=harm, involvement=involvement, manipulationCheck=data['manipulationCheck'], finalSigner=data['finalSigner'],
                  openResponse=opened, replayCompleted=True, replayExposureMs=exposure, retained=True, prototype=False)
    return result


def json_body():
    if request.content_length is not None and request.content_length > BODY_LIMIT:
        fail('提交内容过大。', 413)
    raw = request.stream.read(BODY_LIMIT + 1)
    if len(raw) > BODY_LIMIT:
        fail('提交内容过大。', 413)
    def invalid_constant(_):
        raise ValueError('non-finite number')
    def finite_number(text):
        value = float(text)
        if not math.isfinite(value):
            raise ValueError('non-finite number')
        return value
    def js_int(text):
        value = int(text)
        return finite_number(text) if abs(value) > 9007199254740991 else value
    try:
        body = json.loads(raw.decode('utf-8', errors='replace'), parse_constant=invalid_constant, parse_float=finite_number, parse_int=js_int)
        if not isinstance(body, dict):
            raise ValueError('not an object')
        # Bound depth before recursive normalization, without depending on Python's recursion limit.
        stack = [(body, 0)]
        while stack:
            item, depth = stack.pop()
            if depth > 64:
                raise ValueError('too deeply nested')
            if isinstance(item, (dict, list)):
                stack.extend((v, depth + 1) for v in (item.values() if isinstance(item, dict) else item))
        return body
    except (ValueError, RecursionError):
        fail('请求格式无效。')


def secret():
    token = request.headers.get('Authorization', '')
    token = token[7:] if token.startswith('Bearer ') else token
    if not re.fullmatch('[a-f0-9]{64}', token):
        fail('无法验证本次作答，请返回原答题页面。', 401)
    return token


def session(db, allow_withdrawn=False):
    row = db.execute('SELECT * FROM sessions WHERE token_hash=?', (sha(secret()),)).fetchone()
    if row is None:
        fail('本次分组尚未建立。', 401)
    if row['withdrawn_at'] and not allow_withdrawn:
        fail('本次作答已撤回。', 410)
    return row


def start(db, config):
    body = json_body()
    choice = body.get('backgroundChoice')
    if not isinstance(choice, str) or choice not in BACKGROUNDS:
        fail('请选择您的职业背景。')
    if prop(body.get('consent'), 'accepted') is not True or prop(body.get('consent'), 'version') != CONSENT:
        fail('请先同意集中保存研究回答。')
    token_hash, test = sha(secret()), int(body.get('test') is True)
    prior = db.execute('SELECT * FROM sessions WHERE token_hash=?', (token_hash,)).fetchone()
    if prior:
        if prior['withdrawn_at']:
            fail('本次作答已撤回。', 410)
        if prior['background'] != choice or prior['test'] != test:
            fail('已有分组不能通过重新提交背景改变。', 409)
        return dict(assignment=assignment(prior), record=record(db, prior)), 200
    if not config['collectionOpen'] and not test:
        fail('问卷暂未开放收集，请稍后再试。', 503)
    role = choice if choice in ['judge', 'lawyer'] else secrets.choice(['litigant', 'public'])
    sequence = db.execute('SELECT COALESCE(MAX(sequence)+1,0) FROM sessions WHERE role=? AND test=?', (role, test)).fetchone()[0]
    permutation = list(CONDITIONS)
    secrets.SystemRandom().shuffle(permutation)
    db.execute('INSERT OR IGNORE INTO blocks(role,test,block,permutation) VALUES(?,?,?,?)', (role, test, sequence // 4, js_dumps(permutation)))
    permutation = json.loads(db.execute('SELECT permutation FROM blocks WHERE role=? AND test=? AND block=?', (role, test, sequence // 4)).fetchone()[0])
    sid = 'JR-' + uuid.uuid4().hex[:16].upper()
    db.execute('INSERT INTO sessions(id,token_hash,role,test,sequence,condition,background,first_case,created_at,backup_key) VALUES(?,?,?,?,?,?,?,?,?,?)',
               (sid, token_hash, role, test, sequence, permutation[sequence % 4], choice, secrets.choice(CASES), now(), base64.b64encode(secrets.token_bytes(32)).decode()))
    row = db.execute('SELECT * FROM sessions WHERE id=?', (sid,)).fetchone()
    return dict(assignment=assignment(row), record=record(db, row)), 201


def semantic_equal(a, b):
    # Python considers True == 1; JSON does not.
    if isinstance(a, bool) or isinstance(b, bool):
        return type(a) is type(b) and a == b
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(semantic_equal(a[k], b[k]) for k in a)
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(semantic_equal(x, y) for x, y in zip(a, b))
    return a == b


def save_answer(db):
    row = session(db)
    normalized = checked_answer(json_body(), assignment(row))
    digest = sha(js_dumps(normalized))
    exists = db.execute('SELECT * FROM answers WHERE session_id=? AND case_type=?', (row['id'], normalized['caseType'])).fetchone()
    if exists:
        saved = json.loads(exists['payload'])
        prior_input = {k: v for k, v in saved.items() if k not in ['submittedAt', 'receivedAt', 'collectionVersion']}
        if exists['digest'] != digest and not semantic_equal(prior_input, normalized):
            fail('此案件已有已保存的回答，请刷新恢复，避免覆盖。', 409)
        return dict(response=saved, record=record(db, row)), 200
    if normalized['caseType'] != row['first_case'] and not db.execute('SELECT 1 FROM answers WHERE session_id=? AND case_type=?', (row['id'], row['first_case'])).fetchone():
        fail('请先提交第一个案件。', 409)
    submitted = now()
    payload = dict(normalized, submittedAt=submitted, receivedAt=submitted, collectionVersion=VERSION)
    db.execute('INSERT INTO answers(session_id,case_type,payload,digest,submitted_at) VALUES(?,?,?,?,?)', (row['id'], normalized['caseType'], js_dumps(payload), digest, submitted))
    db.execute('UPDATE sessions SET completed_at=COALESCE(completed_at,?) WHERE id=? AND (SELECT COUNT(*) FROM answers WHERE session_id=?)=2', (submitted, row['id'], row['id']))
    return dict(response=payload, record=record(db, row)), 201


def page_records(db, test=None, cursor=''):
    if cursor and not re.fullmatch('JR-[A-F0-9]{16}', cursor):
        fail('分页位置无效。')
    filter_sql = '' if test is None else 'AND test=?'
    args = [cursor] if test is None else [cursor, int(test)]
    rows = db.execute(f'''WITH selected AS (SELECT * FROM sessions WHERE id>? AND withdrawn_at IS NULL {filter_sql}
        AND EXISTS(SELECT 1 FROM answers WHERE session_id=sessions.id) ORDER BY id LIMIT 25)
        SELECT s.*,a.payload FROM selected s JOIN answers a ON a.session_id=s.id ORDER BY s.id,a.case_type''', args).fetchall()
    grouped = {}
    for row in rows:
        grouped.setdefault(row['id'], (row, []))[1].append(json.loads(row['payload']))
    records = [(row, record(db, row, answers)) for row, answers in grouped.values()]
    return records, list(grouped)[-1] if len(grouped) == 25 else None


def backup(db, cursor):
    page, next_cursor = page_records(db, cursor=cursor)
    records = []
    for row, item in page:
        iv = secrets.token_bytes(12)
        ciphertext = AESGCM(base64.b64decode(row['backup_key'], validate=True)).encrypt(iv, js_dumps(item).encode(), row['id'].encode())
        records.append(dict(id=row['id'], iv=base64.b64encode(iv).decode(), ciphertext=base64.b64encode(ciphertext).decode()))
    return dict(version='aes-gcm-per-session-v1', exportedAt=now(), records=records, nextCursor=next_cursor)


def create_app(db_path, public_dir, config_path):
    db_path, public_dir, config_path = Path(db_path).resolve(), Path(public_dir).resolve(), Path(config_path).resolve()
    if db_path.is_relative_to(public_dir) or config_path.is_relative_to(public_dir):
        raise ValueError('Private database and configuration must be outside the public bundle')
    initialize(db_path)
    app = Flask(__name__, static_folder=None)
    app.json.ensure_ascii = True  # Safe even for valid JSON containing escaped lone surrogates.
    app.config['MAX_CONTENT_LENGTH'] = BODY_LIMIT
    # Freeze the built public bundle. No private JSON, source maps, dotfiles,
    # symlinks or files added by later administration can become public.
    extensions = {'.html', '.js', '.css', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.mp3', '.wav', '.ogg', '.m4a', '.mp4', '.woff', '.woff2'}
    assets = {}
    if public_dir.is_dir():
        for file in public_dir.rglob('*'):
            relative = file.relative_to(public_dir)
            if file.is_file() and not file.is_symlink() and file.resolve().is_relative_to(public_dir) and not any(p.startswith('.') for p in relative.parts) and file.suffix.lower() in extensions:
                assets[relative.as_posix()] = file

    @app.before_request
    def reject_public_administration():
        if any(request.path == prefix or request.path.startswith(prefix + '/') for prefix in ['/admin', '/study/admin', '/api/study/admin']):
            fail('仅研究者可查看集中数据。', 403)

    @app.after_request
    def headers(response):
        # The route's database context has committed before this hook runs.
        if request.method == 'POST' and request.path in ['/api/study/answer', '/api/study/withdraw'] and 200 <= response.status_code < 300:
            refresh_owner_exports()
        response.headers['X-Content-Type-Options'] = 'nosniff'
        if request.path.startswith('/api/study'):
            response.headers['Cache-Control'] = 'no-store'
            response.headers['Vary'] = 'Origin'
            origin = request.headers.get('Origin')
            if getattr(request, 'study_allowed_origin', False) and origin:
                response.headers.update({'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                                         'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '600'})
        return response

    @app.errorhandler(Exception)
    def error(exc):
        if isinstance(exc, InvalidRequest):
            return jsonify(error=str(exc)), exc.status
        if isinstance(exc, RequestEntityTooLarge):
            return jsonify(error='提交内容过大。'), 413
        if isinstance(exc, HTTPException):
            return jsonify(error='接口不存在。' if exc.code == 404 else '请求格式无效。'), exc.code
        # Do not log submitted bodies, authorization, secrets or filesystem paths.
        app.logger.error('Collection operation failed: %s', type(exc).__name__)
        return jsonify(error='暂时无法保存，请保留此页并重试。'), 503

    @app.route('/admin', defaults={'path': ''}, methods=['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE', 'PATCH'])
    @app.route('/admin/<path:path>', methods=['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE', 'PATCH'])
    def public_admin(path):
        fail('仅研究者可查看集中数据。', 403)

    @app.route('/study/', defaults={'path': 'index.html'})
    @app.route('/study/<path:path>')
    def static_asset(path):
        if path == 'admin' or path.startswith('admin/'):
            fail('仅研究者可查看集中数据。', 403)
        file = assets.get(path)
        if file is None or file.is_symlink() or not file.resolve().is_relative_to(public_dir):
            fail('接口不存在。', 404)
        return send_file(file, conditional=True)

    @app.route('/api/study/<path:path>', methods=['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE', 'PATCH'])
    def api(path):
        if path == 'admin' or path.startswith('admin/'):
            fail('仅研究者可查看集中数据。', 403)
        config = load_config(config_path)
        origin = request.headers.get('Origin')
        allowed = not origin or origin in ['https://zhy1126.github.io', request.host_url.rstrip('/')] or (config.get('allowLocal') is True and re.fullmatch(r'http://127\.0\.0\.1:\d+', origin))
        request.study_allowed_origin = bool(allowed)
        if not allowed:
            fail('请求来源未获允许。', 403)
        if request.method == 'OPTIONS':
            return '', 204
        with database(db_path, write=request.method == 'POST') as db:
            if path == 'health' and request.method == 'GET':
                db.execute('SELECT COUNT(*) FROM sessions').fetchone()
                return jsonify(ok=True, version=VERSION, collectionOpen=config['collectionOpen'])
            if path == 'start' and request.method == 'POST':
                value, status = start(db, config)
                return jsonify(value), status
            if path == 'answer' and request.method == 'POST':
                value, status = save_answer(db)
                return jsonify(value), status
            if path == 'session' and request.method == 'GET':
                return jsonify(record=record(db, session(db)))
            if path == 'withdraw' and request.method == 'POST':
                row = session(db, allow_withdrawn=True)
                db.execute('UPDATE sessions SET withdrawn_at=COALESCE(withdrawn_at,?),backup_key=NULL,completed_at=NULL WHERE id=?', (now(), row['id']))
                db.execute('DELETE FROM answers WHERE session_id=?', (row['id'],))
                return jsonify(withdrawn=True, sessionId=row['id'])
            if path in ['backup', 'backup/ack']:
                if not hmac.compare_digest(secret(), config['backupToken']):
                    fail('备份凭证无效。', 401)
                if path == 'backup' and request.method == 'GET':
                    return jsonify(backup(db, request.args.get('cursor', '')))
                if path == 'backup/ack' and request.method == 'POST':
                    body = json_body()
                    commit = body.get('commit')
                    if not isinstance(commit, str) or not re.fullmatch('[a-f0-9]{40}', commit):
                        fail('备份版本无效。')
                    value = dict(at=now(), commit=commit)
                    db.execute("INSERT INTO service_meta(key,value) VALUES('backup',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (js_dumps(value),))
                    return jsonify(ok=True)
            fail('接口不存在。', 404)

    def refresh_owner_exports():
        try:
            from study_admin import refresh_live_exports
            refresh_live_exports(db_path)
        except Exception as exc:
            # An export is a derived view; never turn a committed answer into a
            # reported submission failure. Avoid logging participant contents.
            app.logger.error('Owner export refresh failed: %s', type(exc).__name__)

    refresh_owner_exports()  # Backfill existing answers on deployment/restart.
    return app
