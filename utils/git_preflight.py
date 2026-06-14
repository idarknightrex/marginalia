"""
utils/git_preflight.py
Pre-commit safety scanner. Runs before every Save & Break commit.

What it does:
  1. Scans for large or blocked files and auto-adds them to .gitignore
  2. Commits and pushes the main Marginalia repo (code + canonical files)
  3. Commits and pushes the canonical private repo separately
     — so your research data is always backed up alongside the code

Why two repos:
  The main repo (idarknightrex/marginalia) is public — code only.
  The canonical repo (idarknightrex/marginalia-canonical) is private —
  your references, sessions, notes, and writing. Kept separate so the
  instrument can be distributed without exposing your research data.

Why this matters:
  Without this, a power cut between Save & Break calls could lose
  session data. With it, every Save & Break is a complete backup of
  both the instrument and the research.
"""

import subprocess
from pathlib import Path
from utils.paths import APP_ROOT, GITIGNORE_PATH

MAX_FILE_MB = 50

BLOCKED_EXTENSIONS = {
    ".pdf", ".mp4", ".mp3", ".m4a", ".wav", ".mov", ".avi",
    ".db", ".db-shm", ".db-wal",
    ".zip", ".tar", ".gz", ".rar",
    ".psd", ".ai", ".sketch",
}

ALWAYS_IGNORE = {
    ".git", ".venv", "__pycache__", ".DS_Store",
    "node_modules", ".env",
}

# Canonical directory — lives inside the main repo but is a separate git repo
CANONICAL_DIR = APP_ROOT / "canonical"


def scan_for_large_files(repo_root: Path) -> list:
    """
    Returns list of (relative_path, size_mb) for files that should not be committed.
    Skips hidden directories and always-ignored paths.
    """
    flagged = []
    for filepath in repo_root.rglob("*"):
        if not filepath.is_file():
            continue
        # Skip hidden and always-ignored
        if any(part in ALWAYS_IGNORE or part.startswith(".") for part in filepath.parts[len(repo_root.parts):]):
            continue
        size_mb = filepath.stat().st_size / (1024 * 1024)
        if filepath.suffix.lower() in BLOCKED_EXTENSIONS or size_mb > MAX_FILE_MB:
            flagged.append((filepath.relative_to(repo_root), round(size_mb, 1)))
    return flagged


def auto_gitignore(flagged_files: list) -> list:
    """
    Adds flagged files to .gitignore.
    Returns list of (entry, size_mb) for entries actually added.
    """
    existing = GITIGNORE_PATH.read_text(encoding="utf-8") if GITIGNORE_PATH.exists() else ""
    added = []
    new_entries = []

    for rel_path, size_mb in flagged_files:
        entry = str(rel_path)
        if entry not in existing:
            new_entries.append(f"# Auto-added by Marginalia pre-flight ({size_mb}MB)\n{entry}")
            added.append((entry, size_mb))

    if new_entries:
        with open(GITIGNORE_PATH, "a", encoding="utf-8") as f:
            f.write("\n" + "\n".join(new_entries) + "\n")

    return added


def push_canonical(message: str) -> dict:
    """
    Commits and pushes the canonical directory as its own git repo.
    The canonical dir is a separate git repo inside the main repo,
    pointed at the private marginalia-canonical repository.

    Returns a result dict with status and any warnings.
    Silent on success — warnings only surface if something goes wrong.
    """
    canonical_dir = CANONICAL_DIR
    if not canonical_dir.exists():
        return {"status": "skipped", "reason": "canonical directory not found"}

    git_dir = canonical_dir / ".git"
    if not git_dir.exists():
        return {"status": "skipped", "reason": "canonical directory not a git repo — run setup.sh to initialise"}

    try:
        # Stage all changes in canonical
        subprocess.run(
            ["git", "add", "-A"],
            cwd=canonical_dir, check=True, capture_output=True
        )

        # Commit — allow "nothing to commit" without error
        result = subprocess.run(
            ["git", "commit", "-m", message],
            cwd=canonical_dir, capture_output=True, text=True
        )
        if result.returncode != 0 and "nothing to commit" not in result.stdout + result.stderr:
            return {"status": "canonical_error", "message": result.stderr}

        # Push to origin (idarknightrex/marginalia-canonical)
        push = subprocess.run(
            ["git", "push", "origin", "main"],
            cwd=canonical_dir, capture_output=True, text=True
        )
        if push.returncode != 0:
            return {"status": "canonical_push_failed", "message": push.stderr}

        return {"status": "canonical_pushed"}

    except Exception as e:
        return {"status": "canonical_error", "message": str(e)}


def safe_commit(repo_root: Path, message: str) -> dict:
    """
    Full Save & Break sequence:
      1. Pre-flight scan for large/blocked files
      2. Commit and push main repo (code)
      3. Commit and push canonical repo (research data)

    Returns a result dict with status and any warnings for display in the UI.
    """
    warnings = []

    # ── Pre-flight scan ───────────────────────────────────────────────────────
    flagged = scan_for_large_files(repo_root)
    if flagged:
        added = auto_gitignore(flagged)
        warnings = [
            f"{entry} ({size_mb}MB) — added to .gitignore automatically"
            for entry, size_mb in added
        ]

    # ── Main repo commit + push ───────────────────────────────────────────────
    try:
        subprocess.run(
            ["git", "add", "."],
            cwd=repo_root, check=True, capture_output=True
        )
        result = subprocess.run(
            ["git", "commit", "-m", message],
            cwd=repo_root, capture_output=True, text=True
        )
        if result.returncode != 0 and "nothing to commit" not in result.stdout:
            return {"status": "error", "message": result.stderr, "warnings": warnings}

        # Try backup remote first, fall back to origin
        push = subprocess.run(
            ["git", "push", "backup"],
            cwd=repo_root, capture_output=True, text=True
        )
        if push.returncode != 0:
            subprocess.run(
                ["git", "push", "origin", "main"],
                cwd=repo_root, capture_output=True
            )

    except Exception as e:
        return {"status": "error", "message": str(e), "warnings": warnings}

    # ── Canonical repo commit + push ──────────────────────────────────────────
    canonical_result = push_canonical(message)
    if canonical_result["status"] not in ("canonical_pushed", "skipped"):
        warnings.append(
            f"Canonical backup warning: {canonical_result.get('message', canonical_result['status'])}"
        )

    return {
        "status": "committed",
        "commit_message": message,
        "canonical": canonical_result["status"],
        "warnings": warnings,
    }
