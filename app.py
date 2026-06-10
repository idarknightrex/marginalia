"""
Marginalia — app.py  v0.8.3
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
from datetime import datetime

from flask import Flask, request, jsonify, render_template, send_from_directory, Response, stream_with_context
from dotenv import load_dotenv

# ─── Paths ────────────────────────────────────────────────────────────────────
from utils.paths import (
    APP_ROOT, CANONICAL_DIR, REFERENCES_DIR, SESSIONS_DIR,
    CAPTURES_DIR, EXPORTS_DIR, SETTINGS_PATH, BROADCAST_URL
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

# If OLLAMA_MODELS_PATH is set in setup.env, inject it into the environment
# so Ollama finds models on external drives (e.g. Vault SSD on Mac Mini)
_ollama_models_path = os.getenv("OLLAMA_MODELS_PATH", "")
if _ollama_models_path:
    os.environ["OLLAMA_MODELS"] = _ollama_models_path

for d in [REFERENCES_DIR, SESSIONS_DIR, CAPTURES_DIR, EXPORTS_DIR, APP_ROOT / "db"]:
    d.mkdir(parents=True, exist_ok=True)

# ─── App ──────────────────────────────────────────────────────────────────────
app = Flask(__name__, template_folder="templates", static_folder="static")
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024

# ─── Token tracking ───────────────────────────────────────────────────────────
anthropic_tokens = {"input": 0, "output": 0}
import threading as _threading
_tokens_lock = _threading.Lock()

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
    ref_id = data.get("id") or str(uuid.uuid4())
    data["id"] = ref_id
    first_author = data.get("authors", "Unknown").split(";")[0].split(",")[0].strip()
    year = data.get("year", "0000")
    title_slug = "-".join(data.get("title", "untitled").lower().split()[:3])
    title_slug = "".join(c for c in title_slug if c.isalnum() or c == "-")
    filename = f"{first_author}_{year}_{title_slug}.md"

    annotation   = data.get("annotation") or "<!-- AI annotation — run Generate to populate -->"
    user_notes   = data.get("user_notes") or "<!-- Your personal reading notes -->"
    argument     = data.get("argument_connection") or "<!-- How does this source support, complicate, or challenge your research argument? -->"

    # Tags: short, comma-separated, stay in frontmatter
    tags = data.get("tags", "")
    # If old import had themes as short keywords, treat as tags if no dedicated tags field
    if not tags and data.get("themes", ""):
        raw = data.get("themes", "")
        # Heuristic: if all comma-parts are short (<= 4 words), treat as tags
        parts = [p.strip() for p in raw.split(",") if p.strip()]
        if all(len(p.split()) <= 4 for p in parts):
            tags = raw

    # Themes: longer phrases, bullet list in body
    themes_raw = data.get("themes", "")
    if themes_raw and themes_raw != tags:
        theme_lines = "\n".join(
            ("- " + t.strip()) if not t.strip().startswith("-") else t.strip()
            for t in themes_raw.split(",") if t.strip()
        )
    else:
        theme_lines = "<!-- Conceptual themes — full phrases, one per line as: - theme -->"

    # Connections: name | note per line
    connections_raw = data.get("connections", "")
    if connections_raw:
        conn_lines = connections_raw
    else:
        conn_lines = "<!-- Connections to writing/projects: name | note -->"

    canonical = f"""---
id: {ref_id}
title: {data.get("title", "")}
authors: {data.get("authors", "")}
year: {data.get("year", "")}
source_type: {data.get("source_type", "other")}
url_doi: {data.get("url_doi", "")}
verification_status: {data.get("verification_status", "surfaced")}
physical_holding: {data.get("physical_holding", "none")}
holding_location: {data.get("holding_location", "")}
tags: {tags}
created_at: {datetime.now().isoformat()}
updated_at: {datetime.now().isoformat()}
---

## Themes
{theme_lines}

## Connections
{conn_lines}

## Annotation
{annotation}

## Argument Connection
{argument}

