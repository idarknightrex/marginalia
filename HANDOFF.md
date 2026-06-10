# Marginalia — Thread Handoff
**Version:** v0.9.2.1
**Purpose:** Copy this into a new Claude thread to restore full context

---

## The Tool
Marginalia (Largely Local Marginalia / LLM) — a local-first PhD research workbench.
**Repo:** https://github.com/idarknightrex/marginalia
**Ko-fi:** https://ko-fi.com/llmarginalia
**License:** MIT

---

## Current Hardware State (Mac Mini M4 — "Solaris")
- Marginalia running at localhost:5001 via `./bootstrap.command`
- Working repo: `/Users/rajboora/Developer/marginalia/` (flat, push from here)
- Claude Haiku working (Anthropic key in setup.env — monitor credits)
- Gemini working (Google key in setup.env)
- OpenAI GPT-4o — key needed, get from platform.openai.com/api-keys
- Perplexity — key needed, get from perplexity.ai/settings/api
- DeepSeek R1 8B on Vault — confirmed working
- Gemma 4 on Vault — confirmed downloaded (gemma4:latest, 9.6GB)
- Python 3.9 on Mini — needs upgrade to 3.12 via Homebrew (not yet done)
- Homebrew not yet installed on Mini
- Ollama models path: `/Volumes/Vault/Marginalia/ollama/models`
- SSD: Vault, ~450GB free, mounted at /Volumes/Vault
- MacBook Air M5 15" arriving end of next week

---

## API Keys — setup.env
All keys live in `~/Developer/marginalia/setup.env` (visible, gitignored).
No hidden .env file needed. Fields:
- ANTHROPIC_API_KEY — has key, credits low, top up at console.anthropic.com
- GOOGLE_API_KEY — has key, working
- OPENAI_API_KEY — **empty, needs key** from platform.openai.com/api-keys
- PERPLEXITY_API_KEY — **empty, needs key** from perplexity.ai/settings/api
- OLLAMA_HOST — http://127.0.0.1:11434 (default)
- MARGINALIA_PORT — 5000 (running on 5001 because 5000 was taken)

---

## Model Chips (v0.9.2)
| Chip | Model | Status |
|---|---|---|
| Gemini 2.5 Flash | gemini-2.5-flash | ✅ Working |
| Claude Haiku | claude-haiku-4-5 | ✅ Working |
| GPT-4o | gpt-4o (direct OpenAI) | ⚠️ Key needed |
| Llama 3.1 | llama3.1:8b (local) | ⚠️ Pull needed: ollama pull llama3.1:8b |
| DeepSeek R1 | deepseek-r1:8b (local) | ✅ Working |
| Gemma 4 | gemma4:latest (local) | ✅ Downloaded, start inactive on 16GB |

---

## Known Issues
- `ollama list` requires `OLLAMA_MODELS` env var in same shell session
  Workaround: `OLLAMA_MODELS=/Volumes/Vault/Marginalia/ollama/models ollama list`
  Fix needed: launchctl env var or Ollama GUI config
- Python 3.9 still in .venv — needs rebuild with 3.12 after Homebrew install
- GPT-4o and Perplexity chips show but error until keys added
- Synthesis panel working — DeepSeek R1 does meta-pass locally after multi-model prompts

---

## File Locations
```
~/Developer/marginalia/          ← working repo, push from here
/Volumes/Vault/Marginalia/       ← SSD: ollama models, future PDF backup
~/.ollama/                       ← identity keys only (models on Vault)
~/Documents/Research/PDFs/       ← PDFs live here, never inside repo
```

---

## Key Architecture Decisions (do not relitigate)
- SQLite is runtime state only — canonical flat markdown files are truth
- Flask is API key vault — frontend never sees keys
- `utils/paths.py` is single source of truth for all filesystem paths
- `setup.env` is the visible key config — no hidden .env required
- Ollama models live on external Vault SSD, not internal drive
- MIT + Ko-fi voluntary — no licensing gates, no unlock states
- Save & Break = git add + commit + push backup, pre-flight scans for large files
- PDF naming: `AuthorLastname_Year_ShortTitle.pdf`
- Four-layer backup: internal drive → Vault rsync → iCloud/OneDrive → GitHub

