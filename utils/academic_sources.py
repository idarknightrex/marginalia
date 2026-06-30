"""
utils/academic_sources.py

Academic index integration for Marginalia.
Provides abstract retrieval, DOI resolution, and citation lead surfacing.

Sources:
  - Semantic Scholar (Allen Institute, nonprofit, free, no key required)
  - OpenAlex (OurResearch, nonprofit, free, no key required) — failover
  - Crossref (DOI resolution + citation leads, open access flags)

Design principles:
  - Thin abstraction: swap source without touching calling code
  - Source always stamped on returned data — researcher knows provenance
  - Failover is automatic and silent, but the source stamp reveals which fired
  - On total failure: return empty/None, never fabricate
  - Health checks are lightweight HEAD/GET — not full requests
  - All network calls have explicit timeouts — never hang a session

Raj Boora / Marginalia v1.6.0
"""

# Python 3.9 compatibility: this file uses modern union-type syntax
# (e.g. `dict | None`) which is only natively valid in Python 3.10+.
# `from __future__ import annotations` makes all type hints lazy/string-
# evaluated, so the syntax works correctly on 3.9 without rewriting every
# signature to typing.Optional[dict]. Must be the first statement after
# the module docstring. Discovered June 30 2026 when Solaris's venv
# (Python 3.9) crashed on import the first time this module's enrich
# path was actually exercised — see seeds.md.
from __future__ import annotations

import json
import os
import time
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime, timezone


# ── Constants ─────────────────────────────────────────────────────────────────

SEMANTIC_SCHOLAR_BASE = "https://api.semanticscholar.org/graph/v1"
OPENALEX_BASE         = "https://api.openalex.org"
CROSSREF_BASE         = "https://api.crossref.org"

# Fields to request from Semantic Scholar
SS_FIELDS = "title,authors,year,abstract,externalIds,publicationVenue,referenceCount,citationCount,references"
SS_REF_FIELDS = "title,authors,year,externalIds,isOpenAccess,openAccessPdf"

# Timeout for all external requests (seconds)
REQUEST_TIMEOUT = 8
HEALTH_TIMEOUT  = 4

# Semantic Scholar API key, read from environment (set in setup.env, never
# committed). Unauthenticated requests share a low rate limit and are subject
# to throttling during heavy use -- confirmed in practice June 30 2026, a
# single afternoon of Enrich testing triggered 429s. Authenticated requests
# get a dedicated, much higher limit. If unset, requests still work, just
# unauthenticated and more easily rate-limited -- this is a degrade-gracefully
# fallback, not a hard requirement, since the module must keep working for
# anyone who hasn't set up a key yet.
SS_API_KEY = os.environ.get("SEMANTIC_SCHOLAR_API_KEY", "")

# Exponential backoff for 429 (rate limited) responses specifically.
# Does NOT retry on other errors (404, network failure, etc) -- those are
# real "nothing found" or "unreachable" states that retrying won't fix.
# Only a 429 means "the data is there, you're just asking too fast."
MAX_RETRIES_429   = 3
BACKOFF_BASE_SECS = 1.5


# ── Health checks ─────────────────────────────────────────────────────────────

def check_semantic_scholar() -> dict:
    """
    Lightweight health check for Semantic Scholar API.

    Distinguishes "unreachable" from "rate limited" -- these look identical
    to a researcher otherwise and were confirmed to cause real confusion
    June 30 2026 (read as "maybe S2 is down" when it was actually a 429).
    A rate-limited status still means the service is up, just temporarily
    refusing this client's requests.
    """
    try:
        url = f"{SEMANTIC_SCHOLAR_BASE}/paper/search?query=test&limit=1&fields=title"
        headers = {"User-Agent": "Marginalia/1.6 (research tool; contact via github.com/idarknightrex/marginalia)"}
        if SS_API_KEY:
            headers["x-api-key"] = SS_API_KEY
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=HEALTH_TIMEOUT) as r:
            return {"source": "semantic_scholar", "status": "ok", "http": r.status}
    except urllib.error.HTTPError as e:
        if e.code == 429:
            return {"source": "semantic_scholar", "status": "rate_limited", "http": 429}
        return {"source": "semantic_scholar", "status": "unreachable", "error": str(e)}
    except Exception as e:
        return {"source": "semantic_scholar", "status": "unreachable", "error": str(e)}


