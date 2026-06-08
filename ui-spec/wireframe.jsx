import { useState, useEffect } from "react";

const NAV_ITEMS = [
  { id: "prompt", label: "Prompt", icon: "◈" },
  { id: "references", label: "References", icon: "◎" },
  { id: "ingest", label: "Ingest", icon: "⊕" },
  { id: "map", label: "Idea Map", icon: "⬡" },
  { id: "posts", label: "Writing", icon: "◻" },
  { id: "projects", label: "Projects", icon: "◆" },
];

const MODELS = [
  { id: "gemini", label: "Gemini 2.5 Flash", color: "#4285f4", active: true },
  { id: "azure", label: "GPT-4o", color: "#00a4ef", active: true },
  { id: "claude", label: "Claude Haiku", color: "#c96442", active: true },
  { id: "deepseek", label: "DeepSeek R1", color: "#6e56cf", active: true },
  { id: "llama", label: "Llama 3.1", color: "#3d8b37", active: false },
];

const MOCK_REFS = [
  { id: 1, author: "Battiste", year: 2013, title: "Decolonizing Education: Nourishing the Learning Spirit", status: "verified", themes: ["indigenous-pedagogy", "cognitive-imperialism"], holding: "physical" },
  { id: 2, author: "Couldry & Mejias", year: 2019, title: "The Costs of Connection", status: "verified", themes: ["data-colonialism", "automation"], holding: "physical" },
  { id: 3, author: "Freire", year: 1970, title: "Pedagogy of the Oppressed", status: "located", themes: ["banking-education", "critical-pedagogy"], holding: "pdf" },
  { id: 4, author: "Mueller & Oppenheimer", year: 2014, title: "The Pen Is Mightier Than the Keyboard", status: "verified", themes: ["paper-primary", "note-taking"], holding: "pdf" },
  { id: 5, author: "Patel", year: 2026, title: "People Do Not Yearn for Automation", status: "surfaced", themes: ["automation", "software-brain"], holding: "none" },
  { id: 6, author: "Barrett", year: 1996, title: "In Defense of Educational Luddism", status: "verified", themes: ["cognitive-throughput", "automation"], holding: "pdf" },
  { id: 7, author: "Merleau-Ponty", year: 1945, title: "Phenomenology of Perception", status: "located", themes: ["embodied-cognition", "paper-primary"], holding: "physical" },
];

const MOCK_PROJECTS = [
  { id: 1, name: "PhD — USask SoTL", type: "PhD", active: true, refs: 74, sessions: 12, since: "Fall 2026" },
  { id: 2, name: "Marginalia Paper — TLI", type: "Paper", active: false, refs: 18, sessions: 6, since: "Winter 2027" },
  { id: 3, name: "ISSOTL26 Presentation", type: "Conference", active: false, refs: 9, sessions: 3, since: "Oct 2026" },
];

const STATUS_COLORS = {
  verified: "#3d8b37",
  located: "#c9a832",
  surfaced: "#6e56cf",
  rejected: "#c94242",
};

const THEMES = {
  default: { bg: "#f5f0e8", surface: "#fff", text: "#1a1410", accent: "#8b4513", border: "#d4c5b0", muted: "#8a7a6a" },
  dark: { bg: "#1a1410", surface: "#241c16", text: "#e8ddd0", accent: "#c9a832", border: "#3a2e24", muted: "#7a6a5a" },
  night: { bg: "#120e0a", surface: "#1c1410", text: "#c8b89a", accent: "#d4956a", border: "#2a2018", muted: "#6a5a4a" },
};

function Tag({ label, color }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: "3px",
      fontSize: "10px", fontFamily: "monospace", background: color + "22",
      color, border: `1px solid ${color}44`, marginRight: "4px", marginBottom: "4px",
    }}>{label}</span>
  );
}

function ModelChip({ model, theme, onToggle }) {
  return (
    <div onClick={onToggle} style={{
      display: "flex", alignItems: "center", gap: "6px", padding: "4px 10px",
      borderRadius: "4px", background: model.active ? model.color + "18" : theme.surface,
      border: `1px solid ${model.active ? model.color + "44" : theme.border}`,
      cursor: "pointer", opacity: model.active ? 1 : 0.5, userSelect: "none",
    }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: model.active ? model.color : theme.muted }} />
      <span style={{ fontSize: "11px", color: model.active ? theme.text : theme.muted, fontFamily: "monospace" }}>{model.label}</span>
    </div>
  );
}