---

## Build History
- **v0.8-pre** — Multi-model prompt: Gemini, Claude Haiku, Azure GPT-4o. References pipeline. Save & Break.
- **v0.9.2** — DeepSeek R1 + Gemma 4 chips added and wired to Ollama backend
- **v0.9.2** — Synthesis engine (DeepSeek R1 local meta-pass). 16GB mutex. Claude cost counter.
- **v0.9.2** — Full reference import (CSV/BibTeX/RIS/DOI/plaintext). Azure replaced with OpenAI direct + Perplexity. setup.env replaces .env. Docs updated.
- **v0.9.2.1** — Local model chips multi-select restored. Removed erroneous radio-button exclusion logic from toggleModel().

---

## Phase 2 Build List (next sessions)
1. **Wire Homebrew + Python 3.12** — rebuild .venv, fix warnings
2. **Add OpenAI + Perplexity keys** — test all 6 chips live
3. **Idea map** — force-directed SVG graph, theme nodes, hover tooltips
4. **Reading Assistant** — transparent opt-in dwell-time cross-reference
5. **Settings panel** — configurable workflow preferences
6. **Writing tracker** — log with session and reference linking
7. **Projects view** — multi-project context switching
8. **Ingest / OCR** — Phase 4, Gemma 4 as primary engine
9. **launchd config** — persistent OLLAMA_MODELS env var on Mini

---

## Context for PhD Thread (sibling thread)
Raj is building this tool to support his PhD research question:
*How do embodied community-building activities influence performance anxiety
and intellectual risk-taking among first-year undergraduates?*
Supervisor: Dr. Hamilton (U of Saskatchewan), shared undergraduate history at U of Lethbridge.
ISSOTL 2026 Saskatoon, October 28-31 — first public appearance.
Target paper: Teaching and Learning Inquiry (TLI), 2027.

---

## The Line
*Ideas don't have a calendar. Neither does gratitude.*

---

## From PhD Thread (PreWork 6) — Architectural Notes for Marginalia

### The three-lens provocation sequence
Local model matrix as pre-deployment stress-testing layer — Phase 6 or 7 function. Before bringing an argument to human gatekeepers, run it through the local model sequence. Outputs won't be right but they'll surface where the argument is soft. "The XO using the enemy's maps to find the reefs."

### Bedrock bias caveat
Known architectural limitation: if the LLM summarizing a source is trained on the same Western linear textual monoculture as the sources being summarized, annotations will be epistemologically flatter than the sources deserve. Not a blocker — a caveat to build into the UI and documentation. The global model chip row (Qwen/Asian, Mistral/European, AfriqueQwen/African) is a partial structural response to this.

### Positionality sentence (methods section)
"Scaffolding your own scaffolding." The researcher who built a research workbench to stress-test the architecture before human review is doing methodological transparency in a form most SoTL candidates don't have access to. Name it explicitly in the methods section of the dissertation.

### Implication for annotation fields
annotation and argument_connection fields in canonical references are downstream of whoever summarized them. Single-model annotations are epistemologically narrow. Multi-model annotation — running the same source through Qwen, Mistral, and DeepSeek and comparing — is a richer capture. Worth building as an option in the reference panel (Phase 6).

---

## v0.9 — Project Intelligence (scoped, ready to build)

### "What am I missing?" button
- On-demand predictive pass — DeepSeek R1 reads all session files in current project
- Surfaces unasked questions, unexplored gaps, argument weaknesses
- Trigger: button in UI, not automatic — respects the "slow down" ethos
- Secondary trigger: optional time-based (every 2 hours if active)

### Rolling 100-word project summary
- Auto-updated every session completion and on every Save & Break
- Covers sessions between two selectable dates
- Lives at canonical/projects/[project-name]-summary.md
- 2-hour background timer triggers silent regeneration
- Designed to be readable as a standalone research diary entry

