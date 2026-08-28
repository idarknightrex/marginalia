"""
Marginalia — app.py  v1.7.2.0828-0311
Flask backend. Run via bootstrap.command or: python app.py
All API keys loaded from setup.env — edit that file, never touch this one.
"""

import os
import io
import csv
import json
import uuid
import threading
import webbrowser
from pathlib import Path
from datetime import datetime, timezone

from flask import Flask, request, jsonify, render_template, send_from_directory, Response, stream_with_context
from dotenv import load_dotenv

# ─── Paths ────────────────────────────────────────────────────────────────────
from utils.paths import (
    APP_ROOT, CANONICAL_DIR, REFERENCES_DIR, SESSIONS_DIR,
    CAPTURES_DIR, EXPORTS_DIR, PROJECTS_DIR, WRITING_DIR, SETTINGS_PATH, BROADCAST_URL
)

# ─── Bootstrap — load setup.env (visible), fall back to .env (legacy) ────────
setup_env = APP_ROOT / "setup.env"
dot_env   = APP_ROOT / ".env"
if setup_env.exists():
    load_dotenv(setup_env)
elif dot_env.exists():
    load_dotenv(dot_env)

KEYS = {
    "gemini":     os.getenv("GOOGLE_API_KEY"),
    "anthropic":  os.getenv("ANTHROPIC_API_KEY"),
    "openai":     os.getenv("OPENAI_API_KEY"),
}

OLLAMA_BASE = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")

# Research PDF folder — configurable in setup.env, defaults to ~/Documents/Research/PDFs/
_research_pdf_path = os.getenv("RESEARCH_PDF_PATH", "")
RESEARCH_PDF_DIR = Path(_research_pdf_path).expanduser() if _research_pdf_path else Path.home() / "Documents" / "Research" / "PDFs"

# Backup folder — configurable in setup.env as MARGINALIA_BACKUP_PATH.
# Defaults to ~/Documents/Marginalia Backups/ if not set.
# Primary safety net -- always local, always succeeds, no auth, no network.
# Git is developer-only, opt-in, secondary. Set MARGINALIA_GIT_ENABLED=true in setup.env.
_backup_path = os.getenv("MARGINALIA_BACKUP_PATH", "")
BACKUP_DIR = Path(_backup_path).expanduser() if _backup_path else Path.home() / "Documents" / "Marginalia Backups"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)
GIT_ENABLED = os.getenv("MARGINALIA_GIT_ENABLED", "").lower() == "true"

# If OLLAMA_MODELS_PATH is set in setup.env, inject it into the environment
# so Ollama finds models on external drives (e.g. Vault SSD on Mac Mini)
_ollama_models_path = os.getenv("OLLAMA_MODELS_PATH", "")
if _ollama_models_path:
    os.environ["OLLAMA_MODELS"] = _ollama_models_path

for d in [REFERENCES_DIR, SESSIONS_DIR, CAPTURES_DIR, EXPORTS_DIR, PROJECTS_DIR, WRITING_DIR, APP_ROOT / "db", APP_ROOT / "canonical" / "notes"]:
    d.mkdir(parents=True, exist_ok=True)

NOTES_DIR = APP_ROOT / "canonical" / "notes"

# ─── Version ──────────────────────────────────────────────────────────────────
APP_VERSION = "1.7.2.0828-0311"



# ─── App ──────────────────────────────────────────────────────────────────────
app = Flask(__name__, template_folder="templates", static_folder="static")
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024

# ─── Token tracking ───────────────────────────────────────────────────────────
anthropic_tokens = {"input": 0, "output": 0}
_tokens_lock = threading.Lock()

def estimate_anthropic_cost(input_tokens: int, output_tokens: int) -> float:
    return (input_tokens / 1_000_000 * 0.80) + (output_tokens / 1_000_000 * 4.00)

# ─── Settings ─────────────────────────────────────────────────────────────────
def load_settings():
    if SETTINGS_PATH.exists():
        return json.loads(SETTINGS_PATH.read_text())
    return {}

def save_settings(data):
    SETTINGS_PATH.write_text(json.dumps(data, indent=2))

# ─── Canonical file helpers ───────────────────────────────────────────────────
def write_canonical_reference(data: dict) -> Path:
    """
    Write a reference as a plain markdown file with YAML frontmatter.

    Why markdown, not a database:
    - Human-readable and editable with any text editor
    - Researcher owns the files — not locked to Marginalia
    - Works with Obsidian, VS Code, git diff, grep
    - Survives software rot: markdown will be readable in 20 years
    - The instrument is a guest in the researcher's files, not the landlord

    File naming: LastName_Year_slug.md
    The slug is derived from the first 3 words of the title.
    This makes files sortable, scannable, and meaningful at a glance.
    """
    ref_id = data.get("id") or str(uuid.uuid4())
    data["id"] = ref_id
    first_author = data.get("authors", "Unknown").split(";")[0].split(",")[0].strip()
    year = data.get("year", "0000")
    title_slug = "-".join(data.get("title", "untitled").lower().split()[:3])
    title_slug = "".join(c for c in title_slug if c.isalnum() or c == "-")
    filename = f"{first_author}_{year}_{title_slug}.md"

    abstract     = data.get("abstract") or "<!-- Machine-fetched abstract — use Enrich from Index to populate -->"
    annotation   = data.get("annotation") or "<!-- AI annotation — run Generate to populate -->"
    user_notes   = data.get("user_notes") or "<!-- Your own critical reading of this source -->"
    argument     = data.get("argument_connection") or "<!-- How does this source support, complicate, or challenge your research argument? -->"

    # Single keywords field — replaces separate tags + themes.
    # Plain comma-separated: enactment, polyvagal theory, embodied cognition
    # Merges from any legacy tags or themes fields on import
    keywords = data.get("keywords", "") or data.get("tags", "") or data.get("themes", "")

    connections_raw = data.get("connections", "")
    if connections_raw:
        conn_lines = connections_raw
    else:
        conn_lines = "<!-- Connections to writing/projects: slug | note -->"

    canonical = f"""---
id: {ref_id}
title: {data.get("title", "")}
authors: {data.get("authors", "")}
year: {data.get("year", "")}
source_type: {data.get("source_type", "other")}
url_doi: {data.get("url_doi", "")}
verification_status: {data.get("verification_status", "surfaced")}
reading_status: {data.get("reading_status", "unread")}
physical_holding: {data.get("physical_holding", "none")}
holding_location: {data.get("holding_location", "")}
keywords: {keywords}
needs_review: {str(data.get("needs_review", True)).lower()}
created_at: {datetime.now(timezone.utc).isoformat()}
updated_at: {datetime.now(timezone.utc).isoformat()}
---

## Connections
{conn_lines}

## Abstract
{abstract}

## Annotation
{annotation}

## Argument Connection
{argument}

## Your Notes
{user_notes}
"""
    filepath = REFERENCES_DIR / filename

    # De-dupe check: warn if a file with this name already exists
    # (same first author + year + title slug = likely duplicate)
    if filepath.exists():
        # Append a short uuid fragment to avoid silent overwrite
        dedup_suffix = str(uuid.uuid4())[:6]
        filename     = f"{first_author}_{year}_{title_slug}_{dedup_suffix}.md"
        filepath     = REFERENCES_DIR / filename
        import logging
        logging.warning(f"Duplicate reference detected — saving as {filename}")

    filepath.write_text(canonical, encoding="utf-8")
    return filepath


def normalise_slug_project(raw: str) -> str:
    """Lowercase, replace spaces and hyphens with underscores. For project slugs."""
    import re
    s = raw.strip().lower()
    s = re.sub(r'[\s\-]+', '_', s)
    s = re.sub(r'[^a-z0-9_]', '', s)
    return s

def normalise_slug_writing(raw: str) -> str:
    """Lowercase, replace spaces and underscores with hyphens. For writing slugs."""
    import re
    s = raw.strip().lower()
    s = re.sub(r'[\s_]+', '-', s)
    s = re.sub(r'[^a-z0-9\-]', '', s)
    return s

def normalise_keywords(raw: str) -> str:
    """Lowercase, trim each keyword, replace spaces within keyword with hyphens."""
    import re
    parts = [k.strip() for k in raw.split(',') if k.strip()]
    cleaned = []
    for p in parts:
        p = p.lower()
        p = re.sub(r'\s+', '-', p)
        p = re.sub(r'[^a-z0-9\-]', '', p)
        if p:
            cleaned.append(p)
    return ', '.join(cleaned)



    """Strip JATS XML tags from abstract text returned by academic APIs.
    Publishers wrap abstracts in <jats:p>, <jats:italic> etc. which come
    through raw from Semantic Scholar and OpenAlex."""
    import re
    # Remove all <jats:*> and </jats:*> tags
    text = re.sub(r'</?jats:[^>]+>', '', text)
    # Remove any other XML/HTML tags that slip through
    text = re.sub(r'<[^>]+>', '', text)
    # Collapse multiple spaces/newlines
    text = re.sub(r'\s+', ' ', text).strip()
    return text



    """
    Write a session as a plain markdown file.

    Sessions are the researcher's thinking record — not a log, not telemetry.
    They are meant to be read, annotated, and connected to other canonical files.
    The markdown format means a researcher can open any session file and read it
    as a document, not decode it as a database record.

    The `project` and `notes` fields in frontmatter enable the Intelligence tab
    to filter sessions by project scope and surface connections to deep read notes.
    The `title` field is auto-generated from prompt keywords + synthesis concepts
    so sessions are navigable without opening the full file.
    """

    SESSION_STOP = {
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
        "here","okay","others","whether","furthermore","provided","offered",
        "regarding","points","medium","high","while","within","across","important",
        "valuable","significant","relevant","interesting","useful","summarize",
        "summary","following","prompts","responses","critical","critically",
        "word","words","given","finally","briefly","comment","distill",
    }
    CONCEPT_STOP = {
        "consensus","divergence","unique","contributions","absent","voices",
        "survived","destabilized","unresolved","unasked","examiner","survey",
        "pressure","synthesis","model","research","study","response","question",
        "argument","approach","framework","perspective","analysis","evidence",
        "context","section","overall","similarly","however","therefore",
        "specifically","generally","simply","directly","currently","none",
        "analytical","adds","gaps","notes","neither","explicitly","another",
        "source","argues","elaborates","several","most","provides","bond",
        "alignment","gauge","mortar","brick","masonry","course","standard",
        "suggests","states","claims","shows","finds","okay","others","whether",
        "furthermore","provided","offered","regarding","medium","high","here",
        # Model names
        "gemini","deepseek","qwen","mistral","cohere","gemma","llama","claude",
        "openai","anthropic","chatgpt",
    }

    # Build title from prompt keywords and synthesis concepts
    # Wrapped in try/except — extraction failure must never prevent session save
    title = ""
    try:
        import re as _re
        blocks = prompt.split("+++")
        final_block = blocks[-1].strip() if blocks else prompt
        kw_tokens = _re.findall(r'\b[a-zA-Z]{4,}\b', final_block.lower())
        seen, keywords = set(), []
        for w in kw_tokens:
            if w not in SESSION_STOP and w not in seen:
                seen.add(w); keywords.append(w)
            if len(keywords) >= 5:
                break
        concepts = []
        if synthesis:
            c_tokens = _re.findall(r'\b[A-Z][a-z]{3,}\b', synthesis)
            freq = {}
            for t in c_tokens:
                tl = t.lower()
                if tl not in SESSION_STOP and tl not in CONCEPT_STOP:
                    freq[tl] = freq.get(tl, 0) + 1
            concepts = [t for t, _ in sorted(freq.items(), key=lambda x: -x[1])[:3]]
        ts_short = datetime.now(timezone.utc).strftime("%Y%m%d")
        kw_part  = " ".join(keywords[:4]) if keywords else "session"
        title    = kw_part
        if concepts:
            title += " \u2014 " + ", ".join(concepts)
        title += f" ({ts_short})"
    except Exception:
        title = datetime.now(timezone.utc).strftime("session-%Y%m%d-%H%M")

    session_id    = str(uuid.uuid4())
    timestamp     = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M")
    filename      = f"session_{timestamp}.md"
    prompt_label  = prompt.strip().replace("\n", " ")[:80]
    response_blocks = "\n\n".join(
        f"### {model.capitalize()}\n{text}" for model, text in responses.items() if text
    )
    synth_block = synthesis if synthesis else "<!-- Add synthesis notes here -->"
    canonical = f"""---
id: {session_id}
title: {title}
created_at: {datetime.now(timezone.utc).isoformat()}
models: {list(responses.keys())}
project: {project}
writing: {writing}
notes: {notes}
tags:
prompt_label: {prompt_label}
---

## Prompt
{prompt}

## Responses
{response_blocks}

## Synthesis
{synth_block}
"""
    filepath = SESSIONS_DIR / filename
    try:
        filepath.write_text(canonical, encoding="utf-8")
    except Exception as e:
        import sys
        print(f"SESSION WRITE FAILED: {e}", file=sys.stderr, flush=True)
        raise
    return filepath


def read_all_references() -> list:
    refs = []
    for filepath in sorted(REFERENCES_DIR.glob("*.md")):
        try:
            text = filepath.read_text(encoding="utf-8")
            if text.startswith("---"):
                parts = text.split("---", 2)
                if len(parts) >= 3:
                    meta = {}
                    for line in parts[1].strip().splitlines():
                        if ": " in line:
                            k, v = line.split(": ", 1)
                            meta[k.strip()] = v.strip()
                    meta["_filename"] = filepath.name
                    body = parts[2]
                    def extract_section(body, heading):
                        if "## " + heading in body:
                            raw = body.split("## " + heading)[1].split("\n## ")[0].strip()
                            if raw and not raw.startswith("<!--"):
                                return raw
                        return ""
                    meta["abstract"]             = extract_section(body, "Abstract")
                    meta["annotation"]          = extract_section(body, "Annotation")
                    meta["argument_connection"] = extract_section(body, "Argument Connection")
                    meta["user_notes"]           = extract_section(body, "Your Notes")
                    meta["connections"]          = extract_section(body, "Connections")

                    # Collapse legacy tags/themes into single keywords field
                    # Priority: keywords > tags > themes (body section)
                    if not meta.get("keywords"):
                        legacy_tags   = meta.get("tags", "")
                        legacy_themes = meta.get("themes", "") or extract_section(body, "Themes") or ""
                        meta["keywords"] = legacy_tags or legacy_themes
                    meta["keywords_list"] = [k.strip() for k in meta.get("keywords","").split(",") if k.strip()]
                    meta["conn_list"]  = [ln.strip() for ln in (meta["connections"] or "").splitlines() if ln.strip() and not ln.strip().startswith("<!--")]
                    status_hist = extract_section(body, "Status History")
                    if status_hist:
                        lines = [l.strip() for l in status_hist.splitlines() if l.strip() and not l.startswith("<!--")]
                        meta["last_status_change"] = lines[-1].lstrip("- ").strip() if lines else ""
                    else:
                        meta["last_status_change"] = ""
                    edit_hist = extract_section(body, "Edit History")
                    if edit_hist:
                        lines = [l.strip() for l in edit_hist.splitlines() if l.strip() and not l.startswith("<!--")]
                        meta["last_edit"] = lines[-1].lstrip("- ").strip() if lines else ""
                    else:
                        meta["last_edit"] = ""
                    refs.append(meta)
        except Exception:
            pass
    return refs


