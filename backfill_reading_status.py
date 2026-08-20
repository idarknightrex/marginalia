#!/usr/bin/env python3
"""
backfill_reading_status.py — Add reading_status and needs_review to existing
canonical reference files that are missing these fields.

Default values:
  reading_status: unread   (researcher hasn't set a depth yet)
  needs_review: true       (every ref needs attention before it's integrated)

Refs that already have these fields are left untouched.

Run on Solaris:
  python3 ~/Developer/marginalia/backfill_reading_status.py

Dry run:
  python3 ~/Developer/marginalia/backfill_reading_status.py --dry-run
"""

import sys
from pathlib import Path

REFS_DIR = Path(__file__).parent / "canonical" / "references"
DRY_RUN  = "--dry-run" in sys.argv

def process_ref(filepath):
    text = filepath.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return None, "skip: no frontmatter"

    parts = text.split("---", 2)
    if len(parts) < 3:
        return None, "skip: malformed frontmatter"

    # Parse frontmatter
    meta = {}
    for line in parts[1].strip().splitlines():
        if ": " in line:
            k, v = line.split(": ", 1)
            meta[k.strip()] = v.strip()

    changed = []

    if "reading_status" not in meta:
        meta["reading_status"] = "unread"
        changed.append("reading_status")

    if "needs_review" not in meta:
        meta["needs_review"] = "true"
        changed.append("needs_review")

    if not changed:
        return None, "skip: already has both fields"

    # Rebuild frontmatter preserving order, inserting new fields after verification_status
    fm_keys = list(meta.keys())
    # Ensure reading_status and needs_review are in sensible positions
    for field in ["reading_status", "needs_review"]:
        if field in fm_keys:
            fm_keys.remove(field)
    # Insert after verification_status if present, else append
    if "verification_status" in fm_keys:
        idx = fm_keys.index("verification_status")
        fm_keys.insert(idx + 1, "reading_status")
        fm_keys.insert(idx + 2, "needs_review")
    else:
        fm_keys.extend(["reading_status", "needs_review"])

    fm_lines = "\n".join(
        f"{k}: {meta[k]}" for k in fm_keys
        if k in meta and meta[k] is not None and meta[k] != ""
    )
    new_text = f"---\n{fm_lines}\n---\n{parts[2]}"

    if not DRY_RUN:
        filepath.write_text(new_text, encoding="utf-8")

    return changed, "updated"

def main():
    if not REFS_DIR.exists():
        print(f"References directory not found: {REFS_DIR}")
        sys.exit(1)

    files = sorted(REFS_DIR.glob("*.md"))
    print(f"{'DRY RUN — ' if DRY_RUN else ''}Processing {len(files)} references...\n")

    updated, skipped, errors = 0, 0, 0
    for f in files:
        try:
            changed, status = process_ref(f)
            if status == "updated":
                updated += 1
                if DRY_RUN:
                    print(f"  ✓ {f.name} — would add: {', '.join(changed)}")
            else:
                skipped += 1
        except Exception as e:
            errors += 1
            print(f"  ✗ {f.name} — error: {e}")

    print(f"\nDone: {updated} updated, {skipped} skipped, {errors} errors")
    if DRY_RUN:
        print("(dry run — no files were modified)")

if __name__ == "__main__":
    main()