## Your Notes
{user_notes}
"""
    filepath = REFERENCES_DIR / filename
    filepath.write_text(canonical, encoding="utf-8")
    return filepath


def write_canonical_session(prompt: str, responses: dict, synthesis: str = "") -> Path:
    session_id = str(uuid.uuid4())
    timestamp  = datetime.now().strftime("%Y-%m-%d_%H-%M")
    filename   = f"session_{timestamp}.md"
    response_blocks = "\n\n".join(
        f"### {model.capitalize()}\n{text}" for model, text in responses.items() if text
    )
    synth_block = synthesis if synthesis else "<!-- Add synthesis notes here -->"
    canonical = f"""---
id: {session_id}
created_at: {datetime.now().isoformat()}
models: {list(responses.keys())}
---

## Prompt
{prompt}

## Responses
{response_blocks}

## Synthesis
{synth_block}
"""
    filepath = SESSIONS_DIR / filename
    filepath.write_text(canonical, encoding="utf-8")
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
                    # Extract body sections
                    body = parts[2]
                    def extract_section(body, heading):
                        if "## " + heading in body:
                            raw = body.split("## " + heading)[1].split("\n## ")[0].strip()
                            if raw and not raw.startswith("<!--"):
                                return raw
                        return ""
                    meta["annotation"]          = extract_section(body, "Annotation")
                    meta["argument_connection"] = extract_section(body, "Argument Connection")
                    meta["user_notes"]           = extract_section(body, "Your Notes")
                    meta["themes_body"]          = extract_section(body, "Themes")
                    meta["connections"]          = extract_section(body, "Connections")

                    # Migration: old files have themes in frontmatter, not body
                    if not meta["themes_body"] and meta.get("themes"):
                        meta["themes_body"] = meta["themes"]
                    # Expose clean lists
                    meta["tags_list"]  = [t.strip() for t in meta.get("tags","").split(",") if t.strip()]
                    meta["theme_list"] = [ln.lstrip("- ").strip() for ln in (meta["themes_body"] or "").splitlines() if ln.strip() and not ln.strip().startswith("<!--")]
                    meta["conn_list"]  = [ln.strip() for ln in (meta["connections"] or "").splitlines() if ln.strip() and not ln.strip().startswith("<!--")]
                    refs.append(meta)
        except Exception:
            pass
    return refs


def call_ollama(model_str: str, prompt: str, unload_after: bool = True) -> str:
    """
    Call a local Ollama model.
    unload_after=True sets keep_alive=0 — model is evicted from memory immediately
    after responding. This allows sequential local model firing without memory pressure.
    """
    import urllib.request as _ur
    payload = json.dumps({
        "model":      model_str,
        "prompt":     prompt,
        "stream":     False,
        "keep_alive": 0 if unload_after else "5m"
    }).encode()
    req = _ur.Request(f"{OLLAMA_BASE}/api/generate", data=payload, headers={"Content-Type": "application/json"})
    with _ur.urlopen(req, timeout=300) as r:
        return json.loads(r.read()).get("response", "")


def run_synthesis(prompt: str, responses: dict, synthesis_model: str = "deepseek") -> str:
    settings  = load_settings()
    local_cfg = settings.get("models", {}).get("local", {})
    model_map = {
        "deepseek": local_cfg.get("reasoning",  "deepseek-r1:8b"),
        "qwen":     local_cfg.get("asia",       "qwen2.5:14b"),
        "mistral":  local_cfg.get("europe",     "mistral:7b"),
        "gemma":    local_cfg.get("multimodal", "gemma4:latest"),
        "llama":    local_cfg.get("general",    "llama3.1:8b"),
    }
    model_str = model_map.get(synthesis_model, local_cfg.get("reasoning", "deepseek-r1:8b"))
    response_block = "\n\n".join(
        f"[{model.upper()}]\n{text}" for model, text in responses.items() if text
    )
    synth_prompt = f"""You are a research synthesis engine. A researcher asked the following question and received responses from multiple AI models. Synthesize these into a single analytical summary.

RESEARCHER'S QUESTION:
{prompt}

MODEL RESPONSES:
{response_block}

Provide a synthesis identifying:
1. CONSENSUS: What do the models agree on?
2. DIVERGENCE: Where do they differ, and why?
3. UNIQUE CONTRIBUTIONS: What does each model add that others missed?
4. GAPS: What important angles did none address?

