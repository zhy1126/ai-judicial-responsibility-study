"""Owner-only commands. No HTTP route exposes these exports or database files."""
import argparse
import csv
from datetime import datetime, timedelta, timezone
import fcntl
import io
import json
import os
from pathlib import Path
import re
import sqlite3
import tempfile

from study_app import RATINGS, SUBJECTS, database, js_dumps, now, page_records


def summary(db_path, test=False):
    with database(db_path) as db:
        groups = [dict(row) for row in db.execute('''SELECT role,condition,COUNT(*) AS assigned,
            SUM(CASE WHEN withdrawn_at IS NOT NULL THEN 1 ELSE 0 END) AS withdrawn,
            SUM(CASE WHEN withdrawn_at IS NULL AND EXISTS(SELECT 1 FROM answers WHERE session_id=s.id) THEN 1 ELSE 0 END) AS firstCase,
            SUM(CASE WHEN withdrawn_at IS NULL AND completed_at IS NOT NULL THEN 1 ELSE 0 END) AS completed
            FROM sessions s WHERE test=? GROUP BY role,condition''', (int(test),))]
        backup = db.execute("SELECT value FROM service_meta WHERE key='backup'").fetchone()
    return dict(groups=groups, totals={k: sum(g[k] or 0 for g in groups) for k in ['assigned', 'withdrawn', 'firstCase', 'completed']},
                test=bool(test), backup=json.loads(backup['value']) if backup else None)


def export_records(db_path, test=False):
    with database(db_path) as db:
        return records_snapshot(db, test)


def records_snapshot(db, test=False):
    """Read all pages inside the caller's single consistent transaction."""
    records, cursor = [], ''
    while True:
        page, cursor = page_records(db, test=test, cursor=cursor)
        records.extend(record for _, record in page)
        if cursor is None:
            break
    return dict(exportedAt=now(), test=bool(test), records=records, nextCursor=None)


def to_csv(data):
    columns = ['session_id', 'test', 'case_number', 'case_order', 'study_completed', 'background_choice', 'role', 'condition', 'case_type', 'submitted_at']
    columns += ['score_' + k for k in SUBJECTS] + ['allocation_' + k for k in SUBJECTS] + RATINGS
    columns += ['perceived_harm', 'involvement', 'manipulation_check', 'final_signer', 'open_response', 'consent', 'reading', 'orientation', 'playback', 'audio', 'speech', 'participation_presentation']
    rows = [columns]
    for r in data['records']:
        for i, a in enumerate(r['responses']):
            row = [r['sessionId'], r['test'], i + 1, ' > '.join(r['caseOrder']), r['completed'], a['backgroundChoice'], a['role'], a['condition'], a['caseType'], a['submittedAt']]
            row += [a['responsibilityScores'][k] for k in SUBJECTS] + [a['responsibilityAllocation'][k] for k in SUBJECTS] + [a['ratings'][k] for k in RATINGS]
            row += [a['perceivedHarm'], a['involvement'], a['manipulationCheck'], a['finalSigner'], a['openResponse']]
            row += [js_dumps(a[k]) for k in ['consent', 'reading', 'orientation', 'playback', 'audio', 'speech']] + [a['participationPresentation']]
            rows.append(row)
    def cell(value):
        value = '' if value is None else 'true' if value is True else 'false' if value is False else str(value)
        return "'" + value if re.match(r'^\s*[=+\-@]', value) else value
    out = io.StringIO(newline='')
    writer = csv.writer(out, quoting=csv.QUOTE_ALL, lineterminator='\r\n')
    writer.writerows([[cell(value) for value in row] for row in rows])
    return '\ufeff' + out.getvalue().removesuffix('\r\n')


