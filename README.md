# Marginalia

**A research instrument. Slow down.**

Marginalia is a largely-local, privacy-first research workbench for PhD researchers and serious academic writers. It holds your full research process — references, reading notes, AI-assisted sessions, writing elements, and deep thinking — in plain markdown files you own and control.

It is not a literature manager. It is not an answer machine. It is a Socratic partner: a colleague at the same PD session, an off-the-record supervisor, a tool that asks the next question rather than closing the current one.

---

## What it does

**Prompt** — Send a research question to multiple AI models simultaneously. Cloud models (Gemini, Claude, GPT-4o) fire in parallel. Local models fire sequentially to manage RAM. A synthesis pass identifies consensus, divergence, unique contributions, and absent voices across all responses.

**References** — A canonical library of sources in plain markdown. Import via DOI, BibTeX, RIS, CSV, or paste. Each reference has annotation, themes, argument connections, and a status cycle (surfaced → located → verified). Filter by project slug to scope your library to a specific inquiry.

**Ingest** — Drop PDFs, photos, or handwritten notes. Typed PDFs extract in seconds via pdfplumber. Scanned or handwritten content runs through Gemma 4 OCR (~15-45s). After extraction, choose: Save as Note (your thinking) or Save as Reference (someone else's work). Scan your PDF folder to import an entire collection at once.

**Notes** — Deep reading and accumulation without destination. A note is thinking provoked by reading. It has no status workflow, no completion state. It just gets richer. Connected to references, projects, and writing elements by slugs you type — pins in a corkboard, not database foreign keys.

**Projects** — Research projects with a framing statement. References, notes, sessions, and writing elements connect to projects via slugs. The framing statement seeds the Intelligence tab's synthesis prompts — so the instrument knows what lens you're working with.

**Writing** — Writing elements (blog posts, chapters, papers, grants) connected to projects. Track status from drafting to published.

**Intelligence** — Four synthesis modes against your own accumulated material:
- **References** — themes, tensions, absent voices, conversations across your library
- **Sessions** — recurring questions, evolution of thinking, unresolved threads
- **Both** — full picture across references and sessions
- **▲ What am I missing?** — argument weaknesses, unasked questions, examiner challenges, next moves

Scope by project or writing piece. Model selector. Cancel button. Results as colour-coded section cards.

---

## Why largely local

Local models run on your machine. Your research data, your community conversations, your draft arguments never leave. This is not just a privacy preference — for researchers working with community-sourced data, it is a methodological and ethics board requirement.

Cloud models (Gemini, Claude, GPT-4o) are available for their strengths but are clearly labelled and optional. No cloud key is required to use Marginalia — DeepSeek R1 alone is enough to start.

---

## Models

| Model | Type | Origin | Training knowledge | Size | Why |
|-------|------|--------|-------------------|------|-----|
| Gemini 2.5 Flash | Cloud | Google | Current (web access) | — | Live internet, free tier |
| Claude Haiku 4.5 | Cloud | Anthropic | ~early 2025 | — | Strong reasoning |
| GPT-4o | Cloud | OpenAI | ~early 2025 | — | Broad capability |
| DeepSeek R1 | Local | China | ~early 2024 | 5.2GB | Reasoning, synthesis |
| Qwen 2.5 | Local | Asia/Global South | ~mid 2024 | 9.0GB | Asian/Global South training data |
| Mistral 7B | Local | Europe | ~early 2023 | 4.4GB | European academic tradition |
| Command R7B | Local | Canada (Cohere) | ~early 2024 | 5.1GB | RAG-optimised, 23 languages |
| Gemma 4 | Local | Google | ~early 2025 | 9.6GB | Multimodal — OCR for handwritten notes |
| Llama 3.1 | Local | Meta | ~early 2024 | 4.9GB | General purpose |

**Training knowledge dates** refer to what the model knows about the world — not the age of the software. A model with knowledge to ~early 2024 does not know about papers, events, or developments after that date.

**On 8GB machines:** DeepSeek R1 (5.2GB) runs comfortably alone. Command R7B (5.1GB) is a good alternative. Avoid running Gemma 4 (9.6GB) simultaneously with other local models on 8GB. The `keep_alive: 0` setting unloads each model after every response, so sequential use is safe on any RAM size.

**On 16GB machines (recommended):** All models run comfortably sequentially. Avoid running Gemma 4 and DeepSeek simultaneously if doing heavy synthesis work.

---

## Install

```bash
git clone https://github.com/idarknightrex/marginalia.git
cd marginalia
chmod +x setup.sh
./setup.sh
```

`setup.sh` will:
1. Check for Homebrew (offers to install)
2. Check for Python 3.12+ (offers to install via Homebrew)
3. Check for Ollama (links to download)
4. List installed models and show pull commands for all Marginalia models
5. Create or validate `setup.env` with your API keys
6. Build the Python virtual environment
7. Final check — confirms everything is ready
8. Set up canonical backup repo (optional, requires GitHub)
9. Install auto-start launchd service (optional, Mac only)

### Requirements
- macOS (Apple Silicon recommended) or Linux
- Python 3.12+
- [Ollama](https://ollama.com/download) for local models
- At least one API key, or Ollama with at least one model pulled

### Minimum viable start
```bash
ollama pull deepseek-r1:8b   # 5.2GB — enough to begin
# Add GOOGLE_API_KEY to setup.env for Gemini (free tier)
./bootstrap.sh               # auto-detects macOS or Linux
# or run the platform script directly:
#   ./bootstrap-macos.sh
#   ./bootstrap-linux.sh
```

> **Production deployments:** `bootstrap.sh` and its platform variants are for first-time setup and manual runs only. If you're configuring a launchd/systemd/supervisor entry to keep Marginalia running unattended, point it at `.venv/bin/python app.py` directly with `MARGINALIA_PORT` set in the environment — not at any bootstrap script. See `HANDOFF.md` for why this distinction matters.

---

## Architecture

```
marginalia/
├── app.py                    # Flask backend — all API routes
├── setup.sh                  # Safe install and setup script
├── bootstrap.sh               # OS-detecting dispatcher (calls one of the two below)
├── bootstrap-macos.sh         # macOS setup/start script (lsof port check)
├── bootstrap-linux.sh         # Linux setup/start script (ss port check)
├── bootstrap.command          # Double-click to start (Mac, GUI convenience)
├── com.marginalia.server.plist  # launchd auto-start (Mac) — calls app.py directly, not a bootstrap script
├── setup.env                 # API keys — gitignored, never pushed
├── requirements.txt
├── static/
│   ├── app.js                # All frontend JavaScript
│   └── app.css               # All styles
├── templates/
│   └── index.html            # Markup only — wired to static files
├── utils/
│   ├── paths.py              # Canonical directory paths
│   └── git_preflight.py      # Save & Break — pre-flight + dual repo push
└── canonical/                # Your research data — gitignored from main repo
    ├── references/           # One .md file per reference
    ├── sessions/             # One .md file per prompt session
    ├── notes/                # Deep reading notes
    ├── projects/             # Project framing files
    └── writing/              # Writing elements
```

### Why plain markdown
Every canonical file is human-readable plain text with YAML frontmatter. You can open any file in a text editor, read it, edit it, move it. The instrument is a guest in your files, not the landlord. Marginalia uses SQLite only where necessary (none currently) and markdown everywhere it can.

### The two-repo pattern
The main repo (`idarknightrex/marginalia`) is public — code only. Your research data lives in `canonical/`, which is gitignored from the main repo and has its own private repo (`idarknightrex/marginalia-canonical`). Save & Break commits and pushes both simultaneously. Your research is always backed up without ever being public.

### Intentional friction
Marginalia is built against software brain — the tendency of digital tools to automate thinking away. The slugs you type to connect a note to a project are pins in a corkboard, not database foreign keys. The status you cycle manually (surfaced → located → verified) is a reading practice. Save & Break is a deliberate gesture. The 2-hour session note prompt asks where you are. These are not UX decisions — they are epistemological commitments made visible in the interface.

---

## Headless operation (Mac Mini)

Marginalia is designed to run headless on a Mac Mini accessible via Tailscale:

```bash
# Install Tailscale: https://tailscale.com/download
# Then install the launchd service via setup.sh (step 9)
# Or manually:
cp com.marginalia.server.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.marginalia.server.plist

# Access from anywhere:
http://[tailscale-ip]:5001

# Check logs:
tail -f /tmp/marginalia.log
ssh rajboora@[tailscale-ip] "tail -f /tmp/marginalia.log"
```

---

## Research folder

PDFs live outside the repo at `~/Documents/Research/PDFs/` by default. Override in `setup.env`:

```
RESEARCH_PDF_PATH=/Volumes/Vault/Research/PDFs
```

PDF naming convention: `AuthorLastname_Year_ShortTitle.pdf`

The Ingest tab scans this folder, extracts text from typed PDFs instantly, and flags handwritten or scanned PDFs for Gemma 4 OCR.

---

## Save & Break

The **↑ Save & Take a Break** button in the nav:
- Runs a pre-flight scan for large or blocked files
- Commits all changes to the main repo
- Commits and pushes your canonical research data to the private backup repo
- Returns warnings if anything needs attention

Automatic silent saves every 30 minutes. A session note prompt appears every 2 hours asking where you are and what's shifting.

---

## Configuration reference

```bash
# setup.env
GOOGLE_API_KEY=          # Gemini — free tier at aistudio.google.com
ANTHROPIC_API_KEY=       # Claude — console.anthropic.com
OPENAI_API_KEY=          # GPT-4o — platform.openai.com/api-keys
OLLAMA_HOST=http://127.0.0.1:11434   # Change if Ollama runs on another machine
OLLAMA_MODELS_PATH=      # External drive path, blank for default ~/.ollama/models
RESEARCH_PDF_PATH=       # PDF folder, blank for ~/Documents/Research/PDFs/
GITHUB_USER=             # Your GitHub username
GITHUB_CANONICAL_REPO=marginalia-canonical  # Private backup repo name
MARGINALIA_PORT=5001     # Change if port is taken
```

---

## Roadmap

- **v1.x** — Posture slider (Supportive ↔ Interrogative), scope × posture Intelligence design, model preload on session start, nap mode / session budget, boulder animation, Settings tab (write to setup.env from UI), promoted vs transient sessions
- **v2.0** — Tauri wrapper (native app, cross-platform), first-run installer, auto-updater
- **v2.x** — Fine-tuning on session files, local agent with canonical as knowledge base, concept lens (software brain as a question not a container)
- **v3.0** — App Store / notarization, distribution

---

*Marginalia. Slow down.*