def call_ollama(model_str: str, prompt: str, unload_after: bool = True, num_predict: int = -1) -> str:
    import urllib.request as _ur
    payload = json.dumps({
        "model":      model_str,
        "prompt":     prompt,
        "stream":     False,
        "keep_alive": 0 if unload_after else "5m",
        "options":    {"num_predict": num_predict} if num_predict > 0 else {}
    }).encode()
    req = _ur.Request(f"{OLLAMA_BASE}/api/generate", data=payload, headers={"Content-Type": "application/json"})
    with _ur.urlopen(req, timeout=300) as r:
        return json.loads(r.read()).get("response", "")


def run_synthesis(prompt: str, responses: dict, synthesis_model: str = "deepseek", synth_mode: str = "survey") -> str:
    settings  = load_settings()
    local_cfg = settings.get("models", {}).get("local", {})
    model_map = {
        "deepseek": local_cfg.get("reasoning",  "deepseek-r1:8b"),
        "qwen":     local_cfg.get("asia",       "qwen2.5:14b"),
        "mistral":  local_cfg.get("europe",     "mistral:7b"),
        "gemma":    local_cfg.get("multimodal", "gemma4:latest"),
        "llama":    local_cfg.get("general",    "llama3.1:8b"),
        "cohere":   local_cfg.get("canadian",   "command-r7b:latest"),
    }
    model_str = model_map.get(synthesis_model, local_cfg.get("reasoning", "deepseek-r1:8b"))

    # Strip <think>...</think> reasoning chains before synthesis
    # DeepSeek R1 exposes chain-of-thought in <think> tags — useful for the
    # researcher's own response cards but noise in synthesis input.
    import re as _re
    def strip_think(text: str) -> str:
        return _re.sub(r'<think>.*?</think>', '', text, flags=_re.DOTALL).strip()

    # Build response block with actual model names — explicit so synthesis
    # model cannot invent labels. The model names in brackets ARE the names
    # the synthesis must use when attributing claims.
    model_names = list(responses.keys())
    response_block = "\n\n".join(
        f"[{model.upper()}]\n{strip_think(text)}"
        for model, text in responses.items() if text
    )
    names_list = ", ".join(m.upper() for m in model_names)

    if synth_mode == "prompt_pressure":
        # Prompt Pressure Test — examines the researcher's position before firing.
        # Target is the argument being made, not the generic shape of the question.
        # The +++ separator layers are deliberate context stacking — read them as
        # evidence of the researcher's existing thinking, not as padding.
        # Do not produce rubric output. Do not assume ignorance.
        # Find where the argument is weakest and push there specifically.
        synth_prompt = f"""You are a dissertation examiner who has read this researcher's work before. You are not introducing yourself to their ideas — you are pressure-testing an argument you already know is sophisticated.

The researcher may have used +++ to stack context layers. Everything before the last +++ is prior thinking they are bringing into this prompt. Read it as evidence of what they already know. Do not tell them what they already know.

RESEARCHER'S PROMPT (with any context layers):
{prompt}

Your job: find the load-bearing assumptions in this specific argument and push on the ones most likely to crack. Do not list generic gaps. Do not explain what academic rigour requires in the abstract. Engage with what is actually being claimed here.

Output exactly three sections. No preamble. No numbered lists. No meta-commentary. Write in direct prose — one or two sharp sentences per point, not a rubric.

## ASSUMED
What is this argument taking for granted that it cannot afford to take for granted? Name the specific assumption and why it is doing too much work here.

## UNASKED
What question does this argument most need to answer that it is currently avoiding? Not what is generically missing — what would destabilise this specific claim if left unaddressed.

## EXAMINER CHALLENGES
What would an examiner who knows this field say to this researcher's face — not to a generic student? What is the sharpest, most specific pushback on the argument as constructed?

Three sections only. No preamble. Be the examiner who has read the work, not the one who hasn't."""

    elif synth_mode == "pressure":
        synth_prompt = f"""You are a research pressure-tester. A researcher brought a half-formed idea and sent it through multiple AI models. Your job is not to summarize — assess what happened to the idea.

IMPORTANT: The models that responded are: {names_list}
When attributing a claim, use ONLY these names. Do not invent labels like CONVERSUS, COUNTERPOINTS, or ABSTRACT.
Output exactly three sections with these exact headers. No preamble. No restarts. No meta-commentary.

RESEARCHER'S PROMPT:
{prompt}

MODEL RESPONSES:
{response_block}

## SURVIVED
What held up under scrutiny across multiple responses? What did the models reinforce or leave standing?

## DESTABILIZED
What got contradicted, complicated, or weakened? Name which model (from {names_list}) challenged what.

## STILL OPEN
What remains genuinely unresolved? What did none of the models reach?

Be direct. No preamble. Output the three ## sections only."""

    else:
        synth_prompt = f"""You are a research synthesis engine. A researcher asked a question and received responses from multiple AI models. Synthesize into a single analytical summary.

IMPORTANT: The models that responded are: {names_list}
When attributing a claim, use ONLY these exact names. Do not invent labels like CONVERSUS, COUNTERPOINTS, ABSTRACT, PERFORMANCE, or CONVERSATION.
Output exactly four sections with these exact headers. No preamble. No restarts. No meta-commentary. No "Okay, here is..." introduction.

RESEARCHER'S QUESTION:
{prompt}

MODEL RESPONSES:
{response_block}

## CONSENSUS
What do the models agree on?

## DIVERGENCE
Where do they differ? Name which model (from {names_list}) said what.

## UNIQUE CONTRIBUTIONS
What does each model add that others missed? Name each model from {names_list}.

## ABSENT VOICES
What important angles did none of the models address?

Output the four ## sections only. No preamble. No restarts."""

    try:
        raw = call_ollama(model_str, synth_prompt)
        # Strip any <think> tags that leak into synthesis output itself
        return strip_think(raw)
    except Exception as e:
        return f"Synthesis unavailable — {synthesis_model} error: {e}"


# ─── Import parsers ───────────────────────────────────────────────────────────

def parse_csv_import(text: str) -> list:
    records = []
    reader = csv.DictReader(io.StringIO(text))
    field_map = {
        "title": ["title"], "authors": ["authors", "author"],
        "year": ["year"], "source_type": ["source_type", "type", "sourcetype"],
        "url_doi": ["url_doi", "doi", "url"],
        "verification_status": ["verification_status", "status"],
        "physical_holding": ["physical_holding", "holding"],
        "holding_location": ["holding_location", "location"],
        "annotation": ["annotation", "notes", "abstract"],
        "argument_connection": ["argument_connection", "argument"],
        "tags": ["tags", "keywords"],
        "themes": ["themes", "subject"],
        "connections": ["connections", "projects"],
    }
    for row in reader:
        if not any(row.values()):
            continue
        norm = {k.lower().strip(): v for k, v in row.items()}
        rec = {}
        for canonical_key, aliases in field_map.items():
            for alias in aliases:
                if alias in norm and norm[alias].strip():
                    rec[canonical_key] = norm[alias].strip()
                    break
        if rec.get("title"):
            records.append(rec)
    return records


def parse_bibtex_import(text: str) -> list:
    # Fix: note/annote → ## Your Notes (Claude annotations land here),
    # abstract → ## Abstract. Multi-line values handled properly.
    try:
        import bibtexparser
        db = bibtexparser.loads(text)
    except ImportError:
        return _parse_bibtex_minimal(text)
    type_map = {
        "article": "journal article", "book": "book", "inbook": "chapter",
        "incollection": "chapter", "inproceedings": "conference paper",
        "proceedings": "conference paper", "phdthesis": "thesis",
        "mastersthesis": "thesis", "misc": "other", "techreport": "other",
    }
    records = []
    for entry in db.entries:
        authors_raw = entry.get("author", "")
        authors = "; ".join(a.strip() for a in authors_raw.split(" and ")) if authors_raw else ""
        abstract = strip_jats(entry.get("abstract", "").strip())
        note     = (entry.get("note", "") or entry.get("annote", "")).strip()
        if note:
            note = f"<!-- [import] BibTeX note field — review and edit -->\n\n{note}"
        truncated = (note and len(note) > 50 and note[-1] not in '.!?') or                     (abstract and len(abstract) > 50 and abstract[-1] not in '.!?')
        rec = {
            "title":        entry.get("title", "").replace("{", "").replace("}", ""),
            "authors":      authors,
            "year":         entry.get("year", ""),
            "source_type":  type_map.get(entry.get("ENTRYTYPE", "").lower(), "other"),
            "url_doi":      entry.get("doi", "") or entry.get("url", ""),
            "abstract":     abstract,
            "user_notes":   note,
            "keywords":     normalise_keywords(entry.get("keywords", "")),
            "needs_review": truncated,
        }
        if rec["title"]:
            records.append(rec)
    return records


def _parse_bibtex_minimal(text: str) -> list:
    # Handles multi-line field values by tracking brace depth — previous regex
    # version stopped at first newline, silently truncating Claude annotations.
    import re
    records = []
    entries = re.findall(r'@\w+\{[^@]+', text, re.DOTALL)
    for entry in entries:
        def field(name):
            m = re.search(rf'{name}\s*=\s*\{{', entry, re.IGNORECASE)
            if m:
                start = m.end()
                depth, i = 1, start
                while i < len(entry) and depth > 0:
                    if entry[i] == '{': depth += 1
                    elif entry[i] == '}': depth -= 1
                    i += 1
                val = entry[start:i-1].strip()
                return re.sub(r'\s+', ' ', val)
            m2 = re.search(rf'{name}\s*=\s*"([^"]*)"', entry, re.IGNORECASE | re.DOTALL)
            return re.sub(r'\s+', ' ', m2.group(1).strip()) if m2 else ""
        authors_raw = field("author")
        authors = "; ".join(a.strip() for a in authors_raw.split(" and ")) if authors_raw else ""
        abstract = strip_jats(field("abstract").strip())
        note     = (field("note") or field("annote")).strip()
        if note:
            note = f"<!-- [import] BibTeX note field — review and edit -->\n\n{note}"
        truncated = (note and len(note) > 50 and note[-1] not in '.!?') or                     (abstract and len(abstract) > 50 and abstract[-1] not in '.!?')
        rec = {
            "title":        field("title").replace("{","").replace("}",""),
            "authors":      authors,
            "year":         field("year"),
            "url_doi":      field("doi") or field("url"),
            "abstract":     abstract,
            "user_notes":   note,
            "keywords":       field("keywords"),
            "needs_review": truncated,
        }
        if rec["title"]:
            records.append(rec)
    return records

def parse_ris_import(text: str) -> list:
    type_map = {"JOUR": "journal", "BOOK": "book", "CHAP": "chapter", "CONF": "conference", "THES": "thesis", "RPRT": "other", "ELEC": "web", "GEN": "other"}
    records, current, authors = [], {}, []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line == "ER  -":
            if current.get("title"):
                current["authors"] = "; ".join(authors)
                records.append(current)
            current, authors = {}, []
            continue
        if len(line) < 6 or line[2:6] != "  - ":
            continue
        tag, val = line[:2].strip(), line[6:].strip()
        if tag == "TY":   current["source_type"] = type_map.get(val, "other")
        elif tag in ("TI","T1"): current["title"] = val
        elif tag in ("AU","A1","A2"): authors.append(val)
        elif tag in ("PY","Y1"): current["year"] = val[:4]
        elif tag == "DO": current["url_doi"] = val
        elif tag == "UR": current.setdefault("url_doi", val)
        elif tag == "AB": current["annotation"] = val
        elif tag == "KW": current["keywords"] = (current.get("keywords","") + ", " + val).strip(", ")
        elif tag == "N1": current["argument_connection"] = val
    return records


def lookup_doi(doi: str) -> dict:
    import urllib.request as _ur
    doi = doi.strip().lstrip("https://doi.org/").lstrip("http://doi.org/").lstrip("doi:")
    url = f"https://api.crossref.org/works/{doi}"
    try:
        req = _ur.Request(url, headers={"User-Agent": "Marginalia/0.9.2.5 (mailto:research@marginalia.local)"})
        with _ur.urlopen(req, timeout=10) as r:
            data = json.loads(r.read())
        msg = data.get("message", {})
        authors_list = msg.get("author", [])
        authors = "; ".join(f"{a.get('family','')}, {a.get('given','')}".strip(", ") for a in authors_list)
        year = ""
        date_parts = msg.get("published", msg.get("published-print", msg.get("published-online", {})))
        if date_parts and date_parts.get("date-parts"):
            year = str(date_parts["date-parts"][0][0])
        type_map = {"journal-article": "journal", "book": "book", "book-chapter": "chapter", "proceedings-article": "conference", "dissertation": "thesis"}
        titles = msg.get("title", [""])
        return {"title": titles[0] if titles else "", "authors": authors, "year": year, "source_type": type_map.get(msg.get("type",""), "other"), "url_doi": doi, "annotation": msg.get("abstract", "")}
    except Exception as e:
        return {"_error": str(e), "url_doi": doi}


# ─── API routes ───────────────────────────────────────────────────────────────



@app.route("/")
def index():
    from flask import make_response
    resp = make_response(render_template("index.html", app_version=APP_VERSION))
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp

@app.route("/api/settings", methods=["GET"])
def get_settings():
    return jsonify(load_settings())

@app.route("/api/settings", methods=["POST"])
def post_settings():
    save_settings(request.json)
    return jsonify({"status": "saved"})

@app.route("/api/references", methods=["GET"])
def get_references():
    return jsonify(read_all_references())

@app.route("/api/references", methods=["POST"])
def add_reference():
    filepath = write_canonical_reference(request.json)
    return jsonify({"status": "saved", "file": filepath.name})

@app.route("/api/token-usage", methods=["GET"])
def get_token_usage():
    cost = estimate_anthropic_cost(anthropic_tokens["input"], anthropic_tokens["output"])
    return jsonify({"input": anthropic_tokens["input"], "output": anthropic_tokens["output"], "cost_usd": round(cost, 4)})


@app.route("/api/import", methods=["POST"])
def import_references():
    records, parse_errors, fmt = [], [], None
    if request.files:
        file = request.files.get("file")
        if not file:
            return jsonify({"error": "No file received"}), 400
        filename = file.filename.lower()
        text = file.read().decode("utf-8", errors="replace")
        if filename.endswith(".csv"):    fmt, records = "csv",     parse_csv_import(text)
        elif filename.endswith(".bib"):  fmt, records = "bibtex",  parse_bibtex_import(text)
        elif filename.endswith(".ris"):  fmt, records = "ris",     parse_ris_import(text)
        else: return jsonify({"error": f"Unsupported file type: {filename}"}), 400
    elif request.is_json:
        body = request.json
        fmt  = body.get("format", "").lower()
        text = body.get("text", "")
        if fmt == "doi":
            dois = [d.strip() for d in text.replace(",", "\n").splitlines() if d.strip()]
            for doi in dois:
                result = lookup_doi(doi)
                if "_error" in result: parse_errors.append(f"{doi}: {result['_error']}")
                else: records.append(result)
        elif fmt == "csv":     records = parse_csv_import(text)
        elif fmt == "bibtex":  records = parse_bibtex_import(text)
        elif fmt == "ris":     records = parse_ris_import(text)
        elif fmt == "plaintext":
            settings  = load_settings()
            model_str = settings.get("models", {}).get("local", {}).get("reasoning", "deepseek-r1:8b")
            parse_prompt = f"""Parse the following reference list into JSON. Return ONLY a JSON array, no other text.
Each object must have: title, authors, year, source_type, url_doi, themes
authors = semicolon-separated. source_type = journal|book|chapter|conference|thesis|web|other

REFERENCE LIST:
{text}"""
            try:
                raw = call_ollama(model_str, parse_prompt).strip()
                if raw.startswith("```"): raw = "\n".join(raw.split("\n")[1:])
                if raw.endswith("```"):   raw = "\n".join(raw.split("\n")[:-1])
                records = json.loads(raw.strip())
            except Exception as e:
                parse_errors.append(f"Local model parse failed: {e}")
        else:
            return jsonify({"error": f"Unknown format: {fmt}"}), 400
    else:
        return jsonify({"error": "No file or JSON body received"}), 400

    imported, skipped = [], []
    for rec in records:
        if not rec.get("title"): skipped.append(rec); continue
        try:
            rec.setdefault("verification_status", "imported")
            rec.setdefault("reading_status", "unread")
            rec.setdefault("physical_holding", "none")
            imported.append(write_canonical_reference(rec).name)
        except Exception as e:
            parse_errors.append(str(e))

    if imported:
        log_path = SESSIONS_DIR / "imports.md"
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        log_entry = f"\n### {timestamp} — {fmt} import\n"
        log_entry += f"- Imported: {len(imported)}\n"
        if skipped:  log_entry += f"- Skipped (no title): {len(skipped)}\n"
        if parse_errors: log_entry += f"- Errors: {len(parse_errors)}\n"
        for f_name in imported[:10]:
            log_entry += f"  - {f_name}\n"
        if len(imported) > 10:
            log_entry += f"  - ... and {len(imported)-10} more\n"
        try:
            if log_path.exists():
                existing = log_path.read_text(encoding="utf-8")
                log_path.write_text(existing.rstrip() + "\n" + log_entry, encoding="utf-8")
            else:
                log_path.write_text(f"# Import Log\n{log_entry}", encoding="utf-8")
        except Exception:
            pass

    return jsonify({"format": fmt, "imported": len(imported), "skipped": len(skipped), "errors": parse_errors, "files": imported})


