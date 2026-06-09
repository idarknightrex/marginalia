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
    annotation = data.get("annotation") or "<!-- Add your annotation here -->"
    argument   = data.get("argument_connection") or "<!-- How does this connect to your research? -->"
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
themes: {data.get("themes", "")}
created_at: {datetime.now().isoformat()}
updated_at: {datetime.now().isoformat()}
---

## Annotation
{annotation}

## Argument Connection
{argument}
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
                    refs.append(meta)
        except Exception:
            pass
    return refs


def call_ollama(model_str: str, prompt: str) -> str:
    import urllib.request as _ur
    payload = json.dumps({"model": model_str, "prompt": prompt, "stream": False}).encode()
    req = _ur.Request(f"{OLLAMA_BASE}/api/generate", data=payload, headers={"Content-Type": "application/json"})
    with _ur.urlopen(req, timeout=300) as r:
        return json.loads(r.read()).get("response", "")


def run_synthesis(prompt: str, responses: dict) -> str:
    settings  = load_settings()
    local_cfg = settings.get("models", {}).get("local", {})
    model_str = local_cfg.get("reasoning", "deepseek-r1:8b")
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
        "themes": ["themes", "keywords", "tags"],
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
    })

@app.route("/api/prompt", methods=["POST"])
def handle_prompt():
    global anthropic_tokens
    data    = request.json
    prompt  = data.get("prompt", "")
    models  = data.get("models", [])
    results, errors = {}, {}

    if "gemini" in models and KEYS["gemini"]:
        try:
            import google.generativeai as genai
            genai.configure(api_key=KEYS["gemini"])
            response = genai.GenerativeModel("gemini-2.5-flash").generate_content(prompt)
            results["gemini"] = response.text
        except Exception as e:
            errors["gemini"] = str(e)

    if "anthropic" in models and KEYS["anthropic"]:
        try:
            import anthropic
            client  = anthropic.Anthropic(api_key=KEYS["anthropic"])
            message = client.messages.create(model="claude-haiku-4-5", max_tokens=1024, messages=[{"role": "user", "content": prompt}])
            results["anthropic"] = message.content[0].text
            anthropic_tokens["input"]  += message.usage.input_tokens
            anthropic_tokens["output"] += message.usage.output_tokens
        except Exception as e:
            errors["anthropic"] = str(e)

    if "openai" in models and KEYS["openai"]:
        try:
            from openai import OpenAI
            client   = OpenAI(api_key=KEYS["openai"])
            response = client.chat.completions.create(model="gpt-4o", messages=[{"role": "user", "content": prompt}])
            results["openai"] = response.choices[0].message.content
        except Exception as e:
            errors["openai"] = str(e)

    if "llama" in models:
        try:
            results["llama"] = call_ollama(local_cfg.get("general", "llama3.1:8b"), prompt)
        except Exception as e:
            errors["llama"] = str(e)

    settings  = load_settings()
    local_cfg = settings.get("models", {}).get("local", {})

    if "deepseek" in models:
        try: results["deepseek"] = call_ollama(local_cfg.get("reasoning", "deepseek-r1:8b"), prompt)
        except Exception as e: errors["deepseek"] = str(e)

    if "gemma" in models:
        try: results["gemma"] = call_ollama(local_cfg.get("multimodal", "gemma4:latest"), prompt)
        except Exception as e: errors["gemma"] = str(e)

    synthesis = run_synthesis(prompt, results) if len(results) > 1 else ""
    if results:
        write_canonical_session(prompt, results, synthesis)

    cost = estimate_anthropic_cost(anthropic_tokens["input"], anthropic_tokens["output"])
    return jsonify({
        "results": results, "errors": errors, "synthesis": synthesis,
        "session_saved": bool(results),
        "anthropic_cost_usd": round(cost, 4),
        "anthropic_tokens": dict(anthropic_tokens)
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
