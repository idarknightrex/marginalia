"""
Marginalia — app.py
Flask backend. Run via bootstrap.command or: python app.py
All API keys loaded from .env — never exposed to the frontend.
"""

import os
import json
import uuid
import threading
import webbrowser
from pathlib import Path
from datetime import datetime

from flask import Flask, request, jsonify, render_template, send_from_directory
from dotenv import load_dotenv

# ─── Paths ────────────────────────────────────────────────────────────────────
from utils.paths import (
    APP_ROOT, CANONICAL_DIR, REFERENCES_DIR, SESSIONS_DIR,
    CAPTURES_DIR, EXPORTS_DIR, SETTINGS_PATH, BROADCAST_URL
)

# ─── Bootstrap ────────────────────────────────────────────────────────────────
load_dotenv(APP_ROOT / ".env")

KEYS = {
    "gemini":           os.getenv("GOOGLE_API_KEY"),
    "azure_key":        os.getenv("AZURE_OPENAI_KEY"),
    "azure_endpoint":   os.getenv("AZURE_OPENAI_ENDPOINT"),
    "azure_deployment": os.getenv("AZURE_DEPLOYMENT_NAME", "gpt-4o"),
    "anthropic":        os.getenv("ANTHROPIC_API_KEY"),
}

# Create required directories on startup
for d in [REFERENCES_DIR, SESSIONS_DIR, CAPTURES_DIR, EXPORTS_DIR, APP_ROOT / "db"]:
    d.mkdir(parents=True, exist_ok=True)

# ─── App ──────────────────────────────────────────────────────────────────────
app = Flask(__name__, template_folder="templates", static_folder="static")


# ─── Settings ─────────────────────────────────────────────────────────────────
def load_settings():
    if SETTINGS_PATH.exists():
        return json.loads(SETTINGS_PATH.read_text())
    return {}

def save_settings(data):
    SETTINGS_PATH.write_text(json.dumps(data, indent=2))


# ─── Canonical file helpers ───────────────────────────────────────────────────
def write_canonical_reference(data: dict) -> Path:
    """Write a reference as a canonical markdown file. Returns the file path."""
    ref_id = data.get("id") or str(uuid.uuid4())
    data["id"] = ref_id

    first_author = data.get("authors", "Unknown").split(";")[0].split(",")[0].strip()
    year = data.get("year", "0000")
    title_slug = "-".join(data.get("title", "untitled").lower().split()[:3])
    title_slug = "".join(c for c in title_slug if c.isalnum() or c == "-")
    filename = f"{first_author}_{year}_{title_slug}.md"

    annotation = data.get("annotation") or "<!-- Add your annotation here -->"
    argument  = data.get("argument_connection") or "<!-- How does this connect to your research? -->"

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


def write_canonical_session(prompt: str, responses: dict) -> Path:
    """Write a synthesis session as a canonical markdown file."""
    session_id = str(uuid.uuid4())
    timestamp  = datetime.now().strftime("%Y-%m-%d_%H-%M")
    filename   = f"session_{timestamp}.md"

    response_blocks = "\n\n".join(
        f"### {model.capitalize()}\n{text}"
        for model, text in responses.items()
        if text
    )

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
<!-- Add synthesis notes here -->
"""
    filepath = SESSIONS_DIR / filename
    filepath.write_text(canonical, encoding="utf-8")
    return filepath


def read_all_references() -> list:
    """Load all canonical reference files into a list of dicts."""
    refs = []
    for filepath in sorted(REFERENCES_DIR.glob("*.md")):
        try:
            text = filepath.read_text(encoding="utf-8")
            # Parse YAML frontmatter
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
    data = request.json
    filepath = write_canonical_reference(data)
    return jsonify({"status": "saved", "file": filepath.name})


@app.route("/api/prompt", methods=["POST"])
def handle_prompt():
    """
    Receives prompt + model list from frontend.
    Calls APIs server-side — keys never reach the browser.
    """
    data    = request.json
    prompt  = data.get("prompt", "")
    models  = data.get("models", [])
    results = {}
    errors  = {}

    if "gemini" in models and KEYS["gemini"]:
        try:
            import google.generativeai as genai
            genai.configure(api_key=KEYS["gemini"])
            model = genai.GenerativeModel("gemini-2.5-flash")
            response = model.generate_content(prompt)
            results["gemini"] = response.text
        except Exception as e:
            errors["gemini"] = str(e)

    if "anthropic" in models and KEYS["anthropic"]:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=KEYS["anthropic"])
            message = client.messages.create(
                model="claude-haiku-4-5",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}]
            )
            results["anthropic"] = message.content[0].text
        except Exception as e:
            errors["anthropic"] = str(e)

    if "azure" in models and KEYS["azure_key"]:
        try:
            from openai import AzureOpenAI
            client = AzureOpenAI(
                api_key=KEYS["azure_key"],
                azure_endpoint=KEYS["azure_endpoint"],
                api_version="2024-02-01"
            )
            response = client.chat.completions.create(
                model=KEYS["azure_deployment"],
                messages=[{"role": "user", "content": prompt}]
            )
            results["azure"] = response.choices[0].message.content
        except Exception as e:
            errors["azure"] = str(e)

    # Save session to canonical file
    if results:
        session_file = write_canonical_session(prompt, results)

    return jsonify({
        "results": results,
        "errors":  errors,
        "session_saved": bool(results)
    })


@app.route("/api/broadcast", methods=["GET"])
def get_broadcast():
    """Fetch broadcast.json from GitHub. Silent fail if offline."""
    try:
        import urllib.request
        with urllib.request.urlopen(BROADCAST_URL, timeout=3) as r:
            data = json.loads(r.read())
            b = data.get("broadcast", {})
            if not b.get("active"):
                return jsonify({})
            expires = b.get("expires")
            if expires and datetime.fromisoformat(expires) < datetime.now():
                return jsonify({})
            return jsonify(b)
    except Exception:
        return jsonify({})


@app.route("/api/save-break", methods=["POST"])
def save_and_break():
    """Git add, commit, push backup. Pre-flight scans for large files first."""
    from utils.git_preflight import safe_commit
    import subprocess

    message = request.json.get("message", f"Session — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    result  = safe_commit(APP_ROOT, message)
    return jsonify(result)


# ─── Static assets ────────────────────────────────────────────────────────────
@app.route("/assets/<path:filename>")
def serve_assets(filename):
    return send_from_directory(APP_ROOT / "assets", filename)


# ─── Launch ───────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("MARGINALIA_PORT", 5000))

    def open_browser():
        webbrowser.open(f"http://localhost:{port}")

    threading.Timer(1.5, open_browser).start()
    print(f"\n  Marginalia running at http://localhost:{port}\n")
    app.run(host="0.0.0.0", port=port, debug=False)
