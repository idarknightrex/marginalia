# Marginalia — Changelog

---

## v0.9.2.2 — 2026-06-10 — dynamic local model discovery

### Feature: unknown Ollama models surface automatically as chips
- `/api/local-models` now returns any model in `ollama list` not claimed by a
  known chip key as a `dynamic: true` entry with key `ollama:<model_str>`
- `checkLocalModels()` renders new chip HTML for dynamic entries on page load —
  pull a new model, restart Marginalia, it appears without any code changes
- `call_model()` routes `ollama:*` keys directly to Ollama with the model string
- `handle_prompt` includes dynamic models in the local sequential firing order
- Response cards display cleaned label (strips `ollama:` prefix and `:latest`)
- Chip colour assigned deterministically from model name hash across a palette

---

## v0.9.2.1 — 2026-06-10 — local chip multi-select restored

### Fixed: local model chips reverted to single-select
- v0.9.2 introduced a radio-button enforcement block in `toggleModel()` that
  deactivated all other local chips whenever one was activated
- Removed the `if (isLocal)` exclusion loop — local chips now behave identically
  to cloud chips: toggle independently, any combination selectable
- Multi-model parallel local runs (DeepSeek + Qwen + Mistral etc.) restored

---

## v0.9.2 — 2026-06-10 — security & wiring fixes (fresh-eyes review)

### Fixed: Annotate button never shipped in v0.9.1
- The v0.9.1 patch silently failed to match — reference cards still had the old
  button row, annotateRef() was defined but never called
- Reference cards fully rebuilt: Launch Prompt →, ◆ Annotate, and Edit all wired
- Build scripts now FAIL LOUDLY when a patch target isn't found, instead of
  printing success while changing nothing — root cause of the v0.8.6 route bug
  and this one

### Security: path traversal guard on annotate route
- /api/references/<filename>/annotate validated: no slashes, no "..", resolved
  path must stay inside canonical/references/
- Matters now that the app binds 0.0.0.0 and Tailscale exposure is two weeks out

### Security: XSS-safe reference cards
- Titles, authors, and themes now rendered via textContent, never innerHTML
- A hostile BibTeX import can no longer execute script in the browser

### Fixed: thread-safe cost counter
- Parallel cloud workers now update anthropic_tokens under a lock

---

## v0.9.1 — 2026-06-10

### Library Intelligence — "What's in my library?"
- Button on References tab runs DeepSeek R1 across all canonical reference annotations
- Surfaces: recurring themes, tensions between sources, gaps in collection,
  sources that should be in conversation, fit with dissertation research question
- Output in a synthesis panel above the search row
- No agent language — the library is the intelligence, not a persona

### Per-reference multi-voice annotation
- "Annotate" button on each reference card
- Sends title/authors/themes through up to 2 active local models
- Synthesises their readings into a multi-voice annotation
- Writes result back to canonical markdown file
- Uses models already selected in the chip row

### Launch Prompt from reference
- "Launch Prompt →" button now pre-populates the prompt input with the reference
  details and a research-framed question ready to send to active models

### Synthesis model selector
- Dropdown next to synthesis label — "Synthesise with: [DeepSeek R1 ▾]"
- Choose any installed local model for the synthesis pass
- Selection sent with each prompt request — no restart needed
- Full settings panel (v2.0) will be the permanent home for this

### Architecture note
- NOT an agent, NOT an assistant — a lens pointed at curated material
- Researcher remains epistemological centre — tool surfaces, researcher decides
- All processing from your own canonical files, not internet or training data

---

## v0.8.8 — 2026-06-10

### Local model auto-detection
- On load, Marginalia queries Ollama /api/tags to check which models are actually installed
- Chips for uninstalled models go grey with "not installed" badge
- Clicking an uninstalled chip shows the exact ollama pull command to run
- Installed chips show actual model string and size (GB) added to tooltip
- Ollama unreachable: chips stay available but tooltip warns "Ollama not detected"
- No more silent failures — you know immediately what's available

### Repo cleanup
- Removed broadcast.json (handled remotely via GitHub)
- Removed ui-spec/ folder (v0.5 wireframe artifact)
- Removed bootstrap.bat (Windows — not a supported platform)
- Removed THREAD-SUMMARY.md (superseded by HANDOFF.md)

