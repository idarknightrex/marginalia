# Marginalia — Changelog

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
