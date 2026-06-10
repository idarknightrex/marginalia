"""
utils/paths.py
Single source of truth for all filesystem paths in Marginalia.
All paths are relative to APP_ROOT — never hardcoded absolute paths.
This makes the entire project portable across machines, usernames, and drives.

Import pattern:
    from utils.paths import REFERENCES_DIR, SESSIONS_DIR
    # Never: open("/Users/raj/Desktop/marginalia/...")
    # Always: open(REFERENCES_DIR / filename)
"""

from pathlib import Path

# ─── Root ─────────────────────────────────────────────────────────────────────
# Resolves to the marginalia project folder regardless of where it lives
APP_ROOT = Path(__file__).parent.parent.resolve()

# ─── Canonical (source of truth — committed to git) ───────────────────────────
CANONICAL_DIR  = APP_ROOT / "canonical"
REFERENCES_DIR = CANONICAL_DIR / "references"
SESSIONS_DIR   = CANONICAL_DIR / "sessions"
CAPTURES_DIR   = CANONICAL_DIR / "captures"
POSTS_DIR      = CANONICAL_DIR / "posts"

# ─── Runtime (never committed) ────────────────────────────────────────────────
DB_DIR         = APP_ROOT / "db"
DB_PATH        = DB_DIR / "research.db"
DB_SQL_DUMP    = DB_DIR / "research.sql"

# ─── Exports ──────────────────────────────────────────────────────────────────
EXPORTS_DIR    = APP_ROOT / "exports"
REFS_EXPORT    = EXPORTS_DIR / "references"
MAPS_EXPORT    = EXPORTS_DIR / "maps"

# ─── Logs ─────────────────────────────────────────────────────────────────────
LOGS_DIR       = APP_ROOT / "logs"
SESSIONS_LOG   = LOGS_DIR / "sessions"

# ─── Config ───────────────────────────────────────────────────────────────────
SETTINGS_PATH  = APP_ROOT / "settings.json"
GITIGNORE_PATH = APP_ROOT / ".gitignore"
STATE_PATH     = APP_ROOT / ".marginalia-state.json"

# ─── Assets ───────────────────────────────────────────────────────────────────
ASSETS_DIR     = APP_ROOT / "assets"
LOGO_PATH      = ASSETS_DIR / "marginalia-logo.svg"

# ─── External ─────────────────────────────────────────────────────────────────
BROADCAST_URL  = "https://raw.githubusercontent.com/idarknightrex/marginalia/main/broadcast.json"

# ─── Projects and Writing (canonical, committed) ──────────────────────────────
PROJECTS_DIR   = CANONICAL_DIR / "projects"
WRITING_DIR    = CANONICAL_DIR / "writing"