def check_openalex() -> dict:
    """Lightweight health check for OpenAlex API."""
    try:
        url = f"{OPENALEX_BASE}/works?filter=title.search:test&per-page=1"
        req = urllib.request.Request(url, headers={"User-Agent": "Marginalia/1.6 (research tool; mailto:marginalia@boora.ca)"})
        with urllib.request.urlopen(req, timeout=HEALTH_TIMEOUT) as r:
            return {"source": "openalex", "status": "ok", "http": r.status}
    except Exception as e:
        return {"source": "openalex", "status": "unreachable", "error": str(e)}


def check_crossref() -> dict:
    """Lightweight health check for Crossref API."""
    try:
        url = f"{CROSSREF_BASE}/works?query=test&rows=1"
        req = urllib.request.Request(url, headers={"User-Agent": "Marginalia/1.6 (research tool; mailto:marginalia@boora.ca)"})
        with urllib.request.urlopen(req, timeout=HEALTH_TIMEOUT) as r:
            return {"source": "crossref", "status": "ok", "http": r.status}
    except Exception as e:
        return {"source": "crossref", "status": "unreachable", "error": str(e)}


def check_all_sources() -> dict:
    """
    Check all three academic sources.
    Returns a dict suitable for the frontend status indicator.
    Runs sequentially — called infrequently (on References tab open).
    """
    return {
        "semantic_scholar": check_semantic_scholar(),
        "openalex":         check_openalex(),
        "crossref":         check_crossref(),
        "checked_at":       datetime.now(timezone.utc).isoformat(),
    }


# ── Semantic Scholar ───────────────────────────────────────────────────────────

def _ss_request(url: str) -> dict | None:
    """
    Make a Semantic Scholar API request. Returns parsed JSON or None.

    Includes the API key (if set via SS_API_KEY) as the x-api-key header --
    authenticated requests get a dedicated, much higher rate limit than the
    shared unauthenticated tier. Retries with exponential backoff specifically
    on 429 (rate limited) responses, up to MAX_RETRIES_429 times. Does not
    retry on other failures (404, timeout, network error) -- those won't be
    fixed by waiting, only a 429 means "the data exists, slow down."

    Added June 30 2026 after confirming via direct curl test that a single
    afternoon of Enrich/candidate-search testing was enough to hit the
    unauthenticated rate limit, which silently looked like "Semantic Scholar
    has nothing" rather than what it actually was. See seeds.md.
    """
    headers = {"User-Agent": "Marginalia/1.6 (research tool; contact via github.com/idarknightrex/marginalia)"}
    if SS_API_KEY:
        headers["x-api-key"] = SS_API_KEY

    for attempt in range(MAX_RETRIES_429 + 1):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < MAX_RETRIES_429:
                # Exponential backoff: 1.5s, 3s, 6s -- short enough to not
                # hang a single Enrich click for too long, long enough to
                # actually clear a brief rate-limit window.
                time.sleep(BACKOFF_BASE_SECS * (2 ** attempt))
                continue
            return None
        except Exception:
            return None
    return None