@app.route("/api/doi-lookup", methods=["POST"])
def doi_lookup():
    doi = request.json.get("doi", "")
    if not doi: return jsonify({"error": "No DOI provided"}), 400
    return jsonify(lookup_doi(doi))


@app.route("/api/setup-status", methods=["GET"])
def setup_status():
    has_any_cloud_key = any([
        bool(KEYS.get("gemini")),
        bool(KEYS.get("anthropic")),
        bool(KEYS.get("openai")),
    ])
    ollama_models_path = os.getenv("OLLAMA_MODELS_PATH", "")
    setup_file = "setup.env" if (APP_ROOT / "setup.env").exists() else ".env"
    return jsonify({
        "configured":        has_any_cloud_key,
        "has_gemini":        bool(KEYS.get("gemini")),
        "has_anthropic":     bool(KEYS.get("anthropic")),
        "has_openai":        bool(KEYS.get("openai")),
        "has_ollama_path":   bool(ollama_models_path),
        "ollama_models_path": ollama_models_path,
        "setup_file":        setup_file,
        "setup_file_path":   str(APP_ROOT / setup_file),
    })


@app.route("/api/local-models", methods=["GET"])
def get_local_models():
    import urllib.request as _ur
    LOCAL_MODEL_MAP = {
        "deepseek": ["deepseek-r1"],
        "qwen":     ["qwen2.5", "qwen"],
        "mistral":  ["mistral"],
        "gemma":    ["gemma4", "gemma"],
        "llama":    ["llama3.1", "llama3", "llama"],
        "cohere":   ["command-r7b", "command-r"],
    }
    installed = {}
    try:
        req = _ur.Request(f"{OLLAMA_BASE}/api/tags", headers={"Content-Type": "application/json"})
        with _ur.urlopen(req, timeout=5) as r:
            data = json.loads(r.read())
        ollama_models = {m["name"]: m for m in data.get("models", [])}
        claimed_ollama_names = set()
        for chip_key, prefixes in LOCAL_MODEL_MAP.items():
            found = None
            for name, info in ollama_models.items():
                for prefix in prefixes:
                    if name.startswith(prefix):
                        found = {"installed": True, "model_str": name, "size_gb": round(info.get("size", 0) / 1e9, 1)}
                        claimed_ollama_names.add(name)
                        break
                if found:
                    break
            installed[chip_key] = found or {"installed": False, "model_str": None, "size_gb": 0}
        for name, info in ollama_models.items():
            if name not in claimed_ollama_names:
                chip_key = "ollama:" + name
                installed[chip_key] = {"installed": True, "model_str": name, "size_gb": round(info.get("size", 0) / 1e9, 1), "dynamic": True}
    except Exception as e:
        for chip_key in LOCAL_MODEL_MAP:
            installed[chip_key] = {"installed": None, "model_str": None, "size_gb": 0, "error": str(e)}
    return jsonify(installed)


@app.route("/api/key-status", methods=["GET"])
def key_status():
    return jsonify({
        "gemini":    bool(KEYS.get("gemini")),
        "anthropic": bool(KEYS.get("anthropic")),
        "openai":    bool(KEYS.get("openai")),
        "deepseek":  True,
        "gemma":     True,
        "llama":     True,
        "qwen":      True,
        "mistral":   True,
        "cohere":    True,
    })


def call_model(model, prompt, num_predict=-1):
    # Researcher context block — loaded from settings, set once by the researcher.
    # Tells the council who they're talking to and what kind of response is useful.
    # Without this block the council defaults to assistant mode regardless of synthesis mode.
    settings = load_settings()
    researcher_context = settings.get("researcher_context", "").strip()
    disposition = settings.get("disposition", "balance")
    disposition_instructions = {
        "build":     "Your role is generative — build on the researcher's ideas, extend connections, find supporting threads. Be constructive and expansive.",
        "balance":   "Your role is balanced — engage honestly with the argument, note both where it holds and where it needs work.",
        "challenge": "Your role is adversarial — find the weakest point in the argument and press it. Surface what's missing. Do not validate.",
    }
    disposition_text = disposition_instructions.get(disposition, disposition_instructions["balance"])

    word_count_map = {
        75:  "Respond in approximately 50 words or less.",
        300: "Respond in approximately 200 words or less.",
        750: "Respond in approximately 500 words or less.",
    }
    word_limit = word_count_map.get(num_predict, "")

    STYLE_PREAMBLE = (
        "Begin your response with substantive content. "
        "Do not open with affirmations, compliments, or observations about the quality of the question. "
        "Respond in plain prose. Do not use markdown headers (##, ###), bullet points, numbered lists, "
        "or bold/italic formatting unless the content is genuinely a list or requires code blocks. "
        "Write as if corresponding with a peer researcher, not tutoring a student."
        + (f" {word_limit}" if word_limit else "")
        + f"\n\nDISPOSITION: {disposition_text}"
        + "\n\n"
        + (f"RESEARCHER CONTEXT: {researcher_context}\n\n" if researcher_context else "")
    )
    prompt = STYLE_PREAMBLE + prompt
    settings  = load_settings()
    local_cfg = settings.get("models", {}).get("local", {})
    try:
        if model == "gemini" and KEYS.get("gemini"):
            try:
                from google import genai as google_genai
                client = google_genai.Client(api_key=KEYS["gemini"])
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt,
                )
                return (model, response.text, None, 0, 0)
            except ImportError:
                # Fallback to legacy library
                import google.generativeai as genai
                genai.configure(api_key=KEYS["gemini"])
                try:
                    r = genai.GenerativeModel("gemini-3.6-flash").generate_content(prompt, request_options={"timeout": 60})
                    return (model, r.text, None, 0, 0)
                except Exception as e:
                    err_str = str(e)
                    if "504" in err_str or "timeout" in err_str.lower() or "DeadlineExceeded" in err_str:
                        return (model, None, "Gemini timed out (504) — try again or use local models only", 0, 0)
                    return (model, None, f"Gemini error: {err_str[:120]}", 0, 0)
            except Exception as e:
                err_str = str(e)
                if "504" in err_str or "timeout" in err_str.lower() or "DeadlineExceeded" in err_str:
                    return (model, None, "Gemini timed out (504) — try again or use local models only", 0, 0)
                return (model, None, f"Gemini error: {err_str[:120]}", 0, 0)
        elif model == "anthropic" and KEYS.get("anthropic"):
            import anthropic as _anth
            client = _anth.Anthropic(api_key=KEYS["anthropic"])
            msg = client.messages.create(model="claude-haiku-4-5", max_tokens=1024,
                                         messages=[{"role": "user", "content": prompt}])
            return (model, msg.content[0].text, None, msg.usage.input_tokens, msg.usage.output_tokens)
        elif model == "openai" and KEYS.get("openai"):
            from openai import OpenAI
            client = OpenAI(api_key=KEYS["openai"])
            r = client.chat.completions.create(model="gpt-4o", messages=[{"role": "user", "content": prompt}])
            return (model, r.choices[0].message.content, None, 0, 0)
        elif model == "deepseek":
            return (model, call_ollama(local_cfg.get("reasoning", "deepseek-r1:8b"), prompt), None, 0, 0)
        elif model == "gemma":
            return (model, call_ollama(local_cfg.get("multimodal", "gemma4:latest"), prompt), None, 0, 0)
        elif model == "llama":
            return (model, call_ollama(local_cfg.get("general", "llama3.1:8b"), prompt), None, 0, 0)
        elif model == "qwen":
            return (model, call_ollama(local_cfg.get("asia", "qwen2.5:14b"), prompt), None, 0, 0)
        elif model == "mistral":
            return (model, call_ollama(local_cfg.get("europe", "mistral:7b"), prompt), None, 0, 0)
        elif model == "cohere":
            return (model, call_ollama(local_cfg.get("canadian", "command-r7b:latest"), prompt), None, 0, 0)
        elif model.startswith("ollama:"):
            return (model, call_ollama(model[len("ollama:"):], prompt), None, 0, 0)
        else:
            return (model, None, "No key configured", 0, 0)
    except Exception as e:
        return (model, None, str(e), 0, 0)


MODEL_ORDER  = ["gemini", "anthropic", "openai", "deepseek", "qwen", "mistral", "cohere", "gemma", "llama"]
CLOUD_MODELS = {"gemini", "anthropic", "openai"}
LOCAL_MODELS = {"deepseek", "gemma", "llama", "qwen", "mistral", "cohere"}


@app.route("/api/prompt", methods=["POST"])
def handle_prompt():
    global anthropic_tokens
    data            = request.json
    prompt          = data.get("prompt", "")
    synthesis_ctx   = data.get("synthesis_context", "").strip()
    if synthesis_ctx:
        prompt = f"[SYNTHESIS CONTEXT — generated by previous model pass]\n{synthesis_ctx}\n\n+++\n\n{prompt}"
    models          = data.get("models", [])
    synthesis_model = data.get("synthesis_model", "deepseek")
    synth_mode      = data.get("synth_mode", "survey")
    num_predict     = int(data.get("num_predict", 75))
    project_tag     = data.get("project", "")
    writing_tag     = data.get("writing", "")
    # Per-request disposition override — saves to settings so call_model picks it up
    req_disposition = data.get("disposition", "").strip()
    if req_disposition in ("build", "balance", "challenge"):
        s = load_settings(); s["disposition"] = req_disposition; save_settings(s)
    full_prompt     = data.get("full_prompt", prompt)

    # ── Minimal session save — fires immediately before any model calls ────────
    # The prompt is the research gesture. If the stream dies (timeout, disconnect,
    # crash), the spark is captured and the session exists for review and re-fire.
    # Responses and synthesis are written back progressively as they arrive.
    early_session_path = None
    try:
        early_session_path = write_canonical_session(
            full_prompt, {}, "",
            project=project_tag, writing=writing_tag
        )
    except Exception as e:
        import sys
        print(f"EARLY SESSION WRITE FAILED: {e}", file=sys.stderr, flush=True)
    # ──────────────────────────────────────────────────────────────────────────

    dynamic_local = [m for m in models if m.startswith("ollama:")]
    cloud_ordered = [m for m in MODEL_ORDER if m in models and m in CLOUD_MODELS]
    local_ordered = [m for m in MODEL_ORDER if m in models and m in LOCAL_MODELS] + dynamic_local

    def generate():
        import concurrent.futures
        results, errors = {}, {}

        if cloud_ordered:
            for m in cloud_ordered:
                yield json.dumps({"event": "start", "model": m}) + "\n"
            with concurrent.futures.ThreadPoolExecutor() as ex:
                futures = {ex.submit(call_model, m, prompt, num_predict): m for m in cloud_ordered}
                for future in concurrent.futures.as_completed(futures):
                    try:
                        model, result, error, in_tok, out_tok = future.result()
                    except Exception as e:
                        model = futures[future]
                        yield json.dumps({"event": "error", "model": model, "error": str(e)}) + "\n"
                        continue
                    if in_tok:
                        with _tokens_lock:
                            anthropic_tokens["input"]  += in_tok
                            anthropic_tokens["output"] += out_tok
                    if result:
                        results[model] = result
                        yield json.dumps({"event": "result", "model": model, "text": result}) + "\n"
                    else:
                        # Surface rate limit errors clearly
                        err_msg = error or "No response"
                        if "429" in str(err_msg) or "quota" in str(err_msg).lower() or "rate" in str(err_msg).lower():
                            err_msg = "Rate limited — free tier quota exceeded. Add a paid key or retry later."
                        errors[model] = err_msg
                        yield json.dumps({"event": "error", "model": model, "error": err_msg}) + "\n"

        for model in local_ordered:
            global _prompt_cancel_flag
            if _prompt_cancel_flag:
                _prompt_cancel_flag = False  # reset for next run
                yield json.dumps({"event": "cancelled"}) + "\n"
                break
            yield json.dumps({"event": "start", "model": model}) + "\n"
            import time; time.sleep(0.05)
            yield json.dumps({"event": "heartbeat"}) + "\n"
            _, result, error, _, _ = call_model(model, prompt, num_predict)
            if result:
                results[model] = result
                yield json.dumps({"event": "result", "model": model, "text": result}) + "\n"
            else:
                errors[model] = error or "No response"
                yield json.dumps({"event": "error", "model": model, "error": errors[model]}) + "\n"

        synthesis = ""
        if len(results) > 1:
            yield json.dumps({"event": "synthesis_start"}) + "\n"
            synthesis = run_synthesis(prompt, results, synthesis_model=synthesis_model, synth_mode=synth_mode)
            yield json.dumps({"event": "synthesis", "text": synthesis}) + "\n"

        session_filename = None
        if results or early_session_path:
            try:
                if early_session_path and early_session_path.exists():
                    # Update the early session file with full responses and synthesis
                    updated_path = write_canonical_session(
                        full_prompt, results, synthesis,
                        project=project_tag, writing=writing_tag
                    )
                    # Remove the early stub and use the full version
                    if updated_path and updated_path != early_session_path:
                        early_session_path.unlink(missing_ok=True)
                    session_filename = (updated_path or early_session_path).name
                elif results:
                    saved_path = write_canonical_session(
                        full_prompt, results, synthesis,
                        project=project_tag, writing=writing_tag
                    )
                    session_filename = saved_path.name if saved_path else None
                else:
                    session_filename = early_session_path.name if early_session_path else None
            except Exception as e:
                import sys
                print(f"FINAL SESSION UPDATE FAILED: {e}", file=sys.stderr, flush=True)
                session_filename = early_session_path.name if early_session_path else None

        cost = estimate_anthropic_cost(anthropic_tokens["input"], anthropic_tokens["output"])
        yield json.dumps({
            "event":              "done",
            "session_saved":      bool(results),
            "session_filename":   session_filename,
            "anthropic_cost_usd": round(cost, 4),
        }) + "\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"}
    )