---

## v0.8.7.1 — 2026-06-09

### Fixed: Qwen and Mistral now fire correctly
- Added qwen and mistral to frontend MODEL_ORDER
- Added qwen and mistral to MODEL_META with correct perspective labels
- Added qwen and mistral to MODEL_TIMEOUT (300s each)
- Added qwen and mistral to MODEL_COLORS

### Fixed: Local model badges show correct type
- Qwen: local · Asia/Global South · ~1yr cutoff
- Mistral: local · Europe · ~1yr cutoff
- DeepSeek: local · China · ~1yr cutoff
- Gemma: local · Western · ~1yr cutoff
- Llama: local · Global · ~1yr cutoff

### Fixed: Countdown timer starts when model actually fires
- Timer now starts on backend 'start' event, not card creation
- Sequential local models show accurate individual elapsed times
- Cards created immediately but show no timer until backend signals

### Fixed: Local chip mutex removed
- Multiple local models can be selected and activated
- Fire sequentially with keep_alive:0 — each unloads before next loads
- Warning updated: Mistral (14GB) note, others sequential

### Fixed: cardStartTimes single declaration
- Removed duplicate declaration that caused reference errors

---

## v0.8.7 — 2026-06-09

### New local models: Qwen 2.5 14B and Mistral Small
- Qwen 2.5 14B (Asia / Global South perspective) — Alibaba, ~9GB, immense Asian cultural and academic training data
- Mistral Small (Europe perspective) — Mistral AI Paris, ~14GB, European legal and pedagogical training data, Apache 2.0
- Both start inactive by default — activate one local model at a time
- Mistral at 14GB: close all other apps before running

### Graceful local model unload (keep_alive: 0)
- All local Ollama calls now set keep_alive=0
- Model is evicted from memory immediately after responding
- Enables sequential local firing without RAM pressure building up
- Each model gets clean memory — no contention between local models
- Noted in chip tooltips

### Global perspective labels on local model badges
- DeepSeek R1: China
- Qwen 2.5: Asia / Global South
- Mistral: Europe
- Gemma 4: Western / Google
- Llama 3.1: Global English
- Visible in both chip tooltips and response card badges

### Epistemic diversity rationale
Multi-perspective synthesis is qualitatively different from multi-model consensus.
Qwen's reading of a Western source on embodied learning will surface assumptions
that DeepSeek and Gemma cannot see. Named as a methodological contribution in
the dissertation positionality section.

---

## v0.8.6.4 — 2026-06-09

### Generation timing per card
- Each response card shows elapsed time at the bottom when it arrives: ⏱ 4.2s
- Timing shown on error/timeout cards too
- Baseline data for future predictive/reading assistant work

### Synthesis pulse animation
- Synthesis panel border pulses amber while DeepSeek is running the meta-pass
- Loading text breathes (opacity pulse) during synthesis
- Snaps solid when text arrives
- Loading messages rotate randomly including "Conbobulating obfusticators…"

### Fixed: route decorator on wrong function
- @app.route("/api/prompt") was on call_model instead of handle_prompt
- Caused TypeError on every prompt submission
- Fixed permanently in build

### Fixed: Gemini request timeout
- Added request_options timeout=30 to Gemini API call
- Prevents silent hangs on slow network responses

### UI
- Prompt footer margin-bottom: 24px — more breathing room above response cards
- Response cards confirmed below prompt input

---

## v0.8.6.2 — 2026-06-09

### Fixed: response cards now correctly below the prompt input
- Reverted accidental reorder from v0.8.6.1 — cards appear below textarea as intended

### Fixed: timeout at zero now marks the card
- When countdown hits 0, card shows "⏱ Timed out" message in red
- Countdown hides cleanly
- Card no longer sits frozen — you can send a new prompt immediately

### Fixed: chip tooltips
- Switched from CSS hover to JS mouseenter with fixed positioning
- Tooltips now appear correctly above each chip with accurate placement
- No longer clipped by parent overflow or misaligned to wrong chip

---

## v0.8.6.1 — 2026-06-09