def fetch_from_semantic_scholar(query: str = "", doi: str = "") -> dict | None:
    """
    Fetch paper metadata from Semantic Scholar.
    Accepts either a DOI (preferred) or a keyword query.
    Returns normalized dict with source stamp, or None on failure.
    """
    if doi:
        clean_doi = doi.strip().lstrip("https://doi.org/").lstrip("doi:")
        url = f"{SEMANTIC_SCHOLAR_BASE}/paper/DOI:{urllib.parse.quote(clean_doi)}?fields={SS_FIELDS}"
        data = _ss_request(url)
        if data and data.get("abstract"):
            return _normalize_ss(data, "semantic_scholar")

    if query:
        encoded = urllib.parse.quote(query.strip())
        url = f"{SEMANTIC_SCHOLAR_BASE}/paper/search?query={encoded}&limit=1&fields={SS_FIELDS}"
        data = _ss_request(url)
        if data and data.get("data") and len(data["data"]) > 0:
            candidate = data["data"][0]
            # Guard: a search match with no abstract is not a usable result --
            # the old code returned it anyway, which let a wrong or
            # abstract-less record silently masquerade as a successful
            # enrich. Discovered June 30 2026 (Ken Bain reference: enrich
            # returned 200 with nothing real written). See seeds.md.
            if candidate.get("abstract"):
                return _normalize_ss(candidate, "semantic_scholar")

    return None


def _normalize_ss(paper: dict, source: str) -> dict:
    """Normalize a Semantic Scholar paper record to Marginalia's reference shape."""
    authors_list = paper.get("authors", [])
    authors_str  = "; ".join(a.get("name", "") for a in authors_list) if authors_list else ""

    doi = ""
    ext = paper.get("externalIds", {})
    if ext.get("DOI"):
        doi = f"https://doi.org/{ext['DOI']}"
    elif ext.get("ArXiv"):
        doi = f"https://arxiv.org/abs/{ext['ArXiv']}"

    venue = ""
    pv = paper.get("publicationVenue")
    if pv:
        venue = pv.get("name", "")

    abstract = (paper.get("abstract") or "").strip()

    return {
        "title":          paper.get("title", ""),
        "authors":        authors_str,
        "year":           str(paper.get("year", "")),
        "abstract":       abstract,
        "url_doi":        doi,
        "venue":          venue,
        "citation_count": paper.get("citationCount", 0),
        "ss_paper_id":    paper.get("paperId", ""),
        "source":         source,
        "fetched_at":     datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        # TLDR for canonical file — author's own abstract, stamped
        "tldr":           abstract,
        "tldr_source":    f"Semantic Scholar ({datetime.now(timezone.utc).strftime('%Y-%m-%d')})",
    }


# ── OpenAlex (failover) ────────────────────────────────────────────────────────

def _oa_request(url: str) -> dict | None:
    """Make an OpenAlex API request. Returns parsed JSON or None."""
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Marginalia/1.6 (research tool; mailto:marginalia@boora.ca)"}
        )
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception:
        return None


def fetch_from_openalex(query: str = "", doi: str = "") -> dict | None:
    """
    Fetch paper metadata from OpenAlex.
    Accepts DOI or keyword query. Returns normalized dict or None.
    """
    if doi:
        clean_doi = doi.strip().lstrip("https://doi.org/").lstrip("doi:")
        url = f"{OPENALEX_BASE}/works/https://doi.org/{urllib.parse.quote(clean_doi)}"
        data = _oa_request(url)
        if data and data.get("id"):
            return _normalize_oa(data, "openalex")

    if query:
        encoded = urllib.parse.quote(query.strip())
        url = f"{OPENALEX_BASE}/works?filter=title.search:{encoded}&per-page=1&select=id,title,authorships,publication_year,abstract_inverted_index,doi,primary_location,cited_by_count,open_access"
        data = _oa_request(url)
        if data and data.get("results") and len(data["results"]) > 0:
            candidate = data["results"][0]
            # Guard: a title-search match with no reconstructable abstract
            # is not a usable result. OpenAlex's title.search has no
            # relevance threshold -- it can match a tangential or wrong
            # record and we'd otherwise return it as a "success" with an
            # empty or junk abstract. Same fix as Semantic Scholar above.
            if candidate.get("abstract_inverted_index"):
                normalized = _normalize_oa(candidate, "openalex")
                if normalized.get("abstract"):
                    return normalized

    return None