Be concise. The researcher will use this to decide what to investigate further."""
    try:
        return call_ollama(model_str, synth_prompt)
    except Exception as e:
        return f"Synthesis unavailable — DeepSeek R1 error: {e}"


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
    try:
        import bibtexparser
        db = bibtexparser.loads(text)
    except ImportError:
        return _parse_bibtex_minimal(text)
    type_map = {
        "article": "journal", "book": "book", "inbook": "chapter",
        "incollection": "chapter", "inproceedings": "conference",
        "proceedings": "conference", "phdthesis": "thesis",
        "mastersthesis": "thesis", "misc": "other", "techreport": "other",
    }
    records = []
    for entry in db.entries:
        authors_raw = entry.get("author", "")
        authors = "; ".join(a.strip() for a in authors_raw.split(" and ")) if authors_raw else ""
        rec = {
            "title":       entry.get("title", "").replace("{", "").replace("}", ""),
            "authors":     authors,
            "year":        entry.get("year", ""),
            "source_type": type_map.get(entry.get("ENTRYTYPE", "").lower(), "other"),
            "url_doi":     entry.get("doi", "") or entry.get("url", ""),
            "annotation":  entry.get("abstract", ""),
            "themes":      entry.get("keywords", ""),
        }
        if rec["title"]:
            records.append(rec)
    return records


def _parse_bibtex_minimal(text: str) -> list:
    import re
    records = []
    entries = re.findall(r'@\w+\{[^@]+\}', text, re.DOTALL)
    for entry in entries:
        def field(name):
            m = re.search(rf'{name}\s*=\s*[{{"](.+?)[{{}}"]\s*[,}}]', entry, re.IGNORECASE | re.DOTALL)
            return m.group(1).strip().replace('\n', ' ') if m else ""
        authors_raw = field("author")
        authors = "; ".join(a.strip() for a in authors_raw.split(" and ")) if authors_raw else ""
        rec = {"title": field("title").replace("{","").replace("}",""), "authors": authors, "year": field("year"), "url_doi": field("doi") or field("url")}
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
        elif tag == "KW": current["themes"] = (current.get("themes","") + ", " + val).strip(", ")
        elif tag == "N1": current["argument_connection"] = val
    return records


def lookup_doi(doi: str) -> dict:
    import urllib.request as _ur
    doi = doi.strip().lstrip("https://doi.org/").lstrip("http://doi.org/").lstrip("doi:")
    url = f"https://api.crossref.org/works/{doi}"
    try:
        req = _ur.Request(url, headers={"User-Agent": "Marginalia/0.8.3 (mailto:research@marginalia.local)"})
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
    return render_template("index.html")

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
            rec.setdefault("verification_status", "surfaced")
            rec.setdefault("physical_holding", "none")
            imported.append(write_canonical_reference(rec).name)
        except Exception as e:
            parse_errors.append(str(e))

    return jsonify({"format": fmt, "imported": len(imported), "skipped": len(skipped), "errors": parse_errors, "files": imported})


@app.route("/api/doi-lookup", methods=["POST"])
def doi_lookup():
    doi = request.json.get("doi", "")
    if not doi: return jsonify({"error": "No DOI provided"}), 400
    return jsonify(lookup_doi(doi))




@app.route("/api/setup-status", methods=["GET"])
def setup_status():
    """
    Check whether setup.env has been configured.
    Returns a warning if all keys are blank (fresh install).
    """
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
    """
    Query Ollama /api/tags to find which local models are actually installed.
    Returns a dict of model_key -> { installed, model_str, size_gb }
    """
    import urllib.request as _ur

    # Known local models: chip key -> list of possible ollama name prefixes
    LOCAL_MODEL_MAP = {
        "deepseek": ["deepseek-r1"],
        "qwen":     ["qwen2.5", "qwen"],
        "mistral":  ["mistral"],
        "gemma":    ["gemma4", "gemma"],
        "llama":    ["llama3.1", "llama3", "llama"],
    }

    installed = {}
    try:
        req = _ur.Request(
            f"{OLLAMA_BASE}/api/tags",
            headers={"Content-Type": "application/json"}
        )
        with _ur.urlopen(req, timeout=5) as r:
            data = json.loads(r.read())
        ollama_models = {m["name"]: m for m in data.get("models", [])}
        claimed_ollama_names = set()

        for chip_key, prefixes in LOCAL_MODEL_MAP.items():
            found = None
            for name, info in ollama_models.items():
                for prefix in prefixes:
                    if name.startswith(prefix):
                        found = {
                            "installed": True,
                            "model_str": name,
                            "size_gb":   round(info.get("size", 0) / 1e9, 1)
                        }
                        claimed_ollama_names.add(name)
                        break
                if found:
                    break
            installed[chip_key] = found or {"installed": False, "model_str": None, "size_gb": 0}

        # Surface any Ollama models not claimed by a known chip as dynamic entries
        for name, info in ollama_models.items():
            if name not in claimed_ollama_names:
                chip_key = "ollama:" + name
                installed[chip_key] = {
                    "installed": True,
                    "model_str": name,
                    "size_gb":   round(info.get("size", 0) / 1e9, 1),
                    "dynamic":   True
                }

    except Exception as e:
        # Ollama not running or unreachable — mark all as unknown
        for chip_key in LOCAL_MODEL_MAP:
            installed[chip_key] = {"installed": None, "model_str": None, "size_gb": 0, "error": str(e)}

    return jsonify(installed)

@app.route("/api/key-status", methods=["GET"])
def key_status():
    """Tell the frontend which API keys are configured — no values, just booleans."""
    return jsonify({
        "gemini":     bool(KEYS.get("gemini")),
        "anthropic":  bool(KEYS.get("anthropic")),
        "openai":     bool(KEYS.get("openai")),
        "deepseek":  True,  # local — always available if Ollama is running
        "gemma":     True,  # local — always available if Ollama is running
        "llama":     True,  # local — always available if Ollama is running
        "qwen":      True,  # local — always available if Ollama is running
        "mistral":   True,  # local — always available if Ollama is running
    })

def call_model(model, prompt):
    """Call one model. Returns (model, result, error, input_tokens, output_tokens)."""
    settings  = load_settings()
    local_cfg = settings.get("models", {}).get("local", {})
    try:
        if model == "gemini" and KEYS.get("gemini"):
            import google.generativeai as genai
            genai.configure(api_key=KEYS["gemini"])
            r = genai.GenerativeModel("gemini-2.5-flash").generate_content(prompt, request_options={"timeout": 30})
            return (model, r.text, None, 0, 0)
        elif model == "anthropic" and KEYS.get("anthropic"):
            import anthropic as _anth
            client = _anth.Anthropic(api_key=KEYS["anthropic"])
            msg = client.messages.create(model="claude-haiku-4-5", max_tokens=1024,
                                         messages=[{"role": "user", "content": prompt}])
            return (model, msg.content[0].text, None,
                    msg.usage.input_tokens, msg.usage.output_tokens)
        elif model == "openai" and KEYS.get("openai"):
            from openai import OpenAI
            client = OpenAI(api_key=KEYS["openai"])
            r = client.chat.completions.create(model="gpt-4o",
                                               messages=[{"role": "user", "content": prompt}])
            return (model, r.choices[0].message.content, None, 0, 0)
        elif model == "deepseek":
            return (model, call_ollama(local_cfg.get("reasoning",  "deepseek-r1:8b"),    prompt), None, 0, 0)
        elif model == "gemma":
            return (model, call_ollama(local_cfg.get("multimodal", "gemma4:latest"),     prompt), None, 0, 0)
        elif model == "llama":
            return (model, call_ollama(local_cfg.get("general",    "llama3.1:8b"),       prompt), None, 0, 0)
        elif model == "qwen":
            return (model, call_ollama(local_cfg.get("asia",       "qwen2.5:14b"),       prompt), None, 0, 0)
        elif model == "mistral":
            return (model, call_ollama(local_cfg.get("europe",     "mistral:7b"), prompt), None, 0, 0)
        elif model.startswith("ollama:"):
            # Dynamic model — call Ollama directly with the model string after "ollama:"
            return (model, call_ollama(model[len("ollama:"):], prompt), None, 0, 0)
        else:
            return (model, None, "No key configured", 0, 0)
    except Exception as e:
        return (model, None, str(e), 0, 0)


# Firing order — cloud parallel first, local sequential after
MODEL_ORDER   = ["gemini", "anthropic", "openai", "deepseek", "qwen", "mistral", "gemma", "llama"]
CLOUD_MODELS  = {"gemini", "anthropic", "openai"}
LOCAL_MODELS  = {"deepseek", "gemma", "llama", "qwen", "mistral"}


@app.route("/api/prompt", methods=["POST"])
def handle_prompt():
    global anthropic_tokens
    data           = request.json
    prompt         = data.get("prompt", "")
    models         = data.get("models", [])
    synthesis_model = data.get("synthesis_model", "deepseek")

    # Dynamic ollama: models come in from the frontend — collect them separately
    dynamic_local = [m for m in models if m.startswith("ollama:")]
    cloud_ordered = [m for m in MODEL_ORDER if m in models and m in CLOUD_MODELS]
    local_ordered = [m for m in MODEL_ORDER if m in models and m in LOCAL_MODELS] + dynamic_local

    def generate():
        import concurrent.futures
        results, errors = {}, {}

        # Phase 1 — cloud models in parallel
        if cloud_ordered:
            for m in cloud_ordered:
                yield json.dumps({"event": "start", "model": m}) + "\n"
            with concurrent.futures.ThreadPoolExecutor() as ex:
                futures = {ex.submit(call_model, m, prompt): m for m in cloud_ordered}
                for future in concurrent.futures.as_completed(futures):
                    model, result, error, in_tok, out_tok = future.result()
                    if in_tok:
                        with _tokens_lock:
                            anthropic_tokens["input"]  += in_tok
                            anthropic_tokens["output"] += out_tok
                    if result:
                        results[model] = result
                        yield json.dumps({"event": "result", "model": model, "text": result}) + "\n"
                    else:
                        errors[model] = error or "No response"
                        yield json.dumps({"event": "error", "model": model, "error": errors[model]}) + "\n"

        # Phase 2 — local models one at a time
        for model in local_ordered:
            yield json.dumps({"event": "start", "model": model}) + "\n"
            import time; time.sleep(0.05)  # yield to event loop — forces flush before blocking Ollama call
            yield json.dumps({"event": "heartbeat"}) + "\n"
            _, result, error, _, _ = call_model(model, prompt)
            if result:
                results[model] = result
                yield json.dumps({"event": "result", "model": model, "text": result}) + "\n"
            else:
                errors[model] = error or "No response"
                yield json.dumps({"event": "error", "model": model, "error": errors[model]}) + "\n"

        # Phase 3 — synthesis
        synthesis = ""
        if len(results) > 1:
            yield json.dumps({"event": "synthesis_start"}) + "\n"
            synthesis = run_synthesis(prompt, results, synthesis_model=synthesis_model)
            yield json.dumps({"event": "synthesis", "text": synthesis}) + "\n"

        if results:
            write_canonical_session(prompt, results, synthesis)

        cost = estimate_anthropic_cost(anthropic_tokens["input"], anthropic_tokens["output"])
        yield json.dumps({
            "event":              "done",
            "session_saved":      bool(results),
            "anthropic_cost_usd": round(cost, 4),
        }) + "\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"}
    )




@app.route("/api/references/<ref_filename>", methods=["PUT"])
def update_reference(ref_filename):
    """Update a reference's metadata fields. Rewrites canonical file."""
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

    # Update only provided fields
    for field in ["title","authors","year","source_type","url_doi","themes",
                  "annotation","argument_connection","verification_status",
                  "physical_holding","holding_location"]:
        if field in data:
            meta[field] = str(data[field]).strip()

    # Update annotation and argument in body sections if provided
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

    if "annotation" in data and data["annotation"]:
        body = replace_section(body, "Annotation", data["annotation"])
        meta.pop("annotation", None)
    if "argument_connection" in data and data["argument_connection"]:
        body = replace_section(body, "Argument Connection", data["argument_connection"])
        meta.pop("argument_connection", None)
    if "user_notes" in data and data["user_notes"]:
        body = replace_section(body, "Your Notes", data["user_notes"])
        meta.pop("user_notes", None)
    if "themes_body" in data and data["themes_body"]:
        body = replace_section(body, "Themes", data["themes_body"])
        meta.pop("themes", None)
    if "connections" in data:
        body = replace_section(body, "Connections", data["connections"])
    # tags stay in frontmatter — handled via meta dict above
    if "tags" in data:
        meta["tags"] = data["tags"]

    # Update updated_at timestamp
    meta["updated_at"] = datetime.now().isoformat()

    # Reconstruct frontmatter — preserve all existing keys
    fm_lines = "\n".join(f"{k}: {v}" for k, v in meta.items() if v)
    new_file = f"---\n{fm_lines}\n---\n{body}"
    filepath.write_text(new_file, encoding="utf-8")
    return jsonify({"status": "updated", "filename": ref_filename})