### UI fixes
- Response cards moved above the prompt input — you see responses without scrolling down
- Cards now stack single-column (was 2-col grid that caused overlap with 5+ cards)
- Response text capped at 300px with scroll for long responses
- Model label row bolder — easier to scan which model said what
- Cloud model timeout bumped from 30s to 60s — Gemini 2.5 Flash can be slow under load

### First-run setup warning
- On load, Marginalia checks /api/setup-status — if no cloud keys are configured, a full-screen setup guide appears
- Dark overlay explains exactly what to do: open setup.env, paste keys, restart
- Lists all three key sources with URLs
- Includes local model setup instructions (Ollama pull commands, OLLAMA_MODELS_PATH)
- "I'll set this up later" button dismisses and continues to the app
- Warning does not appear once any cloud key is configured
- Protects new users from landing on a broken-looking UI with no explanation

---

## v0.8.6 — 2026-06-09

### Timeout countdown (replaces progress bar)
- Each loading card shows a live countdown timer: "Waiting… ▓▓▓▓░░░ 28s"
- Bar depletes in real time with second-by-second updates
- Colour shifts: blue/green → amber at 40% remaining → red at 15%
- Timer stops and hides cleanly when response arrives
- Cloud models: 30s · Local models: 300s

### Cancel button
- Appears next to Send while a prompt is running
- Cancels stream immediately — pending cards marked Cancelled
- Send re-enables straight away — no restart needed

### Fixed: chip tooltips
- Tooltips now correctly attached to each chip
- Hover any chip to see model type, web awareness, knowledge cutoff, notes

### Fixed: local models not responding
- OLLAMA_MODELS_PATH added to setup.env
- app.py injects it as OLLAMA_MODELS env var on startup
- Ollama can now find models on external Vault SSD without manual export
- Set to /Volumes/Vault/Marginalia/ollama/models — change if your path differs

---

## v0.8.6 — 2026-06-09

### Timeout progress bar
- Each response card shows a thin bar that depletes over the model's timeout window
- Cloud models: 30 second bar (blue)
- Local models: 300 second bar (green)
- Bar turns red and card shows "Timed out" if model doesn't respond in time
- Bar fills instantly to full on completion — clear visual confirmation

### Cancel button
- Cancel button appears next to Send while a prompt is running
- Cancels the stream immediately — all pending cards marked Cancelled
- Send button re-enables — you can send a new prompt straight away
- No need to restart Marginalia to recover from a stalled session

---

## v0.8.5 — 2026-06-09

### Parallel cloud / sequential local model firing
- Cloud models (Gemini, Claude, GPT-4o) now fire in parallel — all start simultaneously
- Local models (DeepSeek, Gemma, Llama) still fire sequentially after cloud completes
- Net result: cloud responses arrive together in seconds; you read them while local models think
- Fixes Gemma appearing to "fire first" when cloud keys were missing (they errored instantly)

### Chip tooltips
- Hover over any model chip to see: model name, type, web awareness, knowledge cutoff, notes
- Gemini: web-aware, current knowledge
- Cloud models: no web search, ~early 2025 cutoff
- Local models: private, on-machine, ~1yr knowledge cutoff, memory notes
- DeepSeek tooltip notes it doubles as the synthesis engine

### Hide inactive chips toggle
- "Hide inactive" button above chip row — collapses greyed chips out of view
- Toggles to "Show all" — restores full chip row
- Useful when running with only 2-3 models active

---

## v0.8.4 — 2026-06-09

### Sequential streaming responses
- Models fire one at a time in defined order: Gemini → Claude → GPT-4o → DeepSeek → Gemma → Llama
- Each response card fills the moment that model completes — no waiting for all models to finish
- You can read Gemini while Claude is still thinking
- Local models fire after cloud models — fast responses first, deep local reasoning after
- Synthesis panel shows "Synthesising…" while DeepSeek R1 runs the meta-pass
- Backend: Flask streaming (text/event-stream); frontend: ReadableStream API

### Model swap — Perplexity → Llama 3.1 local
- Perplexity removed (paid API, no meaningful free tier)
- Llama 3.1 8B added as local chip — pull with: `ollama pull llama3.1:8b`
- Llama starts inactive by default — activate for a third local perspective

### Response card badges
- 🌐 web — model has live internet access (Gemini 2.5 Flash)
- 🔒 local — runs on your machine, private, no internet, ~1yr knowledge cutoff shown
- ☁️ cloud — cloud API call, no web search

