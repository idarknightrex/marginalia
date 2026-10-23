# Marginalia comment gaps — 1.8.16 audit

Full audit of app.py and app.js against 1.8.16.1019-2352.
app.css and index.html have no gaps.

Add all items below in the next build pass before incrementing the version.

---

## app.py

### Line 2 — module docstring (stale)

Currently says `v1.7.3.0923-1607`. Must be updated to current version on every pack.
This is the single most important housekeeping item — it will keep drifting if not tied to the build checklist.

**Fix:** Update on every pack. Add to build checklist: "Update module docstring version on line 2."

---

### Functions with NO docstring

| Function / route | Approx. line | Notes |
|-----------------|--------------|-------|
| `read_all_references()` | ~290 | Reads all `.md` files from `references/` into list of dicts. Core data-access function — critical to document. |
| `call_ollama()` | ~400 | Wraps Ollama API call; handles streaming vs. non-streaming. Worth a docstring noting the streaming contract. |
| `run_synthesis()` | ~450 | Runs multi-model synthesis over refs; has inline comments but no top docstring. |
| `parse_csv_import()` | ~560 | Parses CSV into list of ref dicts; has inline logic comments but no docstring. |
| `parse_ris_import()` | ~692 | Parses RIS format; no docstring. |
| `lookup_doi()` | ~720 | CrossRef DOI lookup; no docstring. |
| `import_references()` | ~1123 | Complex import route — SSE streaming, dupe check, file write loop. Definitely needs a docstring. |
| `get_local_models()` | ~1238 | Lists available Ollama models; no docstring. |
| `key_status()` | ~1277 | Trivial API key check; low priority but part of the setup flow. |
| `handle_prompt()` | ~1518 | Main prompt/council route. Has excellent inline comments but no top-level docstring summarising the flow. High priority. |
| `update_reference()` | ~1657 | Large, complex route — handles field updates, slug regen, file rename. Needs docstring. |
| `delete_reference()` | ~1759 | No docstring. |
| `update_reference_status()` | ~1772 | No docstring. |
| `get_projects()` | ~1817 | No docstring. |
| `update_project()` | ~1856 | No docstring. |
| `create_project()` | ~1898 | No docstring. |
| `get_project()` | ~1931 | No docstring. |
| `get_writing()` | ~1944 | No docstring. |
| `update_writing()` | ~1969 | No docstring. |

**Priority tier:**
- **High** (complex logic, non-obvious contract): `read_all_references`, `import_references`, `handle_prompt`, `update_reference`, `run_synthesis`
- **Medium** (import/export paths): `parse_csv_import`, `parse_ris_import`, `lookup_doi`, `call_ollama`
- **Low** (thin wrappers): `get_local_models`, `key_status`, `delete_reference`, `update_reference_status`, all project/writing getters

---

### Suggested docstring format for app.py

```python
def read_all_references() -> list[dict]:
    """Return all canonical references as a list of dicts.

    Scans REFS_DIR for .md files, parses YAML frontmatter and body
    sections (Abstract, Annotation, etc.) for each. Skips files that
    fail to parse and logs a warning.

    Returns:
        list[dict]: One dict per reference, keys matching frontmatter
                    fields plus 'body' for the markdown content.
    """
```

---

## app.js

### Features/functions with NO block comment

| Item | Approx. line | Notes |
|------|--------------|-------|
| Filter history feature block | ~671 | `recordFilterHistory`, `renderFilterHistory`, `applyFilterHistory` — no block comment explaining what the 3-item history does or why it exists. A future reader has no context. |
| `updateFilterLabels()` | ~827 | No comment. Updates the filter chip labels in the UI — not obvious what state it reads. |
| `renderRefs()` | ~855 | ~280-line function with no top comment. Has good inline comments on specific cases but nothing describing what the function as a whole does or the card DOM structure it produces. High priority. |
| `lookupDOI()` | ~1147 | No comment. |
| `importDOIPreview()` | ~1155 | No comment. |
| `closeDOIPreview()` | ~1160 | No comment. |
| `uploadFile()` | ~1190 | No comment. |
| `runPasteImport()` | ~1210 | No comment. Important — triggers the import confirmation flow. |
| `cancelIngestConfirm()` | ~1220 | No comment. |
| `confirmAndImport()` | ~1230 | No comment. The actual write path — definitely needs a comment. |
| `checkDuplicates()` | ~1260 | No comment. |
| `syncCslJson()` | ~1280 | No comment. |
| `renderAuditTable()` | ~1370 | No comment. |
| `auditOpenRef()` | ~1400 | No comment. |
| `showImportResult()` | ~1460 | No comment. |
| `selectEnrichCandidate()` | ~1764 | No comment. Part of the two-step enrich flow — needs a line explaining its role. |
| `annotateRef()` | ~1796 | No comment. Triggers the annotation council — high value, should have a comment. |

**Priority tier:**
- **High**: `renderRefs`, `confirmAndImport`, `annotateRef`, filter history block, `runPasteImport`
- **Medium**: `renderAuditTable`, `selectEnrichCandidate`, `uploadFile`, `updateFilterLabels`
- **Low**: DOI preview open/close, `cancelIngestConfirm`, `syncCslJson`, `showImportResult`, `auditOpenRef`

---

### Suggested block comment format for app.js

```js
// ── renderRefs ────────────────────────────────────────────────────────────
// Renders the filtered reference list into #ref-list.
// Each ref card is built as a <div class="ref-card"> with:
//   - header: cite key + status badge + action buttons
//   - enriched bib fields (authors, year, source, etc.) when present
//   - DOI/URL button when url_doi is populated
//   - footer: audit flag + surfaced badge
// Calls renderFilterHistory() to update the filter chip row.
// Called by: loadReferences(), setFilter(), resetAllRefFilters(), etc.
```

---

## No gaps

- **app.css**: Section divider comments throughout. Complete.
- **index.html**: Structural HTML template — `data-tooltip` attributes on controls, HTML comments on view sections and modals. No code logic, no gaps.
