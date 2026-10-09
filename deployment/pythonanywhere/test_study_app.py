"""Compatibility/security tests; answer fixture mirrors collection-site/tests/collection.test.mjs."""
import base64
import concurrent.futures
import copy
import csv
import hashlib
import importlib
import json
import os
from pathlib import Path
import secrets
import sqlite3
import tempfile
import unittest
from unittest import mock

CONSENT = 'central-research-2026-09-27-v1'
SUBJECTS = ['judge', 'court', 'provider', 'system']
RATINGS = ['fairness', 'control', 'clarity', 'judgeOwnership', 'aiTrust', 'legitimacy', 'acceptance', 'unease']


def answer(a, case_type=None):
    return dict(sessionId=a['sessionId'], role=a['role'], condition=a['condition'],
                caseType=case_type or a['caseType'], preview=False, version='2.2.0',
                caseVersion='cases-presentation-2026-09-17', narrationVersion='condition-narration-2026-09-23-v1',
                participationPresentation='stage-disclosure-2026-09-27-v1', conditionLine='test',
                presentation='condition_audio_fast_text', responsibilityMeasure='independent-and-allocation-2026-09-16-v1',
                ratingPresentation='required-seven-point-slider-2026-09-25-v1', responsibilityOrder=SUBJECTS,
                responsibilityScores=dict(zip(SUBJECTS, [80, 60, 40, 20])),
                responsibilityAllocation=dict(zip(SUBJECTS, [50, 30, 15, 5])), ratings=dict.fromkeys(RATINGS, 5),
                perceivedHarm=3, involvement=5, manipulationCheck=a['condition'], finalSigner='judge',
                replayCompleted=True, reading={k: dict(confirmed=True, reachedEnd=True, visibleMs=8000) for k in ['overview', 'evidence', 'task']},
                orientation=dict(completed=True, visibleMs=3000),
                playback=dict(completed=True, textVisibleMs=15000, textReachedEnd=True, textRevealCompleted=True),
                audio=dict(completed=False), speech=dict(inputMethod='text'), openResponse='AUTOMATED TEST ONLY', replayExposureMs=15000)


class StudyTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(importlib.util.find_spec('study_app'), 'The Flask study backend must exist')
        self.mod = importlib.import_module('study_app')
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.public = self.root / 'public'
        self.public.mkdir()
        (self.public / 'index.html').write_text('<html>study</html>')
        (self.public / 'assets').mkdir()
        (self.public / 'assets' / 'sample.mp3').write_bytes(b'0123456789')
        (self.root / 'private.sqlite3').write_text('PRIVATE')
        (self.public / 'secret-link.json').symlink_to(self.root / 'private.sqlite3')
        self.db = self.root / 'study.sqlite3'
        self.config = self.root / 'config.json'
        self.config.write_text(json.dumps(dict(collectionOpen=True, backupToken='b' * 64)))
        self.app = self.mod.create_app(self.db, self.public, self.config)
        self.client = self.app.test_client()

    def call(self, path, method='GET', body=None, token=None, origin='https://zhy1126.github.io', client=None, **kw):
        headers = {'Origin': origin}
        if token:
            headers['Authorization'] = 'Bearer ' + token
        if body is not None:
            kw.update(data=json.dumps(body, ensure_ascii=False).encode(), content_type='application/json')
        return (client or self.client).open('/api/study/' + path, method=method, headers=headers, **kw)

    def start(self, choice='other', test=True, token=None, client=None):
        token = token or secrets.token_hex(32)
        r = self.call('start', 'POST', dict(backgroundChoice=choice, test=test, consent=dict(version=CONSENT, accepted=True)), token, client=client)
        return token, r

    def sql(self, q, args=()):
        with sqlite3.connect(self.db) as db:
            db.row_factory = sqlite3.Row
            return [dict(r) for r in db.execute(q, args)]

    def test_consent_retry_background_and_test_are_immutable(self):
        self.assertEqual(self.call('start', 'POST', {'backgroundChoice': 'other'}, 'a' * 64).status_code, 400)
        t, r = self.start()
        self.assertEqual(r.status_code, 201)
        a = r.json['assignment']
        self.assertEqual(self.start(token=t)[1].json['assignment'], a)
        self.assertEqual(self.start(choice='lawyer', token=t)[1].status_code, 409)
        self.assertEqual(self.start(test=False, token=t)[1].status_code, 409)
        self.assertEqual(len(self.sql('SELECT * FROM sessions')), 1)
        self.assertNotIn(t, self.db.read_bytes().decode('latin1'))

    def test_formal_closed_test_open_and_live_config(self):
        self.config.write_text(json.dumps(dict(collectionOpen=False, backupToken='b' * 64)))
        self.assertFalse(self.call('health').json['collectionOpen'])
        self.assertEqual(self.start(test=False)[1].status_code, 503)
        self.assertEqual(self.start(test=True)[1].status_code, 201)

    def test_concurrent_blocks_are_balanced_and_separate(self):
        def create(_):
            return self.start(choice='lawyer', client=self.app.test_client())[1].status_code
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
            self.assertEqual(list(pool.map(create, range(40))), [201] * 40)
        rows = self.sql('SELECT condition FROM sessions WHERE test=1 ORDER BY sequence')
        for n in range(0, 40, 4):
            self.assertEqual(len({r['condition'] for r in rows[n:n+4]}), 4)
        self.assertEqual(self.start(choice='lawyer', test=False)[1].status_code, 201)
        self.assertEqual(self.sql('SELECT sequence FROM sessions WHERE test=0')[0]['sequence'], 0)
        self.assertEqual(len(self.sql('SELECT * FROM blocks')), 11)

    def test_concurrent_duplicate_starts_and_answers_are_single_immutable_writes(self):
        token = secrets.token_hex(32)
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            starts = list(pool.map(lambda _: self.start(choice='judge', token=token, client=self.app.test_client())[1], range(16)))
        self.assertEqual(sorted(r.status_code for r in starts), [200] * 15 + [201])
        a = starts[0].json['assignment']
        self.assertTrue(all(r.json['assignment'] == a for r in starts))
        payload = answer(a)
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            answers = list(pool.map(lambda _: self.call('answer', 'POST', payload, token, client=self.app.test_client()), range(16)))
        self.assertEqual(sorted(r.status_code for r in answers), [200] * 15 + [201])
        self.assertTrue(all(r.json['response'] == answers[0].json['response'] for r in answers))
        self.assertEqual(len(self.sql('SELECT * FROM sessions')), 1)
        self.assertEqual(len(self.sql('SELECT * FROM answers')), 1)

    def test_withdraw_racing_submit_cannot_leave_answers_or_keys(self):
        t, r = self.start()
        a = r.json['assignment']
        self.call('answer', 'POST', answer(a), t)
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            saves = pool.submit(self.call, 'answer', 'POST', answer(a, a['caseOrder'][1]), t, client=self.app.test_client())
            withdrawal = pool.submit(self.call, 'withdraw', 'POST', {}, t, client=self.app.test_client())
            self.assertEqual(withdrawal.result().status_code, 200)
            self.assertIn(saves.result().status_code, [201, 410])
        self.assertEqual(self.sql('SELECT * FROM answers'), [])
        self.assertIsNone(self.sql('SELECT backup_key FROM sessions')[0]['backup_key'])

    def test_all_admin_paths_and_methods_forbidden(self):
        for path in ['/admin', '/admin/', '/admin/summary', '/api/study/admin', '/api/study/admin/summary', '/study/admin/']:
            for method in ['GET', 'POST', 'OPTIONS', 'DELETE', 'PUT', 'PATCH']:
                self.assertEqual(self.client.open(path, method=method).status_code, 403, (path, method))

    def test_private_database_and_config_cannot_reside_under_public(self):
        with self.assertRaises(ValueError):
            self.mod.create_app(self.public / 'data.sqlite3', self.public, self.config)
        with self.assertRaises(ValueError):
            self.mod.create_app(self.db, self.public, self.public / 'config.json')

    def test_public_roles_random_pool_and_background_mapping(self):
        seen = set()
        for choice in ['other', 'legal_other']:
            for _ in range(32):
                a = self.start(choice=choice)[1].json['assignment']
                self.assertEqual(a['backgroundGroup'], 'public')
                self.assertEqual(a['roleAssignment'], 'randomized_perspective')
                self.assertEqual(a['background']['legalIndustry'], 'no' if choice == 'other' else 'yes')
                seen.add(a['role'])
        self.assertEqual(seen, {'public', 'litigant'})
        for role in ['judge', 'lawyer']:
            a = self.start(choice=role)[1].json['assignment']
            self.assertEqual(a['role'], role)
            self.assertEqual(a['backgroundGroup'], role)

    def test_sequential_cases_completion_idempotency_and_mutation(self):
        t, r = self.start(choice='lawyer', test=False)
        a = r.json['assignment']
        self.assertEqual(self.call('answer', 'POST', answer(a, a['caseOrder'][1]), t).status_code, 409)
        for i, case in enumerate(a['caseOrder']):
            payload = answer(a, case)
            saved = self.call('answer', 'POST', payload, t)
            self.assertEqual(saved.status_code, 201, saved.json)
            self.assertEqual(saved.json['record']['completed'], i == 1)
            self.assertEqual(saved.json['response']['condition'], a['condition'])
            self.assertEqual(self.call('answer', 'POST', payload, t).json, saved.json)
            payload['openResponse'] = 'changed'
            self.assertEqual(self.call('answer', 'POST', payload, t).status_code, 409)
        record = self.call('session', token=t).json['record']
        self.assertEqual([r['caseType'] for r in record['responses']], a['caseOrder'])
        self.assertEqual(record['caseIndex'], 1)
        self.assertTrue(self.sql('SELECT completed_at FROM sessions')[0]['completed_at'])

    def test_validation_and_eight_second_reading(self):
        t, r = self.start()
        a = r.json['assignment']
        changes = [({'responsibilityAllocation': dict.fromkeys(SUBJECTS, 0)}), {'ratings': dict.fromkeys(RATINGS, True)},
                   {'preview': True}, {'caseType': 'bogus'}, {'role': 'bogus'}, {'replayCompleted': False},
                   {'reading': {}}, {'orientation': {'completed': True, 'visibleMs': '3000'}},
                   {'playback': {'textReachedEnd': True, 'textVisibleMs': 7999}}, {'responsibilityOrder': ['judge'] * 4},
                   {'openResponse': '😀' * 401}, {'version': '😀' * 301}, {'audio': {'note': 'x' * 16000}},
                   {'reading': True}, {'responsibilityScores': []}, {'responsibilityOrder': [{}, {}, {}, {}]}]
        for change in changes:
            p = answer(a)
            p.update(change)
            self.assertEqual(self.call('answer', 'POST', p, t).status_code, 400, change)
        for case in a['caseOrder']:
            p = answer(a, case)
            p['playback']['textVisibleMs'] = 8000
            p['audio']['completed'] = False
            self.assertEqual(self.call('answer', 'POST', p, t).status_code, 201)

    def test_legacy_digest_retry_compares_normalized_payload(self):
        t, r = self.start()
        p = answer(r.json['assignment'])
        p['replayExposureMs'] = 15000.0
        p['audio'] = {'2': 2.0, '1': -0.0, 'note': '中文😀'}
        saved = self.call('answer', 'POST', p, t)
        self.assertEqual(saved.status_code, 201)
        with sqlite3.connect(self.db) as db:
            db.execute('UPDATE answers SET digest=?', ('f' * 64,))
        before = self.sql('SELECT * FROM answers')
        self.assertEqual(self.call('answer', 'POST', p, t).status_code, 200)
        self.assertEqual(self.sql('SELECT * FROM answers'), before)
        p['audio']['note'] = 'mutation'
        self.assertEqual(self.call('answer', 'POST', p, t).status_code, 409)

    def test_original_node_oracle_assignment_normalization_and_digest(self):
        fixture = json.loads(Path(__file__).with_name('node_contract_fixture.json').read_text())
        for case in fixture['cases']:
            a = self.mod.assignment(case['session'])
            self.assertEqual(a, case['assignment'])
            normalized = self.mod.checked_answer(case['input'], a)
            self.assertEqual(normalized, case['normalized'])
            self.assertEqual(hashlib.sha256(self.mod.js_dumps(normalized).encode()).hexdigest(), case['digest'])

    def test_js_exposure_coercion_is_compatible_and_finite(self):
        t, r = self.start()
        a = r.json['assignment']
        for value, expected in [('inf', 0), ('Infinity', 86400000), ('0x10', 16), ([[12]], 12), ('\ufeff12\ufeff', 12), ('-Infinity', 0), ('NaN', 0)]:
            p = answer(a)
            p['replayExposureMs'] = value
            self.assertEqual(self.mod.checked_answer(p, a)['replayExposureMs'], expected, value)

    def test_backup_aes_gcm_ack_withdraw_destroys_key_and_answers(self):
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        t, r = self.start()
        a = r.json['assignment']
        p = answer(a)
        for field in ['reading', 'orientation', 'playback', 'audio']:
            p[field]['note'] = '测' * 14000
        self.assertEqual(self.call('answer', 'POST', p, t).status_code, 201)
        self.assertEqual(self.call('backup').status_code, 401)
        b = self.call('backup', token='b' * 64)
        self.assertEqual(b.status_code, 200)
        item = b.json['records'][0]
        key = self.sql('SELECT backup_key FROM sessions')[0]['backup_key']
        plain = AESGCM(base64.b64decode(key)).decrypt(base64.b64decode(item['iv']), base64.b64decode(item['ciphertext']), item['id'].encode())
        self.assertEqual(json.loads(plain)['responses'][0]['audio']['note'], '测' * 14000)
        self.assertNotIn('backup_key', b.get_data(as_text=True))
        self.assertEqual(self.call('backup/ack', 'POST', {'commit': 'a' * 40}, 'b' * 64).status_code, 200)
        self.assertEqual(self.call('backup/ack', 'POST', {'commit': 'oops'}, 'b' * 64).status_code, 400)
        self.assertEqual(self.call('withdraw', 'POST', {}, t).json, {'withdrawn': True, 'sessionId': a['sessionId']})
        self.assertEqual(self.call('withdraw', 'POST', {}, t).status_code, 200)
        self.assertEqual(self.call('session', token=t).status_code, 410)
        self.assertEqual(self.call('answer', 'POST', p, t).status_code, 410)
        self.assertEqual(self.start(token=t)[1].status_code, 410)
        self.assertEqual(self.sql('SELECT backup_key,completed_at FROM sessions')[0], {'backup_key': None, 'completed_at': None})
        self.assertEqual(self.sql('SELECT * FROM answers'), [])
        self.assertEqual(self.call('backup', token='b' * 64).json['records'], [])

    def test_backup_pagination(self):
        for _ in range(27):
            t, r = self.start()
            self.call('answer', 'POST', answer(r.json['assignment']), t)
        first = self.call('backup', token='b' * 64).json
        self.assertEqual(len(first['records']), 25)
        second = self.call('backup?cursor=' + first['nextCursor'], token='b' * 64).json
        self.assertEqual(len(second['records']), 2)
        self.assertIsNone(second['nextCursor'])
        self.assertEqual(self.call('backup?cursor=invalid', token='b' * 64).status_code, 400)

    def test_authorizations_cors_private_paths_and_static_range(self):
        for path in ['admin', 'admin/summary', 'admin/export', 'admin/recovery']:
            self.assertEqual(self.call(path, token='b' * 64).status_code, 403)
        for path in ['/admin', '/admin/summary', '/study/admin', '/study/config.json', '/study/secret-link.json', '/study/../private.sqlite3', '/study/.git/config', '/study/study_app.py']:
            self.assertIn(self.client.get(path).status_code, [403, 404])
        self.assertEqual(self.call('session').status_code, 401)
        self.assertEqual(self.call('health', origin='https://evil.test').status_code, 403)
        self.assertEqual(self.call('health', origin='http://127.0.0.1:8000').status_code, 403)
        self.assertEqual(self.call('health', origin='http://localhost').status_code, 200)
        self.assertEqual(self.call('health', method='OPTIONS').status_code, 204)
        self.assertEqual(self.call('health').headers['Access-Control-Allow-Origin'], 'https://zhy1126.github.io')
        self.assertIn('no-store', self.call('health').headers['Cache-Control'])
        with self.client.get('/study/') as page:
            self.assertEqual(page.status_code, 200)
        result = self.client.get('/study/assets/sample.mp3', headers={'Range': 'bytes=2-5'})
        self.assertEqual(result.status_code, 206)
        self.assertEqual(result.data, b'2345')
        self.assertEqual(result.mimetype, 'audio/mpeg')
        result.close()
        (self.public / 'late-secret.json').write_text('SECRET')
        self.assertEqual(self.client.get('/study/late-secret.json').status_code, 404)

    def test_malformed_and_large_body_safe_errors(self):
        for data in ['[1]', 'null', '{', '{"x": NaN}', '{"x": Infinity}', '{"x": 1e999}', '"str"']:
            self.assertEqual(self.client.post('/api/study/start', data=data, content_type='application/json').status_code, 400, data)
        self.assertEqual(self.client.post('/api/study/start', data='x' * 196609).status_code, 413)
        result = self.client.post('/api/study/start', data='[' * 1500 + ']' * 1500)
        self.assertEqual(result.status_code, 400)
        self.config.write_text('{')
        with self.assertLogs(self.app.logger, level='ERROR'):
            r = self.call('health')
        self.assertEqual(r.status_code, 503)
        self.assertNotIn(str(self.config), r.get_data(as_text=True))

    def test_private_cli_summary_exports_and_sqlite_backup(self):
        self.assertIsNotNone(importlib.util.find_spec('study_admin'))
        admin = importlib.import_module('study_admin')
        t, r = self.start(test=False)
        p = answer(r.json['assignment'])
        p['openResponse'] = '  =HYPERLINK("https://evil")'
        self.call('answer', 'POST', p, t)
        t2, r2 = self.start(test=True)
        self.call('answer', 'POST', answer(r2.json['assignment']), t2)
        self.assertEqual(admin.summary(self.db, test=False)['totals']['assigned'], 1)
        records = admin.export_records(self.db, test=False)
        self.assertEqual(len(records['records']), 1)
        self.assertIn("'  =HYPERLINK", admin.to_csv(records))
        dest = self.root / 'owner-only' / 'snapshot.sqlite3'
        admin.sqlite_backup(self.db, dest)
        self.assertEqual(dest.stat().st_mode & 0o777, 0o600)
        with sqlite3.connect(dest) as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM answers').fetchone()[0], 2)

    def latest_rows(self, test=False):
        path = self.root / ('test-latest.csv' if test else 'formal-latest.csv')
        with path.open(encoding='utf-8-sig', newline='') as stream:
            return list(csv.DictReader(stream))

    def test_live_exports_follow_both_cases_and_separate_pilot(self):
        self.assertEqual(self.latest_rows(), [])
        self.assertEqual(self.latest_rows(test=True), [])
        t, r = self.start(test=False)
        a = r.json['assignment']
        p = answer(a)
        p['openResponse'] = '=FORMULA()'
        self.assertEqual(self.call('answer', 'POST', p, t).status_code, 201)
        rows = self.latest_rows()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['study_completed'], 'false')
        self.assertEqual(rows[0]['open_response'], "'=FORMULA()")
        self.assertEqual(self.call('answer', 'POST', p, t).status_code, 200)
        self.assertEqual(len(self.latest_rows()), 1)
        self.assertEqual(self.call('answer', 'POST', answer(a, a['caseOrder'][1]), t).status_code, 201)
        self.assertEqual([row['study_completed'] for row in self.latest_rows()], ['true', 'true'])
        t2, r2 = self.start()
        self.call('answer', 'POST', answer(r2.json['assignment']), t2)
        self.assertEqual(len(self.latest_rows()), 2)
        self.assertEqual(len(self.latest_rows(test=True)), 1)
        status = (self.root / 'data-status.txt').read_text()
        self.assertIn('北京时间', status)
        self.assertIn('正式：2 条案件回答，1 人完成两个案件，0 人仅完成一个案件', status)
        for name in ['formal-latest.csv', 'test-latest.csv', 'data-status.txt']:
            self.assertEqual((self.root / name).stat().st_mode & 0o777, 0o600)
            self.assertEqual(self.client.get('/study/' + name).status_code, 404)

    def test_live_exports_backfill_and_withdraw_without_touching_manual_snapshot(self):
        t, r = self.start(test=False)
        self.call('answer', 'POST', answer(r.json['assignment']), t)
        saved = self.sql('SELECT payload,digest FROM answers')
        old = self.root / 'formal-20261008.csv'
        old.write_text('historical snapshot')
        (self.root / 'formal-latest.csv').unlink()
        self.mod.create_app(self.db, self.public, self.config)
        self.assertEqual(len(self.latest_rows()), 1)
        self.assertEqual(self.sql('SELECT payload,digest FROM answers'), saved)
        self.assertEqual(self.call('withdraw', 'POST', {}, t).status_code, 200)
        self.assertEqual(self.latest_rows(), [])
        self.assertEqual(old.read_text(), 'historical snapshot')
        self.assertIn('正式：0 条案件回答', (self.root / 'data-status.txt').read_text())

    def test_live_export_failure_does_not_lose_answer_and_retry_repairs(self):
        admin = importlib.import_module('study_admin')
        t, r = self.start(test=False)
        p = answer(r.json['assignment'])
        original = admin.atomic_private_output
        def broken(path, content):
            if Path(path).suffix == '.csv':
                raise OSError('synthetic export failure')
            return original(path, content)
        with mock.patch.object(admin, 'atomic_private_output', side_effect=broken), self.assertLogs(self.app.logger, level='ERROR'):
            self.assertEqual(self.call('answer', 'POST', p, t).status_code, 201)
        self.assertEqual(len(self.sql('SELECT * FROM answers')), 1)
        self.assertFalse((self.root / 'formal-latest.csv').exists())
        self.assertFalse((self.root / 'test-latest.csv').exists())
        self.assertIn('导出暂未更新', (self.root / 'data-status.txt').read_text())
        self.assertEqual(self.call('answer', 'POST', p, t).status_code, 200)
        self.assertEqual(len(self.latest_rows()), 1)
        # A failed export after a withdrawal must not leave an obsolete live CSV.
        with mock.patch.object(admin, 'atomic_private_output', side_effect=broken), self.assertLogs(self.app.logger, level='ERROR'):
            self.assertEqual(self.call('withdraw', 'POST', {}, t).status_code, 200)
        self.assertFalse((self.root / 'formal-latest.csv').exists())
        self.assertEqual(self.sql('SELECT * FROM answers'), [])

    def test_live_exports_concurrent_workers_match_database(self):
        second_app = self.mod.create_app(self.db, self.public, self.config)
        participants = [self.start(test=False) for _ in range(12)]
        def submit(item):
            i, (t, r) = item
            client = (self.app if i % 2 else second_app).test_client()
            self.assertEqual(self.call('answer', 'POST', answer(r.json['assignment']), t, client=client).status_code, 201)
            if i % 3 == 0:
                self.assertEqual(self.call('withdraw', 'POST', {}, t, client=client).status_code, 200)
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            list(pool.map(submit, enumerate(participants)))
        ids = {r['session_id'] for r in self.sql('SELECT session_id FROM answers')}
        self.assertEqual(len(ids), 8)
        self.assertEqual({r['session_id'] for r in self.latest_rows()}, ids)
        self.assertEqual(list(self.root.glob('.live-export-*.tmp')), [])


if __name__ == '__main__':
    unittest.main()
