# Multi-LLM Research Assistant — Project Scope
**Version:** 0.5 (pre-build)  
**Author:** Raj Boora  
**Date:** 2026-04-28  
**Status:** Scoping / Pre-development

---

## 1. What This Is

A locally-hosted web application that sends research prompts to multiple LLMs simultaneously, synthesizes their responses, captures and annotates references, and stores everything in a portable, version-controlled project folder. Designed specifically for PhD literature synthesis work, with expansion ports for non-keyboard input.

### What it is not
- A cloud service
- A citation manager (it feeds one)
- A replacement for close reading
- A reliable source of new citations (models hallucinate — verification is built into the workflow)

---

## 2. Core Design Principles

1. **Local-first.** Everything runs on your machine. API calls are the only outbound traffic.
2. **Portable.** The entire project is a folder. Clone it, zip it, copy it — it runs anywhere Python runs.
3. **Sync-safe.** Designed around a private GitHub repo. One command to bootstrap on a new machine.
4. **Research-grade.** Timestamped logs, verification flags, annotation fields, exportable to Zotero.
8. **Flat-files-as-truth.** SQLite is runtime state, not canonical state. Every reference, session, and annotation exists as a human-readable flat file before it exists in the database. Lose the database — rebuild it in seconds. Lose the flat files — you have lost your research. The tool should never be the only thing that can read what you wrote.
5. **Expandable.** Input ingestion is modular — keyboard today, OCR/audio/video tomorrow.
6. **Free-tier friendly.** Optimized for Google AI Studio (free) + institutional Microsoft access. Anthropic optional.
7. **Paper-primary.** The analogue close reading process is primary. This tool is the capture and connection layer around it — complementary, not replacement. A margin note on Battiste and a synthesis session that surfaces Wynter should be able to find each other. They won't if they live in isolation.

   *Neurological basis (added June 2026):* This principle is not preference or habit — it is supported by a growing body of fMRI evidence. Paper reading facilitates deeper linguistic and narrative-structural integration than screen reading (Umejima et al., 2026). Handwritten notes produce stronger hippocampal and language area activations during memory retrieval than typed or device-based notes (Umejima et al., 2021; Mueller & Oppenheimer, 2014). The paper process does cognitive work that the digital process cannot replicate. Marginalia preserves that work and makes it interrogable.

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  Browser (localhost)                 │
│              Your UI — any machine                  │
└────────────────────┬────────────────────────────────┘
                     │ HTTP
┌────────────────────▼────────────────────────────────┐
│              Flask Backend (Python)                  │
│                 localhost:5000                       │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  API Router  │  │  Synthesizer │  │  Ingestion │ │
│  │             │  │              │  │   Layer    │ │
│  └──────┬──────┘  └──────┬───────┘  └─────┬──────┘ │
│         │                │                │        │
│  ┌──────▼────────────────▼────────────────▼──────┐  │
│  │              SQLite Database                  │  │
│  │         (single file: research.db)            │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
    Google AI    Azure/MS     Anthropic
     (free)    (institutional) (optional)
```

---

## 4. Phased Build Plan

### Phase 1 — Core Prompt Engine
**Deliverable:** Working multi-LLM prompt interface with synthesis

Features:
- Text prompt input in browser
- Parallel calls to configured LLMs
- Side-by-side response display
- Synthesis call: commonalities, divergences, unique framings, outliers
- Auto-save: every session saved as timestamped JSON + readable `.txt`
- Basic session log viewable in browser

**Estimated complexity:** ~300 lines Python, ~200 lines HTML/CSS/JS

**Token cost awareness (Phase 1 required feature):**
The synthesis call is the expensive one — sending 4-5 long model responses back into
a single synthesis prompt can scale token billing rapidly under Gemini's compute-based
pricing, especially across a research-heavy day.

Implement a lightweight token counter wrapper before each API call:

```python
# utils/token_counter.py
import tiktoken  # for OpenAI/Azure models
# For Gemini: use the countTokens API endpoint (free to call)

def estimate_tokens(text: str, model: str = "gpt-4o") -> int:
    try:
        enc = tiktoken.encoding_for_model(model)
        return len(enc.encode(text))
    except:
        # Rough fallback: ~4 chars per token
        return len(text) // 4

def estimate_cost_warning(prompt: str, responses: list, threshold: int = 8000) -> dict:
    total = estimate_tokens(prompt)
    for r in responses:
        total += estimate_tokens(r)
    return {
        "total_tokens": total,
        "warn": total > threshold,
        "message": f"Synthesis prompt is ~{total:,} tokens. Proceed?" if total > threshold else None
    }
```

**UI behaviour:**
- Token estimate shown below synthesis button before sending
- Yellow warning if estimated tokens exceed configurable threshold (default 8,000)
- User can proceed or trim responses before synthesising
- Threshold configurable in `config.py` — adjust as you learn your actual usage patterns

**Dependencies:** `tiktoken` (OpenAI, free). Gemini token counting uses the
`countTokens` REST endpoint — no additional library needed.

---

### Phase 2 — Reference Capture
**Deliverable:** In-session reference flagging and annotation

Features:
- "Flag as reference" button on any model response or synthesis
- Fields: title, author(s), year, source type, URL/DOI, your annotation, connection to your argument
- **Verification status:** `unverified` | `verified` | `rejected`
- Reference list view with filter by status, theme, date
- All references stored in SQLite

**Data model (references table):**

| Field | Type | Notes |
|---|---|---|
| id | UUID | auto-generated |
| title | text | |
| authors | text | comma-separated (acceptable at research scale — normalise if exporting to Zotero) |
| year | integer | |
| source_type | text | journal / book / chapter / web / etc. |
| url_doi | text | |
| annotation | text | your words |
| argument_connection | text | how it fits your iceberg |
| themes | text | DEPRECATED — use themes join table (see below) |
| verification_status | text | surfaced / located / verified / rejected (see below) |
| physical_holding | text | none / physical / pdf / library-access / ebook |
| holding_location | text | shelf, folder path, library URL, etc. |
| source_model | text | which LLM surfaced it / manual if entered by hand |
| session_id | text | links back to prompt session (null if manually entered) |
| created_at | timestamp | |
| updated_at | timestamp | |

**Schema normalisation — themes join table (Gap 3 fix, v0.5):**

Comma-separated tags in a text column fail gracefully at 50 references but become
slow painful LIKE queries at 500+, especially under Phase 7 idea map graph rendering.

Replace the flat `themes` text field with a proper join table:

```sql
-- themes lookup table
CREATE TABLE themes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- join table: many references <-> many themes
CREATE TABLE reference_themes (
    reference_id TEXT NOT NULL,
    theme_id INTEGER NOT NULL,
    PRIMARY KEY (reference_id, theme_id),
    FOREIGN KEY (reference_id) REFERENCES references(id),
    FOREIGN KEY (theme_id) REFERENCES themes(id)
);

-- same pattern for posts and dashboard_threads
CREATE TABLE post_themes (
    post_id TEXT NOT NULL,
    theme_id INTEGER NOT NULL,
    PRIMARY KEY (post_id, theme_id)
);
```

**Query performance benefit for Phase 7:**
```sql
-- Fast: join-based theme lookup
SELECT r.* FROM references r
JOIN reference_themes rt ON r.id = rt.reference_id
JOIN themes t ON rt.theme_id = t.id
WHERE t.name = 'indigenous-methodologies';

-- vs. Slow: text column scan at scale
SELECT * FROM references
WHERE themes LIKE '%indigenous-methodologies%';
```

**Migration path from flat text:**
If you start with flat text tags and normalise later, a one-time migration script
converts comma-separated values to the join table. Include this in `db/migrations/`
from the start even if the join table is implemented immediately.

**Recommended:** Implement the join table in Phase 1. The cost is minimal now.
Retrofitting it after 500 references requires a migration and UI changes simultaneously.

**Verification status pipeline:**

| Status | Meaning |
|---|---|
| `surfaced` | LLM mentioned it — not yet located or confirmed to exist |
| `located` | You have it — physical, PDF, or confirmed library access |
| `verified` | You have read enough to confirm it says what was claimed |
| `rejected` | Hallucinated, irrelevant, or superseded |

**Physical/electronic holding types:**

| Value | Meaning |
|---|---|
| `none` | Surfaced but not yet obtained |
| `physical` | Book or paper copy on hand |
| `pdf` | PDF saved locally or in cloud |
| `ebook` | Kindle, Apple Books, institutional ebook |
| `library-access` | Available via MacEwan/USask library proxy |

**Manual entry:**
References do not have to originate from an LLM prompt. Books already on your shelf, papers from your Masters work, or sources from your paper-based reading can be entered directly. Set `source_model` to `manual` and `session_id` to null. This is the primary bridge between your paper method and the digital workbench — your existing library enters the idea map the moment you log it.

**UI implications:**
- Reference card shows holding status as a colour-coded badge: 
  grey (surfaced) → yellow (located) → green (verified) → red (rejected)
- Filter library by holding type — "show me everything I own physically"
- "Mark as located" button promotes surfaced → located and opens holding_location field
- Idea map node colour reflects verification status, not just verified/unverified

---

### Phase 3 — Export & Zotero Integration
**Deliverable:** Push verified references to Zotero

Features:
- Export verified references as BibTeX (`.bib`) — drag-and-drop into Zotero
- APA 7 formatted reference list export (`.txt` / `.md`)
- "Export session" — everything from one research session as a markdown document
- Zotero Web API integration (optional, future — see implementation note below)

**Implementation order — BibTeX first:**
Generate a static `.bib` file that you drag-and-drop into Zotero. This takes an
afternoon to code and covers 95% of the use case. Do NOT attempt Zotero Web API
OAuth token management until BibTeX export is stable and battle-tested.
Managing OAuth tokens for the Zotero API takes a week and introduces an external
dependency that can break independently of everything else. BibTeX first.

---

### Phase 4 — Handwritten Note Ingestion
**Deliverable:** Handwritten notes → prompt or annotation

**Reframing note (June 2026):**
This phase was originally scoped as an "expansion port" — a convenience feature for
people who prefer paper. The evidence now suggests it should be treated as the primary
input channel for the thinking that matters most.

Mueller and Oppenheimer (2014) demonstrated that handwritten note-takers outperformed
laptop note-takers on conceptual questions even with less voluminous notes — because
handwriting forces real-time processing and summarisation, driving deeper encoding.
Umejima et al. (2021) found paper notebook writing produced stronger hippocampal and
language area activations during memory retrieval compared to tablet and smartphone.
Umejima et al. (2026) extended this to reading: paper reading facilitates linguistic
and narrative-structural integration, saving excessive frontal activation compared to
tablet reading.

The chain is consistent: paper reading encodes better, handwritten notes consolidate
better, and the neurological evidence explains why. Photographing handwritten margin
notes and pulling them into Marginalia is not retrofitting an analogue habit — it is
preserving the encoding advantage of the paper process while making the output
interrogable.

Features:
- Upload photo of handwritten notes (phone camera, flatbed scan exported as image)
- Upload scanned PDF (margin notes, annotated pages, handwritten notebooks)
- OCR extracts text (Gemma 4 12B locally — test first; Tesseract as fallback)
- Extracted text editable before sending as prompt or saving as annotation
- Original file preserved alongside extracted text — the handwriting is the primary artifact

**Supported input formats:**

| Format | Source | Notes |
|---|---|---|
| JPG / PNG | Phone photo | Fastest capture — always available |
| JPG / PNG | Flatbed scanner export | Highest quality — flat, consistent, cropped |
| PDF (scanned) | Scanner or copier | Multi-page support — each page processed separately |
| PDF (text layer) | Digital PDF with highlights | Text extracted directly — no OCR needed |

**Scanned PDF handling:**
PDFs are converted to images page by page before processing. One-liner using
`pdf2image` (wraps `poppler`):

```python
from pdf2image import convert_from_path

def pdf_to_images(pdf_path):
    images = convert_from_path(pdf_path)
    return images  # list of PIL Image objects, one per page