def _reconstruct_oa_abstract(inverted_index: dict) -> str:
    """
    OpenAlex stores abstracts as inverted index {word: [positions]}.
    Reconstruct to plain text.
    """
    if not inverted_index:
        return ""
    try:
        word_pos = []
        for word, positions in inverted_index.items():
            for pos in positions:
                word_pos.append((pos, word))
        word_pos.sort(key=lambda x: x[0])
        return " ".join(w for _, w in word_pos)
    except Exception:
        return ""


def _normalize_oa(paper: dict, source: str) -> dict:
    """Normalize an OpenAlex paper record to Marginalia's reference shape."""
    authors_list = paper.get("authorships", [])
    authors_str  = "; ".join(
        a.get("author", {}).get("display_name", "")
        for a in authors_list
        if a.get("author")
    ) if authors_list else ""

    doi = paper.get("doi", "") or ""
    if doi and not doi.startswith("http"):
        doi = f"https://doi.org/{doi}"

    abstract = _reconstruct_oa_abstract(paper.get("abstract_inverted_index"))

    venue = ""
    pl = paper.get("primary_location", {})
    if pl and pl.get("source"):
        venue = pl["source"].get("display_name", "")

    return {
        "title":          paper.get("title", ""),
        "authors":        authors_str,
        "year":           str(paper.get("publication_year", "")),
        "abstract":       abstract,
        "url_doi":        doi,
        "venue":          venue,
        "citation_count": paper.get("cited_by_count", 0),
        "ss_paper_id":    "",
        "source":         source,
        "fetched_at":     datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "tldr":           abstract,
        "tldr_source":    f"OpenAlex ({datetime.now(timezone.utc).strftime('%Y-%m-%d')})",
    }


# ── Primary fetch with automatic failover ─────────────────────────────────────

def search_candidates(query: str, limit: int = 3) -> list:
    """
    Search both Semantic Scholar and OpenAlex, return up to `limit` candidates
    from EACH source (so up to 2x limit total), without auto-selecting any of
    them. Used by the Enrich UI's candidate picker so the researcher chooses
    which match is actually correct, rather than the system silently trusting
    the top search hit.

    Built June 30 2026 directly in response to a confirmed mismatch: an
    auto-selected OpenAlex top hit for "Ken Bain, What the Best College
    Teachers Do" turned out to be a Portuguese-language review of the book,
    not the book's own record -- a real abstract, wrong paper, written
    silently with no way for the researcher to catch it before the fact.
    See seeds.md, "Enrich's false-success bug, and what it revealed."

    Each candidate includes title, authors, year, a short abstract preview,
    and enough info (doi or ss_paper_id) to re-fetch the full record on
    selection. Candidates with no abstract at all are excluded -- there's
    nothing useful to show for those.
    """
    candidates = []

    # Semantic Scholar candidates
    try:
        encoded = urllib.parse.quote(query.strip())
        url = f"{SEMANTIC_SCHOLAR_BASE}/paper/search?query={encoded}&limit={limit}&fields={SS_FIELDS}"
        data = _ss_request(url)
        if data and data.get("data"):
            for paper in data["data"][:limit]:
                if paper.get("abstract"):
                    normalized = _normalize_ss(paper, "semantic_scholar")
                    normalized["preview"] = normalized["abstract"][:220]
                    candidates.append(normalized)
    except Exception:
        pass

    # OpenAlex candidates
    try:
        encoded = urllib.parse.quote(query.strip())
        url = f"{OPENALEX_BASE}/works?filter=title.search:{encoded}&per-page={limit}&select=id,title,authorships,publication_year,abstract_inverted_index,doi,primary_location,cited_by_count,open_access"
        data = _oa_request(url)
        if data and data.get("results"):
            for paper in data["results"][:limit]:
                if paper.get("abstract_inverted_index"):
                    normalized = _normalize_oa(paper, "openalex")
                    if normalized.get("abstract"):
                        normalized["preview"] = normalized["abstract"][:220]
                        candidates.append(normalized)
    except Exception:
        pass

    return candidates