@app.route("/api/references/<ref_filename>", methods=["DELETE"])
def delete_reference(ref_filename):
    """Delete a canonical reference file."""
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
    """Update verification_status with a timestamped log entry."""
    if "/" in ref_filename or "\\" in ref_filename or ".." in ref_filename:
        return jsonify({"error": "Invalid filename"}), 400
    filepath = (REFERENCES_DIR / ref_filename).resolve()
    if REFERENCES_DIR.resolve() not in filepath.parents:
        return jsonify({"error": "Invalid path"}), 400
    if not filepath.exists():
        return jsonify({"error": "Reference not found"}), 404

    new_status = (request.json or {}).get("status", "")
    valid = {"surfaced", "located", "verified"}
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

    # Append status change log as readable markdown
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    body = parts[2]
    log_marker = "## Status History"
    log_line   = f"- {old_status} → **{new_status}** [{timestamp}]"
    if log_marker in body:
        body = body.rstrip() + "\n" + log_line + "\n"
    else:
        body = body.rstrip() + "\n\n" + log_marker + "\n" + log_line + "\n"

    fm_lines = "\n".join(f"{k}: {v}" for k, v in meta.items() if v)
    filepath.write_text(f"---\n{fm_lines}\n---\n{body}", encoding="utf-8")
    return jsonify({"status": "updated", "verification_status": new_status})


