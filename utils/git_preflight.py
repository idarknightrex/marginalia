"""
utils/git_preflight.py
Pre-commit safety scanner. Runs before every Save & Break commit.
Detects large files and blocked extensions, auto-adds to .gitignore,
returns warnings for display in the UI.
"""

import subprocess
from pathlib import Path
from utils.paths import GITIGNORE_PATH

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


def safe_commit(repo_root: Path, message: str) -> dict:
    """
    Pre-flight check, then git add / commit / push backup.
    Returns a result dict with status and any warnings.
    """
    warnings = []

    # Scan for problematic files
    flagged = scan_for_large_files(repo_root)
    if flagged:
        added = auto_gitignore(flagged)
        warnings = [
            f"{entry} ({size_mb}MB) — added to .gitignore automatically"
            for entry, size_mb in added
        ]

    # Git operations
    try:
        subprocess.run(["git", "add", "."], cwd=repo_root, check=True, capture_output=True)
        result = subprocess.run(
            ["git", "commit", "-m", message],
            cwd=repo_root, capture_output=True, text=True
        )
        # Nothing to commit is not an error
        if result.returncode != 0 and "nothing to commit" not in result.stdout:
            return {"status": "error", "message": result.stderr, "warnings": warnings}

        push = subprocess.run(
            ["git", "push", "backup"],
            cwd=repo_root, capture_output=True, text=True
        )
        # If no backup remote, try origin
        if push.returncode != 0:
            subprocess.run(["git", "push", "origin", "main"], cwd=repo_root, capture_output=True)

        return {
            "status": "committed",
            "commit_message": message,
            "warnings": warnings,
        }

    except Exception as e:
        return {"status": "error", "message": str(e), "warnings": warnings}