```

If Gemma 4 12B accepts PDFs natively — test this first before adding the
`pdf2image` dependency. The multimodal architecture may handle multi-page
PDFs directly without conversion.

**Practical quality guide:**
- Phone photo of loose notes → fine, fastest
- Phone photo of book margin notes → acceptable, watch for angle and shadow
- Scanned PDF of annotated pages → clean, consistent, recommended for dense annotations
- Flatbed scan as image → highest quality, worth it for heavily annotated pages

**Architecture note — Gemma 4 12B first, Tesseract second:**
Make testing Gemma 4 12B your absolute first task when you hit Phase 4.
Upload three or four photos of your actual handwriting. If Gemma 4 12B handles
your specific handwriting style with acceptable accuracy, drop Tesseract from
requirements.txt entirely. Do not add dependencies you do not need.

Phase 4 with Gemma 4 12B: upload image → send to local model → extract text. Done.
Phase 4 with Tesseract fallback: only if Gemma 4 12B fails your handwriting test.

Keeping the codebase lightweight matters for the Summer 2027 open-source release —
every dependency is an install friction point for someone else.

**Dependencies:** `pytesseract` + Tesseract binary (free, local) — or Gemma 4 12B via Ollama

**Key references:**
- Mueller, P. A., & Oppenheimer, D. M. (2014). The pen is mightier than the keyboard. *Psychological Science*, 25(6), 1159–1168.
- Umejima, K., Ibaraki, T., Yamazaki, T., & Sakai, K. L. (2021). Paper notebooks vs. mobile devices: Brain activation differences during memory retrieval. *Frontiers in Behavioral Neuroscience*, 15, 634158.
- Umejima, K., Sunada, Y., & Sakai, K. L. (2026). Manga reading on paper vs. digital devices. *PLOS ONE*, 21(6), e0349778.

---

### Phase 5 — Audio/Video Ingestion (Expansion Port 2)
**Deliverable:** Voice memos, lectures, recordings → prompt or annotation

Features:
- Upload audio (`.mp3`, `.m4a`, `.wav`) or video (`.mp4`)
- Transcription via OpenAI Whisper (runs **locally**, free, no API key)
- Video: audio track extracted automatically before transcription
- Transcript editable before sending as prompt or saving as note
- Original file stored with record

**Architecture note (June 2026):**
Gemma 4 12B handles audio and video natively — including speech recognition and
speaker diarization — without a separate Whisper pipeline. In one benchmark it
processed a five-minute keynote at 313 frames/second alongside audio natively.
Test Gemma 4 12B as the unified audio/video ingestion model before committing to
the full Whisper + ffmpeg implementation. Whisper remains the fallback for
audio-only use cases and for sessions where the 12B model is not loaded.

**Dependencies:** `openai-whisper` + `ffmpeg` (both free, local) — or Gemma 4 12B via Ollama

---

### Phase 6 — Reference as Prompt Seed
**Deliverable:** Launch new synthesis sessions directly from verified references

This closes the loop between your reference library and the prompt engine. A verified reference — with your annotation and argument connection already written — becomes the starting context for a new inquiry rather than a dead end.

Features:
- "Launch prompt from this reference" button on any verified reference
- Pre-populates prompt with reference metadata + your annotation + argument connection field
- Optional: select additional references to include as context (multi-seed)
- Session record links back to the source reference(s) — builds a traceable research thread
- Suggested prompt templates per reference type:
  - *"What does [reference] connect to in the literature on [your theme]?"*
  - *"What's the strongest counterargument to [your annotation of this reference]?"*
  - *"Who else is working in the space opened by [reference]?"*
  - *"What's missing from [reference] relative to [your argument]?"*

**Data model addition (sessions table):**

| Field | Type | Notes |
|---|---|---|
| seed_reference_ids | text | comma-separated UUIDs of source references |

No other schema changes needed — the link is a foreign key back to existing reference records.

---

### Phase 7 — Idea Map
**Deliverable:** Visual graph of references, concepts, and connections

Renders the relationships already latent in your database — references, themes, sessions, and your annotations — as a navigable spatial map. The map doesn't create new knowledge; it makes visible the structure of what you've already captured.

**What the nodes are:**
- References (verified, unverified, rejected — colour coded)
- Concepts / themes (derived from your theme tags)
- Sessions (prompt clusters)

**What the edges are:**
- Reference → theme tag
- Reference → reference (via shared theme tags or explicit connection you annotate)
- Session → reference (seeded from or surfaced in)
- Your explicit "connects to" annotations

**Features:**
- Force-directed graph renders in browser (Vis.js — free, no backend changes)
- Click a node to open the reference or session record
- Filter by: theme, verification status, date range
- "Cluster by theme" layout option
- Export map as SVG for inclusion in notes or dissertation appendix
- Manual edge creation — draw a connection between any two nodes with a label

**Implementation approach:**
```
Backend: New /api/graph endpoint returns nodes + edges as JSON
         Derived entirely from existing database — no new tables needed

Frontend: vis-network.js renders the graph
          ~150 lines JS, single new template: map.html
```

**Why this complements paper method:**
Your paper process builds connections spatially — margin notes, arrows, sticky notes, pages laid out on a desk. The idea map is the digital analogue of that spatial thinking, not a replacement for it. Critically, it's generated from your words (your annotations, your theme tags, your argument connections) — not from LLM output.

---


### Phase 8 — PhD Dashboard Integration
**Deliverable:** PhD thread dashboard served within the workbench interface

Integrates the existing PhD Thread Dashboard (currently a standalone HTML file) into the workbench so that thread tracking, flags, and next moves live alongside research sessions and the reference library in a single interface.

---

#### Option A — Folder Watch (Phase 8 initial build) — DO THIS ONE
**Complexity:** ~20 lines of Flask. One afternoon.

**Do not build Option B during your PhD.** Serving your existing `current.html`
via Flask gives you 90% of the value for 10% of the engineering friction.
Building a custom CRUD database editor for dashboard cards is a satisfying
engineering problem that will cost you two weeks of research time you do not have.
Option A first. Option B after the dissertation is submitted if at all.

Flask serves whatever dashboard file lives in `/dashboard/` at `localhost:5000/dashboard`. You continue generating the dashboard however you currently generate it — the workbench just gives it a permanent home and navigation entry point.

**What this buys immediately:**
- Dashboard accessible from any device via Tailscale
- Single URL for your entire research environment
- No changes to your current dashboard generation workflow

**Folder convention:**
```
dashboard/
├── current.html          ← always the live version (Flask serves this)
└── archive/
    ├── phd_dashboard_v1.html
    ├── phd_dashboard_v2.html
    ├── phd_dashboard_v3.html
    └── phd_dashboard_v4.html   ← your current version
```

When you generate a new version: save as current.html, move the previous to archive/ with version suffix. Git tracks the full history automatically.

---

#### Option B — Data-Driven Dashboard (Phase 8 upgrade path)
**Complexity:** Medium. Requires defining a JSON schema for dashboard cards.

Dashboard cards become structured data — JSON files you edit directly or through a simple workbench UI. Flask reads the data and renders the dashboard dynamically. Cards link to reference records in the workbench database.

**What this adds over Option A:**
- Flag as reference button on a dashboard card creates a workbench reference record directly
- Dashboard threads appear as nodes in the idea map (Phase 7)
- Reference records link back to the dashboard thread that prompted them
- Filter sessions by associated dashboard thread
- Dashboard cards update automatically when linked references change status

**Data schema (dashboard_threads table):**

| Field | Type | Notes |
|---|---|---|
| id | UUID | auto-generated |
| title | text | card title |
| priority | text | high / med / low |
| status | text | flags / next / blocked / done |
| chip_label | text | Reading / Writing / Admin / etc. |
| body | text | card expanded content in markdown |
| linked_reference_ids | text | comma-separated UUIDs |
| linked_session_ids | text | comma-separated session UUIDs |
| created_at | timestamp | |
| updated_at | timestamp | |

---

#### Cross-workbench connections (both options)

Several cards in the current v4 dashboard map directly to workbench reference records waiting to be created:

| Dashboard card | Workbench action |
|---|---|
| Callahan (1962) — get and read | New reference, status: surfaced, holding: none |
| Embodied posture study — confirm citation | New reference, status: surfaced, verification needed |
| Wynter Man1/Man2 | New reference, status: located |
| Paraconsistent logic — formal literature | New reference, status: surfaced |
| Sami Verddet + non-Canadian Elder analogues | New reference, status: surfaced |

Creating these records from the dashboard cards is the first concrete data-entry task when the workbench goes live — it seeds the reference library and idea map with your existing intellectual architecture immediately.

---

### Phase 9 — Writing & Posts Tracker
**Deliverable:** Track published writing alongside research sessions and references

The blog is the public-facing surface of the iceberg. The workbench is the structure underneath. This phase closes the loop — connecting published posts to the research sessions and references that informed them, and tracking pieces in progress.

**What this tracks:**
- Published posts (boora.ca and elsewhere)
- Pieces in progress with status
- Connection between a post and the sessions/references that fed it

**Data model (posts table):**

| Field | Type | Notes |
|---|---|---|
| id | UUID | auto-generated |
| title | text | |
| status | text | idea / drafting / published / archived |
| url | text | live URL if published |
| published_date | date | |
| summary | text | one paragraph — what the piece argues |
| linked_reference_ids | text | references that informed this piece |
| linked_session_ids | text | research sessions connected to this piece |
| themes | text | comma-separated tags — should overlap with reference themes |
| created_at | timestamp | |
| updated_at | timestamp | |

**Current posts to seed on first run:**

| Title | Status | Key references |
|---|---|---|
| There's Something Compelling About Lo-Fi | Published | Marcus, Perez, SDT |
| Automation and Colonization | Published | Battiste, Couldry/Mejias, Patel, Zuboff, Crawford, Perez, Barrett |
| Finger Painting with Radium (ed dev post) | Published | Schofield, Alexander, Palmer |
| Freire / Banking Education / Throughput | Idea | Freire, Barrett |
| Battiste notes and reflections | In progress | Battiste + full lit review thread |

**Idea map integration:**
Published posts become nodes in the idea map. Edges connect them to the references and sessions that informed them. The map visualises the relationship between your public writing and your research infrastructure — useful for identifying which threads have already surfaced in public work and which are still submerged.

---

### Phase 10 — UI Theme Switcher
**Deliverable:** Switchable colour themes including night/low-contrast mode

Default UI is clean and minimal. Theme switcher built in from Phase 1 so it is never retrofitted.

**Themes to include at launch:**
- Default — clean light, high contrast
- Dark — dark background, reduced eye strain
- Night — low contrast, warm tones, for tired eyes or low-light reading
- High contrast — accessibility mode

**Implementation:**
CSS custom properties (variables) for all colours, set at the `:root` level. Theme switcher writes a `data-theme` attribute to the `<html>` element. Selected theme persists in localStorage so it survives page refresh.

```css
:root {
  --bg: #ffffff;
  --text: #1a1a1a;
  --accent: #2563eb;
  --surface: #f8f8f8;
  --border: #e0e0e0;
}

[data-theme="dark"] {
  --bg: #1a1a1a;
  --text: #e8e8e8;
  --accent: #60a5fa;
  --surface: #2a2a2a;
  --border: #3a3a3a;
}

[data-theme="night"] {
  --bg: #1c1410;
  --text: #c8b89a;
  --accent: #d4956a;
  --surface: #241c16;
  --border: #3a2e24;
}
```

Theme switcher is a small toggle in the top navigation bar — visible but unobtrusive.

---

## 5. File & Folder Structure

```
research-assistant/
│
├── app.py                    ← Flask application (main entry point)
├── config.py                 ← Model configs, feature flags
├── requirements.txt          ← Python dependencies
├── SETUP.md                  ← Infrastructure recovery document (see Section 7)
├── CHANGELOG.md              ← Model and dependency update log (see Section 7)
├── .env                      ← API keys (NEVER committed to git)
├── .gitignore                ← Excludes .env, __pycache__, etc.
├── README.md                 ← Setup and bootstrap instructions
│
├── templates/
│   ├── index.html            ← Main prompt interface
│   ├── references.html       ← Reference library view
│   ├── session.html          ← Single session view
│   └── map.html              ← Idea map (Phase 7)
│
├── static/
│   ├── style.css
│   └── app.js
│
├── canonical/                ← SOURCE OF TRUTH — committed to git
│   ├── references/           ← one .md file per reference
│   ├── sessions/             ← one .md file per synthesis session
│   └── posts/                ← one .md file per writing tracker entry
│
├── db/
│   └── research.db           ← runtime index ONLY, never committed
│                                rebuilt automatically from canonical/ on startup
│
├── logs/
│   └── sessions/             ← Timestamped JSON + TXT per session
│       ├── 2026-04-28_session_001.json
│       └── 2026-04-28_session_001.txt
│
├── exports/
│   ├── references/           ← BibTeX, APA exports
│   └── maps/                 ← SVG idea map exports (Phase 7)
│
└── uploads/                  ← Temp storage for OCR/audio files
│
└── dashboard/
    ├── current.html          ← live dashboard (served at /dashboard)
    └── archive/              ← versioned dashboard history
```

---

## 6. API Configuration

### Google Gemini (Primary — Free)
- **Signup:** aistudio.google.com
- **Key location:** `.env` as `GOOGLE_API_KEY`
- **Model:** `gemini-2.5-flash` (announced Google I/O May 19 2026 — surpasses 3.1 Pro on coding, agentic, and multimodal benchmarks at Flash speed; 4x faster output than previous frontier models)
- **Upcoming:** `gemini-2.5-pro` expected June 2026 — monitor for free tier availability
- **Pricing note:** Google moving from daily prompt limits to compute-based pricing — monitor impact on free tier research use
- **SDK:** `google-generativeai`

### Microsoft / Azure OpenAI (Institutional)
- **Access:** MacEwan or USask Microsoft 365 Education agreement
- **Azure for Students:** portal.azure.com/studentverification (your .edu email)
- **Key location:** `.env` as `AZURE_OPENAI_KEY` + `AZURE_OPENAI_ENDPOINT`
- **Model:** GPT-4o (deployed through Azure OpenAI Studio)
- **SDK:** `openai` (with Azure base URL)

### Anthropic Claude (Optional — Pay-as-you-go)
- **Signup:** console.anthropic.com
- **Key location:** `.env` as `ANTHROPIC_API_KEY`
- **Model:** `claude-haiku-4-5` (cheapest, still strong for synthesis)
- **SDK:** `anthropic`

**Important distinction — API vs claude.ai:**
These are two separate Anthropic products with separate billing:

| Product | What it is | Billing | Used for |
|---|---|---|---|
| claude.ai | Chat interface (what you use now) | Subscription (Free/Pro/Teams) | Personal research conversations |
| Anthropic API | Programmatic access | Pay-as-you-go per token | Your workbench calls Claude |

The workbench uses the **API only** — no claude.ai subscription required or relevant.
A 0-20 API credit deposit lasts months at research use volumes.
claude.ai subscription tier does not affect API access or cost — they are completely separate.
Monitor usage at console.anthropic.com — easy to see exactly what each session costs.

### `.env` file format
```
GOOGLE_API_KEY=your_key_here
AZURE_OPENAI_KEY=your_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
ANTHROPIC_API_KEY=your_key_here   # optional
```

---

## 7. Sync & Recovery Strategy

### Primary sync: Private GitHub repo
- Everything in the project folder commits to git **except `.env`**
- SQLite database (`research.db`) is committed — your references travel with the repo
- Session logs in `/logs/sessions/` are committed — full audit trail
- Commit cadence: after every meaningful research session

### Bootstrap on a new machine
```bash
git clone https://github.com/idarknightrex/marginalia
cd research-assistant
pip install -r requirements.txt
# Add your .env file manually (from password manager)
python app.py
# Open browser: http://localhost:5000
```

### `.env` key storage
Store API keys in a password manager (Bitwarden is free and open-source). Never in the repo, never in iCloud Notes.

### Belt and suspenders
- SQLite auto-exports references to `/exports/references/references.json` on every save
- This means references exist as plain JSON even if the database somehow corrupts
- Human-readable flat files survive anything

### SQLite Git Sync — Critical Fix (v0.5)

**The problem with tracking the binary `.db` file directly:**
Git cannot merge binary SQLite files. The moment the Air and Mini diverge by even one
session without a push/pull, any attempt to sync produces an unresolvable binary conflict.
A corrupted SQLite header is not recoverable via git merge.

**The fix — SQL text dump on shutdown/commit:**
Flask executes a database dump hook on shutdown (and optionally on a timer) that exports
the full database to a flat SQL text file: `db/research.sql`

Git tracks `db/research.sql` — NOT `db/research.db`

If a conflict occurs on the text file, Git can show you the diff line by line and you
can resolve it. A binary conflict has no resolution path.

**Implementation:**
```python
# app.py — register shutdown hook
import atexit
import subprocess

