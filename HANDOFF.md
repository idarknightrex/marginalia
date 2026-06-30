# Marginalia — Thread Handoff
**Version:** v1.0
**Date:** June 14, 2026
**Purpose:** Copy this into a new Claude thread to restore full context

---

## The Tool
Marginalia (Largely Local Marginalia / LLM) — a local-first PhD research workbench.
**Repo:** https://github.com/idarknightrex/marginalia (public, code only)
**Canonical:** https://github.com/idarknightrex/marginalia-canonical (private, research data)
**Ko-fi:** https://ko-fi.com/llmarginalia
**License:** MIT

---

## ⚠ Production vs. Bootstrap Scripts — read this first
**As of June 29 2026.** `bootstrap.sh` (and its platform variants `bootstrap-macos.sh` / `bootstrap-linux.sh`) are **first-time human setup scripts only**. They install dependencies, create the venv, check for `.env`, and hunt for a free port — useful for someone cloning the repo and running it manually once.

**Production on Solaris does NOT use any bootstrap script.** The launchd plist (`com.marginalia.server.plist`) calls the venv's Python interpreter and `app.py` directly:
```
/Users/rajboora/Developer/marginalia/.venv/bin/python /Users/rajboora/Developer/marginalia/app.py
```
with `MARGINALIA_PORT=5001` set via the plist's `EnvironmentVariables`. `app.py` already reads this directly (`os.environ.get("MARGINALIA_PORT", 5000)`) — no shell wrapper needed.

**Why this matters:** a June 2026 macOS update caused the plist to drop out of launchd. When reloaded, it had been pointed at `bootstrap.sh` instead of `app.py` directly — and `bootstrap.sh`'s port-check used `ss`, a Linux-only tool that doesn't exist on macOS, so it silently failed to detect anything was wrong and defaulted to port 5000, which macOS reserves for AirPlay Receiver. The result was a crash loop that looked like nothing was wrong until the actual stderr log was checked. Full writeup in `marginalia-seeds.md`, "The bootstrap.sh / production plist incident."

**If you ever rebuild or reinstall the launchd plist, always point `ProgramArguments` at the venv's `python` and `app.py` directly. Never at a bootstrap script.**

---

## Hardware State
**Mac Mini M4 — "Solaris"** — headless, Tailscale IP: 100.126.14.57
- Marginalia running via launchd, calling `.venv/bin/python app.py` directly on port 5001 (see note above — never via bootstrap.sh/.command)
- launchd plist installed — survives power cycles (com.marginalia.server.plist)

**Restart commands (SSH into Solaris first):**
```bash
# Preferred — launchd (survives power cycles)
launchctl unload ~/Library/LaunchAgents/com.marginalia.server.plist
launchctl load  ~/Library/LaunchAgents/com.marginalia.server.plist

# Manual fallback — if launchd is not responding
pkill -f "python.*app.py" 2>/dev/null || true
cd ~/Developer/marginalia
nohup ./bootstrap.command > /tmp/marginalia.log 2>&1 &

# Check status
tail -f /tmp/marginalia.log
curl -s http://localhost:5001 | head -5
```

- Working repo: `/Users/rajboora/Developer/marginalia/`
- Canonical repo: `/Users/rajboora/Developer/marginalia/canonical/`
- Access from anywhere: `http://100.126.14.57:5001`
- SSH: `ssh rajboora@100.126.14.57`
- Logs: `tail -f /tmp/marginalia.log`

**Models — all on internal NVMe (migrated from Vault this session):**
| Model | Size | Status |
|-------|------|--------|
| deepseek-r1:8b | 5.2GB | ✅ Working |
| gemma4:latest | 9.6GB | ✅ Working |
| qwen2.5:14b | 9.0GB | ✅ Working |
| mistral:7b | 4.4GB | ✅ Working |
| llama3.1:8b | 4.9GB | ✅ Working |
| command-r7b:latest | 5.1GB | ✅ Working (Cohere, Canada) |