---

## v0.8.3 — 2026-06-09

### Reference import — all routes into one canonical writer
- File drop — drag and drop or click to upload .csv, .bib, .ris
- BibTeX paste — Zotero, Google Scholar, any library export
- RIS paste — university databases, PubMed, JSTOR, U of S library
- CSV paste — seed_template.csv schema or any recognisable headers
- DOI list — paste one or many DOIs, metadata fetched from crossref.org automatically
- Plain text / local AI — paste a messy reference list, DeepSeek R1 parses it locally
- DOI quick lookup — single DOI preview on References tab before committing
- All routes funnel to write_canonical_reference() — one output format regardless of input
- Import button on References tab links to Ingest tab
- Ingest tab shows import UI prominently; Phase 4 capture moved to placeholder below

### Model changes
- Azure/GPT-4o (enterprise) replaced with OpenAI direct API (gpt-4o)
- Both OpenAI and Perplexity use openai Python SDK — same dependency, different base_url

### setup.env — visible config file
- setup.env replaces hidden .env for all API keys
- Plain text, clearly labelled, lives in repo root
- Gitignored so keys never push
- app.py loads setup.env first, falls back to .env for legacy installs
- Keys: ANTHROPIC_API_KEY, GOOGLE_API_KEY, OPENAI_API_KEY, OLLAMA_HOST, MARGINALIA_PORT

### Chips grey out when key is missing
- On load, /api/key-status checks which keys are configured
- Chips without keys go to 30% opacity with "no key" badge
- Clicking a no-key chip shows a prompt directing to setup.env
- Local chips (DeepSeek, Gemma, Llama) always full opacity — no key needed

### Docs updated
- GETTING-STARTED.md — complete rewrite for v0.8.x, Azure removed, setup.env flow
- README.md — model table, architecture, file structure all current
- HANDOFF.md — current build state, all chips, keys needed flagged

---

## v0.8.2 — 2026-06-08

### Local model support (DeepSeek R1 + Gemma 4)
- DeepSeek R1 8B and Gemma 4 wired to UI as selectable chips
- Ollama route added to /api/prompt — keys never leave the machine
- Model strings pulled from settings.json local config block
- Timeout 300s to handle cold model loads on 16GB systems

### Synthesis engine
- After any multi-model prompt, all responses sent to DeepSeek R1 locally for meta-pass
- Synthesis identifies: Consensus, Divergence, Unique Contributions, Gaps
- Synthesis panel shows actual content below response grid
- Synthesis written to canonical session file alongside individual responses
- Stays on machine — no cloud call

### Memory management (16GB systems)
- Gemma 4 starts inactive by default — DeepSeek R1 is the default local
- Clicking a local chip auto-deactivates the other (mutex)
- Amber warning strip if both local chips manually activated

### Claude cost counter
- Session token usage tracked per prompt (input + output)
- Running cost in status bar: Claude: $0.0000 — turns amber on any spend
- Claude Haiku 4.5 pricing: $0.80/M input, $4.00/M output

---

## v0.8.1 — 2026-06-08

- DeepSeek R1 8B and Gemma 4 chips added to UI and wired to Ollama backend
- settings.json multimodal updated to gemma4:latest
- Ollama timeout 120s

---

## v0.8-pre — 2026-06-08 — initial working build

- Multi-model prompt engine: Gemini 2.5 Flash, Claude Haiku, GPT-4o (Azure)
- Reference pipeline with canonical markdown files
- Save & Break — git add + commit + push, pre-flight large file scan
- Broadcast banner (pulls from GitHub broadcast.json)
- Session timer in status bar
- Four-layer backup architecture: internal → Vault rsync → iCloud/OneDrive → GitHub

---

## v0.9 — Project Intelligence (scoped, not yet built)

- "What am I missing?" button — DeepSeek R1 predictive pass across all project sessions
- Rolling 100-word project summary, updated every session and on Save & Break
- 2-hour background auto-summarise timer
- Crash resilience: atomic writes, meat-space notepad covers the gap window
- Chaff as fuel: incomplete sessions still feed the summary
- /api/predict route, ~30-40 lines Python
- Infrastructure already exists — canonical/sessions/ ready to read