def dump_database():
    subprocess.run([
        'sqlite3', 'db/research.db',
        '.dump'
    ], stdout=open('db/research.sql', 'w'))

atexit.register(dump_database)
```

**Bootstrap from dump on new machine:**
```bash
sqlite3 db/research.db < db/research.sql
```

**Updated .gitignore:**
```
db/research.db    ← binary, never committed
db/research.db-shm
db/research.db-wal
.env
__pycache__/
```

**Updated git tracking:**
```
db/research.sql   ← text dump, always committed
```

**Periodic dump — save-triggered, not timer-triggered:**
Do NOT rely solely on the shutdown hook. Under launchd (headless Mini daemon management),
atexit hooks are unreliable — they may not fire on launchd kill, SSH kill, or power loss.

Instead: trigger the SQL dump on every successful reference save and every synthesis
session completion. On a local SSD this takes under 50ms — imperceptible to the user
and guarantees the text dump is current regardless of how the process ends.

```python
# In your reference save handler and session save handler:
def save_reference(data):
    # ... save to SQLite ...
    dump_database()  # always dump after every successful write
    return {"status": "saved"}
```

This replaces the shutdown-only approach entirely. The shutdown hook becomes a
belt-and-suspenders backup, not the primary mechanism.

---

### SETUP.md — Required Infrastructure Recovery Document

SETUP.md lives in the root of the repo and is committed to GitHub. It is the single document that lets you reconstruct the full working environment on a new machine from scratch. Update it whenever you change a model, move a file path, or alter the infrastructure.

**Minimum contents:**

```markdown
# Infrastructure Setup Record
Last updated: [date]

## Hardware
- Server: Mac Mini M4, 16GB RAM, 256GB internal
- External drive: [brand/model], 512GB, APFS, mounted at /Volumes/Research
- Satellite: MacBook Air M4 15", 32GB RAM — browser terminal only

## Python environment
- Python version: X.X.X
- Virtual environment: [yes/no, location if yes]
- Install: pip install -r requirements.txt

## Ollama
- Install: https://ollama.ai
- Model directory: /Volumes/Research/ollama
  (set via: launchctl setenv OLLAMA_MODELS /Volumes/Research/ollama)
- Models currently running:
  - llama3.1:8b                    ← general reasoning and writing
  - deepseek-r1:8b                 ← analytical/research reasoning (~4.9GB, correct Ollama tag)
  - deepseek-r1:14b                ← upgrade if 7B insufficient; monitor thermals
  - gemma2:9b                      ← current best available Gemma via Ollama (interim)
  - gemma4:12b                     ← target model when Ollama packaging available (announced June 2026)
  - [add others as installed]

- Model selection notes:
  - deepseek-r1:7b is the default DeepSeek install via Ollama
  - deepseek-r1:14b requires Q4 quantization on 16GB; run ollama pull deepseek-r1:14b
  - Monitor Mini thermals under sustained 14B inference; 7B preferred for long sessions
  - DeepSeek R1 distilled models optimized for reasoning tasks — strongest local option
    for literature synthesis and argument analysis
  - gemma4:12b runs on 16GB unified memory (fits the Mini), Apache 2.0 license
  - Gemma 4 12B is encoder-free multimodal — feeds text/image/audio/video directly into
    LLM backbone without separate Whisper or Tesseract pipelines
  - Potential Phase 4/5 simplification: test Gemma 4 12B as unified ingestion model
    before committing to full Whisper + Tesseract implementation

## Whisper
- Model size: medium (or whichever is installed)
- Model files location: /Volumes/Research/whisper

## Flask
- Starts on boot via launchd
- Plist location: ~/Library/LaunchAgents/com.research.assistant.plist
- Port: 5000
- Host: 0.0.0.0 (accessible via Tailscale)

## Tailscale
- Account: [your login method]
- Mini hostname: [Tailscale assigned name]
- Mini Tailscale IP: 100.x.x.x
- Access URL from Air or phone: http://100.x.x.x:5000

## API keys
- Stored in: [your password manager name]
- Required in .env: GOOGLE_API_KEY, AZURE_OPENAI_KEY, AZURE_OPENAI_ENDPOINT
- Optional in .env: ANTHROPIC_API_KEY

## Full recovery sequence (new machine)
1. Install Python, Ollama, Tailscale, ffmpeg, Tesseract
2. git clone [repo URL]
3. cd research-assistant
4. pip install -r requirements.txt
5. Add .env file from password manager
6. Mount external drive, confirm paths match this document
7. Pull Ollama models:
   ollama pull llama3.1:8b
   ollama pull deepseek-r1:7b
   ollama pull deepseek-r1:14b  # optional, monitor thermals
   ollama pull gemma2:9b         # current Gemma (interim until gemma4:12b packaged in Ollama)
   # ollama pull gemma4:12b      # uncomment when available in Ollama library
8. Sign into Tailscale
9. python app.py
10. Open browser: http://localhost:5000
```

### Remote Access to the Headless Mac Mini

The Mini runs headless — no display attached. Two types of remote access are needed
and should both be enabled before the display is removed.

**Type 1 — Browser access to Marginalia:**
Already solved. Tailscale IP in any browser. No setup beyond what is already scoped.

**Type 2 — Terminal and admin access to the Mini itself:**
For maintenance, updates, restarting Flask, pulling git updates, running import scripts,
checking logs. Three options in order of recommendation:

---

#### Option 1 — Tailscale SSH (recommended daily driver)

Tailscale's own SSH layer authenticates through your Tailscale account rather than
SSH keys. Zero key management. Works from the Air, phone, or any device signed into
your Tailscale account. The cleanest experience.

**Enable on the Mini (one time):**
1. Open Tailscale admin console: https://login.tailscale.com/admin/machines
2. Find your Mini in the machine list
3. Click the Mini → Enable Tailscale SSH

**Use from the Air or any device:**
```bash
tailscale ssh raj@mini-hostname
```
Replace `mini-hostname` with the name shown in your Tailscale admin console.

**Use from iPhone:**
Install **Blink Shell** or **Prompt 3** (both support Tailscale SSH natively)

---

#### Option 2 — Standard SSH (fallback)

Built into macOS. Works through Tailscale automatically. Requires SSH key setup
but no additional software.

**Enable on the Mini (one time):**
System Settings → General → Sharing → Remote Login → On

**Use from the Air:**
```bash
ssh username@100.x.x.x
```
Replace with your Mac username and Tailscale IP.

**SSH key setup (recommended over password auth):**
```bash
# On the Air — generate a key if you don't have one
ssh-keygen -t ed25519 -C "marginalia-mini-access"

# Copy key to Mini
ssh-copy-id username@100.x.x.x
```
After this, SSH connects without a password prompt.

---

#### Option 3 — Screen Sharing (when you need the GUI)

macOS built-in VNC. Slower than SSH but useful for System Settings, installing
apps, or anything that requires clicking through a GUI. Use sparingly — SSH
handles 95% of headless admin tasks faster.

**Enable on the Mini (one time):**
System Settings → General → Sharing → Screen Sharing → On

**Use from the Air:**
Finder → Go → Connect to Server → type:
```
vnc://100.x.x.x
```

Or open Screen Sharing from Spotlight search and enter the Tailscale IP.

**Use from iPhone:**
**Jump Desktop** or **Screens 5** — both support VNC over Tailscale.

---

#### Pre-headless checklist — do these before removing the display

- [ ] Remote Login enabled (SSH): System Settings → General → Sharing → Remote Login → On
- [ ] Screen Sharing enabled: System Settings → General → Sharing → Screen Sharing → On
- [ ] Tailscale SSH enabled in admin console
- [ ] Verified SSH connection from the Air before going headless
- [ ] Verified Screen Sharing connection from the Air before going headless
- [ ] caffeinate confirmed working (bootstrap.command launched, Mini stays awake)
- [ ] Flask accessible at Tailscale IP from the Air browser
- [ ] SETUP.md updated with Mini hostname and Tailscale IP

**Rule:** Never go headless without confirming both SSH and browser access work
from another device first. Reconnecting a display to a headless Mini to fix a
misconfiguration is the most avoidable admin task there is.

---

### Rollover Mode — Running Full Stack on the MacBook Air

If the Mini is unavailable (repair, replacement, travel without home network), the Air can run the complete research workbench locally. 32GB RAM makes this credible for research sessions. The Air runs warmer than the Mini under sustained inference but handles intermittent research use without issue.

**Rollover sequence:**
```bash
# On the Air
git clone https://github.com/idarknightrex/marginalia  # or git pull if already cloned
cd research-assistant
pip install -r requirements.txt
# Add .env from password manager if not already present

# Install Ollama if not present
# Pull models to external drive or Air internal storage
ollama pull llama3.1:8b
ollama pull deepseek-r1:7b

# Start Flask locally
python app.py
# Open browser: http://localhost:5000
```

**What works in rollover mode:**
- Full prompt engine — all local models available
- Complete reference library — database travels via GitHub
- All session history — logs committed to repo
- OCR and audio ingestion — Whisper runs locally on Air

**What changes in rollover mode:**
- Phone/tablet access stops working — Air not configured as always-on server
- Temporary fix: keep Air lid open, enable Wake for Network Access in System Settings,
  update Tailscale to point at Air's Tailscale IP instead of Mini's
- API calls (Gemini, Azure, Anthropic) unaffected — those are stateless

**Rollover thermal note:**
The Air is fanless. For occasional research sessions it handles inference fine.
Avoid leaving large models loaded continuously — configure Ollama to unload after
5 minutes idle: set OLLAMA_KEEP_ALIVE=5m in your shell profile.

**iOS camera upload note:**
Always access Marginalia from iOS using the Tailscale IP or MagicDNS name,
even when physically in the same room as the Mini.
Local network HTTP (`http://192.168.x.x:5000`) triggers iOS Local Network Privacy
which blocks camera API and file uploads in Safari.
Tailscale's encrypted routing bypasses this restriction.
Bookmark the Tailscale URL on your phone — never the local IP.

**Returning to normal after Mini is restored:**
1. Commit any sessions created during rollover
2. Git pull on Mini to sync database and logs
3. Restart Flask on Mini
4. Update Tailscale back to Mini IP if changed
5. Resume normal architecture

---

**Rule:** If you change anything about the infrastructure, update SETUP.md and commit it in the same session. A stale SETUP.md is worse than no SETUP.md because it gives false confidence during recovery.

---

### CHANGELOG.md — Model and Dependency Update Log

CHANGELOG.md lives in the root of the repo and is committed to GitHub. Every time a model string, dependency version, or infrastructure component changes, log it here. One line per change, 30 seconds to maintain.

**Why this matters methodologically:**
If the workbench appears in your dissertation methods appendix, you need to be able to state which model versions were running during which research sessions. CHANGELOG.md is that record.

**Format:**
```markdown
# Changelog

## [date] — Model updates
- Gemini: gemini-2.5-flash → gemini-2.5-flash (Google I/O announcement)
- Added: deepseek-r1:7b via Ollama

## [date] — Dependency updates
- anthropic SDK: 0.x.x → 0.x.x
- google-generativeai: x.x.x → x.x.x

## [date] — Infrastructure
- Tailscale updated to x.x.x
- Ollama updated to x.x.x
```

---

### Upgrade Check Schedule

| Component | Frequency | How to check |
|---|---|---|
| Gemini model string | Monthly | aistudio.google.com — check available models |
| Azure/OpenAI model | Quarterly | Azure OpenAI Studio — check deployed models |
| Anthropic model | Quarterly | console.anthropic.com — check model list |
| Ollama + local models | Monthly | `ollama list` vs ollama.ai/library |
| DeepSeek distills | Monthly | ollama.ai/library/deepseek-r1 |
| Python dependencies | Each build phase | `pip list --outdated` |
| Tailscale | As prompted | Auto-updates, confirm in menu bar |