@app.route("/api/references/<ref_filename>", methods=["PUT"])
def update_reference(ref_filename):
    if "/" in ref_filename or "\\" in ref_filename or ".." in ref_filename:
        return jsonify({"error": "Invalid filename"}), 400
    filepath = (REFERENCES_DIR / ref_filename).resolve()
    if REFERENCES_DIR.resolve() not in filepath.parents:
        return jsonify({"error": "Invalid path"}), 400
    if not filepath.exists():
        return jsonify({"error": "Reference not found"}), 404

    data = request.json or {}
    text = filepath.read_text(encoding="utf-8")
    parts = text.split("---", 2)
    if len(parts) < 3:
        return jsonify({"error": "Invalid canonical format"}), 400

    meta = {}
    for line in parts[1].strip().splitlines():
        if ": " in line:
            k, v = line.split(": ", 1)
            meta[k.strip()] = v.strip()

    body = parts[2]
    def replace_section(body, heading, new_content):
        if not new_content:
            return body
        marker = "## " + heading
        if marker in body:
            before = body.split(marker)[0]
            rest   = body.split(marker)[1]
            after  = ("\n## " + rest.split("\n## ", 1)[1]) if "\n## " in rest else ""
            return before + marker + "\n" + new_content + "\n" + after
        else:
            return body.rstrip() + "\n\n" + marker + "\n" + new_content + "\n"

    def ensure_sections(body):
        for section in ["Connections", "Abstract", "Annotation", "Argument Connection", "Your Notes", "Edit History", "Status History"]:
            if "## " + section not in body:
                placeholder = {
                    "Themes": "<!-- Conceptual themes — full phrases, one per line as: - theme -->",
                    "Connections": "<!-- Connections to writing/projects: name | note -->",
                    "Abstract": "<!-- Machine-fetched abstract — use Enrich from Index to populate -->",
                    "Annotation": "<!-- AI annotation — run Generate to populate -->",
                    "Argument Connection": "<!-- How does this source support, complicate, or challenge your research argument? -->",
                    "Your Notes": "<!-- Your own critical reading of this source -->",
                }.get(section, "")
                if placeholder:
                    body = body.rstrip() + "\n\n## " + section + "\n" + placeholder + "\n"
        return body

    body = ensure_sections(body)
    if "abstract" in data and data["abstract"]:
        body = replace_section(body, "Abstract", data["abstract"])
        meta.pop("abstract", None)
    if "annotation" in data and data["annotation"]:
        body = replace_section(body, "Annotation", data["annotation"])
        meta.pop("annotation", None)
    if "argument_connection" in data and data["argument_connection"]:
        body = replace_section(body, "Argument Connection", data["argument_connection"])
        meta.pop("argument_connection", None)
    if "user_notes" in data and data["user_notes"]:
        body = replace_section(body, "Your Notes", data["user_notes"])
        meta.pop("user_notes", None)
    if "connections" in data and data["connections"]:
        body = replace_section(body, "Connections", data["connections"])
    # Write all tracked frontmatter fields from data into meta
    for field in ["title","authors","year","source_type","url_doi","physical_holding",
                  "holding_location","verification_status","reading_status","needs_review","keywords"]:
        if field in data:
            val = str(data[field]).strip() if data[field] is not None else ""
            if field == "keywords" and val:
                val = normalise_keywords(val)
            meta[field] = val

    # Remove legacy fields from frontmatter on save
    meta.pop("tags", None)
    meta.pop("themes", None)

    meta["updated_at"] = datetime.now(timezone.utc).isoformat()

    tracked = ["title","authors","year","source_type","url_doi","keywords","physical_holding","holding_location","verification_status","reading_status","needs_review"]
    changed = [f for f in tracked if f in data and str(data[f]).strip() != str(meta.get(f,"")).strip()]
    body_changed = [s for s in ["annotation","connections","argument_connection","user_notes"] if s in data and data[s]]
    all_changed = changed + body_changed
    if all_changed:
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        edit_line = f"- [{timestamp}] edited: {', '.join(all_changed)}"
        log_marker = "## Edit History"
        if log_marker in body:
            body = body.rstrip() + "\n" + edit_line + "\n"
        else:
            body = body.rstrip() + "\n\n" + log_marker + "\n" + edit_line + "\n"

    # Use "is not None and v != \"\"" rather than "if v" to preserve falsy values
    # like needs_review: false and reading_status: unread which are meaningful
    fm_lines = "\n".join(f"{k}: {v}" for k, v in meta.items() if v is not None and v != "")
    new_file = f"---\n{fm_lines}\n---\n{body}"
    filepath.write_text(new_file, encoding="utf-8")
    return jsonify({"status": "updated", "filename": ref_filename})


@app.route("/api/references/<ref_filename>", methods=["DELETE"])
def delete_reference(ref_filename):
    if "/" in ref_filename or "\\" in ref_filename or ".." in ref_filename:
        return jsonify({"error": "Invalid filename"}), 400
    filepath = (REFERENCES_DIR / ref_filename).resolve()
    if REFERENCES_DIR.resolve() not in filepath.parents:
        return jsonify({"error": "Invalid path"}), 400
    if not filepath.exists():
        return jsonify({"error": "Reference not found"}), 404
    filepath.unlink()
    return jsonify({"status": "deleted", "filename": ref_filename})


@app.route("/api/references/<ref_filename>/status", methods=["PATCH"])
def update_reference_status(ref_filename):
    if "/" in ref_filename or "\\" in ref_filename or ".." in ref_filename:
        return jsonify({"error": "Invalid filename"}), 400
    filepath = (REFERENCES_DIR / ref_filename).resolve()
    if REFERENCES_DIR.resolve() not in filepath.parents:
        return jsonify({"error": "Invalid path"}), 400
    if not filepath.exists():
        return jsonify({"error": "Reference not found"}), 404

    new_status = (request.json or {}).get("status", "")
    valid = {"surfaced", "imported", "located", "verified"}
    if new_status not in valid:
        return jsonify({"error": f"Invalid status. Must be one of: {valid}"}), 400

    text = filepath.read_text(encoding="utf-8")
    parts = text.split("---", 2)
    if len(parts) < 3:
        return jsonify({"error": "Invalid canonical format"}), 400

    meta = {}
    for line in parts[1].strip().splitlines():
        if ": " in line:
            k, v = line.split(": ", 1)
            meta[k.strip()] = v.strip()

    old_status = meta.get("verification_status", "surfaced")
    meta["verification_status"] = new_status

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
    body = parts[2]
    log_marker = "## Status History"
    log_line   = f"- {old_status} → **{new_status}** [{timestamp}]"
    if log_marker in body:
        body = body.rstrip() + "\n" + log_line + "\n"
    else:
        body = body.rstrip() + "\n\n" + log_marker + "\n" + log_line + "\n"

    fm_lines = "\n".join(f"{k}: {v}" for k, v in meta.items() if v is not None and v != "")
    filepath.write_text(f"---\n{fm_lines}\n---\n{body}", encoding="utf-8")
    return jsonify({"status": "updated", "verification_status": new_status})


# ─── Projects ─────────────────────────────────────────────────────────────────

@app.route("/api/projects", methods=["GET"])
def get_projects():
    projects  = []
    seen_slugs = set()
    all_refs  = read_all_references()
    for filepath in sorted(PROJECTS_DIR.glob("*.md")):
        try:
            text = filepath.read_text(encoding="utf-8")
            if text.startswith("---"):
                parts = text.split("---", 2)
                if len(parts) >= 3:
                    meta = {}
                    for line in parts[1].strip().splitlines():
                        if ": " in line:
                            k, v = line.split(": ", 1)
                            meta[k.strip()] = v.strip()
                    meta["_filename"] = filepath.name
                    if not meta.get("slug"):
                        meta["slug"] = meta.get("name", filepath.stem)
                    if not meta.get("label"):
                        meta["label"] = meta.get("slug", filepath.stem)
                    body = parts[2]
                    if "## Framing" in body:
                        raw = body.split("## Framing")[1].split("\n## ")[0].strip()
                        meta["framing"] = raw if not raw.startswith("<!--") else ""
                    slug = meta["slug"]
                    connected = [r for r in all_refs
                                 if any(slug == line.split("|")[0].strip()
                                        for line in (r.get("conn_list") or []))]
                    meta["ref_count"] = len(connected)
                    meta["ref_titles"] = [r.get("title","")[:60] for r in connected[:5]]
                    if meta["slug"] not in seen_slugs:
                        seen_slugs.add(meta["slug"])
                        projects.append(meta)
        except Exception:
            pass
    return jsonify(projects)


@app.route("/api/projects/<project_slug>", methods=["PUT"])
def update_project(project_slug):
    safe = project_slug.replace("/","").replace("..","")
    filepath = PROJECTS_DIR / (safe + ".md")
    if not filepath.exists():
        return jsonify({"error": "Not found"}), 404
    data  = request.json or {}
    text  = filepath.read_text(encoding="utf-8")
    parts = text.split("---", 2)
    if len(parts) < 3:
        return jsonify({"error": "Invalid format"}), 400
    meta = {}
    for line in parts[1].strip().splitlines():
        if ": " in line:
            k, v = line.split(": ", 1)
            meta[k.strip()] = v.strip()
    for field in ["label", "status", "abstract"]:
        if field in data:
            meta[field] = data[field]
    new_slug = normalise_slug_project(data.get("slug", "").strip()) if data.get("slug") else ""
    if new_slug and new_slug != safe:
        meta["slug"] = new_slug
        new_filepath = PROJECTS_DIR / (new_slug + ".md")
    else:
        new_filepath = filepath
    meta["updated_at"] = datetime.now(timezone.utc).isoformat()
    body = parts[2]
    if "framing" in data and data["framing"]:
        if "## Framing" in body:
            before = body.split("## Framing")[0]
            rest   = body.split("## Framing")[1]
            after  = ("\n## " + rest.split("\n## ",1)[1]) if "\n## " in rest else ""
            body   = before + "## Framing\n" + data["framing"] + "\n" + after
        else:
            body = body.rstrip() + "\n\n## Framing\n" + data["framing"] + "\n"
    fm_lines = "\n".join(f"{k}: {v}" for k, v in meta.items() if v)
    new_filepath.write_text(f"---\n{fm_lines}\n---\n{body}", encoding="utf-8")
    if new_filepath != filepath:
        filepath.unlink()
    return jsonify({"status": "updated", "slug": new_slug or safe})


@app.route("/api/projects", methods=["POST"])
def create_project():
    data = request.json or {}
    label = data.get("label", "").strip()
    raw_slug = data.get("slug", "").strip() or "_".join(label.lower().split()[:4])
    slug = normalise_slug_project(raw_slug)
    if not slug:
        return jsonify({"error": "Project slug required"}), 400
    filename = slug + ".md"
    filepath = PROJECTS_DIR / filename
    framing  = data.get("framing", "")
    abstract = data.get("abstract", "")
    canonical = f"""---
label: {label or slug}
slug: {slug}
status: active
abstract: {abstract}
created_at: {datetime.now(timezone.utc).isoformat()}
updated_at: {datetime.now(timezone.utc).isoformat()}
---

## Framing
{framing or "<!-- Research question or framing for this project -->"}

## Sessions

## Syntheses

"""
    filepath.write_text(canonical, encoding="utf-8")
    return jsonify({"status": "created", "filename": filename, "slug": slug, "label": label or slug})


@app.route("/api/projects/<project_name>", methods=["GET"])
def get_project(project_name):
    filepath = PROJECTS_DIR / (project_name.replace("/","").replace("..","") + ".md")
    if not filepath.exists():
        return jsonify({"error": "Not found"}), 404
    refs = [r for r in read_all_references()
            if any(project_name in line.split("|")[0].strip()
                   for line in (r.get("conn_list") or []))]
    return jsonify({"ref_count": len(refs), "refs": [r.get("title","") for r in refs]})


# ─── Writing ──────────────────────────────────────────────────────────────────

@app.route("/api/writing", methods=["GET"])
def get_writing():
    items = []
    for filepath in sorted(WRITING_DIR.glob("*.md")):
        try:
            text = filepath.read_text(encoding="utf-8")
            if text.startswith("---"):
                parts = text.split("---", 2)
                if len(parts) >= 3:
                    meta = {}
                    for line in parts[1].strip().splitlines():
                        if ": " in line:
                            k, v = line.split(": ", 1)
                            meta[k.strip()] = v.strip()
                    meta["_filename"] = filepath.name
                    if not meta.get("slug"):
                        meta["slug"] = filepath.stem
                    if not meta.get("title"):
                        meta["title"] = meta["slug"]
                    items.append(meta)
        except Exception:
            pass
    return jsonify(items)


@app.route("/api/writing/<writing_slug>", methods=["PUT"])
def update_writing(writing_slug):
    safe = writing_slug.replace("/","").replace("..","")
    filepath = WRITING_DIR / (safe + ".md")
    if not filepath.exists():
        return jsonify({"error": "Not found"}), 404
    data  = request.json or {}
    text  = filepath.read_text(encoding="utf-8")
    parts = text.split("---", 2)
    if len(parts) < 3:
        return jsonify({"error": "Invalid format"}), 400
    meta = {}
    for line in parts[1].strip().splitlines():
        if ": " in line:
            k, v = line.split(": ", 1)
            meta[k.strip()] = v.strip()
    for field in ["title", "type", "project", "status", "abstract"]:
        if field in data:
            meta[field] = data[field]
    new_slug = normalise_slug_writing(data.get("slug", "").strip()) if data.get("slug") else ""
    if new_slug and new_slug != safe:
        meta["slug"] = new_slug
        new_filepath = WRITING_DIR / (new_slug + ".md")
    else:
        new_filepath = filepath
    meta["updated_at"] = datetime.now(timezone.utc).isoformat()
    fm_lines = "\n".join(f"{k}: {v}" for k, v in meta.items() if v)
    new_filepath.write_text(f"---\n{fm_lines}\n---\n{parts[2]}", encoding="utf-8")
    if new_filepath != filepath:
        filepath.unlink()
    return jsonify({"status": "updated", "slug": new_slug or safe})


@app.route("/api/writing", methods=["POST"])
def create_writing():
    data = request.json or {}
    title = data.get("title", "").strip()
    raw_slug = data.get("slug", "").strip() or "-".join(title.lower().split()[:4])
    slug = normalise_slug_writing(raw_slug)
    if not title:
        return jsonify({"error": "Title required"}), 400
    filename = slug + ".md"
    filepath = WRITING_DIR / filename
    canonical = f"""---
title: {title}
slug: {slug}
type: {data.get("type", "other")}
project: {data.get("project", "")}
status: drafting
abstract: {data.get("abstract", "")}
created_at: {datetime.now(timezone.utc).isoformat()}
updated_at: {datetime.now(timezone.utc).isoformat()}
---

## Argument

## Connected References

## Notes

"""
    filepath.write_text(canonical, encoding="utf-8")
    return jsonify({"status": "created", "filename": filename, "slug": slug})


@app.route("/api/projects/<project_name>/synthesis", methods=["POST"])
def save_project_synthesis(project_name):
    safe = project_name.replace("/","").replace("..","")
    filepath = PROJECTS_DIR / (safe + ".md")
    if not filepath.exists():
        return jsonify({"error": "Project not found"}), 404
    synthesis = (request.json or {}).get("synthesis", "")
    if not synthesis:
        return jsonify({"error": "No synthesis provided"}), 400
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    entry = f"\n### Library synthesis — {timestamp}\n\n{synthesis}\n"
    text  = filepath.read_text(encoding="utf-8")
    parts = text.split("---", 2)
    if len(parts) >= 3:
        body = parts[2]
        if "## Syntheses" in body:
            body = body.replace("## Syntheses", "## Syntheses" + entry, 1)
        else:
            body = body.rstrip() + "\n\n## Syntheses" + entry
        meta_block = parts[1]
        import re
        meta_block = re.sub(r'updated_at:.*', f'updated_at: {datetime.now(timezone.utc).isoformat()}', meta_block)
        filepath.write_text(f"---{meta_block}---\n{body}", encoding="utf-8")
    return jsonify({"status": "saved"})