function HelpPanel({ theme, onClose }) {
  const [tab, setTab] = useState("quick");
  return (
    <div style={{
      position: "fixed", right: 0, top: 0, bottom: 0, width: "340px",
      background: theme.surface, borderLeft: `1px solid ${theme.border}`,
      zIndex: 100, display: "flex", flexDirection: "column", boxShadow: "-4px 0 20px rgba(0,0,0,0.15)",
    }}>
      <div style={{ padding: "16px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "monospace", fontSize: "13px", color: theme.text }}>Help & Documentation</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: theme.muted, cursor: "pointer", fontSize: "16px" }}>×</button>
      </div>
      <div style={{ display: "flex", gap: "4px", padding: "8px 16px", borderBottom: `1px solid ${theme.border}`, flexWrap: "wrap" }}>
        {[["quick","Quick Start"],["docs","Full Docs"],["privacy","Privacy"],["issues","GitHub"]].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "4px 10px", fontSize: "10px", fontFamily: "monospace",
            background: tab === t ? theme.accent : "transparent",
            color: tab === t ? "#fff" : theme.muted,
            border: `1px solid ${tab === t ? theme.accent : theme.border}`,
            borderRadius: "3px", cursor: "pointer",
          }}>{l}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {tab === "quick" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ fontSize: "11px", color: theme.muted, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>The Deep Read Flow</div>
            {[
              ["1", "Enter source details", "Create reference record before reading"],
              ["2", "Converse with LLMs", "Pre-read orientation — what to look for"],
              ["3", "Upload your reflection", "Voice memo, photo of notes, typed thoughts"],
              ["4", "Check capture", "Review OCR/transcription before saving"],
              ["5", "Check connections", "Open idea map — what does this touch?"],
            ].map(([n, title, desc]) => (
              <div key={n} style={{ display: "flex", gap: "10px" }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: theme.accent + "22", border: `1px solid ${theme.accent}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontFamily: "monospace", color: theme.accent, flexShrink: 0 }}>{n}</div>
                <div>
                  <div style={{ fontSize: "12px", color: theme.text, marginBottom: "2px" }}>{title}</div>
                  <div style={{ fontSize: "11px", color: theme.muted }}>{desc}</div>
                </div>
              </div>
            ))}
            <div style={{ marginTop: "8px", padding: "10px", background: theme.bg, borderRadius: "4px", border: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: "11px", color: theme.accent, fontFamily: "monospace", marginBottom: "4px" }}>New idea?</div>
              <div style={{ fontSize: "11px", color: theme.muted }}>Start a new flow. No branching. No nested sessions.</div>
            </div>
          </div>
        )}
        {tab === "docs" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {["Getting Started Guide", "PDF Naming Convention", "Seed CSV Format", "Backup & Recovery", "Remote Access (SSH)", "Model Upgrade Schedule"].map(doc => (
              <div key={doc} style={{ padding: "10px 12px", background: theme.bg, borderRadius: "4px", border: `1px solid ${theme.border}`, cursor: "pointer", fontSize: "12px", color: theme.text, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {doc}
                <span style={{ fontSize: "10px", color: theme.muted, fontFamily: "monospace" }}>local →</span>
              </div>
            ))}
            <div style={{ marginTop: "8px", padding: "10px", background: theme.bg, borderRadius: "4px", border: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: "11px", color: theme.muted }}>All docs stored locally in <span style={{ fontFamily: "monospace", color: theme.accent }}>docs/</span> — readable without internet.</div>
            </div>
          </div>
        )}
        {tab === "privacy" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ padding: "12px", background: theme.bg, borderRadius: "4px", border: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: "12px", color: theme.accent, fontFamily: "monospace", marginBottom: "6px", fontWeight: "bold" }}>
                What Marginalia does not do
              </div>
              {[
                "Does not send your research data to any server",
                "Does not track what you read, write, or annotate",
                "Does not collect usage analytics or telemetry",
                "Does not require an account or email address",
                "Does not phone home except to fetch broadcast.json and check for updates",
                "Does not store anything in the cloud without your explicit action",
                "Does not sell, share, or process your data in any way",
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "6px", alignItems: "flex-start" }}>
                  <span style={{ color: "#3d8b37", fontSize: "12px", flexShrink: 0, marginTop: "1px" }}>✓</span>
                  <span style={{ fontSize: "11px", color: theme.muted, lineHeight: 1.5 }}>{item}</span>
                </div>
              ))}
            </div>

            <div style={{ padding: "12px", background: theme.bg, borderRadius: "4px", border: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: "12px", color: theme.accent, fontFamily: "monospace", marginBottom: "6px", fontWeight: "bold" }}>
                Where your data lives
              </div>
              {[
                ["canonical/", "Your references and annotations — markdown files on your machine"],
                ["db/research.db", "Runtime index — rebuilt locally, never committed to git"],
                ["logs/sessions/", "Your synthesis sessions — local flat files only"],
                [".env", "Your API keys — never leaves your machine, never committed"],
                ["broadcast.json", "The one outbound read — a public file on GitHub, no data sent"],
              ].map(([loc, desc], i) => (
                <div key={i} style={{ marginBottom: "8px" }}>
                  <div style={{ fontFamily: "monospace", fontSize: "10px", color: theme.accent }}>{loc}</div>
                  <div style={{ fontSize: "11px", color: theme.muted, marginTop: "2px" }}>{desc}</div>
                </div>
              ))}
            </div>

            <div style={{ padding: "12px", background: theme.bg, borderRadius: "4px", border: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: "12px", color: theme.accent, fontFamily: "monospace", marginBottom: "6px", fontWeight: "bold" }}>
                API calls — what leaves your machine
              </div>
              <div style={{ fontSize: "11px", color: theme.muted, lineHeight: 1.6, marginBottom: "8px" }}>
                When you send a prompt, your text goes to whichever cloud models
                you have enabled. This is unavoidable for cloud models and is
                governed by their respective privacy policies:
              </div>
              {[
                ["Google Gemini", "ai.google.dev/terms"],
                ["Azure OpenAI", "microsoft.com/privacy"],
                ["Anthropic Claude", "anthropic.com/privacy"],
              ].map(([name, url], i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                  <span style={{ color: theme.text }}>{name}</span>
                  <span style={{ color: theme.muted, fontFamily: "monospace" }}>{url}</span>
                </div>
              ))}
              <div style={{ marginTop: "10px", padding: "8px", background: theme.surface, borderRadius: "3px", border: `1px solid ${theme.border}` }}>
                <div style={{ fontSize: "11px", color: theme.accent, fontFamily: "monospace", marginBottom: "4px" }}>Local models send nothing</div>
                <div style={{ fontSize: "11px", color: theme.muted }}>
                  DeepSeek R1 and Llama running via Ollama process your prompts
                  entirely on your machine. Zero outbound traffic.
                </div>
              </div>
            </div>

            <div style={{ padding: "12px", background: theme.bg, borderRadius: "4px", border: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: "12px", color: theme.accent, fontFamily: "monospace", marginBottom: "6px", fontWeight: "bold" }}>
                Reading Assistant
              </div>
              <div style={{ fontSize: "11px", color: theme.muted, lineHeight: 1.6 }}>
                The Reading Assistant matches text against your local reference
                annotations using keyword overlap. All matching runs in Python
                on your machine. No text is sent anywhere. The dwell timer is
                a local countdown — no eye tracking, no camera, no sensors.
                It simply measures how long the page has been still.
              </div>
            </div>

            <div style={{ padding: "10px 12px", background: theme.accent + "18", borderRadius: "4px", border: `1px solid ${theme.accent}33` }}>
              <div style={{ fontSize: "11px", color: theme.accent, fontFamily: "monospace", lineHeight: 1.6 }}>
                Marginalia is MIT licensed and open source. You can read every
                line of code that runs on your machine.
              </div>
              <a href="https://github.com/idarknightrex/marginalia" target="_blank" rel="noreferrer"
                style={{ fontSize: "11px", color: theme.accent, fontFamily: "monospace", display: "block", marginTop: "4px" }}>
                github.com/idarknightrex/marginalia →
              </a>
            </div>
          </div>
        )}

        {tab === "issues" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ padding: "12px", background: theme.bg, borderRadius: "4px", border: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: "12px", color: theme.text, marginBottom: "4px" }}>Report a bug or request a feature</div>
              <div style={{ fontSize: "11px", color: theme.muted, marginBottom: "10px" }}>Opens GitHub Issues in your browser. Requires internet.</div>
              <button style={{ padding: "6px 14px", background: theme.accent, color: "#fff", border: "none", borderRadius: "3px", cursor: "pointer", fontFamily: "monospace", fontSize: "11px" }}>Open GitHub Issues →</button>
            </div>
            <div style={{ padding: "12px", background: theme.bg, borderRadius: "4px", border: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: "12px", color: theme.text, marginBottom: "4px" }}>Check for Marginalia updates</div>
              <div style={{ fontSize: "11px", color: theme.muted, marginBottom: "10px" }}>Pulls latest version from GitHub.</div>
              <div style={{ fontFamily: "monospace", fontSize: "10px", color: theme.muted, background: theme.surface, padding: "6px 8px", borderRadius: "3px", border: `1px solid ${theme.border}` }}>git pull origin main</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PromptView({ theme, models, setModels }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div>
        <div style={{ fontSize: "10px", color: theme.muted, fontFamily: "monospace", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Active Models — click to toggle</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {models.map((m, i) => (
            <ModelChip key={m.id} model={m} theme={theme} onToggle={() => {
              const next = [...models];
              next[i] = { ...m, active: !m.active };
              setModels(next);
            }} />
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <textarea placeholder="Enter your research question or prompt..." style={{
          padding: "12px", background: theme.surface, border: `1px solid ${theme.border}`,
          borderRadius: "6px", color: theme.text, fontFamily: "'Georgia', serif",
          fontSize: "14px", resize: "none", lineHeight: 1.6, outline: "none", minHeight: "90px",
        }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "11px", color: theme.muted, fontFamily: "monospace" }}>~0 tokens · $0.00 est.</div>
          <button style={{ padding: "8px 20px", background: theme.accent, color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontFamily: "monospace", fontSize: "12px" }}>Send to All Models →</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        {models.filter(m => m.active).slice(0, 4).map(m => (
          <div key={m.id} style={{ padding: "10px", background: theme.surface, border: `1px solid ${theme.border}`, borderLeft: `3px solid ${m.color}`, borderRadius: "4px" }}>
            <div style={{ fontSize: "10px", fontFamily: "monospace", color: m.color, marginBottom: "6px" }}>{m.label}</div>
            <div style={{ fontSize: "12px", color: theme.muted, fontStyle: "italic" }}>Response appears here...</div>
          </div>
        ))}
      </div>
      <div style={{ padding: "12px", background: theme.surface, border: `1px solid ${theme.border}`, borderTop: `2px solid ${theme.accent}`, borderRadius: "4px" }}>
        <div style={{ fontSize: "10px", fontFamily: "monospace", color: theme.accent, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Synthesis — Consensus · Divergence · Gaps</div>
        <div style={{ fontSize: "12px", color: theme.muted, fontStyle: "italic" }}>Synthesis appears here...</div>
        <div style={{ marginTop: "8px", display: "flex", gap: "6px" }}>
          <button style={{ padding: "4px 10px", fontSize: "11px", fontFamily: "monospace", background: "transparent", border: `1px solid ${theme.border}`, color: theme.muted, borderRadius: "3px", cursor: "pointer" }}>Flag Reference</button>
          <button style={{ padding: "4px 10px", fontSize: "11px", fontFamily: "monospace", background: "transparent", border: `1px solid ${theme.border}`, color: theme.muted, borderRadius: "3px", cursor: "pointer" }}>Save Session</button>
        </div>
      </div>
    </div>
  );
}

function AddReferencePanel({ theme, onClose }) {
  const [holding, setHolding] = useState("none");
  const autoStatus = ["physical", "pdf", "ebook", "library-access"].includes(holding) ? "located" : "surfaced";

  const Field = ({ label, children, hint }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <label style={{ fontSize: "10px", fontFamily: "monospace", color: theme.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</label>
        {hint && <span style={{ fontSize: "9px", fontFamily: "monospace", color: theme.muted, opacity: 0.7 }}>{hint}</span>}
      </div>
      {children}
    </div>
  );

  const inputStyle = {
    padding: "7px 10px", background: theme.bg, border: `1px solid ${theme.border}`,
    borderRadius: "4px", color: theme.text, fontFamily: "'Georgia', serif",
    fontSize: "13px", outline: "none", width: "100%", boxSizing: "border-box",
  };

  const selectStyle = { ...inputStyle, fontFamily: "monospace", fontSize: "11px", cursor: "pointer" };

  return (
    <div style={{
      position: "fixed", right: 0, top: 0, bottom: 0, width: "380px",
      background: theme.surface, borderLeft: `1px solid ${theme.border}`,
      zIndex: 100, display: "flex", flexDirection: "column",
      boxShadow: "-4px 0 20px rgba(0,0,0,0.15)",
    }}>
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: "monospace", fontSize: "13px", color: theme.text }}>Add Reference</div>
          <div style={{ fontFamily: "monospace", fontSize: "10px", color: theme.muted, marginTop: "2px" }}>Manual entry — creates canonical file immediately</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: theme.muted, cursor: "pointer", fontSize: "18px", lineHeight: 1 }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>

        <Field label="Title" hint="required">
          <input style={inputStyle} placeholder="Full title of the source" />
        </Field>

        <Field label="Authors" hint="required · semicolons between multiple">
          <input style={inputStyle} placeholder="LastName, FirstName; LastName2, FirstName2" />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <Field label="Year" hint="required">
            <input style={inputStyle} placeholder="2024" type="number" />
          </Field>
          <Field label="Source Type">
            <select style={selectStyle}>
              {["journal", "book", "chapter", "web", "conference", "thesis", "report", "other"].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="DOI / URL" hint="optional">
          <input style={inputStyle} placeholder="10.xxxx/xxxxx or https://..." />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <Field label="Holding">
            <select style={selectStyle} value={holding} onChange={e => setHolding(e.target.value)}>
              {["none", "physical", "pdf", "ebook", "library-access"].map(h => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <div style={{
              ...selectStyle, display: "flex", alignItems: "center", gap: "6px",
              background: STATUS_COLORS[autoStatus] + "18",
              border: `1px solid ${STATUS_COLORS[autoStatus]}44`,
              color: STATUS_COLORS[autoStatus],
            }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_COLORS[autoStatus], flexShrink: 0 }} />
              <span style={{ fontSize: "11px", fontFamily: "monospace" }}>{autoStatus}</span>
              <span style={{ fontSize: "9px", color: theme.muted, marginLeft: "auto" }}>auto</span>
            </div>
          </Field>
        </div>

        {holding !== "none" && (
          <Field label="Holding Location" hint="use PDF naming convention">
            <input style={inputStyle} placeholder="Author_Year_ShortTitle.pdf" />
          </Field>
        )}

        <Field label="Themes" hint="optional · space or comma separated">
          <input style={inputStyle} placeholder="indigenous-pedagogy cognitive-imperialism" />
        </Field>

        <Field label="Annotation" hint="optional · what does this source argue?">
          <textarea style={{ ...inputStyle, minHeight: "80px", resize: "vertical", lineHeight: 1.5 }}
            placeholder="In your own words — what is the core argument?" />
        </Field>

        <Field label="Argument Connection" hint="optional · how does this fit your research?">
          <textarea style={{ ...inputStyle, minHeight: "70px", resize: "vertical", lineHeight: 1.5 }}
            placeholder="How does this connect to your research argument?" />
        </Field>

        <div style={{ padding: "10px", background: theme.bg, borderRadius: "4px", border: `1px solid ${theme.border}` }}>
          <div style={{ fontSize: "10px", fontFamily: "monospace", color: theme.muted }}>
            Saves to <span style={{ color: theme.accent }}>canonical/references/Author_Year_Title.md</span> immediately.
            SQLite index rebuilds automatically.
          </div>
        </div>
      </div>

      <div style={{ padding: "12px 16px", borderTop: `1px solid ${theme.border}`, display: "flex", gap: "8px" }}>
        <button style={{
          flex: 1, padding: "9px", background: theme.accent, color: "#fff",
          border: "none", borderRadius: "4px", cursor: "pointer",
          fontFamily: "monospace", fontSize: "12px",
        }}>Save Reference</button>
        <button onClick={onClose} style={{
          padding: "9px 16px", background: "transparent", color: theme.muted,
          border: `1px solid ${theme.border}`, borderRadius: "4px", cursor: "pointer",
          fontFamily: "monospace", fontSize: "12px",
        }}>Cancel</button>
      </div>
    </div>
  );
}

function ReferencesView({ theme }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("author");
  const [sortDir, setSortDir] = useState("asc");
  const [showAdd, setShowAdd] = useState(false);

  const toggleSort = (field) => {
    if (sortBy === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(field); setSortDir("asc"); }
  };

  const filtered = MOCK_REFS
    .filter(r => filter === "all" || r.status === filter)
    .filter(r => {
      if (!search) return true;
      const q = search.toLowerCase();
      return r.author.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.themes.some(t => t.includes(q));
    })
    .sort((a, b) => {
      let va = sortBy === "year" ? a.year : sortBy === "title" ? a.title : a.author;
      let vb = sortBy === "year" ? b.year : sortBy === "title" ? b.title : b.author;
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  const SortBtn = ({ field, label }) => (
    <button onClick={() => toggleSort(field)} style={{
      padding: "4px 10px", fontFamily: "monospace", fontSize: "10px",
      background: sortBy === field ? theme.accent + "22" : "transparent",
      color: sortBy === field ? theme.accent : theme.muted,
      border: `1px solid ${sortBy === field ? theme.accent + "44" : theme.border}`,
      borderRadius: "3px", cursor: "pointer",
    }}>
      {label} {sortBy === field ? (sortDir === "asc" ? "↑" : "↓") : ""}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {showAdd && <AddReferencePanel theme={theme} onClose={() => setShowAdd(false)} />}
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          type="text"
          placeholder="Search author, title, or theme..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, padding: "8px 12px", background: theme.surface,
            border: `1px solid ${theme.border}`, borderRadius: "6px",
            color: theme.text, fontFamily: "'Georgia', serif", fontSize: "13px",
            outline: "none", boxSizing: "border-box",
          }}
        />
        <button onClick={() => setShowAdd(true)} style={{
          padding: "8px 16px", background: theme.accent, color: "#fff",
          border: "none", borderRadius: "6px", cursor: "pointer",
          fontFamily: "monospace", fontSize: "12px", flexShrink: 0,
        }}>+ Add Reference</button>
      </div>

      {/* Filter + Sort row */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "4px" }}>
          {["all", "verified", "located", "surfaced", "rejected"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "4px 10px", fontFamily: "monospace", fontSize: "10px",
              background: filter === f ? theme.accent : "transparent",
              color: filter === f ? "#fff" : theme.muted,
              border: `1px solid ${filter === f ? theme.accent : theme.border}`,
              borderRadius: "3px", cursor: "pointer", textTransform: "capitalize",
            }}>{f}</button>
          ))}
        </div>
        <div style={{ width: "1px", height: "20px", background: theme.border, margin: "0 4px" }} />
        <div style={{ fontSize: "10px", fontFamily: "monospace", color: theme.muted }}>Sort:</div>
        <SortBtn field="author" label="Author" />
        <SortBtn field="year" label="Year" />
        <SortBtn field="title" label="Title" />
        <div style={{ marginLeft: "auto", fontSize: "11px", fontFamily: "monospace", color: theme.muted }}>
          {filtered.length} of {MOCK_REFS.length}
        </div>
      </div>

      {/* Reference cards */}
      {filtered.length === 0 && (
        <div style={{ padding: "40px", textAlign: "center", color: theme.muted, fontFamily: "monospace", fontSize: "12px" }}>
          No references match "{search}"
        </div>
      )}
      {filtered.map(ref => (
        <div key={ref.id} style={{
          padding: "12px", background: theme.surface,
          border: `1px solid ${theme.border}`, borderLeft: `3px solid ${STATUS_COLORS[ref.status]}`,
          borderRadius: "4px", cursor: "pointer",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "13px", color: theme.text, fontFamily: "'Georgia', serif", marginBottom: "2px" }}>
                {ref.author} ({ref.year})
              </div>
              <div style={{ fontSize: "12px", color: theme.muted, fontStyle: "italic" }}>{ref.title}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", marginLeft: "10px" }}>
              <Tag label={ref.status} color={STATUS_COLORS[ref.status]} />
              <Tag label={ref.holding} color={theme.muted} />
            </div>
          </div>
          <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap" }}>
            {ref.themes.map(t => <Tag key={t} label={t} color={theme.accent} />)}
          </div>
          <div style={{ marginTop: "8px", display: "flex", gap: "6px" }}>
            <button style={{ padding: "3px 8px", fontSize: "10px", fontFamily: "monospace", background: "transparent", border: `1px solid ${theme.border}`, color: theme.muted, borderRadius: "3px", cursor: "pointer" }}>Launch Prompt →</button>
            <button style={{ padding: "3px 8px", fontSize: "10px", fontFamily: "monospace", background: "transparent", border: `1px solid ${theme.border}`, color: theme.muted, borderRadius: "3px", cursor: "pointer" }}>Edit</button>
            <button style={{ padding: "3px 8px", fontSize: "10px", fontFamily: "monospace", background: "transparent", border: `1px solid ${theme.border}`, color: theme.muted, borderRadius: "3px", cursor: "pointer" }}>
              {ref.status === "surfaced" ? "Mark Located" : ref.status === "located" ? "Mark Verified" : "View Canonical"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function IngestView({ theme }) {
  const [tab, setTab] = useState("upload");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", gap: "6px" }}>
        {[["upload", "Photo / PDF"], ["audio", "Audio / Video"], ["text", "Typed Notes"]].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "6px 16px", fontFamily: "monospace", fontSize: "11px",
            background: tab === t ? theme.accent : "transparent",
            color: tab === t ? "#fff" : theme.muted,
            border: `1px solid ${tab === t ? theme.accent : theme.border}`,
            borderRadius: "3px", cursor: "pointer",
          }}>{l}</button>
        ))}
      </div>
      {tab === "upload" && (
        <div>
          <div style={{ padding: "40px", background: theme.surface, border: `2px dashed ${theme.border}`, borderRadius: "6px", textAlign: "center", cursor: "pointer" }}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>⊕</div>
            <div style={{ fontSize: "13px", color: theme.text, marginBottom: "4px" }}>Drop photo, scanned PDF, or image here</div>
            <div style={{ fontSize: "11px", color: theme.muted, fontFamily: "monospace" }}>JPG · PNG · PDF (scanned) · PDF (text layer)</div>
          </div>
          <div style={{ marginTop: "12px", padding: "12px", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: "4px" }}>
            <div style={{ fontSize: "10px", color: theme.muted, fontFamily: "monospace", marginBottom: "6px", textTransform: "uppercase" }}>OCR / Extraction Preview — edit before saving</div>
            <div style={{ fontSize: "12px", color: theme.muted, fontStyle: "italic", minHeight: "60px" }}>Extracted text appears here...</div>
            <div style={{ marginTop: "8px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <button style={{ padding: "4px 10px", fontSize: "11px", fontFamily: "monospace", background: theme.accent, color: "#fff", border: "none", borderRadius: "3px", cursor: "pointer" }}>Save as Annotation</button>
              <button style={{ padding: "4px 10px", fontSize: "11px", fontFamily: "monospace", background: "transparent", border: `1px solid ${theme.border}`, color: theme.muted, borderRadius: "3px", cursor: "pointer" }}>Send as Prompt</button>
              <button style={{ padding: "4px 10px", fontSize: "11px", fontFamily: "monospace", background: "transparent", border: `1px solid ${theme.accent}66`, color: theme.accent, borderRadius: "3px", cursor: "pointer" }}>Save Capture</button>
            </div>
            <div style={{ marginTop: "6px", fontSize: "9px", color: theme.muted, fontFamily: "monospace" }}>
              Save Capture — stores raw text + original file in canonical/captures/ as a draft. Link to a reference later.
            </div>
          </div>
        </div>
      )}
      {tab === "audio" && (
        <div style={{ padding: "40px", background: theme.surface, border: `2px dashed ${theme.border}`, borderRadius: "6px", textAlign: "center" }}>
          <div style={{ fontSize: "32px", marginBottom: "8px" }}>◉</div>
          <div style={{ fontSize: "13px", color: theme.text, marginBottom: "4px" }}>Drop audio or video file here</div>
          <div style={{ fontSize: "11px", color: theme.muted, fontFamily: "monospace" }}>MP3 · M4A · WAV · MP4 — transcribed locally via Whisper</div>
        </div>
      )}
      {tab === "text" && (
        <textarea placeholder="Type or paste your reflection notes here..." style={{
          width: "100%", minHeight: "200px", padding: "12px",
          background: theme.surface, border: `1px solid ${theme.border}`,
          borderRadius: "6px", color: theme.text, fontFamily: "'Georgia', serif",
          fontSize: "14px", resize: "vertical", lineHeight: 1.6, outline: "none", boxSizing: "border-box",
        }} />
      )}
      <div style={{ padding: "10px 12px", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: "4px", display: "flex", gap: "8px", alignItems: "center" }}>
        <div style={{ fontSize: "11px", color: theme.muted, fontFamily: "monospace" }}>Link to reference:</div>
        <select style={{ flex: 1, padding: "4px", background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: "3px", fontFamily: "monospace", fontSize: "11px" }}>
          <option>Battiste 2013 — Decolonizing Education</option>
          <option>Couldry & Mejias 2019 — The Costs of Connection</option>
          <option>Freire 1970 — Pedagogy of the Oppressed</option>
        </select>
      </div>
    </div>
  );
}

const NODE_DETAILS = {
  0: { title: "Battiste (2013)", annotation: "Critiques cognitive imperialism in education. Mi'kmaw learning spirit framework.", themes: ["cognitive-imperialism", "indigenous-pedagogy"], connections: ["Freire 1970", "Mueller 2014"] },
  1: { title: "Couldry & Mejias (2019)", annotation: "Data colonialism as structural extension of historical colonialism.", themes: ["data-colonialism", "automation"], connections: ["Barrett 1996", "Patel 2026"] },
  2: { title: "Freire (1970)", annotation: "Banking education deposits decontextualised facts into passive receivers.", themes: ["banking-education", "cognitive-imperialism"], connections: ["Battiste 2013"] },
  3: { title: "Mueller & Oppenheimer (2014)", annotation: "Handwritten note-takers outperform laptop note-takers on conceptual questions.", themes: ["paper-primary", "cognitive-imperialism"], connections: ["Battiste 2013"] },
  4: { title: "Patel (2026)", annotation: "Software brain flattens human experience into algorithms and databases.", themes: ["automation", "data-colonialism"], connections: ["Couldry 2019", "Barrett 1996"] },
  5: { title: "Barrett (1996)", annotation: "1996 warning about teacherless teaching — swap CD-ROMs for AI and it applies to 2026.", themes: ["automation", "cognitive-throughput"], connections: ["Couldry 2019", "Patel 2026"] },
  6: { title: "cognitive-imperialism", annotation: "Theme node — 3 references share this tag", themes: [], connections: ["Battiste 2013", "Freire 1970", "Mueller 2014"] },
  7: { title: "data-colonialism", annotation: "Theme node — 2 references share this tag", themes: [], connections: ["Couldry 2019", "Patel 2026"] },
  8: { title: "automation", annotation: "Theme node — 3 references share this tag", themes: [], connections: ["Couldry 2019", "Patel 2026", "Barrett 1996"] },
};

function IdeaMapView({ theme }) {
  const [hovered, setHovered] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const nodes = [
    { x: 180, y: 110, label: "Battiste 2013", color: STATUS_COLORS.verified, r: 26 },
    { x: 360, y: 75, label: "Couldry 2019", color: STATUS_COLORS.verified, r: 22 },
    { x: 110, y: 230, label: "Freire 1970", color: STATUS_COLORS.located, r: 20 },
    { x: 290, y: 210, label: "Mueller 2014", color: STATUS_COLORS.verified, r: 18 },
    { x: 450, y: 190, label: "Patel 2026", color: STATUS_COLORS.surfaced, r: 17 },
    { x: 500, y: 100, label: "Barrett 1996", color: STATUS_COLORS.verified, r: 16 },
    { x: 190, y: 330, label: "cognitive-imperialism", color: theme.accent, r: 13, isTheme: true },
    { x: 370, y: 295, label: "data-colonialism", color: theme.accent, r: 13, isTheme: true },
    { x: 510, y: 250, label: "automation", color: theme.accent, r: 13, isTheme: true },
  ];
  const edges = [[0,1],[0,2],[0,6],[1,7],[1,8],[2,6],[3,6],[4,8],[4,7],[5,8],[1,5]];

  const detail = hovered !== null ? NODE_DETAILS[hovered] : null;

  return (
    <div style={{ position: "relative" }}>
      <div style={{ fontSize: "10px", color: theme.muted, fontFamily: "monospace", marginBottom: "8px", display: "flex", gap: "16px", flexWrap: "wrap" }}>
        <span style={{ color: STATUS_COLORS.verified }}>● Verified</span>
        <span style={{ color: STATUS_COLORS.located }}>● Located</span>
        <span style={{ color: STATUS_COLORS.surfaced }}>● Surfaced</span>
        <span style={{ color: theme.accent }}>◆ Theme</span>
        <span style={{ marginLeft: "auto" }}>Hover for details · Click to open · Drag to reposition</span>
      </div>

      <svg width="100%" height="380" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: "6px" }}>
        {edges.map(([a, b], i) => (
          <line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y}
            stroke={hovered !== null && (hovered === a || hovered === b) ? theme.accent : theme.border}
            strokeWidth={hovered !== null && (hovered === a || hovered === b) ? "2" : "1.5"}
            strokeDasharray={nodes[a].isTheme || nodes[b].isTheme ? "4,3" : "none"}
            opacity={hovered !== null && hovered !== a && hovered !== b ? 0.3 : 1}
          />
        ))}
        {nodes.map((n, i) => (
          <g key={i} style={{ cursor: "pointer" }}
            onMouseEnter={e => { setHovered(i); setTooltipPos({ x: n.x, y: n.y }); }}
            onMouseLeave={() => setHovered(null)}
          >
            <circle cx={n.x} cy={n.y} r={hovered === i ? n.r + 3 : n.r}
              fill={hovered === i ? n.color + "44" : n.color + "22"}
              stroke={n.color} strokeWidth={hovered === i ? "2.5" : "1.5"}
              style={{ transition: "all 0.15s ease" }}
            />
            <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="8" fill={n.color} fontFamily="monospace">
              {n.label.split(" ")[0]}
            </text>
          </g>
        ))}
      </svg>

      {/* Hover tooltip */}
      {detail && (
        <div style={{
          position: "absolute",
          left: Math.min(tooltipPos.x + 20, 520),
          top: Math.max(tooltipPos.y - 80, 50),
          width: "240px",
          background: theme.surface,
          border: `1px solid ${theme.accent}66`,
          borderRadius: "6px",
          padding: "10px 12px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          zIndex: 10,
          pointerEvents: "none",
        }}>
          <div style={{ fontSize: "12px", color: theme.text, fontFamily: "'Georgia', serif", marginBottom: "4px", fontWeight: "bold" }}>
            {detail.title}
          </div>
          <div style={{ fontSize: "11px", color: theme.muted, lineHeight: 1.5, marginBottom: "6px" }}>
            {detail.annotation}
          </div>
          {detail.themes.length > 0 && (
            <div style={{ marginBottom: "6px" }}>
              {detail.themes.map(t => <Tag key={t} label={t} color={theme.accent} />)}
            </div>
          )}
          <div style={{ fontSize: "10px", color: theme.muted, fontFamily: "monospace" }}>
            Connected to: {detail.connections.join(" · ")}
          </div>
        </div>
      )}

      <div style={{ marginTop: "8px", display: "flex", gap: "6px" }}>
        <button style={{ padding: "4px 10px", fontSize: "11px", fontFamily: "monospace", background: "transparent", border: `1px solid ${theme.border}`, color: theme.muted, borderRadius: "3px", cursor: "pointer" }}>Cluster by Theme</button>
        <button style={{ padding: "4px 10px", fontSize: "11px", fontFamily: "monospace", background: "transparent", border: `1px solid ${theme.border}`, color: theme.muted, borderRadius: "3px", cursor: "pointer" }}>Export SVG</button>
        <button style={{ padding: "4px 10px", fontSize: "11px", fontFamily: "monospace", background: "transparent", border: `1px solid ${theme.border}`, color: theme.muted, borderRadius: "3px", cursor: "pointer" }}>Add Edge</button>
      </div>
    </div>
  );
}

function ProjectsView({ theme }) {
  const [selected, setSelected] = useState(1);
  const PROJECT_TYPES = ["PhD", "Masters", "Paper", "Conference", "Course", "Other"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "11px", color: theme.muted, fontFamily: "monospace" }}>Switch project context — references, sessions, and idea map filter by active project</div>
        <button style={{ padding: "5px 12px", fontSize: "11px", fontFamily: "monospace", background: theme.accent, color: "#fff", border: "none", borderRadius: "3px", cursor: "pointer" }}>+ New Project</button>
      </div>
      {MOCK_PROJECTS.map(p => (
        <div key={p.id} onClick={() => setSelected(p.id)} style={{
          padding: "14px", background: theme.surface,
          border: `1px solid ${selected === p.id ? theme.accent : theme.border}`,
          borderLeft: `4px solid ${selected === p.id ? theme.accent : theme.border}`,
          borderRadius: "4px", cursor: "pointer",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "14px", color: theme.text, fontFamily: "'Georgia', serif", marginBottom: "4px" }}>{p.name}</div>
              <div style={{ display: "flex", gap: "8px" }}>
                <Tag label={p.type} color={theme.accent} />
                <span style={{ fontSize: "11px", fontFamily: "monospace", color: theme.muted }}>since {p.since}</span>
              </div>
            </div>
            {selected === p.id && (
              <span style={{ fontSize: "10px", fontFamily: "monospace", color: theme.accent, background: theme.accent + "18", padding: "2px 8px", borderRadius: "3px", border: `1px solid ${theme.accent}44` }}>ACTIVE</span>
            )}
          </div>
          <div style={{ marginTop: "10px", display: "flex", gap: "16px" }}>
            <span style={{ fontSize: "11px", fontFamily: "monospace", color: theme.muted }}>{p.refs} references</span>
            <span style={{ fontSize: "11px", fontFamily: "monospace", color: theme.muted }}>{p.sessions} sessions</span>
          </div>
          {selected === p.id && (
            <div style={{ marginTop: "10px", padding: "10px", background: theme.bg, borderRadius: "4px", border: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: "10px", color: theme.muted, fontFamily: "monospace", marginBottom: "8px", textTransform: "uppercase" }}>Project Dashboard — thread cards served here</div>
              <div style={{ display: "flex", gap: "6px" }}>
                {["View Dashboard →", "Export References", "Export Sessions"].map(btn => (
                  <button key={btn} style={{ padding: "4px 10px", fontSize: "10px", fontFamily: "monospace", background: "transparent", border: `1px solid ${theme.border}`, color: theme.muted, borderRadius: "3px", cursor: "pointer" }}>{btn}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
      <div style={{ padding: "10px", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: "4px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <div style={{ fontSize: "10px", color: theme.muted, fontFamily: "monospace", textTransform: "uppercase" }}>Project types</div>
          <span style={{ fontSize: "9px", color: theme.muted, fontFamily: "monospace" }}>selecting "Other" when creating a project prompts for a custom type name — saved permanently</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {PROJECT_TYPES.map(t => <Tag key={t} label={t} color={t === "Other" ? theme.accent : theme.muted} />)}
        </div>
        <div style={{ marginTop: "8px", fontSize: "9px", color: theme.muted, fontFamily: "monospace", lineHeight: 1.6 }}>
          Custom types you create appear here and persist across projects. Manage in Settings → Project Types.
        </div>
      </div>
    </div>
  );
}

function WritingView({ theme }) {
  const MOCK_POSTS = [
    { id: 1, title: "Automation and Colonization", status: "published", url: "https://boora.ca/automation-colonization", date: "2026-05", refs: 6, sessions: 3, notes: "Barrett retrieval was the structural move. Need to follow up on Couldry/Mejias in dissertation lit review." },
    { id: 2, title: "Finger Painting with Radium", status: "published", url: "https://boora.ca/finger-painting-radium", date: "2026-05", refs: 4, sessions: 2, notes: "Bespoke artisan framing — connects directly to Captain/XO distinction in dissertation." },
    { id: 3, title: "Wink, And We're On", status: "published", url: "https://boora.ca/wink-and-were-on", date: "2026-06", refs: 7, sessions: 4, notes: "Yerkes-Dodson + Rominger as mechanism. Minneapolis origin story belongs in TLI paper methods." },
    { id: 4, title: "Freire / Throughput / Banking Education", status: "idea", url: "", date: "", refs: 2, sessions: 0, notes: "60-year arc: Freire 1968 → Barrett 1996 → answer engine 2026. Three citations, complete argument." },
    { id: 5, title: "Battiste Notes and Reflections", status: "drafting", url: "", date: "", refs: 12, sessions: 8, notes: "In progress. First in a series. Full set of reflections when ready." },
  ];

  const STATUS_STYLE = {
    published: { color: STATUS_COLORS.verified, label: "published" },
    drafting: { color: STATUS_COLORS.located, label: "drafting" },
    idea: { color: STATUS_COLORS.surfaced, label: "idea" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ fontSize: "11px", color: theme.muted, fontFamily: "monospace" }}>
        A log of published pieces and ideas in progress — connected to the references and sessions that informed them.
      </div>

      {MOCK_POSTS.map(post => (
        <div key={post.id} style={{
          padding: "12px", background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderLeft: `3px solid ${STATUS_STYLE[post.status].color}`,
          borderRadius: "4px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
            <div style={{ fontSize: "13px", color: theme.text, fontFamily: "'Georgia', serif" }}>{post.title}</div>
            <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0, marginLeft: "10px" }}>
              <Tag label={STATUS_STYLE[post.status].label} color={STATUS_STYLE[post.status].color} />
              {post.date && <span style={{ fontSize: "10px", fontFamily: "monospace", color: theme.muted }}>{post.date}</span>}
            </div>
          </div>

          {post.notes && (
            <div style={{ fontSize: "11px", color: theme.muted, lineHeight: 1.5, marginBottom: "8px", fontStyle: "italic" }}>
              {post.notes}
            </div>
          )}

          <div style={{ display: "flex", gap: "12px", fontSize: "10px", fontFamily: "monospace", color: theme.muted, marginBottom: "8px" }}>
            <span title="References linked to this piece">{post.refs} refs linked</span>
            <span title="Synthesis sessions that informed this piece — tagged manually after each session">{post.sessions} sessions</span>
            {post.url && <a href={post.url} target="_blank" rel="noreferrer" style={{ color: theme.accent, textDecoration: "none" }}>boora.ca →</a>}
          </div>

          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <button style={{ padding: "3px 8px", fontSize: "10px", fontFamily: "monospace", background: "transparent", border: `1px solid ${theme.border}`, color: theme.muted, borderRadius: "3px", cursor: "pointer" }}>Edit log entry</button>
            <button style={{ padding: "3px 8px", fontSize: "10px", fontFamily: "monospace", background: "transparent", border: `1px solid ${theme.border}`, color: theme.muted, borderRadius: "3px", cursor: "pointer" }}>Link session</button>
            <button style={{ padding: "3px 8px", fontSize: "10px", fontFamily: "monospace", background: "transparent", border: `1px solid ${theme.border}`, color: theme.muted, borderRadius: "3px", cursor: "pointer" }}>Link reference</button>
            {post.sessions > 0 && <button style={{ padding: "3px 8px", fontSize: "10px", fontFamily: "monospace", background: "transparent", border: `1px solid ${theme.border}`, color: theme.muted, borderRadius: "3px", cursor: "pointer" }}>View sessions →</button>}
          </div>
        </div>
      ))}

      <button style={{ padding: "8px", background: "transparent", border: `1px dashed ${theme.border}`, color: theme.muted, borderRadius: "4px", cursor: "pointer", fontFamily: "monospace", fontSize: "11px" }}>
        + Log new piece
      </button>
    </div>
  );
}

function PlaceholderView({ label, icon, theme }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "300px", color: theme.muted }}>
      <div style={{ fontSize: "48px", marginBottom: "12px", opacity: 0.3 }}>{icon}</div>
      <div style={{ fontFamily: "monospace", fontSize: "13px" }}>{label} — coming in Phase 9</div>
    </div>
  );
}

// Mock dwell simulation for wireframe demo
const MOCK_DWELL_MATCH = {
  author: "Battiste",
  year: 2013,
  title: "Decolonizing Education: Nourishing the Learning Spirit",
  status: "verified",
  themes: ["cognitive-imperialism", "indigenous-pedagogy"],
  snippet: "Your annotation: 'Critiques cognitive imperialism — the presumption that Western epistemology is universal and sufficient. Learning spirit as the intrinsic, relational process of coming to know.'"
};

export default function Marginalia() {
  const [activeNav, setActiveNav] = useState("prompt");
  const [themeName, setThemeName] = useState("default");
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [upgradeWarning, setUpgradeWarning] = useState(true);
  const [models, setModels] = useState(MODELS);
  const [assistantEnabled, setAssistantEnabled] = useState(false);
  const [dwellSeconds, setDwellSeconds] = useState(30);
  const [assistantMatch, setAssistantMatch] = useState(null);
  const [showAssistantSettings, setShowAssistantSettings] = useState(false);
  const [broadcast, setBroadcast] = useState(MOCK_BROADCAST);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [sessionMinutes, setSessionMinutes] = useState(0);
  const [breakReminder, setBreakReminder] = useState(false);
  const [breakDismissed, setBreakDismissed] = useState(false);
  const theme = THEMES[themeName];

  // Simulate session timer — in production this tracks actual activity time
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionMinutes(m => {
        const next = m + 1;
        if (next >= SETTINGS.breakReminderMinutes && !breakDismissed) setBreakReminder(true);
        return next;
      });
    }, 60000);
    return () => clearInterval(timer);
  }, [breakDismissed]);

  const formatSessionTime = (mins) => {
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins/60)}h ${mins%60 > 0 ? ` ${mins%60}m` : ""}`;
  };

  // Demo: simulate a dwell match firing after 4s when assistant is on
  const simulateDwell = () => {
    if (!assistantEnabled) return;
    setAssistantMatch(null);
    setTimeout(() => setAssistantMatch(MOCK_DWELL_MATCH), 4000);
  };

  const renderView = () => {
    switch (activeNav) {
      case "prompt": return <PromptView theme={theme} models={models} setModels={setModels} />;
      case "references": return <ReferencesView theme={theme} />;
      case "ingest": return <IngestView theme={theme} />;
      case "map": return <IdeaMapView theme={theme} />;
      case "posts": return <WritingView theme={theme} />;
      case "projects": return <ProjectsView theme={theme} />;
      default: return null;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, color: theme.text, fontFamily: "'Georgia', serif", transition: "all 0.2s", paddingBottom: "28px" }}>

      {/* Version update modal — shown when broadcast.json reports a newer version */}
      {showUpdateModal && <UpdateModal theme={theme} onDismiss={() => setShowUpdateModal(false)} />}

      {upgradeWarning && (
        <div style={{ background: "#c9a83222", borderBottom: `1px solid #c9a83244`, padding: "6px 20px", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#c9a832" }}>⚠ Model check due — last checked 32 days ago. Review CHANGELOG.md</span>
          <button onClick={() => setShowUpdateModal(true)} style={{ marginLeft: "6px", fontSize: "11px", fontFamily: "monospace", color: "#c9a832", background: "none", border: `1px solid #c9a83244`, borderRadius: "3px", padding: "1px 8px", cursor: "pointer" }}>demo update modal</button>
          <button onClick={() => setUpgradeWarning(false)} style={{ marginLeft: "auto", fontSize: "11px", fontFamily: "monospace", color: theme.muted, background: "none", border: "none", cursor: "pointer" }}>dismiss ×</button>
        </div>
      )}

      {/* Broadcast banner — fetched from github.com/idarknightrex/marginalia/main/broadcast.json */}
      <BroadcastBanner
        theme={theme}
        broadcast={broadcast}
        onDismiss={() => setBroadcast(null)}
      />

      {/* Save and Break reminder — appears after 90 minutes of activity */}
      {breakReminder && !breakDismissed && (
        <div style={{
          background: "#c9a83222",
          borderBottom: `1px solid #c9a83244`,
          padding: "6px 20px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}>
          <span style={{ fontSize: "14px" }}>☕</span>
          <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#c9a832" }}>
            You've been working for {formatSessionTime(sessionMinutes)}. Time to save and rest?
          </span>
          <button onClick={() => { setBreakDismissed(true); setBreakReminder(false); }} style={{
            padding: "3px 12px", fontFamily: "monospace", fontSize: "11px",
            background: "#c9a832", color: "#fff", border: "none",
            borderRadius: "3px", cursor: "pointer", marginLeft: "4px",
          }}>↑ Save & Break</button>
          <button onClick={() => { setBreakDismissed(true); setBreakReminder(false); }} style={{
            padding: "3px 10px", fontFamily: "monospace", fontSize: "11px",
            background: "transparent", border: `1px solid #c9a83244`,
            color: "#c9a832", borderRadius: "3px", cursor: "pointer",
          }}>Keep going</button>
        </div>
      )}

      {/* Top nav */}
      <div style={{ display: "flex", alignItems: "center", padding: "0 16px", height: "52px", background: theme.surface, borderBottom: `1px solid ${theme.border}`, gap: "2px", flexWrap: "nowrap", overflowX: "auto" }}>
        {/* Logo — uses SVG asset in production: /assets/marginalia-logo.svg */}
        <div style={{ marginRight: "12px", display: "flex", alignItems: "center", flexShrink: 0 }}>
          <div style={{
            background: "linear-gradient(135deg, #f5eedc, #e0d4b0)",
            borderRadius: "4px",
            padding: "2px 10px 3px 10px",
            border: "1px solid #c8b88a",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            lineHeight: 1,
          }}>
            <span style={{
              fontFamily: "'IM Fell English', 'Palatino Linotype', Georgia, serif",
              fontSize: "8px",
              fontStyle: "italic",
              color: "#5a4a2a",
              letterSpacing: "2px",
              marginBottom: "1px",
              opacity: 0.85,
            }}>largely local</span>
            <span style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "18px",
              fontWeight: "bold",
              fontStyle: "italic",
              color: "#1a1208",
              letterSpacing: "-0.5px",
              lineHeight: 1,
            }}>Marginalia</span>
            <span style={{
              fontFamily: "'IM Fell English', Georgia, serif",
              fontSize: "7px",
              fontStyle: "italic",
              color: "#7a6a4a",
              letterSpacing: "3px",
              marginTop: "1px",
              opacity: 0.7,
              alignSelf: "flex-end",
            }}>slow down</span>
          </div>
        </div>

        {NAV_ITEMS.map(item => (
          <button key={item.id} onClick={() => setActiveNav(item.id)} style={{
            padding: "6px 12px", background: activeNav === item.id ? theme.accent + "22" : "transparent",
            color: activeNav === item.id ? theme.accent : theme.muted,
            border: `1px solid ${activeNav === item.id ? theme.accent + "44" : "transparent"}`,
            borderRadius: "4px", cursor: "pointer", fontFamily: "monospace", fontSize: "11px",
            display: "flex", alignItems: "center", gap: "4px", flexShrink: 0,
          }}>
            <span>{item.icon}</span><span>{item.label}</span>
          </button>
        ))}

        <div style={{ marginLeft: "auto", display: "flex", gap: "5px", alignItems: "center", flexShrink: 0 }}>
          {["default", "dark", "night"].map(t => (
            <button key={t} onClick={() => setThemeName(t)} style={{
              width: "18px", height: "18px", borderRadius: "50%",
              background: THEMES[t].bg, border: `2px solid ${themeName === t ? theme.accent : theme.border}`,
              cursor: "pointer",
            }} title={t} />
          ))}
          <button onClick={() => setShowAssistantSettings(s => !s)} style={{
            padding: "5px 10px",
            background: assistantEnabled ? theme.accent + "22" : showAssistantSettings ? theme.surface : "transparent",
            color: assistantEnabled ? theme.accent : theme.muted,
            border: `1px solid ${assistantEnabled ? theme.accent + "44" : theme.border}`,
            borderRadius: "4px", cursor: "pointer", fontFamily: "monospace", fontSize: "11px", marginLeft: "4px",
            position: "relative",
          }}>
            {assistantEnabled && <span style={{ position: "absolute", top: 3, right: 3, width: 5, height: 5, borderRadius: "50%", background: theme.accent }} />}
            ✦ Assistant
          </button>
          <button onClick={() => setShowSettings(s => !s)} style={{
            padding: "5px 10px", background: showSettings ? theme.accent + "22" : "transparent",
            color: showSettings ? theme.accent : theme.muted,
            border: `1px solid ${showSettings ? theme.accent + "44" : theme.border}`,
            borderRadius: "4px", cursor: "pointer", fontFamily: "monospace", fontSize: "11px", marginLeft: "4px",
          }}>⚙ Settings</button>
          <button onClick={() => setShowHelp(h => !h)} style={{
            padding: "5px 10px", background: showHelp ? theme.accent + "22" : "transparent",
            color: showHelp ? theme.accent : theme.muted,
            border: `1px solid ${showHelp ? theme.accent + "44" : theme.border}`,
            borderRadius: "4px", cursor: "pointer", fontFamily: "monospace", fontSize: "11px", marginLeft: "4px",
          }}>? Help</button>
          <button style={{
            padding: "6px 12px", background: theme.accent, color: "#fff",
            border: "none", borderRadius: "4px", cursor: "pointer",
            fontFamily: "monospace", fontSize: "11px", marginLeft: "4px", flexShrink: 0,
          }}>↑ Save & Break</button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px", paddingRight: showHelp ? "360px" : "20px", transition: "padding 0.2s" }}>
        <div style={{ marginBottom: "16px", display: "flex", alignItems: "baseline", gap: "10px" }}>
          <h1 style={{ margin: 0, fontSize: "18px", fontWeight: "normal", color: theme.text }}>
            {NAV_ITEMS.find(n => n.id === activeNav)?.label}
          </h1>
          <span style={{ fontSize: "11px", fontFamily: "monospace", color: theme.muted }}>
            {activeNav === "references" && `${MOCK_REFS.length} sources · ${MOCK_REFS.filter(r => r.status === "verified").length} verified`}
            {activeNav === "prompt" && "Multi-model synthesis"}
            {activeNav === "ingest" && "Capture your reflection"}
            {activeNav === "map" && `${MOCK_REFS.length} nodes · 11 edges`}
            {activeNav === "projects" && `${MOCK_PROJECTS.length} projects · PhD active`}
          </span>
        </div>
        {renderView()}
      </div>

      {/* Reading Assistant settings panel */}
      {showAssistantSettings && (
        <div style={{
          position: "fixed", bottom: "36px", left: "20px", width: "360px",
          zIndex: 90,
        }}>
          <ReadingAssistantSettings
            theme={theme}
            enabled={assistantEnabled}
            onToggle={() => { setAssistantEnabled(e => !e); setAssistantMatch(null); }}
            dwellSeconds={dwellSeconds}
            onDwellChange={setDwellSeconds}
          />
          {assistantEnabled && (
            <button onClick={simulateDwell} style={{
              marginTop: "6px", width: "100%", padding: "6px",
              fontFamily: "monospace", fontSize: "10px",
              background: "transparent", border: `1px solid ${theme.border}`,
              color: theme.muted, borderRadius: "4px", cursor: "pointer",
            }}>Demo: simulate dwell match in 4s →</button>
          )}
        </div>
      )}

      {/* Reading Assistant match panel */}
      <ReadingAssistantPanel
        theme={theme}
        match={assistantMatch}
        onDismiss={() => setAssistantMatch(null)}
        onLaunchPrompt={(match) => {
          setAssistantMatch(null);
          setActiveNav("prompt");
          setShowAssistantSettings(false);
        }}
      />

      {/* Settings panel */}
      {showSettings && <SettingsPanel theme={theme} onClose={() => setShowSettings(false)} />}

      {/* Help panel */}
      {showHelp && <HelpPanel theme={theme} onClose={() => setShowHelp(false)} />}

      {/* Status bar */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, height: "28px",
        background: theme.surface, borderTop: `1px solid ${theme.border}`,
        display: "flex", alignItems: "center", padding: "0 20px", gap: "16px",
      }}>
        <span style={{ fontSize: "10px", fontFamily: "monospace", color: STATUS_COLORS.verified }}>Mini ● online</span>
        <span style={{ fontSize: "10px", fontFamily: "monospace", color: STATUS_COLORS.verified }}>Tailscale ● connected</span>
        <span style={{ fontSize: "10px", fontFamily: "monospace", color: theme.muted }}>Ollama ● 2 models loaded</span>
        <span style={{ fontSize: "10px", fontFamily: "monospace", color: theme.muted }}>
          Session: {formatSessionTime(sessionMinutes)}
        </span>
        <button onClick={() => { setSessionMinutes(92); setBreakReminder(true); setBreakDismissed(false); }}
          style={{ fontSize: "9px", fontFamily: "monospace", color: theme.muted, background: "none", border: `1px solid ${theme.border}`, borderRadius: "3px", padding: "1px 6px", cursor: "pointer" }}
          title="Demo: trigger break reminder">demo ☕</button>
        <span style={{ marginLeft: "auto", fontSize: "10px", fontFamily: "monospace", color: theme.muted }}>
          Marginalia v0.5 · LLM · {MOCK_PROJECTS.find(p => p.id === 1)?.name || "No project active"}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// SETTINGS — persisted in settings.json, loaded on startup
// ============================================================================

const SETTINGS = {
  breakReminderMinutes: 120,
  dwellThresholdSeconds: 30,
  theme: "default",
  defaultVerificationStatus: "located",
  pdfFolderPath: "~/Documents/Research/PDFs",
  ollamaModels: {
    reasoning: "deepseek-r1:8b",
    multimodal: "gemma2:9b",
    general: "llama3.1:8b",
  },
  upgradeCheckDays: 30,
  projectTypes: ["PhD", "Masters", "Paper", "Conference", "Course", "Other"],
  autoSaveCanonical: true,
};

function SettingsPanel({ theme, onClose }) {
  const [tab, setTab] = useState("workflow");
  const [breakMins, setBreakMins] = useState(SETTINGS.breakReminderMinutes);
  const [dwellSecs, setDwellSecs] = useState(SETTINGS.dwellThresholdSeconds);
  const [pdfPath, setPdfPath] = useState(SETTINGS.pdfFolderPath);
  const [customType, setCustomType] = useState("");
  const [projectTypes, setProjectTypes] = useState(SETTINGS.projectTypes);

  const TABS = [
    ["workflow", "Workflow"],
    ["models", "Models"],
    ["storage", "Storage"],
    ["projects", "Projects"],
    ["about", "About"],
  ];

  const FieldLabel = ({ label, hint }) => (
    <div style={{ marginBottom: "4px" }}>
      <div style={{ fontSize: "11px", color: theme.text, fontFamily: "monospace" }}>{label}</div>
      {hint && <div style={{ fontSize: "9px", color: theme.muted, fontFamily: "monospace", marginTop: "1px" }}>{hint}</div>}
    </div>
  );

  const inputStyle = {
    padding: "6px 10px", background: theme.bg,
    border: `1px solid ${theme.border}`, borderRadius: "4px",
    color: theme.text, fontFamily: "monospace", fontSize: "11px",
    outline: "none", width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{
      position: "fixed", right: 0, top: 0, bottom: 0, width: "360px",
      background: theme.surface, borderLeft: `1px solid ${theme.border}`,
      zIndex: 100, display: "flex", flexDirection: "column",
      boxShadow: "-4px 0 20px rgba(0,0,0,0.15)",
    }}>
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: "monospace", fontSize: "13px", color: theme.text }}>Settings</div>
          <div style={{ fontFamily: "monospace", fontSize: "9px", color: theme.muted, marginTop: "2px" }}>Saved to settings.json · travels with your repo</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: theme.muted, cursor: "pointer", fontSize: "18px" }}>×</button>
      </div>

      <div style={{ display: "flex", gap: "2px", padding: "8px 12px", borderBottom: `1px solid ${theme.border}`, flexWrap: "wrap" }}>
        {TABS.map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "4px 10px", fontSize: "10px", fontFamily: "monospace",
            background: tab === t ? theme.accent : "transparent",
            color: tab === t ? "#fff" : theme.muted,
            border: `1px solid ${tab === t ? theme.accent : theme.border}`,
            borderRadius: "3px", cursor: "pointer",
          }}>{l}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>

        {tab === "workflow" && (
          <>
            <div>
              <FieldLabel label="Break reminder" hint="How long before Marginalia suggests you save and rest" />
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input type="range" min="30" max="240" step="15" value={breakMins}
                  onChange={e => setBreakMins(Number(e.target.value))}
                  style={{ flex: 1, accentColor: theme.accent }} />
                <span style={{ fontSize: "12px", fontFamily: "monospace", color: theme.text, minWidth: "50px" }}>
                  {breakMins >= 60 ? `${Math.floor(breakMins/60)}h${breakMins%60 ? ` ${breakMins%60}m` : ""}` : `${breakMins}m`}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: theme.muted, fontFamily: "monospace", marginTop: "2px" }}>
                <span>30m</span><span>1h</span><span>2h (default)</span><span>3h</span><span>4h</span>
              </div>
            </div>

            <div>
              <FieldLabel label="Reading Assistant dwell threshold" hint="How long you must stay on a passage before the assistant fires" />
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input type="range" min="15" max="120" step="5" value={dwellSecs}
                  onChange={e => setDwellSecs(Number(e.target.value))}
                  style={{ flex: 1, accentColor: theme.accent }} />
                <span style={{ fontSize: "12px", fontFamily: "monospace", color: theme.text, minWidth: "40px" }}>{dwellSecs}s</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: theme.muted, fontFamily: "monospace", marginTop: "2px" }}>
                <span>15s</span><span>30s (default)</span><span>60s</span><span>2m</span>
              </div>
            </div>

            <div>
              <FieldLabel label="Default verification status on manual entry" hint="Status assigned when you add a reference you already have" />
              <select style={inputStyle}>
                <option value="located" selected>located (recommended — you have it)</option>
                <option value="surfaced">surfaced (not yet obtained)</option>
                <option value="verified">verified (already read)</option>
              </select>
            </div>

            <div>
              <FieldLabel label="Upgrade check frequency" hint="How often Marginalia checks broadcast.json for updates" />
              <select style={inputStyle}>
                <option>Every 30 days (default)</option>
                <option>Every 7 days</option>
                <option>Every 90 days</option>
                <option>On startup only</option>
              </select>
            </div>
          </>
        )}

        {tab === "models" && (
          <>
            <div style={{ padding: "10px", background: theme.bg, borderRadius: "4px", border: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: "10px", color: theme.muted, fontFamily: "monospace", marginBottom: "8px", textTransform: "uppercase" }}>Local models (Ollama)</div>
              {[
                ["Reasoning model", "deepseek-r1:8b", "Used for synthesis and argument analysis"],
                ["Multimodal model", "gemma2:9b", "Used for OCR and audio ingestion"],
                ["General model", "llama3.1:8b", "Used for general prompting"],
              ].map(([label, val, hint]) => (
                <div key={label} style={{ marginBottom: "10px" }}>
                  <FieldLabel label={label} hint={hint} />
                  <input style={inputStyle} defaultValue={val} />
                </div>
              ))}
            </div>

            <div style={{ padding: "10px", background: theme.bg, borderRadius: "4px", border: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: "10px", color: theme.muted, fontFamily: "monospace", marginBottom: "8px", textTransform: "uppercase" }}>Cloud models</div>
              {[
                ["Gemini model", "gemini-2.5-flash"],
                ["Azure deployment", "gpt-4o"],
                ["Anthropic model", "claude-haiku-4-5"],
              ].map(([label, val]) => (
                <div key={label} style={{ marginBottom: "10px" }}>
                  <FieldLabel label={label} />
                  <input style={inputStyle} defaultValue={val} />
                </div>
              ))}
              <div style={{ fontSize: "9px", color: theme.muted, fontFamily: "monospace", marginTop: "4px" }}>
                Model strings are also tracked in CHANGELOG.md for methodological record.
              </div>
            </div>
          </>
        )}

        {tab === "storage" && (
          <>
            <div>
              <FieldLabel label="PDF folder location" hint="Where your research PDFs live — outside the Marginalia project folder" />
              <input style={inputStyle} value={pdfPath} onChange={e => setPdfPath(e.target.value)} />
            </div>

            <div style={{ padding: "10px", background: theme.bg, borderRadius: "4px", border: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: "10px", color: theme.muted, fontFamily: "monospace", marginBottom: "6px", textTransform: "uppercase" }}>Backup layers</div>
              {[
                ["Layer A", "Internal drive — canonical/", "Live working copy", "#3d8b37"],
                ["Layer B", "External drive — rsync nightly", "Automated local backup", "#3d8b37"],
                ["Layer C", "iCloud / OneDrive", "Cloud sync", "#c9a832"],
                ["Layer D", "GitHub private repo", "Offsite backup", "#3d8b37"],
              ].map(([layer, loc, desc, color]) => (
                <div key={layer} style={{ display: "flex", gap: "8px", marginBottom: "6px", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "10px", fontFamily: "monospace", color, flexShrink: 0, minWidth: "16px" }}>●</span>
                  <div>
                    <div style={{ fontSize: "11px", color: theme.text, fontFamily: "monospace" }}>{layer} — {loc}</div>
                    <div style={{ fontSize: "9px", color: theme.muted }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: "10px", background: theme.bg, borderRadius: "4px", border: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: "10px", color: theme.muted, fontFamily: "monospace", marginBottom: "6px", textTransform: "uppercase" }}>Canonical file auto-save</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "11px", color: theme.muted }}>Write canonical file on every save (recommended)</div>
                <div style={{ width: "36px", height: "20px", background: "#3d8b37", borderRadius: "10px", position: "relative", cursor: "pointer" }}>
                  <div style={{ position: "absolute", right: "3px", top: "3px", width: "14px", height: "14px", background: "#fff", borderRadius: "50%" }} />
                </div>
              </div>
            </div>
          </>
        )}

        {tab === "projects" && (
          <>
            <div>
              <FieldLabel label="Project types" hint="Types available when creating a new project" />
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "10px" }}>
                {projectTypes.map(t => (
                  <div key={t} style={{
                    display: "flex", alignItems: "center", gap: "4px",
                    padding: "3px 8px", background: theme.bg,
                    border: `1px solid ${theme.border}`, borderRadius: "3px",
                  }}>
                    <span style={{ fontSize: "11px", fontFamily: "monospace", color: theme.text }}>{t}</span>
                    {!["PhD", "Masters", "Paper", "Conference", "Course"].includes(t) && (
                      <button onClick={() => setProjectTypes(pts => pts.filter(p => p !== t))}
                        style={{ background: "none", border: "none", color: theme.muted, cursor: "pointer", fontSize: "12px", lineHeight: 1, padding: "0 0 0 2px" }}>×</button>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="Add custom type..."
                  value={customType}
                  onChange={e => setCustomType(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && customType.trim()) {
                      setProjectTypes(pts => [...pts.filter(p => p !== "Other"), customType.trim(), "Other"]);
                      setCustomType("");
                    }
                  }}
                />
                <button
                  onClick={() => { if (customType.trim()) { setProjectTypes(pts => [...pts.filter(p => p !== "Other"), customType.trim(), "Other"]); setCustomType(""); }}}
                  style={{ padding: "6px 12px", background: theme.accent, color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontFamily: "monospace", fontSize: "11px" }}>
                  Add
                </button>
              </div>
              <div style={{ fontSize: "9px", color: theme.muted, fontFamily: "monospace", marginTop: "6px" }}>
                Built-in types cannot be removed. Custom types can be deleted with ×.
                Press Enter or click Add to save a new type.
              </div>
            </div>
          </>
        )}

        {tab === "about" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              ["Version", "Marginalia v0.5 · LLM"],
              ["License", "MIT — free, open source, always"],
              ["Last model check", "32 days ago — check now"],
              ["Canonical files", "74 references · 12 sessions · 5 posts"],
              ["Database", "research.db — rebuilt from canonical on startup"],
              ["settings.json", "travels with repo · human readable"],
            ].map(([label, val]) => (
              <div key={label} style={{ padding: "8px 10px", background: theme.bg, borderRadius: "4px", border: `1px solid ${theme.border}` }}>
                <div style={{ fontSize: "9px", fontFamily: "monospace", color: theme.muted, textTransform: "uppercase", marginBottom: "2px" }}>{label}</div>
                <div style={{ fontSize: "11px", fontFamily: "monospace", color: theme.text }}>{val}</div>
              </div>
            ))}
            <a href="https://github.com/idarknightrex/marginalia" target="_blank" rel="noreferrer"
              style={{ fontSize: "11px", fontFamily: "monospace", color: theme.accent, textDecoration: "none", textAlign: "center", marginTop: "4px" }}>
              github.com/idarknightrex/marginalia →
            </a>
          </div>
        )}
      </div>

      <div style={{ padding: "12px 16px", borderTop: `1px solid ${theme.border}`, display: "flex", gap: "8px" }}>
        <button onClick={onClose} style={{
          flex: 1, padding: "8px", background: theme.accent, color: "#fff",
          border: "none", borderRadius: "4px", cursor: "pointer",
          fontFamily: "monospace", fontSize: "12px",
        }}>Save Settings</button>
        <button onClick={onClose} style={{
          padding: "8px 14px", background: "transparent", color: theme.muted,
          border: `1px solid ${theme.border}`, borderRadius: "4px", cursor: "pointer",
          fontFamily: "monospace", fontSize: "12px",
        }}>Cancel</button>
      </div>
    </div>
  );
}