**MacBook Air M5 15" — "forkd"** — development machine
- Tailscale connected, SSH access to Solaris confirmed
- marginalia repo cloned at ~/Developer/marginalia (for reference/editing)

---

## API Keys — setup.env
```
GOOGLE_API_KEY=        # configured, working (Gemini free tier)
ANTHROPIC_API_KEY=     # empty — add from console.anthropic.com
OPENAI_API_KEY=        # empty — add from platform.openai.com/api-keys
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_MODELS_PATH=    # blank — models on internal ~/.ollama/models
RESEARCH_PDF_PATH=     # blank — defaults to ~/Documents/Research/PDFs/
GITHUB_USER=idarknightrex
GITHUB_CANONICAL_REPO=marginalia-canonical
MARGINALIA_PORT=5001
```

---

## Current Tab Structure
```
Prompt | References | Ingest | Projects | Writing | Notes | Intelligence
```

---

## What Works in v1.0

### Prompt
- Multi-model: cloud parallel (Gemini, Claude, GPT-4o), local sequential
- DOM-driven model order — adding a chip in HTML is the only step needed
- Synthesis pass: 4 section cards (Consensus, Divergence, Unique Contributions, Absent Voices)
- Section cards colour-coded — renderer falls back to plain text if model ignores format
- Save to project from synthesis panel — wired, working
- 30min silent autosave, 2hr session note prompt
- Loading hint after 10s on local models: "Loading model from disk..."
- MODEL_TIMEOUT: all local models 300s, dynamic ollama: chips 300s

### References
- Full CRUD — add, edit, delete, status cycle (surfaced → located → verified)
- Filter by status, search, filter by project slug
- DOI lookup, BibTeX/RIS/CSV/plaintext import, file drop
- Edit modal: title, authors, year, type, DOI, tags, status, holding, location,
  themes, connections, AI annotation, your annotation, argument connection
- Holding location displayed on card
- Multi-voice AI annotation (runs through active local models, synthesises)
- Launch Prompt from reference — pre-populates prompt with source context

### Ingest
- File drop: .csv, .bib, .ris
- Paste import: BibTeX, RIS, CSV, DOI list, plaintext → local AI parse
- PDF folder scan — scans RESEARCH_PDF_PATH, extracts typed PDFs instantly,
  flags scanned/handwritten for Gemma OCR, creates reference stubs
- Capture (OCR) — drop PDF/image, typed PDFs extract via pdfplumber (~instant),
  scanned/handwritten run Gemma 4 OCR (~15-45s)
- After OCR: **Save as Note** (your thinking) or **Save as Reference** (their work)
  — the 60/40 principle made into a UI decision

### Projects
- Create with label, slug, framing statement
- Connected reference count and titles
- Edit modal — slug rename supported
- Framing feeds Intelligence synthesis prompts (scoped mode)

### Writing
- Types: blog, conference, chapter, grant, journal, other
- Status: drafting, in-progress, submitted, published, archived
- Project connection via slug

### Notes (new in v0.9.8)
- Deep reading and accumulation without destination
- Fields: title, source reference, project, writing connection, body,
  questions it raised, connections I'm noticing
- No status workflow — accumulation without resolution
- Filter by project
- Connected to sessions via `notes:` field in session frontmatter
- From Ingest: OCR → Save as Note pre-fills form and switches tab

### Intelligence
- Scope: project selector (all or specific slug)
- Mode buttons: References | Sessions | Both | ▲ What am I missing?
- Model selector (DeepSeek R1 default)
- Cancel button (AbortController)
- Output: colour-coded section cards

**References mode sections:**
Recurring Themes · Tensions · Absent Voices · Conversations · Research Question Fit
— scoped mode injects project framing; unscoped = bookstore mode (no framing)

**Sessions mode sections:**
Recurring Questions · Evolution · Unresolved · Momentum · Absent Voices