@app.route("/api/refs-chunk/concept-search", methods=["POST"])
def refs_chunk_concept_search():
    # Runs a lightweight local model pass to generate refined search terms
    # from a concept and its sentence context, then fires OpenAlex.
    # Fast and light -- single short prompt, not a council fire.
    data    = request.json or {}
    concept = data.get("concept", "").strip()
    context = data.get("context", "").strip()
    if not concept:
        return jsonify({"error": "concept required"}), 400

    # Generate refined search terms via local model
    search_terms = concept  # fallback
    try:
        prompt = f"""Given this concept and its context from a research session, suggest 2-3 precise academic search terms that would find the most relevant scholarly sources. Return the search terms only, comma-separated, nothing else.

Concept: {concept}
Context: {context or "(no context available)"}

Search terms:"""
        # Use Mistral for speed — fast enough to feel near-instant
        settings  = load_settings()
        local_cfg = settings.get("models", {}).get("local", {})
        model_tag = local_cfg.get("europe", "mistral:7b")
        _, result, _, _, _ = call_model("mistral", prompt)
        if result:
            # Clean up — take first line, strip any preamble
            raw = result.strip().split("\n")[0]
            # Remove any "Search terms:" prefix the model might add
            raw = raw.replace("Search terms:", "").strip().strip('"').strip()
            if raw:
                search_terms = raw
    except Exception:
        pass  # fall through to bare concept search

    # Fire search with refined terms using existing search_candidates
    results = []
    try:
        from utils.academic_sources import search_candidates
        hits = search_candidates(search_terms)
        # Normalize to simple format for the JS
        for h in (hits or [])[:4]:
            results.append({
                "title":   h.get("title", ""),
                "authors": h.get("authors", ""),
                "year":    h.get("year", ""),
                "doi":     h.get("doi", "") or h.get("url", ""),
            })
    except Exception:
        pass

    return jsonify({"search_terms": search_terms, "results": results})


@app.route("/api/export/bibtex", methods=["GET"])
def export_bibtex():
    # Live BibTeX export — generates fresh from canonical files on every request.
    # Point Zettlr at http://100.126.14.57:5001/api/export/bibtex as the citation library.
    # Citekey = slug (already BibTeX-safe: lowercase, underscores, no spaces).
    type_map = {
        "journal article": "article", "journal": "article",
        "book": "book", "chapter": "incollection",
        "conference paper": "inproceedings", "conference": "inproceedings",
        "conference presentation": "inproceedings",
        "thesis": "phdthesis", "preprint": "misc", "essay": "misc",
        "keynote": "misc", "poster": "misc", "talk": "misc",
        "other": "misc", "web": "misc",
    }
    lines = []
    for ref in read_all_references():
        slug   = ref.get("slug") or (ref.get("_filename","")).replace(".md","")
        if not slug: continue
        entry_type = type_map.get(ref.get("source_type","").lower(), "misc")
        # Convert "Last, First; Last, First" or "First Last; First Last" to BibTeX "and" format
        authors_raw = ref.get("authors","")
        authors_bib = " and ".join(a.strip() for a in authors_raw.split(";") if a.strip())
        fields = [f"  author    = {{{authors_bib}}}",
                  f"  title     = {{{ref.get('title','')}}}",
                  f"  year      = {{{ref.get('year','')}}}"]
        if ref.get("url_doi"):
            doi = ref["url_doi"]
            if "doi.org" in doi or doi.startswith("10."):
                fields.append(f"  doi       = {{{doi}}}")
            else:
                fields.append(f"  url       = {{{doi}}}")
        if ref.get("tags"):
            fields.append(f"  keywords  = {{{ref['tags']}}}")
        if ref.get("annotation"):
            fields.append(f"  annote    = {{{ref['annotation'][:500]}}}")
        lines.append(f"@{entry_type}{{{slug},\n" + ",\n".join(fields) + "\n}")
    bib_content = "\n\n".join(lines)
    from flask import Response
    return Response(bib_content, mimetype="application/x-bibtex",
                    headers={"Content-Disposition": "inline; filename=marginalia.bib"})


@app.route("/api/keywords", methods=["GET"])
@app.route("/api/tags", methods=["GET"])
def get_all_keywords():
    keywords = set()
    for ref in read_all_references():
        for k in ref.get("keywords_list", []):
            if k:
                keywords.add(k.lower().strip())
    return jsonify(sorted(keywords))


@app.route("/api/connections", methods=["GET"])
def get_all_connections():
    conns = set()
    for ref in read_all_references():
        for line in ref.get("conn_list", []):
            name = line.split("|")[0].strip()
            if name:
                conns.add(name.lower().strip())
    return jsonify(sorted(conns))


@app.route("/api/references/library-synthesis", methods=["POST"])
def library_synthesis():
    data    = request.json or {}
    project = data.get("project", "").strip()
    writing = data.get("writing", "").strip()
    req_model = data.get("model", "").strip()

    all_refs = read_all_references()
    if not all_refs:
        return jsonify({"error": "No references found in library"}), 400

    # Filter by project or writing slug when set — match against conn_list
    if project:
        refs = [r for r in all_refs
                if any(project == line.split("|")[0].strip()
                       for line in (r.get("conn_list") or []))]
        if not refs:
            return jsonify({"error": f"No references connected to project '{project}'"}), 400
    elif writing:
        refs = [r for r in all_refs
                if any(writing == line.split("|")[0].strip()
                       for line in (r.get("conn_list") or []))]
        if not refs:
            return jsonify({"error": f"No references connected to writing piece '{writing}'"}), 400
    else:
        refs = all_refs

    ref_summaries = []
    for ref in refs:
        if ref.get("title"):
            entry = f"[{ref.get('authors','Unknown')} {ref.get('year','')}] {ref.get('title','')}"
            if ref.get("keywords"):
                entry += f" — keywords: {ref.get('keywords')}"
            filepath = REFERENCES_DIR / ref.get("_filename", "")
            if filepath.exists():
                text = filepath.read_text(encoding="utf-8")
                parts = text.split("---", 2)
                if len(parts) >= 3:
                    body = parts[2].strip()
                    # Annotation — the researcher's interpretive reading
                    if "## Annotation" in body:
                        ann = body.split("## Annotation")[1].split("\n## ")[0].strip()
                        if ann and not ann.startswith("<!--"):
                            entry += f"\nAnnotation: {ann[:300]}"
                    # Your Notes — the researcher's voice, thinking in progress
                    if "## Your Notes" in body:
                        notes = body.split("## Your Notes")[1].split("\n## ")[0].strip()
                        if notes and not notes.startswith("<!--"):
                            entry += f"\nResearcher notes: {notes[:200]}"
                    # Argument Connection — how it plugs into the argument
                    if "## Argument Connection" in body:
                        arg = body.split("## Argument Connection")[1].split("\n## ")[0].strip()
                        if arg and not arg.startswith("<!--"):
                            entry += f"\nArgument connection: {arg[:200]}"
            ref_summaries.append(entry)

    library_text = "\n\n".join(ref_summaries)
    settings  = load_settings()
    local_cfg = settings.get("models", {}).get("local", {})
    _model_map = {
        "deepseek": local_cfg.get("reasoning",  "deepseek-r1:8b"),
        "qwen":     local_cfg.get("asia",       "qwen2.5:14b"),
        "mistral":  local_cfg.get("europe",     "mistral:7b"),
        "cohere":   local_cfg.get("canadian",   "command-r7b:latest"),
        "gemma":    local_cfg.get("multimodal", "gemma4:latest"),
        "llama":    local_cfg.get("general",    "llama3.1:8b"),
    }
    model_str = _model_map.get(req_model, local_cfg.get("reasoning", "deepseek-r1:8b"))

    # Load project framing if scoped — inject so the model knows the research lens
    framing = ""
    if project:
        proj_file = PROJECTS_DIR / (project + ".md")
        if proj_file.exists():
            try:
                pt  = proj_file.read_text(encoding="utf-8")
                pp  = pt.split("---", 2)
                if len(pp) >= 3 and "## Framing" in pp[2]:
                    raw = pp[2].split("## Framing")[1].split("\n## ")[0].strip()
                    if raw and not raw.startswith("<!--"):
                        framing = raw
            except Exception:
                pass

    framing_block = f"\nRESEARCH FRAMING:\n{framing}\n" if framing else ""
    scope = f"project '{project}'" if project else "full library"

    lens_prompt = f"""You are a research librarian helping a PhD researcher understand their own collection.
Read the following reference library ({scope}) and produce exactly five sections using these exact headers:

## RECURRING THEMES
What topics and concepts appear most frequently? Be specific — cite author names and years.

## TENSIONS
Which sources argue against each other, or represent competing frameworks? Cite directly.

## ABSENT VOICES
What perspectives, epistemological traditions, or communities are missing from this collection? Who is not in the room?

## CONVERSATIONS
Which sources should be read together and why? Surface unexpected connections.

## RESEARCH QUESTION FIT
How well does this collection serve the research framing? Where are the strongest supports and the weakest coverage?
{framing_block}
Use only the researcher's own curated material — do not introduce outside sources.

LIBRARY:
{library_text}"""

    try:
        synthesis = call_ollama(model_str, lens_prompt)
        return jsonify({"synthesis": synthesis, "ref_count": len(refs), "project": project})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/sessions/list", methods=["GET"])