### Crash resilience by design
- Canonical files write atomically — crash mid-session loses only the unsaved window
- The notepad in meat space covers that window (Ingest tab, Phase 4)
- Incomplete sessions still contribute to rolling summary — fragments are data points
- "Chaff as fuel" — nothing wasted, just weighted accordingly

### Predictive framing
- The pass isn't looking for what's there — it's looking for what's missing and what's weak
- Same function as a supervisor reading a draft and asking "but what about X?"
- Checks the instrument's own work for blight
- Dissertation positionality note: the researcher built a tool that audits its own gaps

### Implementation estimate
- ~30-40 lines Python, one new Flask route /api/predict
- Small UI panel, "What am I missing?" button prominent in prompt view
- DeepSeek R1 as engine — same model doing synthesis, now doing longitudinal pattern recognition
- Session files already exist in canonical/sessions/ — infrastructure ready

---

## v0.9.2 — Library Intelligence (scoped, ready to build)

### Framing — critical
- NOT an agent, NOT an assistant, NOT acting on behalf of the researcher
- The library IS the intelligence — the tool is a lens pointed at curated material
- Researcher remains the epistemological centre — tool surfaces, researcher decides
- In UI: capability of the References tab, no branding, no persona, no agent language
- Dissertation positionality: using a multi-model lens to interrogate your own material

### Per-reference multi-model annotation
- Send abstract/annotation through 2-3 models, synthesise their readings
- Qwen reads a Western pedagogy paper differently than DeepSeek — that divergence is data
- Writes multi-voice annotation back to canonical reference file
- Route: /api/references/[id]/annotate
- UI: "Annotate" button in reference card, model chip selector, result appended to file

### Cross-reference thematic synthesis — "What's in my library?"
- DeepSeek reads all annotations, surfaces: recurring themes, tensions between sources,
  gaps in collected literature, sources that should be in conversation but aren't
- Route: /api/references/synthesise
- UI: button on References tab — no agent language, just "What's in my library?"
- Output: structured synthesis panel same as prompt synthesis

### Idea map (Phase 2, now has a data layer)
- Nodes: references
- Edges: thematic connections surfaced by cross-reference synthesis pass
- Force-directed SVG, hover shows connection reasoning
- The network is the visual layer on top of the cross-reference data

### What this makes Marginalia
- Not a citation manager (Zotero stores what you collected)
- Not a chat interface
- A research instrument that knows your collection, understands relationships between
  sources, surfaces what's missing, and can interrogate your argument against your
  own literature
- "What does my library say about embodied learning in non-Western contexts?" —
  answered from your canonical files, not from the internet or training data

### Connection to v0.9 Project Intelligence
- Session intelligence and reference intelligence feed the same synthesis engine
- Together they answer: what have I been thinking? what have I collected?
  what's the relationship? what's missing?
- The dissertation methods section should note: the instrument evolved from a
  multi-model prompt interface into a research library instrument during the
  course of the research. That evolution is itself a methodological finding.


---


---

## Versioning Roadmap — locked June 2026

### v0.9.x — Multi-model system complete (current)
- v0.9.2 — Library intelligence, synthesis model selector, local auto-detect ✓
- v0.9.2.1 — Local chip multi-select restored ✓
- v0.9.3 — Project intelligence / "What am I missing?" + rolling 100-word session summary, 2hr auto-update
- v0.9.4 — Crash resilience, atomic writes, chaff-as-fuel (incomplete sessions feed summary)

### v1.0 — Complete instrument, headless Mini
**Target: Mini goes headless in ~2 weeks**
- Tailscale remote access — phone/MBA as interface, Mini as engine
- Launchd plist — Marginalia starts on boot, runs headless
- Photo / handwritten notes → Gemma 4 OCR → models → canonical (The Napkin)
- Voice memo → transcription → models → canonical
- PDF annotation extraction → models → canonical
- Three-lens provocation on ingested material
- BibTeX export — round-trip complete (import AND export)