// ============================================================================
// BROADCAST — Static JSON from GitHub, read during update check
// ============================================================================

const MOCK_BROADCAST = {
  active: true,
  type: "celebration",
  title: "Marginalia is live",
  body: "Welcome to the community. The napkin that remembers is now in your hands. If this tool earns a place in your research practice, share it with a colleague or leave a note in GitHub Discussions.",
  cta_label: "GitHub Discussions →",
  cta_url: "https://github.com/idarknightrex/marginalia/discussions",
  expires: "2027-12-01",
  dismissible: true,
};

const BROADCAST_TYPE_COLORS = {
  info: "#6e56cf",
  warning: "#c9a832",
  urgent: "#c94242",
  celebration: "#3d8b37",
};

function UpdateModal({ theme, onDismiss }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: "420px", background: theme.surface,
        border: `1px solid ${theme.border}`, borderRadius: "8px",
        boxShadow: "0 8px 40px rgba(0,0,0,0.25)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: `1px solid ${theme.border}`,
          background: theme.bg, display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontFamily: "monospace", fontSize: "13px", color: theme.text }}>
              Marginalia v0.5.1 is available
            </div>
            <div style={{ fontFamily: "monospace", fontSize: "10px", color: theme.muted, marginTop: "2px" }}>
              You are running v0.5.0
            </div>
          </div>
          <button onClick={onDismiss} style={{
            background: "none", border: "none", color: theme.muted,
            cursor: "pointer", fontSize: "20px", lineHeight: 1,
          }}>×</button>
        </div>

        {/* Release notes */}
        <div style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: "11px", color: theme.muted, fontFamily: "monospace", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            What's new
          </div>
          {[
            ["✦", "Reading Assistant", "Transparent opt-in dwell-time cross-reference engine"],
            ["✦", "Settings panel", "Configurable workflow preferences, model strings, project types"],
            ["✦", "Save Capture", "Save raw ingest output as a draft without linking immediately"],
            ["✦", "Idea map hover", "Mouse over any node to see annotation, themes, and connections"],
            ["✦", "Git pre-flight", "Large files auto-excluded before commit — no broken sync pipelines"],
          ].map(([icon, title, desc]) => (
            <div key={title} style={{ display: "flex", gap: "10px", marginBottom: "10px", alignItems: "flex-start" }}>
              <span style={{ color: theme.accent, fontSize: "12px", flexShrink: 0, marginTop: "1px" }}>{icon}</span>
              <div>
                <div style={{ fontSize: "12px", color: theme.text, fontFamily: "'Georgia', serif" }}>{title}</div>
                <div style={{ fontSize: "11px", color: theme.muted, marginTop: "1px" }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Update instructions */}
        <div style={{
          padding: "12px 20px", background: theme.bg,
          borderTop: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}`,
        }}>
          <div style={{ fontSize: "10px", color: theme.muted, fontFamily: "monospace", marginBottom: "6px" }}>To update:</div>
          <code style={{
            display: "block", padding: "6px 10px", background: theme.surface,
            border: `1px solid ${theme.border}`, borderRadius: "4px",
            fontFamily: "monospace", fontSize: "11px", color: theme.text,
          }}>git pull origin main</code>
        </div>

        {/* Footer actions */}
        <div style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <a
            href="https://ko-fi.com/llmarginalia"
            target="_blank"
            rel="noreferrer"
            style={{
              fontFamily: "monospace", fontSize: "11px",
              color: theme.muted, textDecoration: "none",
              borderBottom: `1px solid ${theme.border}`,
              paddingBottom: "1px",
            }}>
            ☕ Support independent open-source development
          </a>
          <button onClick={onDismiss} style={{
            padding: "8px 20px", background: theme.accent, color: "#fff",
            border: "none", borderRadius: "4px", cursor: "pointer",
            fontFamily: "monospace", fontSize: "12px", flexShrink: 0,
          }}>Dismiss</button>
        </div>
      </div>
    </div>
  );
}

function BroadcastBanner({ theme, broadcast, onDismiss }) {
  if (!broadcast || !broadcast.active) return null;
  const color = BROADCAST_TYPE_COLORS[broadcast.type] || BROADCAST_TYPE_COLORS.info;
  return (
    <div style={{
      background: color + "18",
      borderBottom: `1px solid ${color}44`,
      padding: "8px 20px",
      display: "flex",
      alignItems: "flex-start",
      gap: "12px",
    }}>
      <div style={{ flex: 1 }}>
        <span style={{ fontFamily: "monospace", fontSize: "11px", color, fontWeight: "bold", marginRight: "8px" }}>
          {broadcast.title}
        </span>
        <span style={{ fontFamily: "monospace", fontSize: "11px", color: theme.muted }}>
          {broadcast.body}
        </span>
        {broadcast.cta_label && (
          <a href={broadcast.cta_url} target="_blank" rel="noreferrer" style={{
            marginLeft: "10px", fontFamily: "monospace", fontSize: "11px",
            color, textDecoration: "underline", cursor: "pointer",
          }}>{broadcast.cta_label}</a>
        )}
      </div>
      {broadcast.dismissible && (
        <button onClick={onDismiss} style={{
          background: "none", border: "none", color: theme.muted,
          cursor: "pointer", fontSize: "14px", lineHeight: 1, flexShrink: 0,
          padding: "0 4px",
        }}>×</button>
      )}
    </div>
  );
}

// ============================================================================
// READING ASSISTANT — Transparent, opt-in dwell-time cross-reference engine
// ============================================================================

function ReadingAssistantPanel({ theme, match, onDismiss, onLaunchPrompt }) {
  if (!match) return null;
  return (
    <div style={{
      position: "fixed", bottom: "36px", right: "20px", width: "320px",
      background: theme.surface, border: `1px solid ${theme.accent}`,
      borderRadius: "8px", boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      zIndex: 90, overflow: "hidden",
      animation: "slideUp 0.3s ease",
    }}>
      <div style={{
        padding: "10px 14px", background: theme.accent + "18",
        borderBottom: `1px solid ${theme.accent}33`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "14px" }}>✦</span>
          <span style={{ fontFamily: "monospace", fontSize: "11px", color: theme.accent }}>
            Reading Assistant
          </span>
        </div>
        <button onClick={onDismiss} style={{
          background: "none", border: "none", color: theme.muted,
          cursor: "pointer", fontSize: "14px", lineHeight: 1,
        }}>×</button>
      </div>

      <div style={{ padding: "12px 14px" }}>
        <div style={{ fontSize: "11px", color: theme.muted, fontFamily: "monospace", marginBottom: "8px" }}>
          You've been on this passage for a while. This may connect:
        </div>

        <div style={{
          padding: "10px", background: theme.bg,
          border: `1px solid ${theme.border}`,
          borderLeft: `3px solid ${STATUS_COLORS[match.status]}`,
          borderRadius: "4px", marginBottom: "10px",
        }}>
          <div style={{ fontSize: "12px", color: theme.text, fontFamily: "'Georgia', serif", marginBottom: "3px" }}>
            {match.author} ({match.year})
          </div>
          <div style={{ fontSize: "11px", color: theme.muted, fontStyle: "italic", marginBottom: "6px" }}>
            {match.title}
          </div>
          <div style={{ fontSize: "11px", color: theme.muted, lineHeight: 1.5 }}>
            {match.snippet}
          </div>
          <div style={{ marginTop: "6px", display: "flex", flexWrap: "wrap" }}>
            {match.themes.map(t => <Tag key={t} label={t} color={theme.accent} />)}
          </div>
        </div>

        <div style={{ display: "flex", gap: "6px" }}>
          <button onClick={() => onLaunchPrompt(match)} style={{
            flex: 1, padding: "6px", fontSize: "11px", fontFamily: "monospace",
            background: theme.accent, color: "#fff", border: "none",
            borderRadius: "3px", cursor: "pointer",
          }}>Launch Prompt with this →</button>
          <button onClick={onDismiss} style={{
            padding: "6px 10px", fontSize: "11px", fontFamily: "monospace",
            background: "transparent", border: `1px solid ${theme.border}`,
            color: theme.muted, borderRadius: "3px", cursor: "pointer",
          }}>Not now</button>
        </div>
      </div>

      <div style={{
        padding: "6px 14px", borderTop: `1px solid ${theme.border}`,
        fontSize: "9px", color: theme.muted, fontFamily: "monospace",
      }}>
        Matched on shared themes · all matching runs locally · no data leaves your machine
      </div>
    </div>
  );
}

function ReadingAssistantSettings({ theme, enabled, onToggle, dwellSeconds, onDwellChange }) {
  return (
    <div style={{
      padding: "14px", background: theme.surface,
      border: `1px solid ${theme.border}`, borderRadius: "6px",
      display: "flex", flexDirection: "column", gap: "12px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: "13px", color: theme.text }}>Reading Assistant</div>
          <div style={{ fontSize: "11px", color: theme.muted, marginTop: "2px" }}>
            Surfaces related references when you dwell on a passage
          </div>
        </div>
        <button onClick={onToggle} style={{
          padding: "5px 14px", fontFamily: "monospace", fontSize: "11px",
          background: enabled ? theme.accent : "transparent",
          color: enabled ? "#fff" : theme.muted,
          border: `1px solid ${enabled ? theme.accent : theme.border}`,
          borderRadius: "20px", cursor: "pointer",
        }}>{enabled ? "ON" : "OFF"}</button>
      </div>

      {enabled && (
        <>
          <div>
            <div style={{ fontSize: "11px", color: theme.muted, fontFamily: "monospace", marginBottom: "6px" }}>
              Dwell threshold: <strong style={{ color: theme.text }}>{dwellSeconds}s</strong>
            </div>
            <input type="range" min="15" max="120" step="5" value={dwellSeconds}
              onChange={e => onDwellChange(Number(e.target.value))}
              style={{ width: "100%", accentColor: theme.accent }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: theme.muted, fontFamily: "monospace" }}>
              <span>15s (active)</span><span>60s (focused)</span><span>120s (deep)</span>
            </div>
          </div>

          <div style={{
            padding: "10px", background: theme.bg,
            border: `1px solid ${theme.border}`, borderRadius: "4px",
          }}>
            <div style={{ fontSize: "10px", color: theme.muted, fontFamily: "monospace", lineHeight: 1.6 }}>
              How it works: when you stop scrolling for {dwellSeconds} seconds, Marginalia
              compares the visible text against your reference annotations using local
              keyword matching. If it finds a connection, a small prompt appears in the
              corner. Nothing leaves your machine. You can dismiss it and keep reading.
            </div>
          </div>

          <div style={{ fontSize: "10px", color: theme.muted, fontFamily: "monospace" }}>
            Matching runs against: <span style={{ color: theme.accent }}>verified + located references only</span>
          </div>
        </>
      )}
    </div>
  );
}