def sessions_list():
    """
    Return session metadata for Intelligence session list and related-sessions strip.
    Optional ?project=slug filter, ?show_hidden=true to include hidden sessions.
    Optional ?limit=N to control how many sessions are returned (default 20, max 200).
    Hidden sessions (hidden: true in frontmatter) are excluded by default.
    Sessions are never deleted — hide is the only removal gesture.
    """
    project_filter = request.args.get("project", "").strip()
    show_hidden    = request.args.get("show_hidden", "false").lower() == "true"
    limit          = min(int(request.args.get("limit", 20)), 200)
    sessions = []
    if SESSIONS_DIR.exists():
        for f in sorted(SESSIONS_DIR.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
            if not f.name.endswith(".md"):
                continue
            try:
                text = f.read_text(encoding="utf-8")
                fm = {}
                if text.startswith("---"):
                    end = text.find("---", 3)
                    if end > 0:
                        for line in text[3:end].splitlines():
                            if ":" in line:
                                k, v = line.split(":", 1)
                                fm[k.strip()] = v.strip()
                if fm.get("source_type") == "capture":
                    continue
                is_hidden = fm.get("hidden", "false").lower() == "true"
                if is_hidden and not show_hidden:
                    continue
                proj = fm.get("project", "")
                if project_filter and proj != project_filter:
                    continue
                sessions.append({
                    "filename": f.name,
                    "title":    fm.get("title") or fm.get("prompt", "")[:60] or f.stem,
                    "project":  proj,
                    "writing":  fm.get("writing", ""),
                    "tags":     fm.get("tags", ""),
                    "created":  fm.get("created_at", ""),
                    "hidden":   is_hidden,
                })
                if len(sessions) >= limit:
                    break
            except Exception:
                continue
    return jsonify({"sessions": sessions})


@app.route("/api/sessions/<session_filename>", methods=["PATCH"])
def patch_session(session_filename):
    """
    Retroactive tagging — update project, writing, and hidden fields on a saved session.
    The canonical session body is never touched.
    hidden: true removes the session from default Intelligence scope without deleting it.
    Sessions are never deleted — hide is the only removal gesture.
    """
    if "/" in session_filename or "\\" in session_filename or ".." in session_filename:
        return jsonify({"error": "Invalid filename"}), 400
    filepath = (SESSIONS_DIR / session_filename).resolve()
    if not filepath.exists():
        return jsonify({"error": "Session not found"}), 404

    data = request.json or {}
    text = filepath.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return jsonify({"error": "Invalid session format"}), 400

    parts = text.split("---", 2)
    if len(parts) < 3:
        return jsonify({"error": "Invalid session format"}), 400

    meta = {}
    for line in parts[1].strip().splitlines():
        if ": " in line:
            k, v = line.split(": ", 1)
            meta[k.strip()] = v.strip()

    if "project" in data:
        meta["project"] = data["project"].strip()
    if "writing" in data:
        meta["writing"] = data["writing"].strip()
    if "hidden" in data:
        meta["hidden"] = "true" if data["hidden"] else "false"
    if "tags" in data:
        meta["tags"] = data["tags"].strip()
    if "title" in data:
        meta["title"] = data["title"].strip()

    fm_lines = "\n".join(f"{k}: {v}" for k, v in meta.items())
    filepath.write_text(f"---\n{fm_lines}\n---\n{parts[2]}", encoding="utf-8")
    return jsonify({"status": "updated", "filename": session_filename})


@app.route("/api/sessions/<session_filename>/raw", methods=["GET"])
def get_session_raw(session_filename):
    """
    Returns the raw markdown content of a session file for read-only viewing.
    Used by the Intelligence session list expand panel.
    The canonical file is never modified by this route.
    """
    if "/" in session_filename or "\\" in session_filename or ".." in session_filename:
        return jsonify({"error": "Invalid filename"}), 400
    filepath = (SESSIONS_DIR / session_filename).resolve()
    if not filepath.exists():
        return jsonify({"error": "Session not found"}), 404
    return jsonify({"content": filepath.read_text(encoding="utf-8"), "filename": session_filename})

# Global cancel flag — set by /api/prompt/cancel, checked between model calls in SSE
_prompt_cancel_flag = False

@app.route("/api/prompt/cancel", methods=["POST"])
def cancel_prompt():
    global _prompt_cancel_flag
    _prompt_cancel_flag = True
    return jsonify({"status": "cancel_requested"})


@app.route("/api/synthesise", methods=["POST"])
def synthesise():
    # General-purpose synthesis endpoint. Accepts prompt + model responses and
    # runs run_synthesis() with the requested mode. Used by Prompt Pressure Test
    # (synth_mode=prompt_pressure) which fires before or without model responses,
    # and by any other caller that needs synthesis outside the session/prompt flow.
    data      = request.json or {}
    prompt    = data.get("prompt", "").strip()
    responses = data.get("responses", {})
    synth_model = data.get("synthesis_model", "deepseek").strip()
    synth_mode  = data.get("synth_mode", "survey").strip()

    if not prompt:
        return jsonify({"error": "prompt is required"}), 400

    try:
        result = run_synthesis(prompt, responses, synthesis_model=synth_model, synth_mode=synth_mode)
        return jsonify({"synthesis": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/sessions/synthesis", methods=["POST"])
def sessions_synthesis():
    data    = request.json or {}
    project = data.get("project", "").strip()
    writing = data.get("writing", "").strip()
    req_model = data.get("model", "").strip()

    session_files = sorted(SESSIONS_DIR.glob("session_*.md"), reverse=True)
    if not session_files:
        return jsonify({"error": "No sessions found"}), 400

    summaries = []
    matched   = 0
    for filepath in session_files:
        try:
            text  = filepath.read_text(encoding="utf-8")
            parts = text.split("---", 2)
            if len(parts) < 3:
                continue
            # Parse frontmatter
            meta = {}
            for line in parts[1].strip().splitlines():
                if ": " in line:
                    k, v = line.split(": ", 1)
                    meta[k.strip()] = v.strip()
            body = parts[2]

            # Filter logic: frontmatter project/writing field first, text match fallback
            if project:
                fm_project = meta.get("project", "").strip()
                if fm_project:
                    if fm_project != project:
                        continue
                else:
                    if project.lower() not in body.lower():
                        continue
            elif writing:
                fm_writing = meta.get("writing", "").strip()
                if fm_writing:
                    if fm_writing != writing:
                        continue
                else:
                    if writing.lower() not in body.lower():
                        continue

            # Extract prompt
            prompt_text = ""
            if "## Prompt" in body:
                prompt_text = body.split("## Prompt")[1].split("\n## ")[0].strip()[:300]

            # Extract synthesis if present
            synth_text = ""
            if "## Synthesis" in body:
                raw = body.split("## Synthesis")[1].split("\n## ")[0].strip()
                if raw and not raw.startswith("<!--"):
                    synth_text = raw[:300]

            # Extract notes if present
            notes_text = ""
            if "## Notes" in body:
                raw = body.split("## Notes")[1].split("\n## ")[0].strip()
                if raw and not raw.startswith("<!--"):
                    notes_text = raw[:150]

            label    = meta.get("prompt_label", "") or prompt_text[:80]
            created  = meta.get("created_at", "")[:16].replace("T", " ")
            models   = meta.get("models", "")
            entry    = f"[{created}] {label}\nModels: {models}"
            if synth_text:
                entry += f"\nSynthesis: {synth_text}"
            elif prompt_text:
                entry += f"\nPrompt: {prompt_text}"
            if notes_text:
                entry += f"\nNotes: {notes_text}"
            summaries.append(entry)
            matched += 1
            if matched >= 20:  # cap at 20 sessions to avoid context overflow
                break
        except Exception:
            continue

    if not summaries:
        return jsonify({"error": f"No sessions found{' for project ' + project if project else ''}"}), 400

    settings  = load_settings()
    local_cfg = settings.get("models", {}).get("local", {})
    _model_map = {
        "deepseek": local_cfg.get("reasoning",  "deepseek-r1:8b"),
        "qwen":     local_cfg.get("asia",       "qwen2.5:14b"),
        "mistral":  local_cfg.get("europe",     "mistral:7b"),
        "cohere":   local_cfg.get("canadian",   "command-r7b:latest"),
        "gemma":    local_cfg.get("multimodal", "gemma4:latest"),
        "llama":    local_cfg.get("general",    "llama3.1:8b"),
    }
    model_str = _model_map.get(req_model, local_cfg.get("reasoning", "deepseek-r1:8b"))

    # Load project framing if scoped
    framing = ""
    if project:
        proj_file = PROJECTS_DIR / (project + ".md")
        if proj_file.exists():
            try:
                pt  = proj_file.read_text(encoding="utf-8")
                pp  = pt.split("---", 2)
                if len(pp) >= 3 and "## Framing" in pp[2]:
                    raw = pp[2].split("## Framing")[1].split("\n## ")[0].strip()
                    if raw and not raw.startswith("<!--"):
                        framing = raw
            except Exception:
                pass

    framing_block = f"\nRESEARCH FRAMING:\n{framing}\n" if framing else ""
    scope        = f"project '{project}'" if project else "all projects"
    session_text = "\n\n---\n\n".join(summaries)

    lens_prompt = f"""You are a research assistant helping a PhD researcher understand their own thinking over time.
Read the following research session log ({scope}) and produce exactly five sections using these exact headers:

## RECURRING QUESTIONS
What questions or problems keep coming up across sessions? Reference specific dates.

## EVOLUTION
How has the thinking shifted across sessions? What changed and when?

## UNRESOLVED
What threads were raised but never followed up? What was left hanging?

## MOMENTUM
Where is the research moving? What seems to be building toward something?

## ABSENT VOICES
What important questions haven't been asked yet? What is conspicuously absent from the inquiry?
{framing_block}
Be specific — reference session dates and prompts. This is the researcher's own work.

SESSIONS:
{session_text}"""

    try:
        synthesis = call_ollama(model_str, lens_prompt)
        return jsonify({"synthesis": synthesis, "session_count": matched, "project": project})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/sessions/predict", methods=["POST"])
def sessions_predict():
    """
    v0.9.3 — What am I missing?
    Predictive gap analysis: reads sessions and references for a project,
    surfaces argument weaknesses, unasked questions, missing perspectives.
    The instrument auditing its own gaps.
    """
    data      = request.json or {}
    project   = data.get("project", "").strip()
    req_model = data.get("model", "").strip()

    # Load sessions — same logic as sessions_synthesis
    session_files = sorted(SESSIONS_DIR.glob("session_*.md"), reverse=True)
    summaries = []
    matched   = 0
    for filepath in session_files:
        try:
            text  = filepath.read_text(encoding="utf-8")
            parts = text.split("---", 2)
            if len(parts) < 3:
                continue
            meta = {}
            for line in parts[1].strip().splitlines():
                if ": " in line:
                    k, v = line.split(": ", 1)
                    meta[k.strip()] = v.strip()
            body = parts[2]
            if project:
                fm_project = meta.get("project", "").strip()
                if fm_project:
                    if fm_project != project:
                        continue
                else:
                    if project.lower() not in body.lower():
                        continue
            prompt_text = ""
            if "## Prompt" in body:
                prompt_text = body.split("## Prompt")[1].split("\n## ")[0].strip()[:400]
            synth_text = ""
            if "## Synthesis" in body:
                raw = body.split("## Synthesis")[1].split("\n## ")[0].strip()
                if raw and not raw.startswith("<!--"):
                    synth_text = raw[:300]
            label   = meta.get("prompt_label", "") or prompt_text[:80]
            created = meta.get("created_at", "")[:16].replace("T", " ")
            entry   = f"[{created}] {label}"
            if synth_text:
                entry += f"\nSynthesis: {synth_text}"
            elif prompt_text:
                entry += f"\nPrompt: {prompt_text}"
            summaries.append(entry)
            matched += 1
            if matched >= 20:
                break
        except Exception:
            continue

    if not summaries:
        return jsonify({"error": f"No sessions found{' for project ' + project if project else ''}"}), 400

    # Also pull connected reference titles for context
    ref_context = ""
    if project:
        all_refs = read_all_references()
        connected = [r for r in all_refs
                     if any(project == line.split("|")[0].strip()
                            for line in (r.get("conn_list") or []))]
        if connected:
            ref_context = "\n\nCONNECTED REFERENCES:\n" + "\n".join(
                f"- {r.get('authors','')} ({r.get('year','')}) {r.get('title','')}"
                for r in connected[:20]
            )

    # Load project framing
    framing = ""
    if project:
        proj_file = PROJECTS_DIR / (project + ".md")
        if proj_file.exists():
            try:
                pt  = proj_file.read_text(encoding="utf-8")
                pp  = pt.split("---", 2)
                if len(pp) >= 3 and "## Framing" in pp[2]:
                    raw = pp[2].split("## Framing")[1].split("\n## ")[0].strip()
                    if raw and not raw.startswith("<!--"):
                        framing = raw
            except Exception:
                pass

    framing_block = f"\nRESEARCH FRAMING:\n{framing}\n" if framing else ""
    scope        = f"project '{project}'" if project else "all sessions"
    session_text = "\n\n---\n\n".join(summaries)

    settings  = load_settings()
    local_cfg = settings.get("models", {}).get("local", {})
    _model_map = {
        "deepseek": local_cfg.get("reasoning",  "deepseek-r1:8b"),
        "qwen":     local_cfg.get("asia",       "qwen2.5:14b"),
        "mistral":  local_cfg.get("europe",     "mistral:7b"),
        "cohere":   local_cfg.get("canadian",   "command-r7b:latest"),
        "gemma":    local_cfg.get("multimodal", "gemma4:latest"),
        "llama":    local_cfg.get("general",    "llama3.1:8b"),
    }
    model_str = _model_map.get(req_model, local_cfg.get("reasoning", "deepseek-r1:8b"))

    lens_prompt = f"""You are a critical research supervisor reviewing a PhD researcher's work in progress.
Your job is NOT to summarise what is there — it is to find what is missing, what is weak, and what the researcher has not yet asked.
Be direct. Be specific. This is the most useful thing you can do.

Scope: {scope}
{framing_block}
Produce exactly five sections using these exact headers:

## UNASKED QUESTIONS
What important questions has this researcher not yet asked? What should they be investigating that they aren't?

## ARGUMENT WEAKNESSES
Where is the reasoning soft? What claims are made without sufficient support in the sessions?

## MISSING PERSPECTIVES
What disciplinary lenses, theoretical frameworks, or communities of practice are entirely absent from this inquiry?

## EXAMINER CHALLENGES
What would a skeptical dissertation examiner ask that this researcher has not yet addressed?

## NEXT MOVES
What are the three most important things this researcher should do next to strengthen their work?
{framing_block}
SESSIONS:
{session_text}{ref_context}"""

    try:
        synthesis = call_ollama(model_str, lens_prompt)
        return jsonify({"synthesis": synthesis, "session_count": matched, "project": project})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/sessions/stack-analysis", methods=["POST"])
def sessions_stack_analysis():
    """
    +++ Stack mode — dissects prompt stacking patterns across recent sessions.
    Shows layer count, weight distribution, context collapse risk, and what
    the researcher is actually asking stripped of context layers.
    """
    data      = request.json or {}
    project   = data.get("project", "").strip()
    writing   = data.get("writing", "").strip()
    req_model = data.get("model", "deepseek").strip()

    sessions_data = []
    if SESSIONS_DIR.exists():
        files = sorted(SESSIONS_DIR.glob("*.md"), key=lambda f: f.stat().st_mtime, reverse=True)
        for f in files[:40]:
            try:
                text  = f.read_text(encoding="utf-8")
                parts = text.split("---", 2)
                if len(parts) < 3: continue
                meta  = {}
                for line in parts[1].strip().splitlines():
                    if ": " in line:
                        k, v = line.split(": ", 1); meta[k.strip()] = v.strip()
                if project and meta.get("project", "").strip() != project: continue
                if writing and meta.get("writing", "").strip() != writing: continue
                body = parts[2]
                prompt_text = ""
                if "## Prompt" in body:
                    prompt_text = body.split("## Prompt")[1].split("\n## ")[0].strip()
                if not prompt_text: continue
                layers = [l.strip() for l in prompt_text.split("+++") if l.strip()]
                layer_tokens = [len(l.split()) for l in layers]
                total_tokens = sum(layer_tokens)
                final_pct = round(layer_tokens[-1] / total_tokens * 100) if total_tokens > 0 else 100
                sessions_data.append({
                    "title":        meta.get("title", f.stem),
                    "created":      meta.get("created_at", "")[:10],
                    "layer_count":  len(layers),
                    "layer_tokens": layer_tokens,
                    "total_tokens": total_tokens,
                    "final_pct":    final_pct,
                    "final_block":  layers[-1][:150] if layers else "",
                    "at_risk":      final_pct < 25 and len(layers) > 1,
                })
                if len(sessions_data) >= 20: break
            except Exception: continue

    if not sessions_data:
        return jsonify({"error": "No sessions with +++ stacking found"}), 400

    at_risk = [s["title"] for s in sessions_data if s["at_risk"]]
    stack_summary = []
    for s in sessions_data:
        entry = f"[{s['created']}] {s['title']}\n"
        if s["layer_count"] > 1:
            entry += f"  {s['layer_count']} layers, ~{s['total_tokens']} words total. "
            entry += f"Final question: {s['layer_tokens'][-1]}w ({s['final_pct']}% of stack)\n"
            if s["at_risk"]: entry += f"  ⚠ CONTEXT COLLAPSE RISK\n"
            entry += f"  Final: {s['final_block'][:100]}...\n"
        else:
            entry += f"  Single-layer prompt (~{s['total_tokens']} words)\n"
        stack_summary.append(entry)

    synthesis_prompt = f"""Analyse the +++ prompt stacking patterns across {len(sessions_data)} research sessions.

SESSIONS:
{"".join(stack_summary)}

{"CONTEXT COLLAPSE RISK in: " + ", ".join(at_risk) if at_risk else "No immediate context collapse risks detected."}

Analyse: (1) What is the researcher actually asking across sessions, stripped of context layers? (2) Where did context stacking help vs overwhelm? (3) What does the stacking pattern reveal about how this researcher builds inquiry? (4) What question hasn't been asked yet that the pattern suggests they're circling?

Be specific. Name the sessions. This is a structural reading."""

    try:
        _, synthesis, _, _, _ = call_model(req_model, synthesis_prompt)
        return jsonify({"synthesis": synthesis or "No synthesis generated", "session_count": len(sessions_data)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/references/<ref_filename>/annotate", methods=["POST"])
def annotate_reference(ref_filename):
    data   = request.json or {}
    models = data.get("models", ["deepseek"])

    if "/" in ref_filename or "\\" in ref_filename or ".." in ref_filename:
        return jsonify({"error": "Invalid filename"}), 400
    filepath = (REFERENCES_DIR / ref_filename).resolve()
    if REFERENCES_DIR.resolve() not in filepath.parents:
        return jsonify({"error": "Invalid path"}), 400
    if not filepath.exists():
        return jsonify({"error": f"Reference file not found: {ref_filename}"}), 404

    text  = filepath.read_text(encoding="utf-8")
    parts = text.split("---", 2)
    if len(parts) < 3:
        return jsonify({"error": "Invalid canonical file format"}), 400

    meta = {}
    for line in parts[1].strip().splitlines():
        if ": " in line:
            k, v = line.split(": ", 1)
            meta[k.strip()] = v.strip()

    title   = meta.get("title", "Unknown")
    authors = meta.get("authors", "Unknown")
    year    = meta.get("year", "")
    themes  = meta.get("keywords", "") or meta.get("themes", "")

    # Gate: refuse to annotate references still at 'surfaced' status.
    # Surfaced means the researcher hasn't yet confirmed this reference is
    # real -- annotating it anyway is the highest-confabulation-risk case
    # there is, a model reasoning confidently about something nobody has
    # verified exists. Enforced server-side so every annotate path (modal
    # Generate button, card-level quick-annotate, batch annotation once
    # built) is covered by one rule rather than relying on each UI surface
    # to remember to check. See seeds.md, "A concrete confabulation, caught."
    verification_status = meta.get("verification_status", "surfaced")
    if verification_status == "surfaced":
        return jsonify({
            "error": "Reference is still 'Surfaced' -- mark it Located or "
                     "Verified before annotating, so a model isn't reasoning "
                     "about something nobody has confirmed is real. Try "
                     "'Enrich from Index' first if you want real grounding."
        }), 400

    existing_body = parts[2]
    existing_annotation = ""
    if "## Annotation" in existing_body:
        existing_annotation = existing_body.split("## Annotation")[1].split("##")[0].strip()
        if existing_annotation.startswith("<!--"):
            existing_annotation = ""

    # Annotated bibliography style: citation + 3-5 sentences covering argument,
    # methodology/approach, and significance to the researcher's work.
    # Output must be plain prose — no headers, no bullet points, no bold labels.
    # "AI draft — edit before relying on this" label is added by the frontend.
    abstract_block = ""
    if "## Abstract" in existing_body:
        raw_abstract = existing_body.split("## Abstract")[1].split("\n## ")[0].strip()
        if raw_abstract and not raw_abstract.startswith("<!--"):
            abstract_block = f"\nAbstract: {strip_jats(raw_abstract)[:800]}"

    annotation_prompt = f"""Write an annotated bibliography entry for the following academic source. The annotation must be 3-5 sentences of plain prose — no headers, no bullet points, no bold labels, no preamble.

The annotation should cover: (1) what the source argues or demonstrates, (2) its theoretical or methodological approach, (3) why it matters to a PhD researcher studying embodied learning, community-building, performance anxiety, and intellectual risk-taking in first-year undergraduates.

Source:
{authors} ({year}). {title}.
Themes: {themes}{abstract_block}

Output the annotation only. Plain prose, 3-5 sentences. No label, no preamble, no \"This source argues\" opener if it can be avoided — begin with the substance."""

    results = {}
    for model in models:
        try:
            _, result, error, _, _ = call_model(model, annotation_prompt)
            if result:
                results[model] = result.strip()
        except Exception as e:
            results[model] = f"Error: {e}"

    if not results:
        return jsonify({"error": "No models returned annotations"}), 500

    # Single model: use output directly. Two models: pick the longer/richer one
    # rather than running synthesis (which produces headers and structure inappropriate
    # for an annotation field). Synthesis-style output in the annotation field was the bug.
    if len(results) == 1:
        synthesis = list(results.values())[0]
    else:
        # Pick the result with more substantive content (longer, no error prefix)
        valid = {m: r for m, r in results.items() if not r.startswith("Error:")}
        synthesis = max(valid.values(), key=len) if valid else list(results.values())[0]

    date_stamp = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    models_label = ", ".join(results.keys())
    new_annotation = f"<!-- AI draft ({models_label}, {date_stamp}) — edit before relying on this -->\n\n{synthesis}"

    if "## Annotation" in existing_body:
        before = existing_body.split("## Annotation")[0]
        after_parts = existing_body.split("## Annotation")[1].split("\n## ", 1)
        after = ("\n## " + after_parts[1]) if len(after_parts) > 1 else ""
        new_body = before + "## Annotation\n" + new_annotation + after
    else:
        new_body = existing_body + "\n## Annotation\n" + new_annotation

    new_file = "---" + parts[1] + "---\n" + new_body
    filepath.write_text(new_file, encoding="utf-8")

    return jsonify({"status": "annotated", "filename": ref_filename, "models_used": list(results.keys()), "synthesis": synthesis})


# ── Academic Sources — Semantic Scholar, OpenAlex, Crossref ───────────────────
# Thin abstraction layer over academic indices.
# Source is always stamped on returned data. Failover is automatic.
# On total failure: return empty/None, never fabricate.

@app.route("/api/academic/health", methods=["GET"])
def academic_health():
    """
    Lightweight health check for all three academic APIs.
    Called on References tab open. Results drive the status indicator in the UI.
    Runs sequentially — fast enough for on-demand use.
    """
    from utils.academic_sources import check_all_sources
    return jsonify(check_all_sources())


@app.route("/api/academic/fetch", methods=["POST"])
def academic_fetch():
    """
    Fetch paper metadata (abstract, authors, DOI) from Semantic Scholar or OpenAlex.

    Body:
      query            str  — keyword/title search (use if no DOI)
      doi              str  — DOI preferred; resolves more precisely
      preferred_source str  — "semantic_scholar" (default) or "openalex"

    Returns normalized paper record with source stamp.
    The abstract becomes the TLDR machine layer in the canonical reference file.
    Source stamp tells the researcher exactly where it came from.
    """
    from utils.academic_sources import fetch_paper, build_tldr_section
    data   = request.json or {}
    query  = data.get("query", "").strip()
    doi    = data.get("doi", "").strip()
    source = data.get("preferred_source", "semantic_scholar")

    if not query and not doi:
        return jsonify({"error": "Provide query or doi"}), 400

    result = fetch_paper(query=query, doi=doi, preferred_source=source)
    if not result:
        return jsonify({"error": "No results from either index — both may be unreachable or the paper is not indexed"}), 404

    # Build the formatted TLDR section ready to write into canonical
    result["tldr_section"] = build_tldr_section(result.get("abstract", ""), result.get("tldr_source", ""))
    return jsonify(result)


@app.route("/api/academic/save-to-references", methods=["POST"])
def academic_save_to_references():
    """
    Save a fetched paper record directly to canonical/references/.
    Writes the abstract into the ## TLDR section with source stamp.
    Human annotation layer (## Your Notes, ## Argument Connection) stays blank.

    Body: the normalized paper record returned by /api/academic/fetch,
    plus any researcher-added fields (tags, themes, project connection).
    """
    from utils.academic_sources import build_tldr_section
    data = request.json or {}

    if not data.get("title"):
        return jsonify({"error": "Title required"}), 400

    # Build TLDR section with source stamp
    abstract     = data.get("abstract", "")
    tldr_source  = data.get("tldr_source", "Academic index")
    tldr_section = build_tldr_section(abstract, tldr_source)

    # Map to canonical reference shape
    ref_data = {
        "title":               data.get("title", ""),
        "authors":             data.get("authors", ""),
        "year":                data.get("year", ""),
        "url_doi":             data.get("url_doi", ""),
        "source_type":         data.get("source_type", "journal-article"),
        "verification_status": "surfaced",
        "tags":                data.get("tags", ""),
        "keywords":            data.get("keywords", "") or data.get("themes", ""),
        "annotation":          tldr_section,   # machine layer: abstract from index
        "user_notes":          "",             # human layer: waiting
        "argument_connection": "",
        "connections":         data.get("connections", ""),
        # Internal provenance — visible in canonical frontmatter
        "abstract_source":     data.get("tldr_source", ""),
        "ss_paper_id":         data.get("ss_paper_id", ""),
    }

    filepath = write_canonical_reference(ref_data)
    return jsonify({"status": "saved", "file": filepath.name, "tldr_source": tldr_source})


@app.route("/api/academic/leads", methods=["POST"])
def academic_leads():
    """
    Fetch citation leads for a reference via Crossref.
    Returns the paper's reference list with open access flags.

    These are signals, not instructions. The researcher decides what to chase.
    Leads already in the canonical library are flagged already_in_library=True.

    Body:
      doi  str  — DOI of the source paper
    """
    from utils.academic_sources import fetch_crossref_leads
    data = request.json or {}
    doi  = data.get("doi", "").strip()

    if not doi:
        return jsonify({"error": "DOI required for leads"}), 400

    # Collect existing DOIs from canonical library to flag already-held leads
    all_refs     = read_all_references()
    existing_dois = {r.get("url_doi", "").strip() for r in all_refs if r.get("url_doi")}
    # Also add raw DOI forms (without https://doi.org/ prefix)
    for r in all_refs:
        raw = r.get("url_doi", "").replace("https://doi.org/", "").strip()
        if raw:
            existing_dois.add(raw)

    result = fetch_crossref_leads(doi=doi, existing_dois=existing_dois)
    return jsonify(result)


@app.route("/api/references/<ref_filename>/enrich/search", methods=["POST"])
def enrich_search(ref_filename):
    """
    Step 1 of the Enrich flow: search the academic index, return CANDIDATES,
    write nothing. The researcher picks which (if any) is correct before
    anything touches the file.

    Built June 30 2026 to replace the old single-shot enrich, which
    auto-selected the top search hit and wrote it directly. That approach
    produced a confirmed real failure: an OpenAlex top hit for the Ken Bain
    reference turned out to be a Portuguese-language review of the book,
    not the book itself -- a genuine abstract, wrong paper, written
    silently. See seeds.md, "Enrich's false-success bug, and what it
    revealed." Source selection must be a human gate, not automatic --
    this route exists specifically to make that true.

    Body:
      query  str  optional override search query. If omitted, built from
                  the reference's own title + first author.
    """
    if "/" in ref_filename or "\\" in ref_filename or ".." in ref_filename:
        return jsonify({"error": "Invalid filename"}), 400
    filepath = (REFERENCES_DIR / ref_filename).resolve()
    if REFERENCES_DIR.resolve() not in filepath.parents:
        return jsonify({"error": "Invalid path"}), 400
    if not filepath.exists():
        return jsonify({"error": "Reference not found"}), 404

    from utils.academic_sources import search_candidates

    text = filepath.read_text(encoding="utf-8")
    parts = text.split("---", 2)
    if len(parts) < 3:
        return jsonify({"error": "Invalid canonical format"}), 400

    meta = {}
    for line in parts[1].strip().splitlines():
        if ": " in line:
            k, v = line.split(": ", 1)
            meta[k.strip()] = v.strip()

    title   = meta.get("title", "")
    authors = meta.get("authors", "")

    data = request.json or {}
    query = data.get("query", "").strip()
    if not query:
        query = f"{title} {authors.split(';')[0].strip()}" if authors else title

    if not query:
        return jsonify({"error": "No title or query to search with"}), 400

    candidates = search_candidates(query)

    return jsonify({
        "candidates": candidates,
        "query_used": query,
        "reference_title": title,
        "count": len(candidates),
    })


@app.route("/api/references/<ref_filename>/enrich/confirm", methods=["POST"])
def enrich_confirm(ref_filename):
    """
    Step 2 of the Enrich flow: the researcher has picked a specific
    candidate from the search step. Write it into the Abstract field,
    cleanly replacing any prior content there (and ONLY there -- the
    Annotation field, with Generate's interpretation, is untouched).

    Built June 30 2026. The old single-shot enrich also had a section-
    replace bug: it could leave stale fragments from a previous Generate
    run sitting below the newly-written content, because the split logic
    only looked for the next "\\n## " boundary rather than properly
    bounding the whole section being replaced. Confirmed in the wild on
    the Ken Bain reference -- old DEEPSEEK/COHERE synthesis fragments
    survived underneath a freshly-written (and wrong) abstract. This
    route writes to a dedicated Abstract section, separate from
    Annotation, so the two can never collide or leave cross-contaminated
    fragments in each other's space.

    Body:
      candidate  dict  one of the candidates returned by enrich/search,
                       passed back exactly as received
    """
    if "/" in ref_filename or "\\" in ref_filename or ".." in ref_filename:
        return jsonify({"error": "Invalid filename"}), 400
    filepath = (REFERENCES_DIR / ref_filename).resolve()
    if REFERENCES_DIR.resolve() not in filepath.parents:
        return jsonify({"error": "Invalid path"}), 400
    if not filepath.exists():
        return jsonify({"error": "Reference not found"}), 404

    from utils.academic_sources import build_tldr_section

    data = request.json or {}
    candidate = data.get("candidate")
    if not candidate or not candidate.get("abstract"):
        return jsonify({"error": "No candidate with an abstract provided"}), 400

    text = filepath.read_text(encoding="utf-8")
    parts = text.split("---", 2)
    if len(parts) < 3:
        return jsonify({"error": "Invalid canonical format"}), 400

    meta = {}
    for line in parts[1].strip().splitlines():
        if ": " in line:
            k, v = line.split(": ", 1)
            meta[k.strip()] = v.strip()

    abstract_section = build_tldr_section(strip_jats(candidate["abstract"]), candidate.get("tldr_source", ""))

    # Cleanly replace JUST the Abstract section. Properly bounded this time:
    # find the Abstract marker, find the NEXT "## " heading after it
    # (whatever it is -- Annotation, Argument Connection, etc.), and
    # replace everything between the two. This is the same general
    # approach as before but applied to a section that's never shared
    # with Generate's output, so there's no cross-contamination risk
    # even if the boundary-finding has an edge case.
    body = parts[2]
    marker = "## Abstract"
    if marker in body:
        before = body.split(marker, 1)[0]
        rest   = body.split(marker, 1)[1]
        after  = ("\n## " + rest.split("\n## ", 1)[1]) if "\n## " in rest else ""
        new_body = before + marker + "\n" + abstract_section + "\n" + after
    else:
        # No Abstract section exists yet (older reference, pre-this-build).
        # Insert it right after Connections if present, else just append.
        if "## Connections" in body:
            before = body.split("## Connections", 1)[0]
            rest   = body.split("## Connections", 1)[1]
            conn_content, _, after = rest.partition("\n## ")
            after = ("## " + after) if after else ""
            new_body = (before + "## Connections" + conn_content.rstrip() + "\n\n"
                        + marker + "\n" + abstract_section + "\n\n" + after)
        else:
            new_body = body.rstrip() + "\n\n" + marker + "\n" + abstract_section + "\n"

    meta["updated_at"] = datetime.now(timezone.utc).isoformat()
    new_meta_block = "\n".join(f"{k}: {v}" for k, v in meta.items())
    new_text = f"---\n{new_meta_block}\n---{new_body}"
    filepath.write_text(new_text, encoding="utf-8")

    return jsonify({
        "status": "enriched",
        "file": filepath.name,
        "matched_title": candidate.get("title", ""),
        "tldr_source": candidate.get("tldr_source", ""),
        "abstract_preview": candidate["abstract"][:200],
    })


@app.route("/api/ingest/scan-pdf-folder", methods=["POST"])
def scan_pdf_folder():
    """
    Scan ~/Documents/Research/PDFs/ for PDF files.
    For each file matching AuthorLastname_Year_ShortTitle.pdf naming convention,
    attempt text extraction via pdfplumber first.
    If extraction returns nothing (scanned/image PDF), flag for Gemma OCR.
    Creates reference stubs from filename + any extracted metadata.
    """
    import re
    pdf_dir = RESEARCH_PDF_DIR
    custom_path = (request.json or {}).get("path", "")
    if custom_path:
        pdf_dir = Path(custom_path).expanduser()

    if not pdf_dir.exists():
        return jsonify({"error": f"PDF folder not found: {pdf_dir}", "path": str(pdf_dir)}), 404

    results = {"scanned": 0, "imported": 0, "skipped": 0, "ocr_needed": [], "errors": []}
    existing_refs = {r.get("_filename", "") for r in read_all_references()}

    for pdf_path in sorted(pdf_dir.glob("*.pdf")):
        results["scanned"] += 1
        stem = pdf_path.stem  # AuthorLastname_Year_ShortTitle

        # Parse filename convention: Author_Year_Title
        parts = stem.split("_", 2)
        author = parts[0].strip() if len(parts) > 0 else ""
        year   = parts[1].strip() if len(parts) > 1 else ""
        title  = parts[2].replace("-", " ").replace("_", " ").strip() if len(parts) > 2 else stem

        # Validate year looks like a year
        if not re.match(r'^\d{4}$', year):
            year, title = "", stem  # filename doesn't follow convention — use whole stem as title

        # Skip if already in library (loose match on author+year)
        already_exists = any(
            author.lower() in fn.lower() and year in fn
            for fn in existing_refs
        )
        if already_exists:
            results["skipped"] += 1
            continue

        # Attempt text extraction
        text_extracted = ""
        needs_ocr = False
        try:
            import pdfplumber
            with pdfplumber.open(str(pdf_path)) as pdf:
                pages_text = []
                for page in pdf.pages[:3]:  # first 3 pages for metadata
                    t = page.extract_text()
                    if t:
                        pages_text.append(t)
                text_extracted = "\n".join(pages_text).strip()
        except Exception as e:
            results["errors"].append(f"{pdf_path.name}: pdfplumber error — {e}")

        if not text_extracted:
            needs_ocr = True
            results["ocr_needed"].append(pdf_path.name)

        # Build reference stub
        rec = {
            "title":             title,
            "authors":           author,
            "year":              year,
            "source_type":       "other",
            "url_doi":           "",
            "verification_status": "surfaced",
            "physical_holding":  "pdf",
            "holding_location":  str(pdf_path),
            "annotation":        text_extracted[:500] if text_extracted else "<!-- Scanned PDF — run Gemma OCR to extract content -->",
            "tags":              "pdf-import",
        }

        try:
            write_canonical_reference(rec)
            results["imported"] += 1
        except Exception as e:
            results["errors"].append(f"{pdf_path.name}: {e}")

    return jsonify({
        **results,
        "path": str(pdf_dir),
        "message": _scan_summary(results)
    })


def _scan_summary(r):
    parts = []
    if r["imported"]:   parts.append(f"{r['imported']} imported")
    if r["skipped"]:    parts.append(f"{r['skipped']} already in library")
    if r["ocr_needed"]: parts.append(f"{len(r['ocr_needed'])} need Gemma OCR")
    if r["errors"]:     parts.append(f"{len(r['errors'])} errors")
    return " · ".join(parts) if parts else "Nothing new found"


@app.route("/api/ingest/ocr", methods=["POST"])
def ocr_capture():
    """
    Run Gemma 4 OCR on an uploaded image or scanned PDF.
    Returns extracted text as a capture record.
    Saves to canonical/sessions/ as a capture file.
    """
    import base64

    file        = request.files.get("file")
    source_note = request.form.get("note", "")   # optional context from researcher
    mode        = request.form.get("mode", "typed")  # "typed" or "handwritten"
    if not file:
        return jsonify({"error": "No file uploaded"}), 400

    filename  = file.filename.lower()
    file_data = file.read()
    is_pdf    = filename.endswith(".pdf")
    is_image  = any(filename.endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".webp", ".gif"])

    if not is_pdf and not is_image:
        return jsonify({"error": "Unsupported file type — use PDF, JPG, PNG, or WEBP"}), 400

    # For PDFs in typed mode: try pdfplumber text extraction first
    # In handwritten mode: skip pdfplumber entirely — go straight to Gemma
    if is_pdf and mode != "handwritten":
        try:
            import pdfplumber, io
            with pdfplumber.open(io.BytesIO(file_data)) as pdf:
                pages_text = []
                for page in pdf.pages:
                    t = page.extract_text()
                    if t:
                        pages_text.append(t)
                extracted = "\n".join(pages_text).strip()
            if extracted:
                # Typed PDF — no OCR needed
                capture = _write_capture(extracted, file.filename, source_note, method="pdfplumber")
                return jsonify({
                    "status":   "extracted",
                    "method":   "pdfplumber",
                    "message":  f"Text extracted — {len(pdf.pages)} pages",
                    "text":     extracted[:1000],
                    "capture":  capture,
                })
        except Exception:
            pass  # fall through to Gemma

    # Image or scanned PDF — send to Gemma 4 via Ollama multimodal
    try:
        import urllib.request as _ur
        settings  = load_settings()
        local_cfg = settings.get("models", {}).get("local", {})
        model_str = local_cfg.get("multimodal", "gemma4:latest")

        ocr_prompt = "Please transcribe all text visible in this image exactly as written. Preserve line breaks where meaningful. If handwritten, do your best — note any words you are uncertain about with [?]."
        if source_note:
            ocr_prompt += f"\n\nContext from researcher: {source_note}"

        def _gemma_ocr_image(image_b64):
            """Send a single image to Gemma and return transcribed text."""
            payload = json.dumps({
                "model":      model_str,
                "prompt":     ocr_prompt,
                "images":     [image_b64],
                "stream":     False,
                "keep_alive": 0
            }).encode()
            req = _ur.Request(
                f"{OLLAMA_BASE}/api/generate",
                data=payload,
                headers={"Content-Type": "application/json"}
            )
            with _ur.urlopen(req, timeout=120) as r:
                return json.loads(r.read()).get("response", "").strip()

        # Multi-page handwritten PDF — rasterize each page and OCR individually
        if is_pdf and mode == "handwritten":
            try:
                from pdf2image import convert_from_bytes
                import io as _io
                # poppler may not be on Flask's PATH (launchd strips Homebrew)
                # pass the explicit path so pdf2image can find pdftoppm
                import shutil, os
                poppler_path = shutil.which("pdftoppm") or "/opt/homebrew/bin"
                if poppler_path and poppler_path.endswith("pdftoppm"):
                    poppler_path = os.path.dirname(poppler_path)
                pages = convert_from_bytes(file_data, dpi=200, poppler_path=poppler_path)
                page_texts = []
                for i, page_img in enumerate(pages):
                    buf = _io.BytesIO()
                    page_img.save(buf, format="PNG")
                    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
                    text = _gemma_ocr_image(b64)
                    page_texts.append(f"--- Page {i+1} ---\n{text}")
                ocr_text = "\n\n".join(page_texts)
                page_count = len(pages)
                method_label = f"gemma-ocr-{page_count}p"
            except ImportError:
                return jsonify({"error": "pdf2image not installed — run: pip install pdf2image and brew install poppler"}), 500
        else:
            # Single image or single-page PDF
            b64 = base64.b64encode(file_data).decode("utf-8")
            ocr_text = _gemma_ocr_image(b64)
            method_label = "gemma-ocr"
            page_count = 1

        capture = _write_capture(ocr_text, file.filename, source_note, method=method_label)
        return jsonify({
            "status":  "ocr_complete",
            "method":  method_label,
            "message": f"Gemma OCR complete — {page_count} page(s)",
            "text":    ocr_text[:1000],
            "full_text": ocr_text,
            "capture": capture,
        })

    except Exception as e:
        import traceback
        return jsonify({"error": f"Gemma OCR failed: {e}", "detail": traceback.format_exc()}), 500


def _write_capture(text: str, source_filename: str, note: str, method: str) -> str:
    """Write a capture canonical file and return its filename."""
    capture_id = str(uuid.uuid4())
    timestamp  = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M")
    filename   = f"capture_{timestamp}.md"
    canonical  = f"""---
id: {capture_id}
created_at: {datetime.now(timezone.utc).isoformat()}
source_type: capture
capture_method: {method}
source_file: {source_filename}
status: raw-capture
---

## Source Note
{note or "<!-- Add context: where was this from, who wrote it, what situation? -->"}

## Extracted Text
{text}

## Your Annotation
<!-- What does this capture mean for your research? -->
"""
    filepath = SESSIONS_DIR / filename
    filepath.write_text(canonical, encoding="utf-8")
    return filename


@app.route("/api/notes", methods=["GET"])
def get_notes():
    notes = []
    for filepath in sorted(NOTES_DIR.glob("*.md"), reverse=True):
        try:
            text  = filepath.read_text(encoding="utf-8")
            parts = text.split("---", 2)
            if len(parts) >= 3:
                meta = {}
                for line in parts[1].strip().splitlines():
                    if ": " in line:
                        k, v = line.split(": ", 1)
                        meta[k.strip()] = v.strip()
                meta["_filename"] = filepath.name
                body = parts[2]
                def extract_note_section(body, heading):
                    if "## " + heading in body:
                        raw = body.split("## " + heading)[1].split("\n## ")[0].strip()
                        if raw and not raw.startswith("<!--"):
                            return raw
                    return ""
                meta["body"]        = extract_note_section(body, "What I'm sitting with")
                meta["questions"]   = extract_note_section(body, "Questions it raised")
                meta["connections"] = extract_note_section(body, "Connections I'm noticing")
                notes.append(meta)
        except Exception:
            pass
    return jsonify(notes)


@app.route("/api/notes", methods=["POST"])
def create_note():
    data     = request.json or {}
    title    = data.get("title", "").strip()
    if not title:
        return jsonify({"error": "Title required"}), 400
    note_id  = str(uuid.uuid4())
    slug     = "-".join(title.lower().split()[:5])
    slug     = "".join(c for c in slug if c.isalnum() or c == "-")
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M")
    filename  = f"note_{timestamp}_{slug[:30]}.md"
    body      = data.get("body", "") or "<!-- What are you sitting with? -->"
    canonical = f"""---
id: {note_id}
title: {title}
source: {data.get("source", "")}
project: {data.get("project", "")}
writing: {data.get("writing", "")}
status: active
created_at: {datetime.now(timezone.utc).isoformat()}
updated_at: {datetime.now(timezone.utc).isoformat()}
---

## What I'm sitting with
{body}

## Questions it raised
<!-- Questions this reading or thought provoked -->

## Connections I'm noticing
<!-- Links to other ideas, sources, or threads -->
"""
    filepath = NOTES_DIR / filename
    filepath.write_text(canonical, encoding="utf-8")
    return jsonify({"status": "created", "filename": filename, "slug": slug})


@app.route("/api/notes/<note_filename>", methods=["PUT"])
def update_note(note_filename):
    if "/" in note_filename or "\\" in note_filename or ".." in note_filename:
        return jsonify({"error": "Invalid filename"}), 400
    filepath = (NOTES_DIR / note_filename).resolve()
    if not filepath.exists():
        return jsonify({"error": "Note not found"}), 404
    data  = request.json or {}
    text  = filepath.read_text(encoding="utf-8")
    parts = text.split("---", 2)
    if len(parts) < 3:
        return jsonify({"error": "Invalid format"}), 400
    meta = {}
    for line in parts[1].strip().splitlines():
        if ": " in line:
            k, v = line.split(": ", 1)
            meta[k.strip()] = v.strip()
    for field in ["title", "source", "project", "writing", "status"]:
        if field in data:
            meta[field] = data[field]
    meta["updated_at"] = datetime.now(timezone.utc).isoformat()
    body = parts[2]
    def replace_note_section(body, heading, new_content):
        if not new_content:
            return body
        marker = "## " + heading
        if marker in body:
            before = body.split(marker)[0]
            rest   = body.split(marker)[1]
            after  = ("\n## " + rest.split("\n## ", 1)[1]) if "\n## " in rest else ""
            return before + marker + "\n" + new_content + "\n" + after
        return body.rstrip() + "\n\n" + marker + "\n" + new_content + "\n"
    if "body" in data:
        body = replace_note_section(body, "What I'm sitting with", data["body"])
    if "questions" in data:
        body = replace_note_section(body, "Questions it raised", data["questions"])
    if "connections" in data:
        body = replace_note_section(body, "Connections I'm noticing", data["connections"])
    fm_lines = "\n".join(f"{k}: {v}" for k, v in meta.items() if v is not None)
    filepath.write_text(f"---\n{fm_lines}\n---\n{body}", encoding="utf-8")
    return jsonify({"status": "updated"})


@app.route("/api/notes/<note_filename>", methods=["DELETE"])
def delete_note(note_filename):
    if "/" in note_filename or "\\" in note_filename or ".." in note_filename:
        return jsonify({"error": "Invalid filename"}), 400
    filepath = (NOTES_DIR / note_filename).resolve()
    if not filepath.exists():
        return jsonify({"error": "Note not found"}), 404
    filepath.unlink()
    return jsonify({"status": "deleted"})


@app.route("/api/broadcast", methods=["GET"])
def get_broadcast():
    try:
        import urllib.request
        with urllib.request.urlopen(BROADCAST_URL, timeout=3) as r:
            data = json.loads(r.read())
            b = data.get("broadcast", {})
            if not b.get("active"): return jsonify({})
            expires = b.get("expires")
            if expires and datetime.fromisoformat(expires) < datetime.now(timezone.utc): return jsonify({})
            return jsonify(b)
    except Exception:
        return jsonify({})


@app.route("/api/save-break", methods=["POST"])
def save_and_break():
    """
    Save & Take a Break — always writes a full timestamped snapshot zip to the
    local backup folder first. Git commit is optional (developer-only, opt-in).

    Backup hierarchy:
    1. Local folder snapshot (always, primary safety net)
    2. Git commit + push (only if MARGINALIA_GIT_ENABLED=true in setup.env)

    The 2h nudge is the reminder to take this break -- get up, move, come back.
    The snapshot is the artefact of that pause.
    """
    import zipfile
    now     = datetime.now(timezone.utc)
    ts      = now.strftime("%Y%m%d-%H%M")
    zipname = f"marginalia-snapshot-{ts}.zip"
    zippath = BACKUP_DIR / zipname

    # Always write local snapshot — sessions, refs, notes, projects, writing, seeds
    try:
        with zipfile.ZipFile(zippath, "w", zipfile.ZIP_DEFLATED) as zf:
            for folder in [REFERENCES_DIR, SESSIONS_DIR, NOTES_DIR, PROJECTS_DIR, WRITING_DIR]:
                if folder.exists():
                    for f in folder.rglob("*"):
                        if f.is_file():
                            zf.write(f, f.relative_to(CANONICAL_DIR))
            # Include seeds if present
            seeds = CANONICAL_DIR / "marginalia-seeds.md"
            if seeds.exists():
                zf.write(seeds, seeds.relative_to(CANONICAL_DIR))
        snapshot_ok  = True
        snapshot_msg = f"Snapshot saved: {zipname}"
    except Exception as e:
        snapshot_ok  = False
        snapshot_msg = f"Snapshot failed: {e}"

    # Git commit — developer-only, opt-in
    git_ok  = None
    git_msg = None
    if GIT_ENABLED:
        try:
            from utils.git_preflight import safe_commit
            message  = request.json.get("message", f"Session snapshot {ts}")
            git_result = safe_commit(APP_ROOT, message)
            git_ok   = git_result.get("ok", False)
            git_msg  = git_result.get("message", "")
        except Exception as e:
            git_ok  = False
            git_msg = str(e)

    return jsonify({
        "ok":           snapshot_ok,
        "snapshot":     snapshot_msg,
        "snapshot_path": str(zippath) if snapshot_ok else None,
        "git_enabled":  GIT_ENABLED,
        "git_ok":       git_ok,
        "git_message":  git_msg,
    })


@app.route("/api/save-delta", methods=["POST"])
def save_delta():
    """
    2h rolling delta -- writes only files changed since last save to backup folder.
    Silent, no prompt, no interruption. Fires in background.
    Nudge banner only appears if researcher is actively in tool at 2h mark.
    """
    import zipfile
    now       = datetime.now(timezone.utc)
    ts        = now.strftime("%Y%m%d-%H%M")
    since_ts  = request.json.get("since")  # ISO timestamp from frontend
    zipname   = f"marginalia-delta-{ts}.zip"
    zippath   = BACKUP_DIR / zipname

    try:
        since_dt = datetime.fromisoformat(since_ts.replace("Z", "+00:00")) if since_ts else None
        changed  = []
        for folder in [REFERENCES_DIR, SESSIONS_DIR, NOTES_DIR, PROJECTS_DIR, WRITING_DIR]:
            if folder.exists():
                for f in folder.rglob("*"):
                    if f.is_file():
                        if since_dt is None or datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc) > since_dt:
                            changed.append(f)

        if not changed:
            return jsonify({"ok": True, "message": "No changes since last save", "files": 0})

        with zipfile.ZipFile(zippath, "w", zipfile.ZIP_DEFLATED) as zf:
            for f in changed:
                zf.write(f, f.relative_to(CANONICAL_DIR))

        return jsonify({
            "ok":      True,
            "message": f"Delta saved: {zipname} ({len(changed)} files)",
            "files":   len(changed),
            "path":    str(zippath),
            "saved_at": now.isoformat(),
        })
    except Exception as e:
        return jsonify({"ok": False, "message": f"Delta failed: {e}"}), 500


@app.route("/assets/<path:filename>")
def serve_assets(filename):
    return send_from_directory(APP_ROOT / "assets", filename)


if __name__ == "__main__":
    port = int(os.environ.get("MARGINALIA_PORT", 5000))
    threading.Timer(1.5, lambda: webbrowser.open(f"http://localhost:{port}")).start()
    print(f"\n  Marginalia v1.5.0.0628-2250 running at http://localhost:{port}\n")
    print(f"  Keys loaded from: {'setup.env' if setup_env.exists() else '.env (legacy)'}\n")
    app.run(host="0.0.0.0", port=port, debug=False)
