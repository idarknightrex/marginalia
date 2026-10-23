# Marginalia — Roadmap

This file lives in the repo and tracks shipped work, known bugs, and the 1.9 plan.
It mirrors the project handoff at `claude/handoff.md` in the Marginalia Claude Project.
Update both when the version changes.

---

## Current version

**1.8.18.1023-2101** (Oct 23 2026)

---

## What shipped in 1.8.x (complete)

- Multi-model council (Gemini, Claude, OpenAI, DeepSeek, Qwen, Mistral, Cohere, Gemma, Llama)
- SSE streaming with per-card countdown and live timer
- RAG layer: SLM (Qwen2.5:0.5b / Llama3.2:1b) → DDG Lite → `[RETRIEVED CONTEXT]` block
- Canonical reference library (markdown + YAML frontmatter, one file per ref)
- Import: BibTeX, RIS, CSV, DOI batch, plaintext (AI-parsed)
- Export: BibTeX sync, CSL-JSON sync
- CrossRef DOI lookup
- Semantic Scholar + OpenAlex enrichment (two-step: search → human picks)
- Library audit (field-quality + passive dedup scan, audit_worst frontmatter flag)
- Reference filter history (last 3 combinations, quick-reapply chips)
- Annotate gate: refuses surfaced refs (confabulation guard)
- Annotation: multi-model council → synthesis → writes to ref body
- Projects + Writing tracking
- Sessions: early stub → full write-back on completion
- Disposition slider (Build / Balance / Challenge)
- Intelligence view: library synthesis
- Notes view
- BibTeX sync on-demand + BIBSYNC alias on forkd

---

## Known bugs (fix in 1.9 build)

### ~~CRITICAL — Cite key Unicode (breaks Zettlr)~~ FIXED in 1.8.17

`_ascii_slug()` helper added; `write_canonical_reference()` now normalises
`first_author` to ASCII for both cite key and filename.  Export functions
still use filename slug -- switching them to `cite_key` requires a migration
pass across all ~280 existing canonical files first (separate build).

### Export silent drop

A malformed ref kills the entire export silently.
Fix: three-phase export (parse / validate / serialize). Currently only parsing exists.
Phase 2 (validate) should collect errors and skip bad refs with a warning log.
Phase 3 (serialize) should only process validated records.

### CRITICAL — All ingest paths drop citation elements

`write_canonical_reference()` has frontmatter slots for journal, volume, issue,
pages, publisher — but every intake path ignores them:

| Parser | journal | volume | issue | pages | publisher |
|--------|---------|--------|-------|-------|-----------|
| BibTeX (bibtexparser) | ❌ | ❌ | ❌ | ❌ | ❌ |
| BibTeX (minimal/regex) | ❌ | ❌ | ❌ | ❌ | ❌ |
| RIS | ❌ | ❌ | ❌ | ❌ | ❌ |
| CSV | ❌ | ❌ | ❌ | ❌ | ❌ |
| DOI lookup | ❌ | ❌ | ❌ | ❌ | ❌ |

Every ref imported since launch has blank citation elements.

**DOI lookup also has wrong year priority**: picks `published` (online-first)
before `published-print` (journal issue). Banas et al. 2011 imports as 2010.
Fix: `published-print` → `published` → `published-online`.

**DOI not written**: stripped DOI value doesn't reliably land in `url_doi`.

Field mappings needed:
- BibTeX: `journal`→journal, `volume`→volume, `number`→issue, `pages`→pages, `publisher`→publisher
- RIS: `JO`/`JF`/`T2`→journal, `VL`→volume, `IS`→issue, `SP`/`EP`→pages, `PB`→publisher
- CSV: add journal/volume/issue/pages/publisher to field_map
- DOI: `container-title`→journal, `volume`, `issue`, `page`→pages, `publisher`

Enrich pass needs a "re-fetch from DOI" mode that re-queries CrossRef for
existing refs and backfills missing/wrong fields.

### Dupe detection gap — no-DOI subtitle variation

`_is_likely_duplicate()` requires ≥3 overlapping title tokens.
A different subtitle on the same work with no DOI is not caught.
Côté double-import was confirmed in the wild.
Fix: add subtitle-strip normalization before token comparison (strip everything after `:` for matching).

### ~~Ref card `url:None` display~~ FIXED in 1.8.17

`renderRefs()` now checks `url_doi.toLowerCase() !== 'none'` in all four
places that test the field (card DOI button, detail panel, has-link count,
has-link filter).

---

## Stale / housekeeping (fix in 1.9 build)

- **Module docstring line 2 of app.py**: still says `v1.7.3.0923-1607`. Update to current version every build.
- **Missing docstrings** (see comment-gaps.md in this repo):
  - `app.py`: `read_all_references`, `call_ollama`, `run_synthesis`, `parse_csv_import`, `parse_ris_import`, `lookup_doi`, `call_model`, `get_local_models`
  - `app.js`: `loadReferences`, `renderRefs`, `updateFilterLabels`, `annotateRef`, `updateFramingPreview`

