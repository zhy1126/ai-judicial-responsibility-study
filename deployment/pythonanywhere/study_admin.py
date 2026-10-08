"""Owner-only commands. No HTTP route exposes these exports or database files."""
import argparse
import csv
import io
import json
import os
from pathlib import Path
import re
import sqlite3

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
    records, cursor = [], ''
    with database(db_path) as db:
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
    elif args.command == 'export':
        data = export_records(args.db, args.test)
        private_output(args.out, to_csv(data) if args.format == 'csv' else js_dumps(data))
        print('Owner-only export created. Remove obsolete copies when participants withdraw.')
    else:
        sqlite_backup(args.db, args.out)
        print('Sensitive owner-only snapshot created. It contains answers and backup keys; remove obsolete snapshots when participants withdraw.')


if __name__ == '__main__':
    main()
