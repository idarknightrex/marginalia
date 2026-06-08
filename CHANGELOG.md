# Marginalia Changelog

## v0.8-pre — 2026-06-08 (pre-release)

First working build. Flask backend, prompt engine, reference library, canonical file architecture.
Beta deniability intact. Full rollout target: Fall 2026 alongside PhD program start.

### What works
- Multi-model prompt engine (Gemini, Claude, Azure — simultaneous)
- Reference library with search, filter, add, canonical file creation
- Session save to canonical/sessions/ on every prompt
- Save & Break — git commit with pre-flight binary scanner
- Broadcast banner from GitHub
- Cross-platform: Mac (bootstrap.command), Linux (bootstrap.sh), Windows (bootstrap.bat)

### Models
- Gemini: gemini-2.5-flash (Google AI Studio free tier)
- Azure: gpt-4o (institutional access)
- Anthropic: claude-haiku-4-5 (optional, pay-as-you-go)
- Local reasoning: deepseek-r1:8b (Ollama — not yet wired to UI)
- Local multimodal: gemma2:9b (Ollama — Phase 4)
- Local general: llama3.1:8b (Ollama — not yet wired to UI)

### Not yet built (Phase 2+)
- Idea map
- Ingest / OCR
- Reading Assistant
- Settings panel
- Writing tracker
- Projects view
- Dashboard integration

---

## v0.5.0 — 2026-06-08 (documentation release)

Scope and documentation only. No runnable code.
README, SCOPE, GETTING-STARTED, broadcast.json, settings.json, wireframe UI spec.

_Update this file whenever models, dependencies, or infrastructure changes._
