# Marginalia — Thread Handoff
**Version:** v0.8.7
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

## Model Chips (v0.8.7)
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
- **v0.8.1** — DeepSeek R1 + Gemma 4 chips added and wired to Ollama backend
- **v0.8.2** — Synthesis engine (DeepSeek R1 local meta-pass). 16GB mutex. Claude cost counter.
- **v0.8.7** — Full reference import (CSV/BibTeX/RIS/DOI/plaintext). Azure replaced with OpenAI direct + Perplexity. setup.env replaces .env. Docs updated.

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