---

## 1.9 scope

### Infrastructure prerequisites (must be running before any 1.9 build)

1. **SLM on Solaris** — Qwen2.5:0.5b (preferred, 397MB) or Llama3.2:1b (1.3GB)
   - `ollama pull qwen2.5:0.5b` on 100.126.14.57
   - Verify: `curl http://localhost:11434/api/tags` shows the model

2. **Perplexica + SearXNG** — containerized, accessible from Marginalia
   - Perplexica API endpoint must be reachable from port 5001 process

Neither 1.9 feature above is buildable until both prerequisites are confirmed live.

---

### Triple RAG

Current RAG: SLM → DDG Lite → `[RETRIEVED CONTEXT]`

1.9 adds two more layers, all three run together and results are merged:

| Layer | Source | Mechanism |
|-------|--------|-----------|
| **Ref library** | Local `.md` files | Keyword + semantic match against `title`, `keywords`, `annotation` |
| **Local SLM** | On-device model | Same SLM DDG query → snippets pattern as current |
| **Perplexica** | Perplexica / SearXNG | API call, richer web retrieval |

Merged block replaces the current single `[RETRIEVED CONTEXT]` block.
Provenance must be per-snippet: `[source: ref-library | Smith_2020_...]`, `[source: web | ...]`, `[source: perplexica | ...]`.

---

### Provenance architecture

Every model response and synthesis must be traceable to its context inputs.
Architecture:
- Each session file records: which RAG layers fired, which refs were in-context, which model versions were used
- A `provenance` frontmatter block in each session: `{ rag_layers: [...], refs_in_context: [...], models: [...] }`
- UI: provenance panel in session view (expandable, not shown by default)

---

### Mapping visualization v1

**Design model:** the PhD Research Desk HTML (not an integration target — a reference for the visual language)

**Purpose:** map relationships between refs, projects, writing pieces, and sessions. Let the researcher see the shape of their argument, not just lists.

**Link model:**
```
{
  id:        UUID,
  from:      ref/project/writing/session filename,
  to:        ref/project/writing/session filename,
  rel:       "supports" | "challenges" | "extends" | "cites" | "used-in",
  rationale: short string (why this link exists),
  origin:    "human" | "llm-proposed",
  at:        ISO8601 timestamp,
  conf:      0.0–1.0 (LLM confidence; human links always 1.0)
}
```

**Human authority:** humans confirm and delete. LLMs propose only — no link is written without human confirmation.

**Storage:** `links/` directory, one JSON file per link, same canonical pattern as refs and sessions.

**Minimum viable UI:**
- Force-directed graph (D3 or similar, embedded in Intelligence view)
- Nodes: refs (blue), projects (green), writing (amber), sessions (grey)
- Edges: colored by rel type
- Click node → open ref/session view
- LLM-proposed links shown as dashed, faded until confirmed

**API:**
- `GET /api/links` → all links
- `POST /api/links` → create (human only; LLM proposals go to `/api/links/propose`)
- `PATCH /api/links/<id>/confirm` → human confirms a proposed link
- `DELETE /api/links/<id>` → human deletes

---

## Manual actions pending

- **Delete bad Côté record** on Solaris: the bottom entry in the library added ~22:15,
  wrong subtitle "A crisis in higher education" — delete the file directly from `references/`

---

## Build conventions

- AST check before every pack: `python3 -m py_compile app.py`
- UTC timestamp from utctime.net immediately before stamping
- Version format: `MAJOR.MINOR.PATCH.MMDD-HHMM` (UTC)
- Deploy: single `scp + ssh -t` compound — git commit AND push stay inside the ssh block, never split
- Module docstring on line 2 of app.py must be updated every build

---

## Version trail (1.8.x)

| Version | Date | Notes |
|---------|------|-------|
| 1.8.18.1023-2101 | Oct 23 2026 | Ingest fix: all parsers now write journal/vol/issue/pages/publisher; DOI date priority fix; DOI re-fetch enrich |
| 1.8.17.1023-1607 | Oct 23 2026 | Cite key ASCII fix, url:None fix, comment pass |
| 1.8.16.1019-2352 | Oct 19 2026 | Repack |
| 1.8.15 | Oct 2026 | Audit backfill, filter history |
| 1.8.14 | Oct 2026 | Enrich two-step (search → human picks), confabulation guard |
| 1.8.13 | Oct 2026 | Audit_worst frontmatter flag, library audit UI |
| 1.8.12 | Oct 2026 | RAG layer (SLM + DDG Lite) |
| 1.8.11 | Oct 2026 | Disposition slider |
| 1.8.10 | Sep 2026 | Multi-model council, SSE streaming |
