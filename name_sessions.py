#!/usr/bin/env python3
"""
name_sessions.py — One-time batch session naming for Marginalia.

Reads all canonical session files, generates a title from:
  - Final prompt block (after last +++ separator) → keyword component
  - Synthesis section → top concept component

Writes title back to frontmatter only if no title exists or title
is the raw timestamp slug (session_YYYY-MM-DD_HH-MM).

Run on Solaris:
  python3 ~/Developer/marginalia/name_sessions.py

Dry run (no writes):
  python3 ~/Developer/marginalia/name_sessions.py --dry-run
"""

import re
import sys
from pathlib import Path
from datetime import datetime

SESSIONS_DIR = Path(__file__).parent / "canonical" / "sessions"
DRY_RUN = "--dry-run" in sys.argv

STOP_WORDS = {
    "the","a","an","and","or","but","in","on","at","to","for","of","with",
    "is","are","was","were","be","been","being","have","has","had","do","does",
    "did","will","would","could","should","may","might","shall","can","this",
    "that","these","those","it","its","they","their","there","what","how",
    "why","when","where","which","who","if","as","by","from","into","through",
    "about","after","before","between","during","without","within","across",
    "please","provide","explain","describe","discuss","analyse","analyze",
    "using","use","used","also","just","more","some","any","all","both",
    "each","much","many","such","than","then","them","him","her","his","she",
    "he","we","you","i","my","your","our","not","no","so","up","out","own",
}

CONCEPT_STOP = {
    "consensus","divergence","unique","contributions","absent","voices",
    "survived","destabilized","unresolved","unasked","examiner","survey",
    "pressure","synthesis","model","research","study","response","question",
    "argument","approach","framework","perspective","analysis","evidence",
    "context","section","above","below","overall","similarly","however",
    "therefore","specifically","generally","simply","directly","currently",
    # Model names — never useful as concepts
    "gemini","deepseek","qwen","mistral","cohere","gemma","llama","claude",
    "openai","anthropic","chatgpt",
    # Generic synthesis/analysis words that aren't concepts
    "none","analytical","summary","adds","gaps","notes","neither","explicitly",
    "another","source","argues","elaborates","several","most","provides",
    "bond","alignment","gauge","mortar","brick","masonry","course","standard",
    "important","valuable","significant","relevant","interesting","useful",
    "suggests","states","claims","shows","finds","okay","others","whether",
    "furthermore","provided","offered","regarding","points","medium","high",
    "here","while","within","across",
}

def extract_keywords(prompt_text, n=5):
    """Extract n meaningful keywords from prompt text."""
    # Take final block after last +++
    blocks = prompt_text.split("+++")
    final  = blocks[-1].strip() if blocks else prompt_text
    words  = re.findall(r'\b[a-zA-Z]{4,}\b', final.lower())
    seen, result = set(), []
    for w in words:
        if w not in STOP_WORDS and w not in seen:
            seen.add(w)
            result.append(w)
        if len(result) >= n:
            break
    return result

def extract_concepts(synthesis_text, n=3):
    """Extract top n concepts from synthesis by frequency."""
    tokens = re.findall(r'\b[A-Z][a-z]{3,}\b', synthesis_text)
    freq = {}
    for t in tokens:
        tl = t.lower()
        if tl not in STOP_WORDS and tl not in CONCEPT_STOP:
            freq[tl] = freq.get(tl, 0) + 1
    top = sorted(freq.items(), key=lambda x: -x[1])[:n]
    return [t for t, _ in top]

def is_timestamp_slug(title):
    """True if title looks like session_2026-08-15_16-35 or similar."""
    if not title:
        return True
    return bool(re.match(r'^session_\d{4}-\d{2}-\d{2}', title))

def process_session(filepath):
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

    existing_title = meta.get("title", "").strip()
    if existing_title and not is_timestamp_slug(existing_title):
        return None, f"skip: already named '{existing_title}'"

    body = parts[2]

    # Extract prompt section
    prompt_text = ""
    if "## Prompt" in body:
        raw = body.split("## Prompt")[1].split("\n## ")[0].strip()
        prompt_text = raw

    # Extract synthesis section
    synthesis_text = ""
    if "## Synthesis" in body:
        raw = body.split("## Synthesis")[1].split("\n## ")[0].strip()
        synthesis_text = raw

    if not prompt_text:
        return None, "skip: no prompt section"

    # Generate title
    keywords = extract_keywords(prompt_text, n=5)
    concepts = extract_concepts(synthesis_text, n=3) if synthesis_text else []

    # Date from filename or frontmatter
    created = meta.get("created_at", "")[:10] or filepath.stem[8:18] if len(filepath.stem) > 18 else ""
    ts = created.replace("-", "") if created else ""

    keyword_part  = " ".join(keywords[:4]) if keywords else filepath.stem
    concept_part  = ", ".join(concepts) if concepts else ""
    title = keyword_part
    if concept_part:
        title += " — " + concept_part
    if ts:
        title += " (" + ts + ")"

    # Write back
    meta["title"] = title
    fm_lines = "\n".join(f"{k}: {v}" for k, v in meta.items())
    new_text = f"---\n{fm_lines}\n---\n{parts[2]}"

    if not DRY_RUN:
        filepath.write_text(new_text, encoding="utf-8")

    return title, "named"

def main():
    if not SESSIONS_DIR.exists():
        print(f"Sessions directory not found: {SESSIONS_DIR}")
        sys.exit(1)

    files = sorted(SESSIONS_DIR.glob("*.md"))
    print(f"{'DRY RUN — ' if DRY_RUN else ''}Processing {len(files)} sessions...\n")

    named, skipped, errors = 0, 0, 0
    for f in files:
        try:
            title, status = process_session(f)
            if status.startswith("named"):
                named += 1
                print(f"  ✓ {f.name}")
                print(f"    → {title}\n")
            else:
                skipped += 1
                if DRY_RUN:
                    print(f"  · {f.name} — {status}")
        except Exception as e:
            errors += 1
            print(f"  ✗ {f.name} — error: {e}")

    print(f"\nDone: {named} named, {skipped} skipped, {errors} errors")
    if DRY_RUN:
        print("(dry run — no files were modified)")

if __name__ == "__main__":
    main()
