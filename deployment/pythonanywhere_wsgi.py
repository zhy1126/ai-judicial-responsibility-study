"""PythonAnywhere entry point; preserve the existing annotation application."""
import sys
from pathlib import Path

STUDY_ROOT = Path('/home/zhy031126/judicial-study')
for directory in ('/home/zhy031126/mysite', str(STUDY_ROOT / 'code')):
    if directory not in sys.path:
        sys.path.insert(0, directory)

from card_annotation_flask_app import app as annotation_app
from study_app import create_app

study_app = create_app(
    STUDY_ROOT / 'private' / 'study.sqlite3',
    STUDY_ROOT / 'public',
    STUDY_ROOT / 'private' / 'config.json',
)


def application(environ, start_response):
    path = environ.get('PATH_INFO', '')
    if path in ('/study', '/api/study') or path.startswith(('/study/', '/api/study/')):
        return study_app(environ, start_response)
    return annotation_app(environ, start_response)