**Gemini gets monthly checks** — Google is moving fast. 2.5 Pro expected June 2026.
**Everything else quarterly** is sufficient for research use volumes.

---

### In-App Upgrade Reminder (Phase 1 implementation)

The workbench UI displays a persistent but unobtrusive upgrade reminder banner based on elapsed time since last recorded check.

**Behaviour:**
- On first launch each month: yellow banner at top of interface
  — *"Model check due — last checked [date]. Review CHANGELOG.md"*
- After 90 days without a CHANGELOG.md commit: orange banner
  — *"Upgrade check overdue — models may be outdated. Check aistudio.google.com and ollama.ai"*
- Dismissible per session — returns next launch until CHANGELOG.md is updated and committed
- Last check date is read from the most recent CHANGELOG.md git commit timestamp automatically

**Implementation note:**
Flask backend exposes a `/api/upgrade-status` endpoint that reads the last CHANGELOG.md commit date via `git log` and returns days elapsed. Frontend renders the appropriate banner based on the response. ~30 lines of code total.

```python
# app.py addition
import subprocess
from datetime import datetime

@app.route('/api/upgrade-status')
def upgrade_status():
    result = subprocess.run(
        ['git', 'log', '-1', '--format=%ct', 'CHANGELOG.md'],
        capture_output=True, text=True
    )
    if result.stdout.strip():
        last_commit = datetime.fromtimestamp(int(result.stdout.strip()))
        days_elapsed = (datetime.now() - last_commit).days
        return {'days_since_update': days_elapsed, 'last_updated': last_commit.strftime('%Y-%m-%d')}
    return {'days_since_update': 999, 'last_updated': 'never'}
```

---

## 8. Synthesis Prompt Design

The synthesis call is where the real research value lives. Draft prompt:

```
You are a research synthesis assistant. Below are responses from multiple AI 
models to the same research question. 

Analyze them and return:
1. CONSENSUS — claims or framings all models agree on
2. PARTIAL AGREEMENT — claims made by some models but not all
3. CONTRADICTIONS — direct disagreements between models
4. UNIQUE CONTRIBUTIONS — substantive points raised by only one model
5. GAPS — what none of the models addressed that the question implied

Be specific. Quote or paraphrase the models directly when identifying divergence.
Flag any citations or sources mentioned — these require independent verification.

---
PROMPT: {original_prompt}

MODEL RESPONSES:
{responses}
```

This prompt is editable in `config.py` — you'll refine it as you use the tool.

---

## 9. Open Questions

### Decided

| # | Question | Decision | Notes |
|---|---|---|---|
| 1 | Default port? | 5000 | Flask default |
| 2 | UI colour scheme? | Basic default with theme switcher | Low-contrast night mode included for tired eyes |
| 3 | Theme tagging? | Freeform to start | Faster to begin, can add predefined list later |
| 4 | Session naming? | Auto timestamp with optional rename | |
| 8 | Primary mobile use case? | Capture device first, scaled-back workbench second | Defined in Phase 13 when hardware ready |
| — | Dashboard current.html generation? | Separate Claude thread generates it | Workbench serves only, no generation logic needed |

### Deferred — Revisit When Hardware Ready

| # | Question | Options | Notes |
|---|---|---|---|
| 5 | Zotero API vs. file export only? | API integration / Export file | File export simpler for Phase 3 |
| 6 | OCR engine for Phase 4? | Tesseract (local/free) / Google Vision (accurate/free tier) | Start with Tesseract |
| 7 | Audio language for Whisper? | English only / Auto-detect | Auto-detect adds minimal overhead |
| 9 | Tailscale setup — which machines first? | Mac Mini + phone first | Covers away-from-desk case |
| 10 | Idea map default layout? | Force-directed / Clustered by theme | Clustered by theme likely best for lit review |
| 11 | Idea map manual edges — labelled? | Labelled / Optional | Labelled more useful, slightly more friction |

---

## 10. Known Limitations & Honest Notes

- **LLMs hallucinate citations.** Every surfaced reference needs independent verification before entering your literature review. The verification flag in Phase 2 is not optional — it's the whole point.
- **Synthesis is conceptual, not factual.** The multi-model comparison is most valuable for identifying framing differences and argument gaps, not for establishing empirical claims.
- **Free tier rate limits.** Google's free tier (1500 requests/day) is generous for research use but will hit a ceiling during intensive sessions. Build in graceful error handling for rate limit responses.
- **SQLite is single-writer.** Don't run the app on two machines simultaneously pointing at the same database. Sync via git between sessions, not during.
- **The idea map reflects your annotations, not ground truth.** Connections in the map are only as good as the theme tags and argument connections you've written. Garbage in, garbage out — but good annotations produce a genuinely useful picture.
- **Headless Mac Mini operations — four known gotchas:**

  **1. macOS App Nap on headless machines:**
  `Wake for network access` in System Settings is not sufficient. macOS aggressively
  naps headless machines even with that checkbox enabled. The Flask server or Ollama
  port will feel offline or lagging when accessed from phone or laptop.
  Fix: `caffeinate -disu python app.py` in bootstrap.command — asserts a system-wide
  wake lock for the duration of the server process. Already implemented in Section 14.

  **2. Ollama VRAM eviction between models:**
  DeepSeek R1 7B and Gemma 4 12B cannot both sit in 16GB unified memory simultaneously
  at maximum context. Switching between models (e.g. ingesting a handwritten note with
  Gemma 4, then immediately running synthesis with DeepSeek) triggers a 10-15 second
  context swap while Ollama evicts one model and loads the other.
  Fix: `OLLAMA_KEEP_ALIVE=20m` (already in SETUP.md) plus a loading spinner in the UI
  labelled "Loading model weights..." so the user knows the machine is working,
  not crashed. Implement in Phase 1 UI alongside the synthesis button.

  **3. iOS Local Network Privacy blocks camera uploads over HTTP:**
  Accessing the workbench via local network IP (`http://192.168.x.x:5000`) from iOS
  Safari triggers Apple's Local Network Privacy feature, which blocks camera API and
  file uploads from unencrypted HTTP connections. This will cause Phase 4 handwritten
  note capture from your phone to fail silently.
  Fix: Always use the Tailscale IP or MagicDNS name, even when physically in the same
  room as the Mini. Tailscale's encrypted routing bypasses iOS's local network security
  flags. Document this in SETUP.md and add a warning banner in the mobile UI.

  **4. atexit hooks are unreliable under launchd — resolved by canonical architecture:**
  This problem is dissolved by the flat-files-as-truth architecture (Design Principle 8).
  Nothing important lives exclusively in SQLite. Every write saves to a canonical
  markdown file first. Kill the process any way you like — the canonical files are
  already written, already safe, already committable. No shutdown hook needed.

- **This tool itself may be worth documenting methodologically.** A custom research instrument built for SoTL/mixed-methods PhD work is a legitimate methodological artifact. The paper-primary principle (Design Principle 7) is worth stating explicitly in a methods appendix.

---

## 11. Dependencies (Full List)

```
# requirements.txt (Phase 1-3)
flask
python-dotenv
anthropic
openai                    # covers Azure OpenAI
google-generativeai
sqlite3                   # stdlib, no install needed

# Phase 4 additions (Tesseract path)
pytesseract
Pillow
pdf2image        # scanned PDF → image conversion (requires poppler system dependency)
# Note: Gemma 4 12B via Ollama may replace Tesseract for Phase 4 — test first
# Note: Test Gemma 4 12B with PDF input directly before adding pdf2image dependency

# Phase 5 additions (Whisper path)
openai-whisper
ffmpeg-python
# Note: Gemma 4 12B via Ollama may replace Whisper for Phase 5 — test first

# Phase 7 additions (frontend only — no pip install)
# vis-network.js loaded via CDN in map.html
```

System dependencies (installed separately):
- Tesseract OCR binary (Phase 4)
- FFmpeg binary (Phase 5)
- Whisper model files download automatically on first run

---

## 12. Remote Access & Multi-Device Strategy

### The three access scenarios

| Scenario | Solution | Notes |
|---|---|---|
| Phone/tablet on same WiFi as running machine | Local network IP | One line change in `app.py`, no extra tools |
| Phone/laptop anywhere → Mac Mini at home | Tailscale | Recommended. Free, encrypted, no open ports |
| Public internet access via domain name | No-IP + port forwarding | Not recommended — security exposure with research data |

---

### Option A — Same Network Access (simplest)

Change one line in `app.py`:

```python
# Default — localhost only
app.run(debug=False)

# Changed — accessible to any device on your local network
app.run(host='0.0.0.0', port=5000, debug=False)
```