### v1.1 — Reference Intelligence Complete
- Zotero sync (import and export)
- Library database search (U of S, CrossRef direct)
- Full settings panel (synthesis model selector moves here from inline)
- Project management UI

### v1.2 — ISSOTL Ready
**Target: October 28, 2026 — Saskatoon**
- Polish, stability, demo mode
- Documentation complete for public release
- Ko-fi page updated with v1.2 release notes

### v2.x — Intelligence Layer
- Idea map (force-directed SVG)
- Reading assistant (transparent opt-in dwell-time)
- Writing tracker
- Multi-project context switching
- Three-lens provocation as standing feature

---

## Immediate next steps (this week)
1. Deploy v0.9.2.1 on Mini
2. Install Tailscale on Mini and MBA
3. Set up launchd plist for auto-start on boot
4. Test headless access from MBA and phone
5. Build v0.9.3 Project Intelligence

## Tailscale setup (quick reference)
- Install: https://tailscale.com/download
- Mini: `tailscale up` — note the Tailscale IP
- MBA/phone: install Tailscale app, sign in same account
- Access Marginalia at: `http://[mini-tailscale-ip]:5001`
- No port forwarding, no VPN config, works anywhere

## launchd plist (to build)
- ~/Library/LaunchAgents/com.marginalia.server.plist
- Runs bootstrap.command on login
- Sets OLLAMA_MODELS env var persistently
- Restarts on crash

## v2.x Wishlist (superseded by roadmap above — kept for reference)
 — Settings Panel and Beyond

### v2.0 — Settings Panel
- Full settings UI (currently Phase 2 placeholder)
- Configurable: default synthesis model, cloud model versions, timeout values
- Configurable: workflow preferences (break reminder, dwell threshold)
- Configurable: local model paths, Ollama host
- Synthesis model selector moves here from inline dropdown (v0.9.2 Option B → Option A)
- Model perspective labels editable (user can rename/reframe)

### v2.1 — Writing Tracker
- Log writing sessions with word count, session duration, reference links
- Connect writing sessions to research sessions
- "What was I thinking when I wrote this?" — link canonical sessions to writing dates

### v2.2 — Projects View
- Multi-project context switching
- Each project has own canonical/ folder, session history, reference library
- Rolling 100-word summary per project (from v0.9 spec)
- Project-scoped "What am I missing?" pass

### v2.3 — Idea Map
- Force-directed SVG graph — nodes are references, edges are thematic connections
- Connections surfaced by library intelligence synthesis pass (v0.9.2)
- Hover tooltips show connection reasoning
- Click node to launch prompt from that reference
- Visual layer on top of cross-reference data already being generated

### v2.4 — Reading Assistant
- Transparent opt-in dwell-time cross-reference engine
- While reading a source, surfaces related references from your library
- NOT covert — explicit opt-in, no hidden logic
- Timing data from v0.8.6.4+ feeds into dwell-time detection

### v2.5 — Three-Lens Provocation Sequence
- Pre-deployment argument stress-testing (from PhD PreWork 6 thread)
- Before bringing argument to human gatekeepers, run through local model matrix
- Surfaces where argument is soft — "the XO using the enemy's maps to find the reefs"
- Structured provocation prompts per lens (epistemic, methodological, contextual)

### v2.6 — Ingest / OCR
- Photo, PDF, audio, typed notes capture
- Gemma 4 as primary OCR engine
- PDF naming convention enforced: AuthorLastname_Year_ShortTitle.pdf
- Voice memo transcription for field notes

### v2.7 — launchd persistent env var
- OLLAMA_MODELS set system-wide on Mini via launchctl
- No manual export needed before ollama commands
- Bootstrap.command works cleanly without shell session dependency

### Perennial items
- Python 3.12 upgrade on Mini (Homebrew install pending)
- MacBook Air M5 deployment
- Anthropic API key top-up reminder in UI when credits low
- Mistral 14B available on stripped Mini (confirmed viable once clean)