**What am I missing? (v0.9.3) sections:**
Unasked Questions · Argument Weaknesses · Missing Perspectives ·
Examiner Challenges · Next Moves
— reads sessions + connected references + project framing

### Save & Break
- Pre-flight scan for large/blocked files, auto-.gitignore
- Commits and pushes main repo (idarknightrex/marginalia)
- Commits and pushes canonical repo (idarknightrex/marginalia-canonical)
- 30min silent autosave also fires this sequence

---

## Architecture

### Two-repo pattern
- **Public repo** — code only, MIT licensed
- **Private canonical repo** — references, sessions, notes, projects, writing
- Save & Break pushes both automatically via `utils/git_preflight.py`
- canonical/ is gitignored from main repo, has own .git

### File structure
```
~/Developer/marginalia/
├── app.py                        # Flask backend v1.0
├── setup.sh                      # Safe install script (9 steps)
├── bootstrap.command             # Double-click start (Mac)
├── bootstrap.sh                  # Headless/Linux start
├── com.marginalia.server.plist   # launchd auto-start
├── setup.env                     # Keys — gitignored
├── requirements.txt              # includes pdfplumber
├── README.md                     # Full docs
├── static/
│   ├── app.js                    # All JS — commented
│   └── app.css                   # All styles
├── templates/
│   └── index.html                # Markup only
├── utils/
│   ├── paths.py                  # Canonical path constants
│   └── git_preflight.py          # Save & Break + canonical push
└── canonical/                    # Gitignored — own repo
    ├── references/               # ~75 sources
    ├── sessions/                 # ~35 sessions
    ├── notes/
    ├── projects/                 # phd-core.md
    └── writing/                  # intro-margin.md
```

### Key decisions (do not relitigate)
- SQLite is runtime state only — canonical markdown files are truth
- Flask is API key vault — frontend never sees keys
- `utils/paths.py` is single source of truth for filesystem paths
- `setup.env` is the visible key config — no hidden .env needed
- Models on internal NVMe (migrated from Vault June 12, 2026)
- `keep_alive: 0` — unloads model after every response, allows sequential firing
- DOM-driven model order in sendPrompt() — no hardcoded MODEL_ORDER array
- Plain markdown canonical files — human readable, researcher owns them
- Intentional friction: slugs typed by hand, status cycled manually, Save & Break deliberate
- MIT + Ko-fi voluntary — no licensing gates

### On what Marginalia currently is and is not
**No RAG, no embedding, no vector store.** When Marginalia passes text to a model — in Capture, in multi-voice annotation, in Intelligence synthesis — it passes the full document text as context in the prompt. This is long-context prompting, not retrieval-augmented generation. There is no chunking, no semantic search, no retrieval of relevant passages from a larger corpus. It works for bounded documents and single captures; it degrades as documents get longer and context windows fill.

**The researcher is the retrieval layer.** When a model times out or returns thin output, the researcher reads it, judges it insufficient, and re-prompts with more context — the relevant reference they remember, the framing from a past session, the theoretical connection the model missed. That is RAG with a human retrieval mechanism, operating exactly as the 60/40 principle intends. The canonical record is the corpus; the researcher's judgment does the retrieval. This is not a workaround — it is the current design, intentional and appropriate for v1.x.

**v2.x RAG** would automate part of that retrieval: embed the canonical record, semantic search at prompt time, inject relevant chunks rather than relying on the researcher to supply them. That removes some active engagement with the researcher's own canon in exchange for speed and coverage. The trade-off should be named honestly before it is built — see seeds doc, June 18-19 2026.

### Build naming convention
`marginalia-v[SEMVER]_[MMDD]-[HHMM].zip` — MMDD-HHMM is UTC build time
Example: `marginalia-v1.0_0614-0001.zip`

### Deploy script
```bash
cp ~/Developer/marginalia/setup.env ~/setup.env.bak
cd ~/Downloads && unzip -o marginalia-v[VERSION].zip
cp -r marginalia-v0925/. ~/Developer/marginalia/
cp ~/setup.env.bak ~/Developer/marginalia/setup.env
cd ~/Developer/marginalia
git add -A
git commit -m "v[VERSION] — [description]"
git push origin main
./bootstrap.command
```