Then on your phone, browser to `http://192.168.x.x:5000` (your machine's local IP).

Find your local IP:
- Mac: `System Settings → Wi-Fi → Details`
- Terminal: `ipconfig getifaddr en0`

**Limitation:** Only works when both devices are on the same network.

---

### Option B — Tailscale (recommended for anywhere access)

Tailscale creates a private encrypted network across all your devices without opening any router ports. Free for personal use (up to 3 users, 100 devices).

**Setup (one-time, ~10 minutes):**

1. Create account at tailscale.com (free)
2. Install Tailscale on:
   - Mac Mini (stationary server)
   - Laptop
   - iPhone/iPad
3. Sign in on each device — they automatically find each other
4. Each device gets a stable private IP like `100.x.x.x`

**Running the app for Tailscale access:**

```python
# app.py — listen on all interfaces so Tailscale IP works
app.run(host='0.0.0.0', port=5000, debug=False)
```

**Accessing from phone or laptop from anywhere:**
```
http://100.x.x.x:5000   ← your Mac Mini's Tailscale IP
```

The Tailscale IP is stable — it doesn't change when you move networks.

**Why Tailscale over No-IP:**
- No open router ports — no public attack surface
- No dynamic DNS configuration
- Encrypted by default (WireGuard under the hood)
- Works through firewalls, NAT, carrier-grade NAT (including mobile data)
- Research data never exposed to the public internet

**Mac Mini as always-on server:**
- System Settings → Battery → uncheck "Put hard disks to sleep" and enable "Wake for network access"
- Tailscale keeps the connection alive automatically

---

### Option C — No-IP (not recommended)

Documented here for completeness only. Exposes a port on your home network to the public internet. Not appropriate for a machine holding research data and API keys, even with password protection. Use Tailscale instead.

---

## 13. Mobile UI Considerations

The default Flask HTML templates will render on a phone but won't be pleasant to use. These additions make it genuinely usable on mobile without building a separate app.

### Responsive layout principles for this tool

The interface has four primary views that need mobile treatment:

**Prompt input view** — the most used on mobile
- Full-width textarea, large touch target
- Submit button prominent, thumb-reachable (bottom of screen)
- Model selector as toggle chips, not a dropdown

**Response view** — read-heavy, occasionally capture
- Stack model responses vertically on mobile (not side-by-side)
- "Flag as reference" button large enough to tap accurately
- Synthesis section collapsible — often you want to read individual responses first

**Reference library** — occasional mobile use, mostly desktop
- Card-based layout scales naturally
- Filter controls collapse into a drawer on small screens
- "Launch prompt from this reference" (Phase 6) must be thumb-reachable on card

**Idea map** — desktop primary, mobile read-only is fine
- Pinch-to-zoom works natively with Vis.js
- Tap a node to open the record
- Edge creation deferred to desktop — too fiddly on touch

### Implementation approach

Add to `static/style.css`:

```css
/* Mobile-first breakpoints */
:root {
  --mobile: 480px;
  --tablet: 768px;
}

/* Response grid: side-by-side on desktop, stacked on mobile */
.response-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

/* Thumb-zone submit button */
@media (max-width: 768px) {
  .submit-btn {
    position: sticky;
    bottom: 1rem;
    width: 100%;
  }

  .response-grid {
    grid-template-columns: 1fr;  /* stack on mobile */
  }

  textarea {
    font-size: 16px;  /* prevents iOS auto-zoom on focus */
  }
}
```

**Critical iOS note:** Set `font-size: 16px` on all text inputs. iOS Safari auto-zooms any input with font-size below 16px, which breaks the layout.

---

### Phase 11 — PreTeXt Document Output (Future)
**Deliverable:** Research-to-dissertation pipeline outputting publication-ready documents

PreTeXt (formerly MathBook XML, Rob Beezer/University of Puget Sound) is an open-source academic document system that outputs simultaneously to HTML, PDF, EPUB, and braille from a single XML source. It handles deep mathematical proof writing without requiring LaTeX fluency — the same quality that made it valuable for open mathematics textbooks makes it valuable for dissertation output.

**What this phase would connect:**
- Verified references → PreTeXt bibliography
- Session annotations → footnotes and appendix material
- Synthesis outputs → literature review scaffolding
- Idea map themes → chapter/section structure hints
- Full export → dissertation-ready PreTeXt document without touching LaTeX directly

**Why this matters:**
A research-to-dissertation pipeline that a non-LaTeX-wizard can use is a significant accessibility contribution. First-generation PhD candidates and researchers from disciplines without strong LaTeX traditions would benefit most — which maps directly onto the "students of the world" framing at the core of the PhD research question.

**Prior art note:**
George Peshke (University of Alberta, ~2009-2011) was building flexible math textbook infrastructure with deep proof support and LaTeX abstraction in the same era MathBook XML was emerging. That parallel development is worth documenting in the Marginalia paper as evidence the need predates the available tooling.

**Dependencies:** PreTeXt CLI (free, open-source). No new Python dependencies.

**Phase prerequisite:** Phase 3 (Zotero export) must be stable — PreTeXt bibliography builds on the same reference data.

**Critical data quality requirement — XML sanitisation:**
PreTeXt output relies on structured XML. Unescaped special characters in your
Phase 2 annotations will break XML output silently and produce cryptic parser errors.

Characters that must be escaped in any annotation or text field destined for PreTeXt:

| Character | XML escape |
|---|---|
| & | `&amp;` |
| < | `&lt;` |
| > | `&gt;` |
| " | `&quot;` |
| ' | `&apos;` |

**Implementation:** Add a sanitisation utility that runs on all text fields before
PreTeXt export. This does not affect how data is stored in SQLite — only how it
is rendered into XML output.

```python
# utils/xml_sanitise.py
import html

def sanitise_for_xml(text: str) -> str:
    if not text:
        return ""
    return html.escape(text, quote=True)
```

Start enforcing clean annotation habits in Phase 2 — avoid raw ampersands in
reference titles and author fields. "Tuck & Yang" should be stored as written
but escaped on export. Build the sanitisation into the export pipeline, not into
the storage layer.

---

---

## 14. Distribution Strategy (Summer 2027 Release)

### Approach 1 — Bootstrap Scripts (Summer 2027 target)
**Effort:** ~2 hours. **Recommendation: Ship this.**

A double-clickable platform-specific script that handles the entire install sequence
without requiring the user to understand virtual environments or terminal commands.

**Files to include in the repo:**
```
bootstrap.command    ← Mac (double-clickable in Finder)
bootstrap.sh         ← Linux
bootstrap.bat        ← Windows (future)
```

**Three rules the bootstrap must follow:**

**Rule 1 — Isolated environments:**
Never install packages globally. Always use a local `.venv` inside the project folder.
If the user deletes the project folder, their system is completely clean. No residue.

**Rule 2 — Port safety:**
Port 5000 conflicts with macOS AirPlay receiver and other common services.
Detect port availability, find an open port automatically, never crash silently.

**Rule 3 — Browser auto-launch:**
Never make the user type a URL. Use Python's built-in `webbrowser` module.
The app opens in their browser automatically at the correct port.

---

**bootstrap.command (Mac) — production version:**
```bash
#!/bin/bash
# Marginalia bootstrap — Mac
# Make executable once: chmod +x bootstrap.command
# Then double-click in Finder to launch

set -e
cd "$(dirname "$0")"

echo "╔════════════════════════════════╗"
echo "║     Starting Marginalia...     ║"
echo "╚════════════════════════════════╝"

# Rule 0 — Check Python
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 not found."
    echo "Please install Python from https://www.python.org/downloads/"
    open "https://www.python.org/downloads/"
    read -p "Press Enter after installing Python, then run this script again."
    exit 1
fi

# Rule 1 — Isolated environment inside project folder
if [ ! -d ".venv" ]; then
    echo "Setting up isolated environment (first run only)..."
    python3 -m venv .venv
fi

source .venv/bin/activate
echo "Installing dependencies..."
pip install -r requirements.txt --quiet --upgrade

# Check Ollama (optional but recommended)
if ! command -v ollama &> /dev/null; then
    echo ""
    echo "NOTE: Ollama not found — local models will be unavailable."
    echo "Cloud models (Gemini, Azure, Anthropic) will still work."
    echo "To install Ollama later: https://ollama.ai/download"
    echo ""
fi

# Rule 2 — Port safety: find an available port
PORT=5000
while lsof -i :$PORT &> /dev/null; do
    echo "Port $PORT in use, trying $((PORT+1))..."
    PORT=$((PORT+1))
done

echo "Launching Marginalia on port $PORT..."

# Rule 4 — Keep Mac Mini awake (headless operation)
# caffeinate prevents macOS App Nap and network sleep on headless machines
# -d: prevent display sleep, -i: prevent idle sleep
# -s: prevent system sleep, -u: declare user is active
echo "Asserting system wake lock via caffeinate..."
MARGINALIA_PORT=$PORT caffeinate -disu python app.py
```

**app.py addition (Rule 3 — browser auto-launch):**
```python
import webbrowser
import threading
import os

def open_browser(port):
    webbrowser.open(f"http://localhost:{port}")

if __name__ == "__main__":
    port = int(os.environ.get("MARGINALIA_PORT", 5000))
    # Open browser after 1.5s delay to let Flask start
    threading.Timer(1.5, open_browser, args=[port]).start()
    app.run(host="0.0.0.0", port=port, debug=False)
```

**bootstrap.sh (Linux) — same logic, replace `open` with `xdg-open`:**
```bash
#!/bin/bash
# Same as bootstrap.command — replace the two `open` calls:
# open "https://..." → xdg-open "https://..."
# (browser auto-launch handled in app.py via webbrowser module)
```

**Target audience:** SoTL researchers, educational developers, qualitative PhD
candidates — one double-click, Marginalia opens in their browser. No terminal
knowledge required. No system pollution. Works on any port.

**Pros:** Two hours to write, zero compilation overhead, trivial to update via
`git pull` then double-click again. Clean uninstall: delete the folder.
**Cons:** Terminal window briefly visible on Mac (acceptable). Fails gracefully
if Python not installed with clear error message and download link.

---

### Approach 2 — PyInstaller Native Binary (v2.0 goal, post-dissertation)
**Effort:** Significant. **Recommendation: Future aspiration, not 2027 target.**

Freezes the Flask app into a single executable using PyInstaller, wrapped in
native installers (`.dmg` for Mac, Inno Setup `.exe` for Windows, AppImage for Linux).

**Why not for Summer 2027:**
PyInstaller is notoriously finicky with compiled C-extensions. Whisper (Phase 5)
uses PyTorch under the hood — bundling PyTorch with PyInstaller is a known pain point
with frequent version-specific breakage. Cross-compilation is not possible: you must
build the Mac version on a Mac, Windows on Windows. This is a substantial maintenance
burden for a solo open-source project mid-PhD.

**When it makes sense:**
After the dissertation is submitted, if Marginalia has an active user community
that would benefit from a zero-terminal install experience. At that point the
Whisper dependency question will also have a cleaner answer as the ecosystem matures.

---

### Release checklist (Summer 2027)
- [ ] bootstrap.command tested on clean Mac (no existing Python venv)
- [ ] README written for a stranger — assumes no prior knowledge
- [ ] SETUP.md current and accurate
- [ ] CHANGELOG.md documents all model versions used in research
- [ ] .env.example includes all required keys with placeholder values
- [ ] All hardcoded paths removed — everything relative or configurable
- [ ] Accompanying TLI paper submitted or in review
- [ ] License confirmed as MIT

---

---

## 21. Settings System

User-configurable preferences stored in `settings.json` in the project root.
Human readable, committed to git, travels with the repo.

**File location:** `settings.json` (root of project, alongside `SCOPE.md` and `CHANGELOG.md`)

**Template:** `settings.json` — copy from repo, edit directly or via Settings panel in UI

---

### Settings categories

**Workflow:**

| Setting | Default | Notes |
|---|---|---|
| `break_reminder_minutes` | 120 | Time before Save & Break reminder appears. 2h default — up and move, get water. |
| `dwell_threshold_seconds` | 30 | Reading Assistant dwell time before firing |
| `default_verification_status` | `located` | Status on manual reference entry |
| `upgrade_check_days` | 30 | Days between broadcast.json checks |
| `auto_save_canonical` | `true` | Write canonical file on every save |

**Models:**

| Setting | Default | Notes |
|---|---|---|
| `local.reasoning` | `deepseek-r1:8b` | Ollama reasoning model |
| `local.multimodal` | `gemma2:9b` | Ollama OCR/audio model |
| `local.general` | `llama3.1:8b` | Ollama general model |
| `cloud.gemini` | `gemini-2.5-flash` | Update when new versions release |
| `cloud.azure_deployment` | `gpt-4o` | Must match Azure deployment name |
| `cloud.anthropic` | `claude-haiku-4-5` | |

**Storage:**

| Setting | Default | Notes |
|---|---|---|
| `pdf_folder` | `~/Documents/Research/PDFs` | Outside project folder |
| `canonical_folder` | `canonical` | Relative to project root |
| `captures_folder` | `canonical/captures` | Ingest Save Capture destination |

**Projects:**

| Setting | Default | Notes |
|---|---|---|
| `types` | PhD, Masters, Paper, Conference, Course, Other | User-extensible list |

Custom types added via Settings panel persist here. "Other" always stays last.
Built-in types cannot be removed.

**UI:**

| Setting | Default | Notes |
|---|---|---|
| `theme` | `default` | default / dark / night |
| `reading_assistant_enabled` | `false` | Persists Reading Assistant toggle state |
| `port` | `5000` | Flask port — change if conflict |

---

### Settings panel — five tabs

Accessible via ⚙ Settings in the nav bar. Slides in from the right, same pattern
as Help and Add Reference panels.

- **Workflow** — break reminder slider, dwell threshold, default status, upgrade frequency
- **Models** — local Ollama model strings, cloud model strings
- **Storage** — PDF folder path, backup layer status, canonical auto-save toggle
- **Projects** — project type list with add/remove custom types
- **About** — version, license, model check status, file counts, GitHub link

Changes write to `settings.json` on Save. Settings are read by Flask on startup.
The UI reads them via `/api/settings` endpoint.

---

### Flask integration

```python
# app.py
import json
from pathlib import Path

SETTINGS_PATH = Path(__file__).parent / "settings.json"

def load_settings():
    if SETTINGS_PATH.exists():
        with open(SETTINGS_PATH) as f:
            return json.load(f)
    return {}  # fall back to defaults

@app.route('/api/settings', methods=['GET'])
def get_settings():
    return jsonify(load_settings())

@app.route('/api/settings', methods=['POST'])
def save_settings():
    data = request.json
    with open(SETTINGS_PATH, 'w') as f:
        json.dump(data, f, indent=2)
    return jsonify({"status": "saved"})
```

---

*This document should live as `SCOPE.md` in the root of the project repo. Update it as decisions are made.*

---

## 15. Typical Use Case — The Deep Read Flow

The canonical workflow Marginalia is built around. Documented here as the reference implementation for UI design decisions, error handling priorities, and the TLI paper methods section.

| Step | Action | Status change | Tool behaviour |
|---|---|---|---|
| 1 | Enter source details | surfaced → located | Reference record created in canonical/references/ |
| 2 | Converse with LLMs | — | Session created, linked to reference record |
| 3 | Upload human reflection | — | Voice memo / handwritten notes / typed thoughts ingested |
| 4 | Check capture | — | OCR/transcription displayed for review and edit |
| 5 | Check for connections | located → verified | Idea map opens, manual edges available |

**The paper is not uploaded. Your reflection on the paper is.**
This distinction keeps the paper-primary principle intact at the workflow level.
The source is the source. Your thinking is yours.

**A new idea starts a new flow.**
No branching. No nested sessions. If something fires mid-flow that belongs elsewhere —
open a new prompt. The tool does not decide what connects to what. You do.

---

## 16. Exceptions and Graceful Fail Matrix

**Design principle for all failures:**
*Fail loudly, recover silently.*
The user should always know something went wrong, never lose data because of it,
and be at most one button away from retrying.

Canonical files are written before SQLite is updated. This means no failure mode
can lose data that was already captured — only data that was in flight.

---

### API Failures

| Failure | Detection | User message | Recovery |
|---|---|---|---|
| Model unavailable / rate limited | HTTP 429 or 503 response | "Model X is unavailable right now. Other models responded successfully." | Show available responses, allow retry of failed model only |
| API key invalid or expired | HTTP 401 response | "API key for [model] is not working. Check your .env file." | Link to key source URL, show which key to update |
| Network loss mid-synthesis | Request timeout after configurable threshold | "Connection lost during synthesis. Responses received so far are saved." | Auto-save partial responses to session canonical file, allow resume |
| Partial response — model started, didn't finish | Response truncated / no stop token | "Response from [model] appears incomplete. Shown as received." | Display partial with truncation flag, allow manual retry |
| All models fail simultaneously | All requests return errors | "No models are responding. Check your internet connection and API keys." | Show diagnostic checklist: network, Ollama running, key validity |

---

### Ingestion Failures

| Failure | Detection | User message | Recovery |
|---|---|---|---|
| OCR returns blank or garbage | Output length < threshold or confidence score low | "Capture quality is low — please review carefully before saving." | Show raw OCR output for manual correction before accepting |
| Audio file corrupted | Whisper / Gemma returns error | "Audio file could not be processed. Try a different format." | Suggest re-recording or format conversion (mp3 → m4a) |
| File format unsupported | MIME type check on upload | "This file type isn't supported yet. Supported: jpg, png, mp3, m4a, mp4, wav" | List supported formats, link to free converter if needed |
| File too large | Size check before processing | "File is too large to process locally ([size]). Maximum is [limit]." | Suggest trimming audio, compressing image, or splitting file |
| PDF locked / DRM protected | PyMuPDF returns access error | "This PDF is protected and cannot be extracted. Use a photo of the physical copy instead." | Offer OCR path as alternative |

---

### Data Integrity Failures

| Failure | Detection | User message | Recovery |
|---|---|---|---|
| Canonical file write succeeds, SQLite upsert fails | Exception after file write | Silent — canonical file is already safe. Log error. | On next startup Flask rebuilds SQLite from canonical files automatically |
| Duplicate reference detected | UUID or title+author+year match on save | "This source may already exist in your library. View existing record?" | Show both records side by side, user chooses merge or keep both |
| Broken idea map edge — UUID no longer exists | Graph build finds dangling reference | Edge rendered as dashed/greyed with tooltip "Linked record not found" | Option to remove broken edge or search for replacement |
| Canonical file corrupted or unparseable | YAML frontmatter parse error on startup | Logged silently, record skipped in rebuild | Quarantine folder for unparseable files, show count in UI health panel |

---

### Hardware Failures

| Failure | Detection | User message | Recovery |
|---|---|---|---|
| Mini sleeps despite caffeinate | Tailscale connection drops, requests time out | On reconnect: "Server was unreachable. Your last session was saved." | Caffeinate re-asserts on next bootstrap.command launch |
| Ollama model eviction during long session | 10-15s delay followed by response | Spinner: "Loading model weights into memory..." | Expected behaviour — spinner prevents user assuming crash |
| Disk full on external drive mid-model-pull | Ollama returns disk error | "Not enough disk space for this model. Free up space on [drive name]." | Show current disk usage, suggest which models to remove |
| External drive not mounted on startup | Ollama model path missing | "Local models unavailable — external drive not detected. Cloud models still work." | Prompt to connect drive, offer cloud-only mode as fallback |

---

### User Errors

| Failure | User action | Detection | Recovery |
|---|---|---|---|
| Browser closed mid-synthesis | Tab closed during API calls | Session canonical file written on first response received | On reopen: "Incomplete session found. View or discard?" |
| Reference accidentally rejected | Status set to rejected | — | Rejected records never deleted — filterable in library, status reversible |
| Canonical file edited outside the tool | Git detects modified file on next commit | — | Flask validates canonical files on startup, flags malformed frontmatter |
| Wrong model selected for synthesis | — | — | Session record logs which models were called — rerun with different selection is one click |
| Ollama not running on startup | All local model requests fail | "Local models unavailable. Is Ollama running?" | Link to open Ollama from Applications, retry button |

---

### Git Failure Modes and the Hermit Contingency

**Git failure probability for a solo researcher:**
Push failures are common but recoverable. True data loss from Git requires
multiple simultaneous failures. For a private repo with a few commits per week
the realistic risk is near zero — but near zero is not zero.

**Ways Git can fail:**

| Failure | Likelihood | Impact | Recovery |
|---|---|---|---|
| GitHub outage | Rare (few times/year, brief) | Cannot push | Wait and retry — local canonical files safe |
| Push rejected (diverged branches) | Common (user error) | Cannot push | `git pull backup` then `git push backup` |
| Credentials expired | Occasional | Cannot push | Regenerate GitHub token, update in keychain |
| Network unavailable | Situational | Cannot push | Local canonical files fully intact |
| Repository corrupted | Extremely rare | Partial loss | Rebuild from canonical files on local drive |

**The hermit contingency — complete local recovery without Git or internet:**

The canonical architecture means Git is the offsite backup, not the source of truth.
The `canonical/` folder on the Mini's internal drive IS the research record.

```
canonical/references/    ← every reference, human readable in TextEdit
canonical/sessions/      ← every synthesis session
canonical/posts/         ← writing tracker entries
logs/sessions/           ← timestamped session logs
exports/                 ← BibTeX, APA, JSON exports
```

No Git. No internet. No Marginalia even running.
Open any canonical file in TextEdit. Your research is there.

*This is the paper-primary principle expressed at the recovery level.*

**Four-layer backup architecture — A/B/C/D failover:**

| Layer | Location | Method | Network needed | Updates |
|---|---|---|---|---|
| A | Mini internal — `canonical/` | Live working copy | No | Continuous |
| B | External drive — `/Volumes/Research/` | rsync snapshot | No | Nightly automated |
| C | Cloud sync — iCloud or OneDrive | Folder sync daemon | Yes | Continuous when online |
| D | GitHub private repo | `git push backup` | Yes | On Save & Take a Break |

Lose A and B simultaneously (Mini dies, external drive fails at the same time) —
C and D have everything committed to that point.
Lose network entirely — A and B are intact, research continues uninterrupted.
Lose all four simultaneously: bigger problems than the dissertation.

---

**Layer B — External drive rsync (automated nightly):**

Add as a launchd job on the Mini so it runs automatically without any action required:

```bash
# Nightly rsync — canonical files to external drive
# Runs at 2am regardless of whether Marginalia is open
rsync -av --delete   ~/Desktop/marginalia/canonical/   /Volumes/Research/marginalia-backup/canonical/
```

Create the launchd plist at
`~/Library/LaunchAgents/com.marginalia.backup.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.marginalia.backup</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-c</string>
    <string>rsync -av --delete ~/Desktop/marginalia/canonical/ /Volumes/Research/marginalia-backup/canonical/</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>2</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
</dict>
</plist>
```

Load it once:
```bash
launchctl load ~/Library/LaunchAgents/com.marginalia.backup.plist
```

---

**Layer C — Cloud sync options:**

Choose one based on what you already have. All three sync the canonical folder
automatically whenever the Mini is online.

**Option C1 — iCloud Drive (simplest for Mac users):**
Move or symlink your canonical folder into iCloud Drive:
```bash
# Symlink canonical/ into iCloud Drive
ln -s ~/Desktop/marginalia/canonical   ~/Library/Mobile\ Documents/com~apple~CloudDocs/Marginalia/canonical
```
iCloud syncs automatically. Visible on iPhone, iPad, MacBook Air.
Accessible at icloud.com if all devices are lost.
✅ Already paid for if you have any iCloud storage plan.

**Option C2 — OneDrive (best for MacEwan/USask users):**
MacEwan and USask both provide OneDrive through Microsoft 365 Education.
Move or symlink canonical/ into your OneDrive folder:
```bash
ln -s ~/Desktop/marginalia/canonical   ~/OneDrive/Marginalia/canonical
```
✅ Already paid for through institutional access.
✅ Recoverable through Microsoft 365 portal from any browser anywhere.

**Option C3 — Dropbox (if already a subscriber):**
Same symlink approach, pointing at your Dropbox folder.
Not recommended as a new paid subscription — iCloud or OneDrive cover it
with tools you already have.

---

**Recommended configuration for your specific setup:**

Given MacEwan + USask institutional access and existing iCloud:

- **Layer B:** External drive rsync via launchd — set up on day one
- **Layer C:** OneDrive via USask Microsoft 365 — institutional, already paid,
  recoverable from any browser, survives losing all hardware simultaneously
- **Layer D:** GitHub — already scoped, code and canonical files

iCloud as an additional layer C is optional — OneDrive already covers the
cloud redundancy. Two cloud providers is belt, suspenders, and a second belt.

### The One Failure Mode That Cannot Be Recovered

Loss of canonical files without a git commit.

If the external drive fails, the Mini dies, and the last session was never committed
to GitHub — that session is gone. The canonical architecture protects against everything
except the failure to commit.

**Mitigation:** Save and Break button.

At the end of every completed deep read flow — and available any time from the
navigation bar — Marginalia offers a single button:

**[ Save & Take a Break ]**

What it does under the hood: git add, git commit with auto-generated timestamp
message, git push backup. What the user experiences: everything is safe, go make
coffee.

This is not automatic — the researcher initiates it. But it is one button,
always visible, never buried. The language is intentional: "Save & Take a Break"
names the moment it belongs to. You finished a deep read. You're putting the book
down. Hit the button.

The button is also available mid-session for anyone who wants to checkpoint
without finishing the flow — a long synthesis session, a natural pause point,
before switching machines.

---

### PDF Storage and Naming Convention

PDFs should live in a dedicated folder outside the Marginalia project directory —
not inside the repo, not on the external drive with the models.

**Recommended location:** `~/Documents/Research/PDFs/`

**Naming convention:**
```
[AuthorLastname]_[Year]_[ShortTitle].pdf
```

Examples:
```
Battiste_2013_DecolonizingEducation.pdf
Couldry_2019_CostsOfConnection.pdf
Mueller_2014_PenMightier.pdf
Barrett_1996_EducationalLuddism.pdf
```

**Why this convention matters:**
The filename becomes a citation shorthand that travels consistently across
the entire workflow:

- **PDF folder** — sorts by author, findable in Finder instantly
- **Reference record** — `holding_location` field stores the filename
- **Canonical markdown file** — `holding_location: Battiste_2013_DecolonizingEducation.pdf`
- **Your annotations** — "see Battiste_2013" in a margin note is unambiguous
- **Idea map** — node tooltip can display the shorthand
- **Conversation with LLMs** — "given Battiste_2013, what connects to Wynter_2003?"

"Cool paper 23" means nothing six months later. `Battiste_2013` means exactly
one thing forever.

**The shorthand rule:**
In annotations and margin notes, use `[AuthorLastname]_[Year]` as the minimum
reference. The full filename is for the folder. The shorthand is for thinking.

**Cloud backup for PDFs:**
The PDF folder should be backed up separately from the Marginalia repo —
iCloud, institutional storage, or a second private GitHub repo using Git LFS.
PDFs are binary files; they do not belong in the main Marginalia repo.


---

## 17. Reference Library Seeding

Marginalia is most useful from day one if the reference library is pre-populated
with sources the researcher already knows. An empty idea map connects nothing.
A seeded library — even with minimal annotations — gives the tool something to
work with immediately.

Two seeding paths are provided. Both generate canonical reference markdown files
directly. Neither requires Marginalia to be running.

---

### Reference Entry Methods — Overview

References enter Marginalia through four paths. All four create canonical markdown files.
All four are first-class — no path is secondary.

| Method | When to use | Status default |
|---|---|---|
| **Manual entry** (Add Reference form) | Book on your desk, paper in hand, quick capture | located (if holding set) |
| **Session flagging** (Flag Reference button) | Source surfaced during LLM synthesis session | surfaced |
| **BibTeX import** (seed script) | Existing reference manager library | surfaced (update after) |
| **CSV import** (seed script) | Spreadsheet, notes, or pre-annotated list | as specified in CSV |

**Manual entry is the daily-use path.** The others are for bulk seeding.
Any time you pick up a book, pull a paper, or want to log a source before reading it —
Add Reference is the right tool. No CSV, no prompt session required.

**Smart status default:**
When holding is set to physical, pdf, ebook, or library-access — the form
automatically sets status to . You have it. It is not merely surfaced.
This default is overridable but correct for the majority of manual entries.

---

### Seeding Path A — BibTeX Import

**Target user:** Anyone with an existing reference manager (Zotero, Mendeley,
EndNote, Google Scholar, Papers). All of these export BibTeX.

**What BibTeX covers:**
Title, authors, year, source type, DOI/URL, journal/publisher details.

**What BibTeX does not cover:**
Your annotation, your argument connection, your theme tags, your holding status.
These fields are added after import — either through the Marginalia UI or by
editing the generated canonical files directly.

**Import script:** `tools/import_bibtex.py`

```python
#!/usr/bin/env python3
"""
Marginalia BibTeX Importer
Usage: python tools/import_bibtex.py path/to/references.bib
Generates one canonical markdown file per reference in canonical/references/
"""

import sys
import uuid
import re
from pathlib import Path
from datetime import datetime

try:
    import bibtexparser
except ImportError:
    print("Installing bibtexparser...")
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "bibtexparser"])
    import bibtexparser

def slugify(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')[:50]

def bibtex_to_canonical(entry):
    ref_id = str(uuid.uuid4())
    authors = entry.get('author', '').replace(' and ', ', ')
    year = entry.get('year', '')
    title = entry.get('title', '').replace('{', '').replace('}', '')
    doi = entry.get('doi', entry.get('url', ''))
    
    # Determine source type from BibTeX entry type
    type_map = {
        'article': 'journal',
        'book': 'book',
        'incollection': 'chapter',
        'inproceedings': 'conference',
        'misc': 'web',
        'phdthesis': 'thesis',
        'techreport': 'report'
    }
    source_type = type_map.get(entry.get('ENTRYTYPE', 'misc'), 'other')

    # Generate filename from first author and year
    first_author = authors.split(',')[0].strip() if authors else 'Unknown'
    short_title = slugify(title.split()[0:3].__str__()
                  .replace("['", '').replace("']", '')
                  .replace("', '", '-'))
    filename = f"{first_author}_{year}_{short_title}.md"

    canonical = f"""---
id: {ref_id}
title: {title}
authors: {authors}
year: {year}
source_type: {source_type}
url_doi: {doi}
verification_status: surfaced
physical_holding: none
holding_location: 
themes: 
created_at: {datetime.now().isoformat()}
updated_at: {datetime.now().isoformat()}
---

## Annotation
<!-- Add your annotation here — what does this source argue? -->

## Argument Connection
<!-- How does this connect to your research argument? -->

## Notes
Imported from BibTeX on {datetime.now().strftime('%Y-%m-%d')}
BibTeX key: {entry.get('ID', '')}
"""
    return filename, canonical

def main():
    if len(sys.argv) < 2:
        print("Usage: python tools/import_bibtex.py path/to/references.bib")
        sys.exit(1)

    bib_path = Path(sys.argv[1])
    if not bib_path.exists():
        print(f"File not found: {bib_path}")
        sys.exit(1)

    output_dir = Path("canonical/references")
    output_dir.mkdir(parents=True, exist_ok=True)

    with open(bib_path) as f:
        db = bibtexparser.load(f)

    imported = 0
    skipped = 0

    for entry in db.entries:
        filename, canonical = bibtex_to_canonical(entry)
        output_path = output_dir / filename

        if output_path.exists():
            print(f"  Skipping (exists): {filename}")
            skipped += 1
            continue

        output_path.write_text(canonical)
        print(f"  Imported: {filename}")
        imported += 1

    print(f"\nDone. {imported} imported, {skipped} skipped.")
    print(f"Open canonical/references/ to add annotations and argument connections.")
    print(f"Then run: python app.py to rebuild the database.")

if __name__ == "__main__":
    main()
```

**Usage:**
```bash
# Export BibTeX from Zotero: File → Export Library → BibTeX format
python tools/import_bibtex.py ~/Downloads/My_Library.bib
```

---

### Seeding Path B — CSV Import

**Target user:** Anyone whose references live in a spreadsheet, Word document,
notes app, or anywhere that isn't a reference manager. Also useful for researchers
who want to add annotations and argument connections before import.

**The CSV is the master annotation document.**
Fill in what you know. Leave blank what you don't.
The more you fill in before import, the richer your idea map on day one.

**Seed CSV template — `tools/seed_template.csv`:**

```
id,title,authors,year,source_type,url_doi,verification_status,physical_holding,holding_location,annotation,argument_connection,themes
,Decolonizing Education: Nourishing the Learning Spirit,"Battiste, Marie",2013,book,,verified,physical,Battiste_2013_DecolonizingEducation.pdf,"Critiques cognitive imperialism in education. Mi'kmaw learning spirit framework central to argument.","Anchors decentring-the-west design principle. Verification pipeline is a direct response to Battiste's insistence on situated knowledge.",cognitive-imperialism;indigenous-pedagogy;decolonial
,The Costs of Connection,"Couldry, Nick; Mejias, Ulises A.",2019,book,10.1515/9781503609754,verified,physical,Couldry_2019_CostsOfConnection.pdf,"Data colonialism as structural extension of historical colonialism. Human life as raw material for extraction.","Theoretical anchor for automation-as-colonialism argument. Closes the Patel/software-brain thread.",data-colonialism;surveillance;automation
```

**Field reference:**

| Field | Required | Notes |
|---|---|---|
| id | **Leave blank** | Auto-generated UUID on import — never a sequential number. UUID is a globally unique identifier (e.g. `550e8400-e29b-41d4-a716-446655440000`) generated independently on any machine without collision risk. You never need to type or remember one. |
| title | Yes | |
| authors | Yes | Semicolon-separated for multiple authors |
| year | Yes | |
| source_type | Yes | journal / book / chapter / web / conference / thesis |
| url_doi | No | DOI preferred, URL as fallback |
| verification_status | No | Defaults to `surfaced` if blank |
| physical_holding | No | none / physical / pdf / ebook / library-access |
| holding_location | No | Filename using PDF naming convention e.g. `Battiste_2013_DecolonizingEducation.pdf` |
| annotation | No | Your words — what does this source argue |
| argument_connection | No | How it connects to your research argument |
| themes | No | Semicolon-separated tags |

**Why UUID and not a sequential number (1, 2, 3...):**
Sequential integers are assigned by the database and only exist inside it. The moment
you have two machines, a BibTeX import, a CSV import, and a manual entry all creating
records, sequential integers collide — machine A creates reference 47, machine B creates
reference 47, they are different records with the same ID and the system cannot tell
them apart.

A UUID is generated independently on any machine and is statistically guaranteed to be
unique globally. Two machines can create records simultaneously without conflict.
Everything merges cleanly. The UUID lives in the canonical file frontmatter as the
stable identifier that idea map edges, session links, and post connections all reference.
It never changes even if you rename the file or correct a title.

In normal use the UUID is invisible. You will only see one if you open a canonical
markdown file directly or debug a broken idea map edge.

**Import script:** `tools/import_csv.py`

```python
#!/usr/bin/env python3
"""
Marginalia CSV Importer
Usage: python tools/import_csv.py path/to/references.csv
Generates one canonical markdown file per row in canonical/references/
"""

import sys
import uuid
import csv
import re
from pathlib import Path
from datetime import datetime

def slugify(text):
    text = str(text).lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')[:40]

def csv_row_to_canonical(row):
    ref_id = row.get('id', '').strip() or str(uuid.uuid4())
    title = row.get('title', '').strip()
    authors = row.get('authors', '').strip()
    year = row.get('year', '').strip()
    source_type = row.get('source_type', 'other').strip()
    url_doi = row.get('url_doi', '').strip()
    verification_status = row.get('verification_status', 'surfaced').strip() or 'surfaced'
    physical_holding = row.get('physical_holding', 'none').strip() or 'none'
    holding_location = row.get('holding_location', '').strip()
    annotation = row.get('annotation', '').strip()
    argument_connection = row.get('argument_connection', '').strip()
    themes = row.get('themes', '').strip()

    # Generate filename
    first_author = authors.split(';')[0].split(',')[0].strip() if authors else 'Unknown'
    title_slug = slugify(' '.join(title.split()[:3]))
    filename = f"{first_author}_{year}_{title_slug}.md"

    annotation_block = annotation if annotation else \
        '<!-- Add your annotation here — what does this source argue? -->'
    argument_block = argument_connection if argument_connection else \
        '<!-- How does this connect to your research argument? -->'

    canonical = f"""---
id: {ref_id}
title: {title}
authors: {authors}
year: {year}
source_type: {source_type}
url_doi: {url_doi}
verification_status: {verification_status}
physical_holding: {physical_holding}
holding_location: {holding_location}
themes: {themes}
created_at: {datetime.now().isoformat()}
updated_at: {datetime.now().isoformat()}
---

## Annotation
{annotation_block}

## Argument Connection
{argument_block}
"""
    return filename, canonical

def main():
    if len(sys.argv) < 2:
        print("Usage: python tools/import_csv.py path/to/references.csv")
        sys.exit(1)

    csv_path = Path(sys.argv[1])
    if not csv_path.exists():
        print(f"File not found: {csv_path}")
        sys.exit(1)

    output_dir = Path("canonical/references")
    output_dir.mkdir(parents=True, exist_ok=True)

    imported = 0
    skipped = 0
    errors = 0

    with open(csv_path, newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, 1):
            if not row.get('title', '').strip():
                print(f"  Row {i}: Skipping — no title")
                skipped += 1
                continue
            try:
                filename, canonical = csv_row_to_canonical(row)
                output_path = output_dir / filename

                if output_path.exists():
                    print(f"  Skipping (exists): {filename}")
                    skipped += 1
                    continue

                output_path.write_text(canonical, encoding='utf-8')
                print(f"  Imported: {filename}")
                imported += 1
            except Exception as e:
                print(f"  Row {i}: Error — {e}")
                errors += 1

    print(f"\nDone. {imported} imported, {skipped} skipped, {errors} errors.")
    if errors:
        print("Review errors above before running app.py")
    else:
        print("Run: python app.py to rebuild the database and see your references.")

if __name__ == "__main__":
    main()
```

**Usage:**
```bash
# Fill in tools/seed_template.csv with your references
# Then run:
python tools/import_csv.py tools/seed_template.csv
```

---

### After seeding either path

```bash
python app.py
```

Flask detects the new canonical files and rebuilds the SQLite index automatically.
Open the reference library — your seeded sources are there.
Open the idea map — connections based on shared themes are already drawn.

The annotation and argument_connection fields are where the real value lives.
A reference seeded with both fields populated contributes immediately to the idea map
and can be used as a prompt seed in Phase 6.
A reference seeded with title and year only is better than nothing but inert
until you add your thinking to it.

**Recommended seeding order:**
1. Run BibTeX or CSV import for your full existing library
2. Sort by verification_status: verified
3. Add annotation and argument_connection to verified sources first
4. Work outward to located, then surfaced


---

## 18. Broadcast System

A static JSON file on GitHub that every Marginalia install reads during the
upgrade check cycle. No server, no subscription, no infrastructure. You edit
one file and push — every install with network access sees the message.

**File location in repo:**
```
broadcast.json   ← root of the Marginalia GitHub repo, main branch
```

**Direct URL installs fetch:**
```
https://raw.githubusercontent.com/idarknightrex/marginalia/main/broadcast.json
```

---

### broadcast.json schema

```json
{
  "version": "0.5.0",
  "broadcast": {
    "active": false,
    "type": "info",
    "title": "Message title",
    "body": "Message body — one or two sentences maximum.",
    "cta_label": "Optional button label →",
    "cta_url": "https://...",
    "expires": "2027-12-01",
    "dismissible": true
  },
  "latest_version": "0.5.0",
  "changelog_url": "https://github.com/idarknightrex/marginalia/blob/main/CHANGELOG.md",
  "release_notes_url": "https://github.com/idarknightrex/marginalia/releases"
}
```

**To silence all broadcasts:** set `"active": false`
**To expire a message automatically:** set `"expires"` to a past date

---

### Message types

| Type | Colour | Use for |
|---|---|---|
| `info` | Purple | New releases, community news, ISSOTL announcements |
| `warning` | Amber | Deprecation notices, model changes, breaking updates |
| `urgent` | Red | Security issues, critical bugs requiring immediate action |
| `celebration` | Green | Milestones, paper published, open-source launch day |

---

### How installs handle it

```python
# app.py — broadcast fetch on startup
import requests
from datetime import datetime

BROADCAST_URL = "https://raw.githubusercontent.com/idarknightrex/marginalia/main/broadcast.json"

def fetch_broadcast():
    try:
        r = requests.get(BROADCAST_URL, timeout=3)
        data = r.json()
        b = data.get("broadcast", {})

        # Check if active
        if not b.get("active"):
            return None

        # Check expiry
        expires = b.get("expires")
        if expires and datetime.fromisoformat(expires) < datetime.now():
            return None

        return b
    except Exception:
        # Silent fail — offline or unreachable
        return None
```

Flask exposes this at `/api/broadcast` — the frontend fetches on load and
renders the banner if a message is present. If the user dismisses, a local
flag keyed to the message title prevents it showing again until a new message
is published.

```python
@app.route('/api/broadcast')
def broadcast():
    return jsonify(fetch_broadcast() or {})
```

---

### Ko-fi integration

The broadcast system is the natural home for community support messages.
Not a popup, not a gate — a dismissible banner that appears occasionally
when there's something worth saying.

**Example soft launch broadcast:**
```json
{
  "active": true,
  "type": "celebration",
  "title": "Marginalia is live",
  "body": "Welcome. The napkin that remembers is now in your hands. If this tool earns a place in your practice, share it or leave a note in Discussions.",
  "cta_label": "GitHub Discussions →",
  "cta_url": "https://github.com/idarknightrex/marginalia/discussions",
  "expires": "2027-12-01",
  "dismissible": true
}
```

**Example Ko-fi broadcast (occasional, not persistent):**
```json
{
  "active": true,
  "type": "info",
  "title": "If Marginalia is useful",
  "body": "A Ko-fi contribution keeps independent, local-first tooling alive. No pressure, no gate — just honest support for honest software.",
  "cta_label": "Ko-fi →",
  "cta_url": "https://ko-fi.com/llmarginalia",
  "expires": "2028-01-01",
  "dismissible": true
}
```

The Ko-fi message should appear rarely — at major version releases or
significant milestones. Not every update. The tool earns trust by not
asking constantly.

---

### Version Update Modal

When `broadcast.json` reports a `latest_version` greater than the installed version,
Marginalia shows a clean non-blocking modal — not a compliance prompt, not a gate.

**Modal contents:**
- Version number and what's new (release highlights from broadcast.json)
- `git pull origin main` update command, copy-paste ready
- Optional Ko-fi link: "☕ Support independent open-source development"
- Prominent **Dismiss** button — clears modal, leaves entire application fully actionable

**What the modal does not do:**
- Block any feature
- Request email, key, or any identifying information
- Store any state about whether the user updated
- Prevent the application from running

**broadcast.json additions for version updates:**
```json
{
  "latest_version": "0.5.1",
  "release_highlights": [
    "Reading Assistant — transparent opt-in dwell-time cross-reference",
    "Settings panel — configurable workflow, models, project types",
    "Git pre-flight — large files auto-excluded before commit"
  ]
}
```

All features — including the Reading Assistant — are fully accessible to all users
out of the box. MIT licensed. No tiers. No gates. No unlock states.

---

### License

**Recommended: MIT + Ko-fi voluntary support**

MIT license means anyone can use, fork, modify, and distribute Marginalia
without restriction. The Ko-fi link in the README and occasional broadcast
messages are the community support mechanism. No enforcement, no gates,
no tracking.

This is consistent with the tool's philosophy: researcher sovereignty,
local-first, paper-primary. A tool that respects your data should respect
your financial reality too.

**LICENSE file (root of repo):**
```
MIT License

Copyright (c) 2027 Raj Boora

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
```

**The README support note:**
```markdown
## Support

Marginalia is free, open-source, and always will be.

If it earns a place in your research practice, a Ko-fi contribution
keeps independent, local-first tooling alive.

[☕ Support on Ko-fi](https://ko-fi.com/llmarginalia)

Ideas don't have a calendar. Neither does gratitude.
```


---

## 19. Privacy Declaration

Every install of Marginalia surfaces this declaration in the Help panel (Privacy tab),
the README, and as a standalone `PRIVACY.md` in the repo root.

The declaration is not a legal document. It is a plain-language commitment
consistent with the tool's design philosophy. A tool built on researcher sovereignty
and paper-primary principles should be unambiguous about what it does and does not do.

---

### What Marginalia does not do

- Does not send your research data to any server
- Does not track what you read, write, or annotate
- Does not collect usage analytics or telemetry of any kind
- Does not require an account, email address, or registration
- Does not phone home except to fetch `broadcast.json` (one-way read of a public file)
- Does not store anything in the cloud without your explicit action (Save & Break)
- Does not sell, share, or process your data in any way

---

### Where your data lives

| Location | What it is | Leaves your machine? |
|---|---|---|
| `canonical/` | References and annotations — markdown files | Only if you push to GitHub |
| `db/research.db` | Runtime SQLite index | Never — not committed |
| `logs/sessions/` | Synthesis session logs | Only if you push to GitHub |
| `.env` | API keys | Never — gitignored |
| `exports/` | BibTeX, APA, JSON exports | Only if you share them |
| `broadcast.json` | Public file fetched from GitHub | One-way read, no data sent |

---

### API calls — what leaves your machine

When you send a prompt to a cloud model, your prompt text goes to that
provider's servers under their privacy policy. This is unavoidable for
cloud models. Researchers with sensitive data should use local models only.

| Model | Provider privacy policy |
|---|---|
| Gemini 2.5 Flash | ai.google.dev/terms |
| Azure GPT-4o | microsoft.com/en-us/privacy |
| Claude Haiku | anthropic.com/privacy |
| DeepSeek R1 (local) | Zero outbound — runs on your machine |
| Llama 3.1 (local) | Zero outbound — runs on your machine |

---

### Reading Assistant privacy

The Reading Assistant matches visible text against your local reference
annotations using keyword overlap. All matching runs in Python on your machine.
No text is sent anywhere during a dwell match.

The dwell timer is a local countdown that measures how long the page has been
still. No eye tracking. No camera. No sensors. It is a stopwatch, nothing more.

---

### Verification

Marginalia is MIT licensed and fully open source. Every line of code that runs
on your machine is readable at `github.com/idarknightrex/marginalia`. If anything
in this declaration seems inconsistent with the code, open an issue.

---

### PRIVACY.md (repo root — plain text, human readable)

```markdown
# Marginalia — Privacy

Your research belongs to you.

Marginalia does not track you, collect your data, or send your research
to any server. Your annotations, references, and sessions live as plain
markdown files on your machine. You can read them in TextEdit without
Marginalia running.

The only outbound connection Marginalia makes is fetching broadcast.json
from our public GitHub repository to check for updates. This is a one-way
read. No data is sent.

When you use cloud models (Gemini, Azure, Anthropic), your prompts go to
their servers under their privacy policies. Use local models only (DeepSeek,
Llama via Ollama) if this concerns you for your research context.

Marginalia is MIT licensed. Read the source. Verify the claims.

github.com/idarknightrex/marginalia
```


---

## 20. Version 2 — Portable Runtime and Workspace Reconciliation

These features are explicitly out of scope for the Summer 2027 release but worth
documenting now so the Phase 1-11 architecture does not close doors on them.

---

### v2 Feature A — User-Space Isolation and Institutional Portability

**The problem:** Researchers on locked-down institutional machines (university labs,
corporate research environments) may not have administrator rights to install Python,
create virtual environments, or open certain ports.

**Design rules for v2 portability:**

- All file reads and writes stay strictly within the application folder — no absolute
  paths, no writing to system directories
- All internal path references use relative paths: `os.path.dirname(__file__)`
- Flask mounts on a high-range non-privileged port (1808 or similar) that does not
  trigger OS firewall warnings on standard user accounts
- Bootstrap script creates `.venv` inside the project folder (already scoped in
  Section 14) — never touches global Python environment
- v2 target: bundle a portable embedded Python runtime directly in the repo so
  users with zero Python installed can run Marginalia from a zip file

**Why this matters for Marginalia's community:**
The researchers most likely to benefit from this tool — first-generation PhD candidates,
researchers in under-resourced institutions, scholars in the Global South — are also
most likely to be on locked-down machines without admin rights. Portability is not a
convenience feature. It is an equity feature.

---

### v2 Feature B — Thumb-Drive Runtime ("Sky Laser" Protocol)

**The scenario:** A researcher needs to work on a locked-down institutional machine
with zero administrator rights. They plug in a USB drive. Marginalia runs from the drive
without installing anything on the host machine. When they unplug, the host machine
has no trace of the session.

**Technical requirements:**
- Embedded portable Python runtime bundled in the drive's folder structure
- All SQLite, canonical files, and session logs read/write to the drive only
- No localStorage or browser cache written to the host machine
- Bootstrap script detects it is running from removable media and adjusts paths
- On unmount: no residue on host filesystem

**Implementation path:**
- Mac/Linux: portable Python via `python-build-standalone` (Astral's distribution)
- Windows: WinPython portable distribution
- Browser cache: use IndexedDB pointed at the drive path rather than host localStorage

**Scope note:** This is a significant build. Target it for v2.1 or later, after the
base portable runtime (Feature A) is stable.

---

### v2 Feature C — Paper-Primary Reconciliation Protocol

**The scenario:** "I have two separate copies of my research folder. I worked on my
thumb drive on the train but I'm not sure if I pulled my latest changes to my laptop
before I handed my work laptop back to IT. Which one is the ground truth?"

Because Marginalia rejects centralised cloud syncing, split-brain file conflicts are
inevitable when working across multiple air-gapped devices. The resolution must be
manual, visible, and non-destructive. Automated merging that risks overwriting a
researcher's thinking is not acceptable.

**The Reconciliation Interface:**

1. **Workspace state index** — each Marginalia folder maintains `.marginalia-state.json`:
   a lightweight index of every canonical file with its SHA-256 hash and timestamp.
   Updated automatically on every save.

2. **Reconcile Workspace button** — appears in the Projects view. User points
   Marginalia at a secondary folder (thumb drive, old laptop backup, etc.)

3. **Human-in-the-loop diff view** — the interface scans both state files and
   generates a side-by-side timeline:
   ```
   Primary folder:    3 files modified  2027-03-14 23:45  (airport session)
   Secondary folder:  5 files modified  2027-03-15 08:15  (train session)

   Conflicts: 2 files modified in both locations
     - Battiste_2013_DecolonizingEducation.md  (annotation differs)
     - session_2027-03-14_synthesis.md         (content differs)
   ```

4. **Three-choice resolution matrix** — presented per conflicting file:
   - `[ Keep Both ]` — appends `-primary` and `-secondary` suffixes, no data lost
   - `[ Primary Dominates ]` — overwrites secondary version with primary
   - `[ Secondary Dominates ]` — overwrites primary version with secondary
   - `[ Manual Fork ]` — moves conflict into a dedicated `conflicts/` subfolder
     for the researcher to resolve by hand

**The principle:** The tool surfaces the conflict clearly and waits. The researcher
decides. Nothing is merged automatically. Nothing is lost without explicit choice.
This is the paper-primary principle applied to version control.

**.marginalia-state.json format:**
```json
{
  "generated_at": "2027-03-15T08:15:00",
  "device_label": "thumb-drive-train",
  "files": {
    "canonical/references/Battiste_2013_DecolonizingEducation.md": {
      "hash": "sha256:a3f9...",
      "modified": "2027-03-15T08:12:33",
      "size_bytes": 1842
    }
  }
}
```


---

## 22. Security — API Key Handling and Git Pre-flight

### API Key Security — Flask as Encrypted Local Vault

**The risk:** API keys stored in `.env` are readable by any process with filesystem
access on the same machine — including malicious browser extensions and local scripts.
The frontend must never handle raw API keys directly.

**The architecture (already implied, now explicit):**

```
Browser (frontend)
    │
    │  sends: { prompt, models: ["gemini", "azure"] }
    │  never sees: API keys
    ▼
Flask localhost:5000  ← keys loaded from .env at startup, held in memory
    │
    │  appends: Authorization: Bearer [key]
    ▼
External API (Gemini, Azure, Anthropic)
```

The browser inspector only ever sees requests to `localhost`. API keys never
appear in browser network logs, localStorage, or JavaScript variables.

**Implementation requirement:**

```python
# app.py — load keys once at startup, never expose to frontend
import os
from dotenv import load_dotenv

load_dotenv()

KEYS = {
    "gemini": os.getenv("GOOGLE_API_KEY"),
    "azure_key": os.getenv("AZURE_OPENAI_KEY"),
    "azure_endpoint": os.getenv("AZURE_OPENAI_ENDPOINT"),
    "anthropic": os.getenv("ANTHROPIC_API_KEY"),
}

@app.route('/api/prompt', methods=['POST'])
def handle_prompt():
    data = request.json
    prompt = data.get("prompt")
    models = data.get("models", [])
    # Flask calls external APIs using KEYS — frontend never sees them
    results = {}
    if "gemini" in models and KEYS["gemini"]:
        results["gemini"] = call_gemini(prompt, KEYS["gemini"])
    # ... etc
    return jsonify(results)
```

**What the frontend sends:**
```javascript
// Frontend — no keys, ever
fetch('/api/prompt', {
  method: 'POST',
  body: JSON.stringify({ prompt: text, models: ["gemini", "azure"] })
})
```

**Additional protection:**
- `.env` is gitignored — never committed
- `.env` permissions set to user-read-only on creation: `chmod 600 .env`
- Bootstrap script sets this automatically

---

### Git Pre-flight — PDF and Binary Safety Filter

**The risk:** A user dropping research PDFs into the project folder before hitting
Save & Break will attempt to commit large binary files to GitHub. This causes:
- GitHub's 100MB hard file size limit to reject the push
- Potential bandwidth throttling on large uploads
- A broken sync pipeline that requires manual git history rewriting to fix

**The fix — pre-commit scan in the Save & Break handler:**

```python
# utils/git_preflight.py
import subprocess
from pathlib import Path

MAX_FILE_MB = 50
BLOCKED_EXTENSIONS = {'.pdf', '.mp4', '.mp3', '.m4a', '.wav', '.mov',
                      '.db', '.db-shm', '.db-wal', '.zip', '.tar', '.gz'}

def scan_for_large_files(repo_root: Path) -> list:
    """Returns list of (path, size_mb) for files that should not be committed."""
    flagged = []
    for filepath in repo_root.rglob('*'):
        if filepath.is_file() and not any(
            part.startswith('.') for part in filepath.parts
        ):
            size_mb = filepath.stat().st_size / (1024 * 1024)
            if filepath.suffix.lower() in BLOCKED_EXTENSIONS or size_mb > MAX_FILE_MB:
                flagged.append((filepath, round(size_mb, 1)))
    return flagged

def auto_gitignore(flagged_files: list, repo_root: Path) -> list:
    """Adds flagged files to .gitignore and returns list of added entries."""
    gitignore_path = repo_root / '.gitignore'
    existing = gitignore_path.read_text() if gitignore_path.exists() else ""
    added = []
    for filepath, size_mb in flagged_files:
        rel = filepath.relative_to(repo_root)
        entry = str(rel)
        if entry not in existing:
            existing += f"\n# Auto-added by Marginalia pre-flight ({size_mb}MB)\n{entry}\n"
            added.append((entry, size_mb))
    gitignore_path.write_text(existing)
    return added

def safe_commit(repo_root: Path, message: str) -> dict:
    """Pre-flight check then commit. Returns result with any warnings."""
    flagged = scan_for_large_files(repo_root)
    warnings = []

    if flagged:
        added = auto_gitignore(flagged, repo_root)
        warnings = [
            f"{entry} ({size_mb}MB) — added to .gitignore automatically"
            for entry, size_mb in added
        ]

    # Now safe to commit
    subprocess.run(['git', 'add', '.'], cwd=repo_root)
    subprocess.run(['git', 'commit', '-m', message], cwd=repo_root)
    subprocess.run(['git', 'push', 'backup'], cwd=repo_root)

    return {
        "status": "committed",
        "warnings": warnings,
        "message": message
    }
```

**UI behaviour when warnings exist:**
The Save & Break button response shows warnings inline before confirming:

```
✓ Session committed to backup

⚠ 2 large files were automatically excluded:
  · Battiste_2013_DecolonizingEducation.pdf (4.2MB) — added to .gitignore
  · recording_2027-03-14.m4a (18.6MB) — added to .gitignore

These files live in your local folder. They are not backed up to GitHub.
Store PDFs in ~/Documents/Research/PDFs and audio in ~/Documents/Research/Audio.
```

**Default .gitignore entries (added at project creation):**
```gitignore
# Marginalia — never commit these
.env
db/research.db
db/research.db-shm
db/research.db-wal
__pycache__/
*.pyc
uploads/
*.pdf
*.mp4
*.mp3
*.m4a
*.wav
*.mov
*.zip
*.tar.gz
```

---

### Relative Path Engine — Portability Requirement

All filesystem operations in the Python backend must use paths relative to the
application root. No hardcoded absolute paths. This makes the entire project
portable — USB drive, different username, institutional machine, any OS.

```python
# utils/paths.py — single source of truth for all paths
from pathlib import Path

APP_ROOT = Path(__file__).parent.parent.resolve()

CANONICAL_DIR  = APP_ROOT / "canonical"
REFERENCES_DIR = CANONICAL_DIR / "references"
SESSIONS_DIR   = CANONICAL_DIR / "sessions"
CAPTURES_DIR   = CANONICAL_DIR / "captures"
EXPORTS_DIR    = APP_ROOT / "exports"
LOGS_DIR       = APP_ROOT / "logs"
DB_PATH        = APP_ROOT / "db" / "research.db"
SETTINGS_PATH  = APP_ROOT / "settings.json"
GITIGNORE_PATH = APP_ROOT / ".gitignore"

# All other modules import from here — never construct paths inline
```

Import pattern across the codebase:
```python
from utils.paths import REFERENCES_DIR, SESSIONS_DIR
# Never: open("/Users/raj/Desktop/marginalia/canonical/references/...")
# Always: open(REFERENCES_DIR / filename)
```