@app.route("/api/tags", methods=["GET"])
def get_all_tags():
    """Return all unique tags across the library for autocomplete."""
    tags = set()
    for ref in read_all_references():
        for t in ref.get("tags_list", []):
            if t:
                tags.add(t.lower().strip())
    return jsonify(sorted(tags))


@app.route("/api/connections", methods=["GET"])
def get_all_connections():
    """Return all unique connection names across the library for autocomplete."""
    conns = set()
    for ref in read_all_references():
        for line in ref.get("conn_list", []):
            name = line.split("|")[0].strip()
            if name:
                conns.add(name.lower().strip())
    return jsonify(sorted(conns))

@app.route("/api/references/library-synthesis", methods=["POST"])
def library_synthesis():
    """
    Read all canonical reference annotations and run a synthesis pass.
    Surfaces: recurring themes, tensions between sources, gaps, sources
    that should be in conversation. All from your own curated material.
    """
    refs = read_all_references()
    if not refs:
        return jsonify({"error": "No references found in library"}), 400

    # Build a condensed representation of the library
    ref_summaries = []
    for ref in refs:
        if ref.get("title"):
            entry = f"[{ref.get('authors','Unknown')} {ref.get('year','')}] {ref.get('title','')}"
            if ref.get("themes"):
                entry += f" — themes: {ref.get('themes')}"
            # Read annotation from file if available
            filepath = REFERENCES_DIR / ref.get("_filename", "")
            if filepath.exists():
                text = filepath.read_text(encoding="utf-8")
                parts = text.split("---", 2)
                if len(parts) >= 3:
                    body = parts[2].strip()
                    # Extract annotation section
                    if "## Annotation" in body:
                        ann = body.split("## Annotation")[1].split("##")[0].strip()
                        if ann and not ann.startswith("<!--"):
                            entry += f"\nAnnotation: {ann[:200]}"
            ref_summaries.append(entry)

    library_text = "\n\n".join(ref_summaries)

    settings  = load_settings()
    local_cfg = settings.get("models", {}).get("local", {})
    model_str = local_cfg.get("reasoning", "deepseek-r1:8b")

    lens_prompt = f"""You are a research librarian helping a PhD researcher understand their own collection.
Read the following reference library and identify:

1. RECURRING THEMES: What topics and concepts appear most frequently?
2. TENSIONS: Which sources seem to argue against each other?
3. GAPS: What important perspectives or topics are missing from this collection?
4. CONVERSATIONS: Which sources should be read together and why?
5. RESEARCH QUESTION FIT: How well does this collection support research on embodied learning, community-building, and performance anxiety in undergraduates?

Be specific — cite author names and years. This is the researcher's own curated material, not general knowledge.

LIBRARY:
{library_text}"""

    try:
        synthesis = call_ollama(model_str, lens_prompt)
        return jsonify({"synthesis": synthesis, "ref_count": len(refs)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/references/<ref_filename>/annotate", methods=["POST"])
def annotate_reference(ref_filename):
    """
    Run a single reference through selected models and synthesise their readings.
    Writes multi-voice annotation back to the canonical file.
    """
    data   = request.json or {}
    models = data.get("models", ["deepseek"])

    # Path traversal guard — filename must be a bare name, no separators
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

    # Parse frontmatter
    meta = {}
    for line in parts[1].strip().splitlines():
        if ": " in line:
            k, v = line.split(": ", 1)
            meta[k.strip()] = v.strip()

    title   = meta.get("title", "Unknown")
    authors = meta.get("authors", "Unknown")
    year    = meta.get("year", "")
    themes  = meta.get("themes", "")

    existing_body = parts[2]
    existing_annotation = ""
    if "## Annotation" in existing_body:
        existing_annotation = existing_body.split("## Annotation")[1].split("##")[0].strip()
        if existing_annotation.startswith("<!--"):
            existing_annotation = ""

    annotation_prompt = f"""Read this academic reference and provide a concise critical annotation (100-150 words).
What does this source argue? What is its methodology? What are its limitations?

Title: {title}
Authors: {authors} ({year})
Themes: {themes}
{"Existing annotation: " + existing_annotation if existing_annotation else ""}

Provide a scholarly annotation suitable for a PhD research bibliography."""

    results = {}
    for model in models:
        try:
            _, result, error, _, _ = call_model(model, annotation_prompt)
            if result:
                results[model] = result
        except Exception as e:
            results[model] = f"Error: {e}"

    if not results:
        return jsonify({"error": "No models returned annotations"}), 500

    # Synthesise if multiple models
    if len(results) > 1:
        synthesis = run_synthesis(annotation_prompt, results)
    else:
        synthesis = list(results.values())[0]

    # Write multi-voice annotation back to canonical file
    voices = "\n\n".join(f"**{m.upper()}:** {r}" for m, r in results.items())
    new_annotation = f"<!-- Multi-voice annotation generated {datetime.now().strftime('%Y-%m-%d')} -->\n\n{voices}\n\n**SYNTHESIS:** {synthesis}"

    # Replace annotation section in file
    if "## Annotation" in existing_body:
        before = existing_body.split("## Annotation")[0]
        after_parts = existing_body.split("## Annotation")[1].split("\n## ", 1)
        after = ("\n## " + after_parts[1]) if len(after_parts) > 1 else ""
        new_body = before + "## Annotation\n" + new_annotation + after
    else:
        new_body = existing_body + "\n## Annotation\n" + new_annotation

    new_file = "---" + parts[1] + "---\n" + new_body
    filepath.write_text(new_file, encoding="utf-8")

    return jsonify({
        "status":      "annotated",
        "filename":    ref_filename,
        "models_used": list(results.keys()),
        "synthesis":   synthesis
    })

@app.route("/api/broadcast", methods=["GET"])
def get_broadcast():
    try:
        import urllib.request
        with urllib.request.urlopen(BROADCAST_URL, timeout=3) as r:
            data = json.loads(r.read())
            b = data.get("broadcast", {})
            if not b.get("active"): return jsonify({})
            expires = b.get("expires")
            if expires and datetime.fromisoformat(expires) < datetime.now(): return jsonify({})
            return jsonify(b)
    except Exception:
        return jsonify({})


@app.route("/api/save-break", methods=["POST"])
def save_and_break():
    from utils.git_preflight import safe_commit
    message = request.json.get("message", f"Session — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    return jsonify(safe_commit(APP_ROOT, message))


@app.route("/assets/<path:filename>")
def serve_assets(filename):
    return send_from_directory(APP_ROOT / "assets", filename)


if __name__ == "__main__":
    port = int(os.environ.get("MARGINALIA_PORT", 5000))
    threading.Timer(1.5, lambda: webbrowser.open(f"http://localhost:{port}")).start()
    print(f"\n  Marginalia running at http://localhost:{port}\n")
    print(f"  Keys loaded from: {'setup.env' if setup_env.exists() else '.env (legacy)'}\n")
    app.run(host="0.0.0.0", port=port, debug=False)