def fetch_paper(query: str = "", doi: str = "", preferred_source: str = "semantic_scholar") -> dict | None:
    """
    Fetch paper metadata with automatic failover.
    preferred_source: "semantic_scholar" or "openalex"
    Always stamps which source actually responded.
    Returns None if both sources fail — never fabricates.
    """
    if preferred_source == "openalex":
        result = fetch_from_openalex(query=query, doi=doi)
        if result:
            return result
        # Failover to Semantic Scholar
        return fetch_from_semantic_scholar(query=query, doi=doi)
    else:
        # Default: Semantic Scholar first
        result = fetch_from_semantic_scholar(query=query, doi=doi)
        if result:
            return result
        # Failover to OpenAlex
        return fetch_from_openalex(query=query, doi=doi)


# ── Crossref — DOI resolution + citation leads ────────────────────────────────

def fetch_crossref_leads(doi: str, existing_dois: set = None) -> dict:
    """
    Fetch citation leads for a paper via Crossref.
    Returns structured lead list with open access flags.

    existing_dois: set of DOIs already in canonical — leads matching these
    are marked as already_in_library=True so the UI can de-emphasise them.

    The leads are a signal, not a command. The researcher decides what to chase.
    """
    if existing_dois is None:
        existing_dois = set()

    clean_doi = doi.strip().lstrip("https://doi.org/").lstrip("doi:")
    if not clean_doi:
        return {"leads": [], "error": "No DOI provided"}

    url = f"{CROSSREF_BASE}/works/{urllib.parse.quote(clean_doi)}"
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Marginalia/1.6 (research tool; mailto:marginalia@boora.ca)"}
        )
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as r:
            data = json.loads(r.read().decode("utf-8"))
    except Exception as e:
        return {"leads": [], "error": str(e)}

    work = data.get("message", {})
    references = work.get("reference", [])

    leads = []
    for ref in references:
        ref_doi = ref.get("DOI", "").strip()
        title   = ref.get("article-title") or ref.get("volume-title") or ""
        author  = ref.get("author", "")
        year    = ref.get("year", "")
        journal = ref.get("journal-title", "")
        unstructured = ref.get("unstructured", "")

        # Normalise DOI to URL form
        doi_url = f"https://doi.org/{ref_doi}" if ref_doi else ""

        # Check if already in researcher's library
        already_in_library = bool(ref_doi and (
            ref_doi in existing_dois or
            f"https://doi.org/{ref_doi}" in existing_dois
        ))

        # Open access check via Unpaywall-style DOI prefix heuristic
        # Full OA check would require Unpaywall API — this is a quick signal only
        is_likely_oa = ref_doi.startswith("10.1101/") or ref_doi.startswith("10.48550/")  # bioRxiv, arXiv

        leads.append({
            "doi":               doi_url,
            "doi_raw":           ref_doi,
            "title":             title,
            "author":            author,
            "year":              year,
            "journal":           journal,
            "unstructured":      unstructured if not title else "",
            "already_in_library": already_in_library,
            "is_likely_oa":      is_likely_oa,
        })

    # Sort: not-in-library first, then by year descending
    leads.sort(key=lambda x: (x["already_in_library"], -int(x["year"]) if x["year"].isdigit() else 0))

    return {
        "leads":       leads,
        "total":       len(leads),
        "source_doi":  doi,
        "fetched_at":  datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "error":       None,
    }


# ── TLDR field builder ─────────────────────────────────────────────────────────

def build_tldr_section(abstract: str, source_stamp: str) -> str:
    """
    Format the TLDR section for a canonical reference file.
    The source stamp is always visible — researcher knows provenance.
    Human annotation layer is kept separate and waiting.
    """
    if not abstract:
        return "<!-- Abstract not available from index — run Generate or add manually -->"
    return f"<!-- Source: {source_stamp} -->\n{abstract}"