---

## Known Issues / Next Build List

### Bugs
- **De-dupe check incomplete** — PDF scan has loose author+year filename match
  but manual Add, DOI lookup, and paste import have NO de-dupe check.
  Fix: check in `write_canonical_reference()` before writing, skip or warn on
  collision. All import paths need this, not just scan. MEDIUM PRIORITY.

### Features — next session
- **Posture slider** — Supportive ↔ Interrogative, shifts synthesis prompt register
  Scope × Posture: project or writing piece as scope object
  Scoped framing seeds the prompt; unscoped = bookstore mode
- **Session budget / nap mode** — Focused (2h/4h), Open (timer grows), Step Away button
  Auto step-away on inactivity (20-30min idle)
- **Boulder animation** — SVG in status bar, rolls up hill as session lengthens,
  rolls back on step-away. Never crests. Warm dark gradient fills status bar
  (#2a2018, left to right, transparent to earthy-dark over hours)
- **Model preload on Start Session** — reads last 10 session files, warms top 2-3
  local models by frequency. keep_alive=300 for session duration.
- **Settings tab** — writes to setup.env from UI. API key fields with Test button,
  Ollama models path, Research PDF path, port, default synthesis model.
  Replaces manual file editing for non-technical users.
- **canonical auto-push wired to setup.sh** — step 8 now handles token + remote
  but needs testing on fresh install
- **Power cycle test** — confirm launchd plist brings Marginalia up without SSH
- **setup.sh GitHub token flow** — test on fresh install, confirm canonical push works

### Architecture ideas (Seeds doc)
- Promoted vs transient sessions — most sessions transient (audit trail),
  promoted sessions become reference records with source_type: insight/field-note/capture
- IRL capture provenance fields — where, who, context, role (ethics board)
- Concept lens — software brain as a question brought to synthesis, not a container
- Session files as fine-tuning data / RAG context (2.x)

---

## Roadmap

### v1.0.1 (shipped June 14 2026)
- setup.sh step 9 mkdir -p fix (reinstall branch)
- Restart commands added to HANDOFF

### v1.0.2 — v1.0.9 (shipped June 14–21 2026)
- Capture mode selector, Go button, multi-page OCR via pdf2image + Gemma
- Full OCR text to note (not truncated preview)
- De-dupe in write_canonical_reference()
- Related sessions strip under synthesis panel
- Project slug autocomplete on Notes/Writing forms
- OCR review banner on Save as Note
- No-cache headers on index route
- Corner version wired to APP_VERSION
- Explicit file-copy deploy script (deploy.sh)
- Canonical push token wired

### v1.2.0 (current — June 21 2026)
- Pressure Test synthesis mode (Survived · Destabilized · Still Open)
- Survey/Pressure Test mode selector next to synthesis model selector
- Cohere added to synthesis model options
- Synthesis cycling nudge banner (dismissable)
- Font size +/− controls in status bar
- Separator (+++) hint below prompt textarea
- Full prompt including separator layers saved to canonical session file
- Author/reference highlighting in model responses (amber = known refs)
- utcnow() deprecation fixed throughout (datetime.now(datetime.UTC))
- Pressure Test and Survey prompt templates in run_synthesis()

### v1.x (next)
- Posture slider + scope × posture Intelligence design
- Session budget / nap mode / boulder animation
- Model preload on Start Session
- Settings tab
- Power cycle confirmation test

### v2.0
- Tauri wrapper — native app, cross-platform (.dmg, .exe, .AppImage)
- First-run installer (no terminal required)
- Auto-updater

### v2.x
- Session continuity primer — synthesis + current session chain + project framing,
  prepended to local model prompts so they're not cold opens every round.
  Stateless models, stateful instrument — see seeds doc, June 15 2026.
- Sequential model conditioning ("shower thought mode") — model 1 responds,
  model 2 sees model 1's output + original prompt, model 3 sees both + prompt,
  final output carries accumulated chain conditioning. Generative/associative
  use case, not analytical — error propagation risk means this mode needs a
  clear UI warning. Trade-off: depth vs. the parallel architecture's immunity
  to cascading errors. See seeds doc, June 21 2026.
- RAG over canonical — embed references/notes/sessions, semantic search at prompt
  time, inject retrieved chunks instead of relying on model training-data memory.
  Distinct from the primer above: primer = "what have we discussed today",
  RAG = "what do I already know about this, going back months". Higher value,
  harder build (chunking, embedding model, retrieval quality). See seeds, June 18 2026
  — addresses the "falling into a well" failure mode where small local models
  reason confidently from training data alone with no signal they've hit a boundary.
- Fine-tuning on session files
- Local agent with canonical as knowledge base
- Idea map (force-directed SVG — nodes: references, edges: thematic connections)
  — both this and the session primer above are downstream of canonical depth;
  neither makes sense until v1.x has filled out Notes/Sessions/References enough
  to have real structure worth mapping or summarizing
- Dashboard flyout — PhD Thread Dashboard (Open Flags / Dangling Threads / Next
  Moves) currently hand-regenerated in a sibling Claude thread every ~15
  interactions, reference copy saved at docs/dashboard-reference-v6.html.
  Already named itself as wanting to live at localhost:5000/dashboard — that
  never got built. Open design question: hand-curated forever vs. partially
  derived from canonical (flagged refs/notes → Open Flags, unresolved
  Intelligence findings → Dangling Threads, Next Moves likely stays manual).
  See seeds doc, June 18 2026 — don't let this drift again.
- /current endpoint — once dashboard generates from canonical, serve it at
  a read-only public Flask route (e.g. http://[tailscale-ip]:5001/current).
  No auth, no login, just a corkboard — here is what I am working on,
  visible to anyone who knows the address.
  HARD PREREQUISITE: dashboard flyout must auto-generate from canonical
  first. The current dashboard artifact exists only because a parallel
  Claude thread has been maintaining it by hand — other researchers
  installing Marginalia have no such sibling thread and no hand-curated
  current to publish. Shipping /current without canonical generation
  ships a broken feature for everyone except the person who built it.
  See seeds doc, June 21 2026.
- BibTeX export

### v3.0
- Federated /current — Marginalia instances subscribing to each other's
  /current endpoints and displaying peers' dashboards inside their own UI.
  A "Following" panel or tab, a settings field for peer URLs, a simple
  fetch-and-render. No central platform, no algorithm, no feed. Peer to
  peer, researcher to researcher — the old Unix finger protocol instinct
  applied to PhD research. See seeds doc, June 21 2026.
- App Store / notarization
- Distribution to other researchers

---

## PhD Context
**Researcher:** Raj Boora, CS instructor at MacEwan University, Edmonton, Alberta
**Program:** University of Saskatchewan Cross-Departmental PhD (SoTL focus), Fall 2026
**Supervisor:** Dr. Hamilton (4M framework)
**Research question:** How do embodied community-building activities influence
performance anxiety and intellectual risk-taking among first-year undergraduates?
**Design:** Mixed-methods quasi-experimental
**First public appearance:** ISSOTL 2026 Saskatoon, October 28-31
**Target publication:** Teaching and Learning Inquiry (TLI), 2027

---

## Seeds Document
`marginalia-seeds.md` — in repo root alongside this file.
Holds design philosophy, positionality observations, fragments worth keeping.
Key entries: the mischief problem, software brain as lens not container,
the boulder never crests, extrusive not extractive, unrealized cognitive capital,
the cognitive agent as collaborative partner, Pinpoint comparison.

---

## The Lines
*Ideas don't have a calendar. Neither does gratitude.*
*The boulder never crests.*
*Note = your thinking · Reference = someone else's work.*
*When in doubt, open the gate.*