def private_output(path, content):
    """Create new owner-only output; refuse overwriting an existing export."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8', newline='') as stream:
        stream.write(content)


def atomic_private_output(path, content):
    """Replace a managed export without ever exposing a partly-written CSV."""
    path = Path(path)
    fd, temporary = tempfile.mkstemp(prefix='.live-export-', suffix='.tmp', dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8', errors='backslashreplace', newline='') as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


def refresh_live_exports(db_path):
    """Owner-only current CSVs, serialized across threads and WSGI workers.

    Take the export lock BEFORE reading SQLite, after the submission committed.
    A delayed request therefore cannot replace a newer export with older data.
    These managed files are replaceable views; SQLite remains authoritative.
    """
    folder = Path(db_path).resolve().parent
    names = ['formal-latest.csv', 'test-latest.csv']
    flags = os.O_CREAT | os.O_RDWR | getattr(os, 'O_NOFOLLOW', 0)
    fd = os.open(folder / '.live-exports.lock', flags, 0o600)
    with os.fdopen(fd, 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            with database(db_path) as db:
                data = [records_snapshot(db, test=False), records_snapshot(db, test=True)]
            timestamp = datetime.now(timezone(timedelta(hours=8))).strftime('%Y-%m-%d %H:%M:%S')
            lines = ['最新数据文件已更新', '北京时间：' + timestamp]
            for name, label, snapshot in zip(names, ['正式', '试填'], data):
                atomic_private_output(folder / name, to_csv(snapshot))
                records = snapshot['records']
                cases = sum(len(r['responses']) for r in records)
                complete = sum(r['completed'] for r in records)
                lines.append(f'{label}：{cases} 条案件回答，{complete} 人完成两个案件，{len(records) - complete} 人仅完成一个案件（{name}）')
            lines += [
                '', '每次提交案件回答或撤回后自动更新；一人完成两个案件会有两行。',
                '只分析完整答卷时，筛选 study_completed=true。试填数据与正式数据分开。',
                '通过 PythonAnywhere 登录后的 Files 页面查看或重新下载最新文件。',
                '已下载到电脑、或已在 Excel 中打开的副本不会自动刷新；请重新下载。',
                '带日期的旧导出文件是历史快照，不会更新。撤回后应另行清理旧快照及下载副本。',
            ]
            # Publish the status last, after both complete files were replaced.
            atomic_private_output(folder / 'data-status.txt', '\n'.join(lines) + '\n')
        except Exception:
            # Do not leave a misleading old view (especially after withdrawal).
            # Historical, explicitly created snapshots are never touched here.
            for name in names + ['data-status.txt']:
                (folder / name).unlink(missing_ok=True)
            atomic_private_output(folder / 'data-status.txt',
                                  '导出暂未更新。答卷仍保存在数据库中，请研究者检查后台并刷新导出。\n')
            raise


def sqlite_backup(db_path, output_path):
    """Explicit manual snapshot only; do not automate plaintext/key retention."""
    source, destination = Path(db_path).resolve(), Path(output_path).resolve()
    if source == destination:
        raise ValueError('The snapshot must use a different path')
    destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    os.close(fd)
    try:
        with sqlite3.connect(source) as src, sqlite3.connect(destination) as dst:
            src.backup(dst)
            dst.execute('PRAGMA secure_delete=ON')
    except Exception:
        destination.unlink(missing_ok=True)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', required=True, type=Path)
    parser.add_argument('--test', action='store_true', help='Export test participants instead of formal participants')
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('summary')
    sub.add_parser('refresh-exports', help='Refresh both owner-only latest CSV files from the database')
    export = sub.add_parser('export')
    export.add_argument('--format', choices=['json', 'csv'], default='json')
    export.add_argument('--out', required=True, type=Path)
    snapshot = sub.add_parser('sqlite-backup', help='Explicit sensitive snapshot containing answers and recovery keys')
    snapshot.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    if not args.db.is_file():
        parser.error('Existing private database required')
    if args.command == 'summary':
        print(json.dumps(summary(args.db, args.test), ensure_ascii=False, indent=2))
    elif args.command == 'refresh-exports':
        refresh_live_exports(args.db)
        print('Owner-only latest CSV exports refreshed.')
    elif args.command == 'export':
        data = export_records(args.db, args.test)
        private_output(args.out, to_csv(data) if args.format == 'csv' else js_dumps(data))
        print('Owner-only export created. Remove obsolete copies when participants withdraw.')
    else:
        sqlite_backup(args.db, args.out)
        print('Sensitive owner-only snapshot created. It contains answers and backup keys; remove obsolete snapshots when participants withdraw.')


if __name__ == '__main__':
    main()
