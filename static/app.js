// ── Marginalia — app.js ───────────────────────────────────────────────────
// All frontend logic. Loaded by templates/index.html via <script src>.
// Organized sections: State · Navigation · Model chips · Prompt · References
//                     Import · Projects · Writing · Intelligence · Session
// ─────────────────────────────────────────────────────────────────────────

// ── State ─────────────────────────────────────────────────────────────────
let allRefs = [], activeFilter = 'all', sessionMinutes = 0;
let activeModels = new Set(['gemini', 'anthropic', 'openai', 'deepseek']);
let doiPreviewData = null;
let pasteFormat = 'bibtex';

const STATUS_COLORS = { verified: '#3d8b37', located: '#c9a832', surfaced: '#6e56cf', rejected: '#c94242' };
const MODEL_COLORS  = { gemini: '#4285f4', anthropic: '#c96442', openai: '#10a37f', llama: '#9c6ade', deepseek: '#52c41a', gemma: '#ffab00', qwen: '#0891b2', mistral: '#ff7000', cohere: '#0d9488' };
const MODEL_META = {
  gemini:    { type: 'cloud',  web: true,  label: 'web' },
  anthropic: { type: 'cloud',  web: false, label: 'cloud' },
  openai:    { type: 'cloud',  web: false, label: 'cloud' },
  deepseek:  { type: 'local',  web: false, label: 'local · China · knowledge to ~early 2024' },
  qwen:      { type: 'local',  web: false, label: 'local · Asia/Global South · knowledge to ~mid 2024' },
  mistral:   { type: 'local',  web: false, label: 'local · Europe · knowledge to ~early 2023' },
  gemma:     { type: 'local',  web: false, label: 'local · Western · knowledge to ~early 2025' },
  llama:     { type: 'local',  web: false, label: 'local · Global · knowledge to ~early 2024' },
  cohere:    { type: 'local',  web: false, label: 'local · Canada · knowledge to ~early 2024' },
};
function getModelMeta(model) {
  if (MODEL_META[model]) return MODEL_META[model];
  return { type: 'local', web: false, label: 'local · Ollama · ~1yr cutoff' };
}


// ── Navigation ────────────────────────────────────────────────────────────
function showView(name, btn) {
  if (name === 'projects')     loadProjects();
  if (name === 'writing')      loadWriting();
  if (name === 'notes')        loadNotes();
  if (name === 'intelligence') loadIntelligenceProjects();
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  if (btn) btn.classList.add('active');
  if (name === 'references') loadReferences();
}


// ── Model chips ───────────────────────────────────────────────────────────
function countActiveLocals() {
  let n = 0;
  document.querySelectorAll('.model-chip[data-local="true"]').forEach(c => {
    if (activeModels.has(c.dataset.model)) n++;
  });
  return n;
}
function updateLocalWarning() {
  document.getElementById('local-warning').classList.toggle('visible', countActiveLocals() > 1);
}
function toggleModel(chip) {
  const model = chip.dataset.model;
  if (activeModels.has(model)) {
    activeModels.delete(model); chip.classList.remove('active'); chip.classList.add('inactive');
  } else {
    activeModels.add(model); chip.classList.add('active'); chip.classList.remove('inactive');
  }
  updateLocalWarning();
}
function toggleHideInactive(btn) {
  const chips = document.getElementById('model-chips');
  const active = btn.classList.toggle('active');
  chips.classList.toggle('hide-inactive', active);
  btn.textContent = active ? 'Show all' : 'Hide inactive';
}


// ── Chip tooltip positioning ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.chip-wrapper').forEach(wrapper => {
    const tooltip = wrapper.querySelector('.chip-tooltip');
    if (!tooltip) return;
    wrapper.addEventListener('mouseenter', () => {
      const rect = wrapper.getBoundingClientRect();
      tooltip.style.display = 'block';
      tooltip.style.left = (rect.left + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';
      tooltip.style.top  = (rect.top - tooltip.offsetHeight - 8) + 'px';
      const tRect = tooltip.getBoundingClientRect();
      if (tRect.left < 8) tooltip.style.left = '8px';
      if (tRect.right > window.innerWidth - 8)
        tooltip.style.left = (window.innerWidth - tRect.width - 8) + 'px';
    });
    wrapper.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
  });
});


// ── Key status ────────────────────────────────────────────────────────────
async function checkKeyStatus() {
  try {
    const res  = await fetch('/api/key-status');
    const keys = await res.json();
    document.querySelectorAll('.model-chip').forEach(chip => {
      const model = chip.dataset.model;
      if (keys[model] === false) {
        chip.classList.add('no-key');
        chip.classList.remove('active');
        chip.classList.add('inactive');
        activeModels.delete(model);
        if (!chip.querySelector('.no-key-badge')) {
          const badge = document.createElement('span');
          badge.className = 'no-key-badge';
          badge.textContent = 'no key';
          chip.appendChild(badge);
        }
        chip.onclick = () => {
          alert(model + ' requires an API key. Add it to setup.env and restart Marginalia.');
        };
      }
    });
  } catch(e) {}
}


// ── Local model auto-detection ────────────────────────────────────────────
async function checkLocalModels() {
  try {
    const res  = await fetch('/api/local-models');
    const data = await res.json();
    Object.entries(data).forEach(([model, info]) => {
      const chip = document.querySelector(`.model-chip[data-model="${model}"]`);
      if (!chip) return;
      if (info.installed === false) {
        const wrapper = chip.closest('.chip-wrapper');
        if (wrapper) wrapper.style.display = 'none';
        activeModels.delete(model);
      } else if (info.installed === true) {
        chip.classList.remove('no-key');
        const badge = chip.querySelector('.no-key-badge');
        if (badge) badge.remove();
        const wrapper = chip.closest('.chip-wrapper');
        if (wrapper) wrapper.style.display = '';
        const tooltip = chip.closest('.chip-wrapper')?.querySelector('.chip-tooltip');
        if (tooltip && info.size_gb) {
          tooltip.innerHTML = tooltip.innerHTML
            .replace(/~[\d.]+GB[^<]*/g, `${info.size_gb}GB on Vault`)
            .replace(/✓ [^<]+<br>✓ /g, '✓ ');
          if (!tooltip.innerHTML.includes('on Vault'))
            tooltip.innerHTML += `<br>✓ ${info.model_str} · ${info.size_gb}GB on Vault`;
        }
      } else if (info.installed === null) {
        const tooltip = chip.closest('.chip-wrapper')?.querySelector('.chip-tooltip');
        if (tooltip && !tooltip.innerHTML.includes('Ollama'))
          tooltip.innerHTML += '<br>⚠ Ollama not detected — is it running?';
      }
    });
    // Dynamic chips for any unknown Ollama models
    const chipsContainer = document.getElementById('model-chips');
    Object.entries(data).forEach(([key, info]) => {
      if (!info.dynamic) return;
      if (document.querySelector(`.model-chip[data-model="${key}"]`)) return;
      const palette = ['#7c3aed','#0891b2','#be185d','#15803d','#b45309','#1d4ed8','#9f1239'];
      let hash = 0; for (const c of key) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
      const col = palette[hash % palette.length];
      const label = info.model_str.replace(/:latest$/, '');
      const wrapper = document.createElement('div');
      wrapper.className = 'chip-wrapper';
      wrapper.innerHTML = `
        <div class="model-chip inactive" data-model="${key}" data-local="true"
             style="background:${col}18;border-color:${col}44" onclick="toggleModel(this)">
          <div class="chip-dot" style="background:${col}"></div>
          <span style="color:${col}">${label}</span>
        </div>
        <span class="chip-tooltip">🔒 Local · ${info.model_str}<br>Runs on your machine · Private · No internet<br>Knowledge: ~1yr behind<br>${info.size_gb}GB on Vault</span>`;
      chipsContainer.appendChild(wrapper);
    });
  } catch(e) {}
}


// ── Prompt ────────────────────────────────────────────────────────────────
document.getElementById('prompt-input').addEventListener('input', function() {
  document.getElementById('token-estimate').textContent =
    '~' + Math.round(this.value.trim().split(/\s+/).length * 1.3) + ' tokens';
});

// Countdown bar durations per model (milliseconds).
// Local models get 300s (5 min) because they cold-load from disk on every
// call (keep_alive=0). Cloud models get 60s — network timeouts are handled
// server-side. Dynamic ollama: models fall back to 300s.
// If a model consistently times out, check Ollama is running and the model
// is pulled: ollama list
const MODEL_TIMEOUT = {
  gemini: 60000, anthropic: 60000, openai: 60000,
  deepseek: 300000, gemma: 300000, llama: 300000, qwen: 300000, mistral: 300000, cohere: 300000
};
let activeReader = null;

function makeCard(model) {
  const card = document.createElement('div');
  card.className = 'response-card loading';
  card.id = 'card-' + model;
  const chipEl = document.querySelector(`.model-chip[data-model="${model}"]`);
  const dotEl = chipEl ? chipEl.querySelector('.chip-dot') : null;
  const chipColor = dotEl ? dotEl.style.background : null;
  card.style.borderLeftColor = MODEL_COLORS[model] || chipColor || '#888';
  const meta = getModelMeta(model);
  const badge = meta.web
    ? '<span style="font-size:9px;font-family:monospace;background:#4285f422;color:#4285f4;border:1px solid #4285f444;border-radius:3px;padding:1px 5px;margin-left:5px">&#127760; web</span>'
    : meta.type === 'local'
      ? '<span style="font-size:9px;font-family:monospace;background:#52c41a22;color:#52c41a;border:1px solid #52c41a44;border-radius:3px;padding:1px 5px;margin-left:5px">&#128274; local</span>'
      : '<span style="font-size:9px;font-family:monospace;background:#8a7a6a22;color:#c9a832;border:1px solid #c9a83244;border-radius:3px;padding:1px 5px;margin-left:5px">&#9729; cloud</span>';
  const cutoff = meta.type === 'local'
    ? '<span style="font-size:9px;font-family:monospace;color:var(--muted);margin-left:4px">~1yr cutoff</span>'
    : '';
  const cdClass = meta.type === 'local' ? 'local' : '';
  card.innerHTML =
    '<div class="timeout-countdown ' + cdClass + '" id="cd-' + model + '">Waiting… <span class="countdown-bar"><span class="countdown-fill" id="cdfill-' + model + '" style="width:100%"></span></span> <span id="cdsec-' + model + '"></span></div>' +
    '<div class="model-label" style="color:' + (MODEL_COLORS[model] || chipColor || '#888') + ';display:flex;align-items:center">' +
      (model.startsWith('ollama:') ? model.replace(/^ollama:/, '').replace(/:latest$/, '') : model) + badge + cutoff +
    '</div>' +
    '<div class="response-text"></div>' +
    '<div class="response-timing" id="timing-' + model + '" style="display:none"></div>';
  return card;
}

const cardStartTimes = {};
const cardTimerIntervals = {};

function startLiveTimer(model) {
  const timingEl = document.getElementById('timing-' + model);
  if (!timingEl) return;
  timingEl.style.display = 'block';
  timingEl.textContent = '\u23f1 0.0s';
  cardTimerIntervals[model] = setInterval(() => {
    if (!cardStartTimes[model]) return;
    const elapsed = ((Date.now() - cardStartTimes[model]) / 1000).toFixed(1);
    timingEl.textContent = '\u23f1 ' + elapsed + 's';
  }, 100);
}
function stopLiveTimer(model) {
  if (cardTimerIntervals[model]) { clearInterval(cardTimerIntervals[model]); delete cardTimerIntervals[model]; }
}

const countdownTimers = {};
function startCardCountdown(model) { startTimeoutBar(model); }
function startTimeoutBar(model) {
  const total  = (MODEL_TIMEOUT[model] || (model.startsWith('ollama:') ? 300000 : 30000)) / 1000;
  const cdEl   = document.getElementById('cd-' + model);
  const fillEl = document.getElementById('cdfill-' + model);
  const secEl  = document.getElementById('cdsec-' + model);
  if (!cdEl) return;
  let remaining = total;
  function tick() {
    if (!document.getElementById('cd-' + model)) return;
    remaining = Math.max(0, remaining - 1);
    const pct = (remaining / total) * 100;
    if (fillEl) fillEl.style.width = pct + '%';
    if (secEl)  secEl.textContent  = remaining + 's';
    if (cdEl) {
      cdEl.classList.toggle('warning',  pct < 40 && pct >= 15);
      cdEl.classList.toggle('critical', pct < 15);
    }
    if (remaining > 0) {
      countdownTimers[model] = setTimeout(tick, 1000);
    } else {
      const card = document.getElementById('card-' + model);
      if (card && card.classList.contains('loading')) {
        card.classList.remove('loading');
        const rt = card.querySelector('.response-text');
        if (rt) { rt.textContent = '\u23f1 Timed out — model took too long.'; rt.style.color = '#c94242'; }
        if (cdEl) cdEl.style.display = 'none';
      }
    }
  }
  if (secEl) secEl.textContent = total + 's';
  // After 10s on a local model, hint that first-load from disk is expected
  const isLocal = !['gemini','anthropic','openai'].includes(model);
  if (isLocal) {
    setTimeout(() => {
      const card = document.getElementById('card-' + model);
      if (card && card.classList.contains('loading')) {
        const rt = card.querySelector('.response-text');
        if (rt && !rt.textContent) {
          rt.textContent = 'Loading model from disk\u2026 first run takes ~20s on cold start.';
          rt.style.fontStyle = 'italic';
          rt.style.color = 'var(--muted)';
        }
      }
    }, 10000);
  }
  countdownTimers[model] = setTimeout(tick, 1000);
}
function stopTimeoutBar(model) {
  clearTimeout(countdownTimers[model]);
  delete countdownTimers[model];
  const cdEl = document.getElementById('cd-' + model);
  if (cdEl) cdEl.style.display = 'none';
}

function cancelPrompt() {
  if (activeReader) { activeReader.cancel(); activeReader = null; }
  document.querySelectorAll('.response-card.loading').forEach(card => {
    card.classList.remove('loading');
    const rt = card.querySelector('.response-text');
    rt.textContent = 'Cancelled';
    rt.style.color = 'var(--muted)';
    rt.style.fontStyle = 'italic';
    const model = card.id.replace('card-', '');
    stopTimeoutBar(model);
  });
  document.getElementById('cancel-btn').classList.remove('visible');
  document.getElementById('send-btn').disabled = false;
}

async function sendPrompt() {
  const prompt = document.getElementById('prompt-input').value.trim();
  if (!prompt) return;
  const grid = document.getElementById('response-grid');
  grid.innerHTML = '';
  document.getElementById('synthesis-panel').style.display = 'none';
  // Build model list from DOM chip order — cloud first, local after, dynamic ollama: chips last.
  //
  // Why DOM-driven instead of a hardcoded array:
  //   A hardcoded MODEL_ORDER array was the source of a class of bugs where
  //   adding a new chip in HTML required also updating the JS array — and
  //   forgetting meant the new model was silently dropped from prompts.
  //   Reading order from the DOM means adding a chip in HTML is the only
  //   step required. The rendering order IS the firing order.
  // This means adding a new chip in HTML is all that's needed — no JS list to maintain
  const CLOUD_CHIP_KEYS = new Set(['gemini', 'anthropic', 'openai']);
  const allChips   = [...document.querySelectorAll('.model-chip[data-model]')];
  const chipOrder  = allChips.map(c => c.dataset.model);
  const cloudFirst = chipOrder.filter(m => CLOUD_CHIP_KEYS.has(m) && activeModels.has(m));
  const localRest  = chipOrder.filter(m => !CLOUD_CHIP_KEYS.has(m) && activeModels.has(m));
  const models     = [...cloudFirst, ...localRest];
  models.forEach(model => grid.appendChild(makeCard(model)));
  document.getElementById('cancel-btn').classList.add('visible');
  document.getElementById('send-btn').disabled = true;
  try {
    const res = await fetch('/api/prompt', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ prompt, models, synthesis_model: document.getElementById('synthesis-model-select')?.value || 'deepseek' })
    });
    const reader  = res.body.getReader();
    activeReader  = reader;
    const decoder = new TextDecoder();
    let   buffer  = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        let evt;
        try { evt = JSON.parse(line); } catch(e) { continue; }
        if (evt.event === 'heartbeat') continue;
        if (evt.event === 'start') {
          const card = document.getElementById('card-' + evt.model);
          if (card) card.classList.add('loading');
          cardStartTimes[evt.model] = Date.now();
          startCardCountdown(evt.model);
          startLiveTimer(evt.model);
        } else if (evt.event === 'result') {
          const card = document.getElementById('card-' + evt.model);
          if (card) {
            card.classList.remove('loading');
            stopTimeoutBar(evt.model);
            stopLiveTimer(evt.model);
            card.querySelector('.response-text').textContent = evt.text;
            const elapsed = cardStartTimes[evt.model] ? ((Date.now() - cardStartTimes[evt.model]) / 1000).toFixed(1) : null;
            const timingEl = document.getElementById('timing-' + evt.model);
            if (timingEl && elapsed) { timingEl.style.display = 'block'; timingEl.textContent = '\u23f1 ' + elapsed + 's'; }
          }
        } else if (evt.event === 'error') {
          const card = document.getElementById('card-' + evt.model);
          if (card) {
            card.classList.remove('loading');
            stopTimeoutBar(evt.model);
            stopLiveTimer(evt.model);
            const rt = card.querySelector('.response-text');
            const isTimeout = evt.error && evt.error.toLowerCase().includes('timed out');
            rt.textContent = isTimeout ? '\u23f1 Timed out — model took too long' : '\u26a0 ' + evt.error;
            rt.style.color = '#c94242';
            const elapsedErr = cardStartTimes[evt.model] ? ((Date.now() - cardStartTimes[evt.model]) / 1000).toFixed(1) : null;
            const timingErrEl = document.getElementById('timing-' + evt.model);
            if (timingErrEl && elapsedErr) { timingErrEl.style.display = 'block'; timingErrEl.textContent = '\u23f1 ' + elapsedErr + 's'; }
          }
        } else if (evt.event === 'synthesis_start') {
          const panel = document.getElementById('synthesis-panel');
          const text  = document.getElementById('synthesis-text');
          panel.style.display = 'block';
          panel.classList.add('pulsing');
          text.style.color = 'var(--muted)';
          text.style.fontStyle = 'italic';
          const splineMessages = [
            'Reticulating splines\u2026',
            'Triangulating research vectors\u2026',
            'Mapping consensus nodes\u2026',
            'Calibrating divergence fields\u2026',
            'Weaving argument threads\u2026',
            'Identifying epistemic gaps\u2026',
            'Conbobulating obfusticators\u2026',
          ];
          text.textContent = splineMessages[Math.floor(Math.random() * splineMessages.length)];
        } else if (evt.event === 'synthesis') {
          const panel = document.getElementById('synthesis-panel');
          const text  = document.getElementById('synthesis-text');
          panel.classList.remove('pulsing');
          text.style.color     = 'var(--text)';
          text.style.fontStyle = 'normal';
          _lastSynthesis = evt.text;
          renderSynthesisSections(evt.text, text);
        } else if (evt.event === 'done') {
          document.getElementById('cancel-btn').classList.remove('visible');
          document.getElementById('send-btn').disabled = false;
          activeReader = null;
          if (evt.anthropic_cost_usd !== undefined) {
            const el = document.getElementById('cost-display');
            el.textContent = 'Claude: $' + evt.anthropic_cost_usd.toFixed(4);
            el.classList.toggle('nonzero', evt.anthropic_cost_usd > 0);
          }
          if (evt.session_saved && models.length === 1) {
            const panel = document.getElementById('synthesis-panel');
            const text  = document.getElementById('synthesis-text');
            panel.style.display = 'block';
            text.style.color = 'var(--muted)';
            text.style.fontStyle = 'italic';
            text.textContent = 'Single model \u2014 no synthesis. Session saved.';
          }
        }
      }
    }
  } catch(e) {
    if (e.name !== 'AbortError')
      grid.innerHTML = '<div style="color:#c94242;font-family:monospace;font-size:12px">Error: ' + e.message + '</div>';
    document.getElementById('cancel-btn').classList.remove('visible');
    document.getElementById('send-btn').disabled = false;
    activeReader = null;
  }
}


// ── References ────────────────────────────────────────────────────────────
const loadRefs = () => loadReferences();
async function loadReferences() {
  const res = await fetch('/api/references');
  allRefs = await res.json();
  document.getElementById('ref-count').textContent = allRefs.length + ' sources';
  renderRefs();
}
function filterRefs() { renderRefs(); }
function setFilter(btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeFilter = btn.dataset.filter;
  renderRefs();
}

function populateRefProjectFilter(projects) {
  const sel = document.getElementById('ref-project-filter');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">All projects</option>';
  projects.forEach(p => {
    const slug = p.slug || p.name || (p._filename || '').replace('.md','');
    const opt  = document.createElement('option');
    opt.value       = slug;
    opt.textContent = (p.label || slug) + ' — ' + slug;
    sel.appendChild(opt);
  });
  if (current) sel.value = current;
}

function updateFilterLabels() {
  const counts = { all: allRefs.length, verified: 0, located: 0, surfaced: 0 };
  const lastChanged = { verified: null, located: null, surfaced: null };
  allRefs.forEach(r => {
    const s = r.verification_status || 'surfaced';
    if (counts[s] !== undefined) counts[s]++;
    if (r.updated_at) {
      const ts = r.updated_at.slice(0, 16).replace('T', ' ');
      if (!lastChanged[s] || ts > lastChanged[s]) lastChanged[s] = ts;
    }
  });
  const btn_all = document.getElementById('filter-all');
  if (btn_all) btn_all.textContent = 'all (' + counts.all + ')';
  ['verified','located','surfaced'].forEach(s => {
    const btn = document.getElementById('filter-' + s);
    if (!btn) return;
    const ts = lastChanged[s] ? ' · ' + lastChanged[s] + ' UTC' : '';
    btn.textContent = s + (counts[s] ? ' (' + counts[s] + ')' : '') + ts;
  });
}

function renderRefs() {
  const q       = document.getElementById('ref-search').value.toLowerCase();
  const slug    = (document.getElementById('ref-project-filter')?.value || '').trim();
  const list    = document.getElementById('ref-list');
  list.innerHTML = '';
  const filtered = allRefs.filter(r => {
    const matchFilter  = activeFilter === 'all' || r.verification_status === activeFilter;
    const matchSearch  = !q || [r.title, r.authors, r.themes].some(f => f && f.toLowerCase().includes(q));
    const matchProject = !slug || (r.conn_list || []).some(line => line.split('|')[0].trim() === slug);
    return matchFilter && matchSearch && matchProject;
  });
  document.getElementById('ref-count').textContent = filtered.length + ' of ' + allRefs.length + ' sources';
  if (!filtered.length) {
    list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);font-family:monospace;font-size:12px">No references match</div>';
    return;
  }
  filtered.forEach(ref => {
    const status = ref.verification_status || 'surfaced';
    const color  = STATUS_COLORS[status] || '#888';
    const card   = document.createElement('div');
    card.className = 'ref-card';
    card.style.borderLeftColor = color;

    // Identity row
    const topRow = document.createElement('div');
    topRow.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:12px';
    const left = document.createElement('div');
    left.style.cssText = 'flex:1;min-width:0';
    const authorEl = document.createElement('div');
    authorEl.className = 'ref-author';
    authorEl.textContent = (ref.authors || '') + ' (' + (ref.year || '') + ')';
    const titleEl = document.createElement('div');
    titleEl.className = 'ref-title';
    titleEl.textContent = (ref.title || '').replace(/<[^>]+>/g, '');
    left.appendChild(authorEl);
    left.appendChild(titleEl);
    const statusBadge = document.createElement('span');
    statusBadge.className = 'ref-status-badge status-' + status;
    statusBadge.textContent = status;
    statusBadge.title = 'Click to change status';
    statusBadge.style.cssText = 'flex-shrink:0;cursor:pointer';
    statusBadge.onclick = () => cycleRefStatus(ref._filename || '', statusBadge);
    topRow.appendChild(left);
    topRow.appendChild(statusBadge);
    card.appendChild(topRow);

    // Tags + connections
    const tagsList = (ref.tags || '').split(',').map(t => t.trim()).filter(Boolean);
    const connList = ref.conn_list || [];
    if (tagsList.length || connList.length) {
      const tagRow = document.createElement('div');
      tagRow.className = 'ref-tags';
      tagsList.forEach(t => {
        const chip = document.createElement('span');
        chip.className = 'tag';
        chip.style.cssText = 'background:var(--accent)22;color:var(--accent);border:1px solid var(--accent)44';
        chip.textContent = t;
        tagRow.appendChild(chip);
      });
      connList.forEach(c => {
        const name = c.split('|')[0].trim();
        const chip = document.createElement('span');
        chip.className = 'tag';
        chip.title = c;
        chip.style.cssText = 'background:#4285f411;color:#4285f4;border:1px solid #4285f433;font-size:10px';
        chip.textContent = '⬡ ' + name;
        tagRow.appendChild(chip);
      });
      card.appendChild(tagRow);
    }

    // Actions
    const actions = document.createElement('div');
    actions.className = 'ref-actions';
    const launchBtn = document.createElement('button');
    launchBtn.className = 'ref-action';
    launchBtn.innerHTML = 'Launch Prompt &#8594;';
    launchBtn.onclick = () => launchPromptFromRef(ref._filename || '');
    const annotateBtn = document.createElement('button');
    annotateBtn.className = 'ref-action';
    annotateBtn.innerHTML = '&#9670; Annotate';
    annotateBtn.onclick = function() { openEditModal(ref, true); };
    const editBtn = document.createElement('button');
    editBtn.className = 'ref-action';
    editBtn.textContent = 'Edit';
    editBtn.onclick = () => openEditModal(ref);
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'ref-action ref-action-danger';
    deleteBtn.textContent = '\u2715 Delete';
    deleteBtn.onclick = () => deleteRef(ref._filename || '', deleteBtn);
    actions.appendChild(launchBtn);
    actions.appendChild(annotateBtn);
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    card.appendChild(actions);

    // Details
    const hasDetails = (ref.theme_list && ref.theme_list.length) ||
                       ref.annotation || ref.user_notes || ref.argument_connection;
    if (hasDetails) {
      const sep = document.createElement('hr');
      sep.style.cssText = 'border:none;border-top:1px solid var(--border);margin:10px 0 8px';
      card.appendChild(sep);
    }
    if (ref.theme_list && ref.theme_list.length) {
      const label = document.createElement('div');
      label.style.cssText = 'font-size:10px;font-family:monospace;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:4px';
      label.textContent = 'Themes';
      const el = document.createElement('div');
      el.style.cssText = 'font-size:12px;color:var(--muted);line-height:1.6;margin-bottom:6px';
      const visible = ref.theme_list.slice(0, 2);
      const rest    = ref.theme_list.slice(2);
      el.textContent = visible.join(' · ') + (rest.length ? ' +' + rest.length + ' more' : '');
      el.title = ref.theme_list.join('\n');
      card.appendChild(label); card.appendChild(el);
    }
    if (ref.annotation) {
      const label = document.createElement('div');
      label.style.cssText = 'font-size:10px;font-family:monospace;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:4px';
      label.textContent = 'AI Annotation';
      const el = document.createElement('div');
      el.className = 'ref-annotation-preview';
      el.textContent = ref.annotation.length > 300 ? ref.annotation.slice(0, 300) + '\u2026' : ref.annotation;
      card.appendChild(label); card.appendChild(el);
    }
    if (ref.user_notes) {
      const label = document.createElement('div');
      label.style.cssText = 'font-size:10px;font-family:monospace;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:8px 0 4px';
      label.textContent = 'Your Annotation';
      const el = document.createElement('div');
      el.className = 'ref-annotation-preview';
      el.textContent = ref.user_notes.length > 300 ? ref.user_notes.slice(0, 300) + '\u2026' : ref.user_notes;
      card.appendChild(label); card.appendChild(el);
    }
    if (ref.argument_connection) {
      const label = document.createElement('div');
      label.style.cssText = 'font-size:10px;font-family:monospace;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:8px 0 4px';
      label.textContent = 'Argument Connection';
      const el = document.createElement('div');
      el.className = 'ref-argument-preview';
      el.textContent = ref.argument_connection.length > 200 ? ref.argument_connection.slice(0, 200) + '\u2026' : ref.argument_connection;
      card.appendChild(label); card.appendChild(el);
    }

    // Holding location
    if (ref.holding_location && ref.holding_location !== '') {
      const holdEl = document.createElement('div');
      holdEl.style.cssText = 'font-size:11px;font-family:monospace;color:var(--muted);margin-top:6px';
      holdEl.textContent = '\u2117 ' + ref.holding_location +
        (ref.physical_holding && ref.physical_holding !== 'none' ? ' (' + ref.physical_holding + ')' : '');
      card.appendChild(holdEl);
    }

    // Footer
    const footerEl = document.createElement('div');
    footerEl.style.cssText = 'font-size:10px;font-family:monospace;color:var(--muted);margin-top:10px;padding-top:6px;border-top:1px solid var(--border);line-height:1.8';
    const created = (ref.created_at || '').slice(0,16).replace('T',' ');
    let footerLines = [];
    if (created) footerLines.push('Added ' + created + ' UTC');
    if (ref.last_status_change) footerLines.push('Status: ' + ref.last_status_change);
    if (ref.last_edit) footerLines.push('Edited: ' + ref.last_edit);
    footerEl.textContent = footerLines.join(' · ');
    if (footerLines.length) card.appendChild(footerEl);

    list.appendChild(card);
  });
  updateFilterLabels();
}


// ── DOI lookup ────────────────────────────────────────────────────────────
async function lookupDOI() {
  const doi = document.getElementById('doi-input').value.trim();
  if (!doi) return;
  const btn = document.querySelector('.doi-row .btn-secondary');
  btn.textContent = 'Looking up...'; btn.disabled = true;
  try {
    const res  = await fetch('/api/doi-lookup', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ doi }) });
    const data = await res.json();
    if (data._error) { alert('DOI not found: ' + data._error); }
    else {
      doiPreviewData = data;
      document.getElementById('doi-preview-title').textContent = data.title || '(no title)';
      document.getElementById('doi-preview-meta').textContent =
        (data.authors || '') + (data.year ? ' · ' + data.year : '') + (data.source_type ? ' · ' + data.source_type : '');
      document.getElementById('doi-preview').style.display = 'block';
    }
  } catch(e) { alert('Lookup failed: ' + e.message); }
  btn.textContent = 'Look up'; btn.disabled = false;
}
async function importDOIPreview() {
  if (!doiPreviewData) return;
  await fetch('/api/references', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(doiPreviewData) });
  closeDOIPreview();
  loadReferences();
}
function closeDOIPreview() {
  document.getElementById('doi-preview').style.display = 'none';
  doiPreviewData = null;
  document.getElementById('doi-input').value = '';
}


// ── File import ───────────────────────────────────────────────────────────
function handleDragOver(e)  { e.preventDefault(); document.getElementById('drop-zone').classList.add('drag-over'); }
function handleDragLeave()  { document.getElementById('drop-zone').classList.remove('drag-over'); }
function handleDrop(e)      { e.preventDefault(); document.getElementById('drop-zone').classList.remove('drag-over'); const file = e.dataTransfer.files[0]; if (file) uploadFile(file); }
function handleFileSelect(e){ const file = e.target.files[0]; if (file) uploadFile(file); }

async function uploadFile(file) {
  const resultEl  = document.getElementById('file-import-result');
  const dropZone  = document.getElementById('drop-zone');
  resultEl.style.display = 'none';
  dropZone.querySelector('.import-drop-label').textContent = 'Importing ' + file.name + '...';
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res  = await fetch('/api/import', { method: 'POST', body: formData });
    const data = await res.json();
    showImportResult(resultEl, data);
    dropZone.querySelector('.import-drop-label').textContent = 'Click to choose a file or drag and drop';
    loadReferences();
  } catch(e) {
    resultEl.className = 'import-result error'; resultEl.style.display = 'block';
    resultEl.textContent = 'Upload failed: ' + e.message;
    dropZone.querySelector('.import-drop-label').textContent = 'Click to choose a file or drag and drop';
  }
}


// ── Paste import ──────────────────────────────────────────────────────────
function selectFormat(btn) {
  document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  pasteFormat = btn.dataset.fmt;
  const placeholders = {
    bibtex:    '@article{key,\n  title={...},\n  author={...},\n  year={2024}\n}',
    ris:       'TY  - JOUR\nTI  - Title\nAU  - Author, Name\nPY  - 2024\nER  -',
    csv:       'title,authors,year,source_type\nMy Paper,Smith J,2024,journal',
    doi:       '10.1234/example\n10.5678/another\nhttps://doi.org/10.9999/third',
    plaintext: 'Smith, J. (2024). The title of the paper. Journal Name, 12(3), 45-67.\nJones, A. & Brown, B. (2023). Another paper. Book Publisher.'
  };
  document.getElementById('paste-input').placeholder = placeholders[pasteFormat] || '';
}

async function runPasteImport() {
  const text = document.getElementById('paste-input').value.trim();
  if (!text) return;
  const resultEl = document.getElementById('paste-import-result');
  resultEl.style.display = 'none';
  const btn = document.querySelector('#view-ingest .import-section:nth-child(2) .btn-primary');
  btn.textContent = 'Importing...'; btn.disabled = true;
  try {
    const res  = await fetch('/api/import', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ format: pasteFormat, text }) });
    const data = await res.json();
    showImportResult(resultEl, data);
    if (data.imported > 0) { document.getElementById('paste-input').value = ''; loadReferences(); }
  } catch(e) {
    resultEl.className = 'import-result error'; resultEl.style.display = 'block';
    resultEl.textContent = 'Import failed: ' + e.message;
  }
  btn.textContent = 'Import \u2192'; btn.disabled = false;
}

function showImportResult(el, data) {
  if (data.error) { el.className = 'import-result error'; el.style.display = 'block'; el.textContent = 'Error: ' + data.error; return; }
  el.className = 'import-result success'; el.style.display = 'block';
  let msg = data.imported + ' reference' + (data.imported !== 1 ? 's' : '') + ' imported';
  if (data.skipped > 0) msg += ', ' + data.skipped + ' skipped (no title)';
  if (data.errors && data.errors.length) msg += ', ' + data.errors.length + ' error(s)';
  el.textContent = msg;
}


// ── Add Reference Panel ───────────────────────────────────────────────────
function openAddPanel()  { document.getElementById('add-ref-panel').classList.add('open'); }
function closeAddPanel() { document.getElementById('add-ref-panel').classList.remove('open'); }
function updateStatus() {
  document.getElementById('ref-status').value =
    ['physical','pdf','ebook','library-access'].includes(document.getElementById('ref-holding').value)
      ? 'located' : 'surfaced';
}
async function saveReference() {
  const data = {
    title: document.getElementById('ref-title').value,
    authors: document.getElementById('ref-authors').value,
    year: document.getElementById('ref-year').value,
    source_type: document.getElementById('ref-type').value,
    url_doi: document.getElementById('ref-doi').value,
    physical_holding: document.getElementById('ref-holding').value,
    verification_status: document.getElementById('ref-status').value,
    themes: document.getElementById('ref-themes').value,
    annotation: document.getElementById('ref-annotation').value,
    argument_connection: document.getElementById('ref-argument').value
  };
  if (!data.title || !data.authors || !data.year) { alert('Title, Authors, and Year are required.'); return; }
  await fetch('/api/references', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
  closeAddPanel();
  loadReferences();
}


// ── Reference status cycle ────────────────────────────────────────────────
const STATUS_CYCLE = ['surfaced', 'located', 'verified'];
async function cycleRefStatus(filename, badge) {
  if (!filename) return;
  const current = badge.textContent.trim();
  const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length];
  try {
    const res = await fetch('/api/references/' + encodeURIComponent(filename) + '/status', {
      method: 'PATCH', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ status: next })
    });
    const data = await res.json();
    if (data.verification_status) {
      const newStatus = data.verification_status;
      badge.textContent = newStatus;
      badge.className = 'ref-status-badge status-' + newStatus;
      const card = badge.closest('.ref-card');
      if (card) card.style.borderLeftColor = STATUS_COLORS[newStatus] || '#888';
      const ref = allRefs.find(r => r._filename === filename);
      if (ref) { ref.verification_status = newStatus; ref.updated_at = new Date().toISOString(); }
      updateFilterLabels();
    }
  } catch(e) { console.error('Status update failed:', e); }
}


// ── Delete reference ──────────────────────────────────────────────────────
async function deleteRef(filename, btn) {
  if (!filename) return;
  if (!confirm('Delete this reference? This cannot be undone.')) return;
  btn.textContent = 'Deleting…'; btn.disabled = true;
  try {
    const res  = await fetch('/api/references/' + encodeURIComponent(filename), { method: 'DELETE' });
    const data = await res.json();
    if (data.status === 'deleted') { await loadRefs(); }
    else { btn.textContent = '✕ Delete'; btn.disabled = false; alert(data.error || 'Delete failed'); }
  } catch(e) { btn.textContent = '✕ Delete'; btn.disabled = false; }
}


// ── Edit modal ────────────────────────────────────────────────────────────
let editingFilename = null;
function openEditModal(ref, runAnnotate) {
  editingFilename = ref._filename || null;
  document.getElementById('edit-title').value              = ref.title || '';
  document.getElementById('edit-authors').value            = ref.authors || '';
  document.getElementById('edit-year').value               = ref.year || '';
  document.getElementById('edit-type').value               = ref.source_type || 'journal';
  document.getElementById('edit-doi').value                = ref.url_doi || '';
  document.getElementById('edit-tags').value               = ref.tags || '';
  document.getElementById('edit-status').value             = ref.verification_status || 'surfaced';
  document.getElementById('edit-holding').value            = ref.physical_holding || 'none';
  document.getElementById('edit-holding-location').value   = ref.holding_location || '';
  document.getElementById('edit-themes-body').value        = ref.themes_body || (ref.themes ? ref.themes.split(',').map(t => '- ' + t.trim()).join('\n') : '');
  document.getElementById('edit-connections').value        = ref.connections || '';
  document.getElementById('edit-annotation').value         = ref.annotation || '';
  document.getElementById('edit-user-notes').value         = ref.user_notes || '';
  document.getElementById('edit-argument').value           = ref.argument_connection || '';
  document.getElementById('edit-modal').style.display      = 'flex';
  if (runAnnotate) setTimeout(() => annotateInModal(ref._filename), 300);
}
function closeEditModal() {
  document.getElementById('edit-modal').style.display = 'none';
  editingFilename = null;
}
async function saveEdit() {
  if (!editingFilename) return;
  const btn = document.getElementById('edit-save-btn');
  btn.textContent = 'Saving…'; btn.disabled = true;
  const payload = {
    title:               document.getElementById('edit-title').value.trim(),
    authors:             document.getElementById('edit-authors').value.trim(),
    year:                document.getElementById('edit-year').value.trim(),
    source_type:         document.getElementById('edit-type').value,
    url_doi:             document.getElementById('edit-doi').value.trim(),
    tags:                document.getElementById('edit-tags').value.trim(),
    verification_status: document.getElementById('edit-status').value,
    physical_holding:    document.getElementById('edit-holding').value,
    holding_location:    document.getElementById('edit-holding-location').value.trim(),
    themes_body:         document.getElementById('edit-themes-body').value.trim(),
    connections:         document.getElementById('edit-connections').value.trim(),
    annotation:          document.getElementById('edit-annotation').value.trim(),
    user_notes:          document.getElementById('edit-user-notes').value.trim(),
    argument_connection: document.getElementById('edit-argument').value.trim(),
  };
  try {
    const res  = await fetch('/api/references/' + encodeURIComponent(editingFilename), {
      method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.status === 'updated') { closeEditModal(); await loadRefs(); }
    else { alert(data.error || 'Save failed'); }
  } catch(e) { alert('Save failed: ' + e.message); }
  btn.textContent = 'Save'; btn.disabled = false;
}


// ── Annotation ────────────────────────────────────────────────────────────
async function annotateInModal(filename) {
  if (!filename) return;
  const btn = document.getElementById('edit-annotate-btn');
  if (btn) { btn.textContent = 'Annotating…'; btn.disabled = true; }
  const localModels = [...activeModels].filter(m => ['deepseek','qwen','mistral','cohere','gemma','llama'].includes(m));
  const allActive   = [...activeModels];
  const models      = localModels.length > 0 ? localModels.slice(0,2) : allActive.length > 0 ? allActive.slice(0,1) : ['deepseek'];
  try {
    const res  = await fetch('/api/references/' + encodeURIComponent(filename) + '/annotate', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ models })
    });
    const data = await res.json();
    if (data.status === 'annotated') {
      document.getElementById('edit-annotation').value = data.synthesis || '';
      if (btn) { btn.textContent = '✓ Done'; setTimeout(() => { btn.textContent = '◆ Generate'; btn.disabled = false; }, 2000); }
    } else {
      if (btn) { btn.textContent = '⚠ ' + (data.error || 'Failed'); btn.disabled = false; }
    }
  } catch(e) {
    if (btn) { btn.textContent = '⚠ Error'; btn.disabled = false; }
  }
}

async function annotateRef(filename, btn) {
  if (!filename) return;
  const originalText = btn.textContent;
  btn.textContent = 'Annotating\u2026'; btn.disabled = true;
  const localModels = [...activeModels].filter(m => ['deepseek','qwen','mistral','cohere','gemma','llama'].includes(m));
  const allActive   = [...activeModels];
  const models      = localModels.length > 0 ? localModels.slice(0,2) : allActive.length > 0 ? allActive.slice(0,1) : ['deepseek'];
  try {
    const res  = await fetch('/api/references/' + encodeURIComponent(filename) + '/annotate', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ models })
    });
    const data = await res.json();
    if (data.status === 'annotated') {
      btn.textContent = '\u2713 Annotated'; btn.style.color = 'var(--verified)';
      await loadRefs();
      setTimeout(() => { btn.textContent = originalText; btn.style.color = ''; btn.disabled = false; }, 3000);
    } else {
      btn.textContent = '\u26a0 ' + (data.error || 'Failed'); btn.style.color = '#c94242';
      setTimeout(() => { btn.textContent = originalText; btn.style.color = ''; btn.disabled = false; }, 4000);
    }
  } catch(e) {
    btn.textContent = '\u26a0 ' + e.message; btn.style.color = '#c94242';
    setTimeout(() => { btn.textContent = originalText; btn.style.color = ''; btn.disabled = false; }, 4000);
  }
}


// ── Library intelligence (alias — do not remove) ──────────────────────────
function runLibrarySynthesis() { runIntelSynthesis(); }


// ── Tag and connection autocomplete ──────────────────────────────────────
let _allTags = [], _allConns = [];
async function loadAutocomplete() {
  try {
    const [tr, cr] = await Promise.all([fetch('/api/tags'), fetch('/api/connections')]);
    _allTags  = await tr.json();
    _allConns = await cr.json();
  } catch(e) {}
}
loadAutocomplete();

function tagAutocomplete(input) {
  const parts   = input.value.split(',');
  const current = parts[parts.length - 1].trim().toLowerCase();
  const box     = document.getElementById('tag-suggestions');
  if (!current || current.length < 1) { box.style.display = 'none'; return; }
  const matches = _allTags.filter(t => t.startsWith(current) && !parts.slice(0,-1).map(p=>p.trim()).includes(t));
  if (!matches.length) { box.style.display = 'none'; return; }
  box.innerHTML = '';
  matches.slice(0,6).forEach(m => {
    const opt = document.createElement('div');
    opt.style.cssText = 'padding:5px 10px;cursor:pointer;font-size:12px;font-family:monospace';
    opt.textContent = m;
    opt.onmousedown = (e) => {
      e.preventDefault();
      parts[parts.length - 1] = m;
      input.value = parts.join(', ') + ', ';
      box.style.display = 'none';
    };
    box.appendChild(opt);
  });
  box.style.display = 'block';
}

function connAutocomplete(textarea) {
  const lines   = textarea.value.split('\n');
  const current = lines[lines.length - 1].split('|')[0].trim().toLowerCase();
  const box     = document.getElementById('conn-suggestions');
  if (!current || current.length < 1) { box.style.display = 'none'; return; }
  const matches = _allConns.filter(c => c.startsWith(current));
  if (!matches.length) { box.style.display = 'none'; return; }
  box.innerHTML = '';
  matches.slice(0,5).forEach(m => {
    const opt = document.createElement('div');
    opt.style.cssText = 'padding:5px 10px;cursor:pointer;font-size:12px;font-family:monospace';
    opt.textContent = m;
    opt.onmousedown = (e) => {
      e.preventDefault();
      lines[lines.length - 1] = m + ' | ';
      textarea.value = lines.join('\n');
      box.style.display = 'none';
    };
    box.appendChild(opt);
  });
  box.style.display = 'block';
}

document.addEventListener('click', () => {
  const tb = document.getElementById('tag-suggestions');
  const cb = document.getElementById('conn-suggestions');
  if (tb) tb.style.display = 'none';
  if (cb) cb.style.display = 'none';
});

function launchPromptFromRef(filename) {
  const ref = allRefs.find(r => r._filename === filename);
  if (!ref) return;
  showView('prompt', document.querySelectorAll('.nav-btn')[0]);
  const input = document.getElementById('prompt-input');
  input.value = 'Analyse this source in the context of embodied learning and intellectual risk-taking in undergraduates:\n\n' +
    ref.authors + ' (' + ref.year + '). ' + ref.title + '.\n\nThemes: ' + (ref.themes || 'not specified');
  input.dispatchEvent(new Event('input'));
}


// ── Projects ──────────────────────────────────────────────────────────────
async function loadProjects() {
  const res  = await fetch('/api/projects');
  const data = await res.json();
  const list = document.getElementById('project-list');
  if (!data.length) {
    list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);font-family:monospace;font-size:12px">No projects yet — create one above, or add a connection slug to a reference</div>';
    return;
  }
  populateRefProjectFilter(data);
  populateSynthProjectDropdown(data);
  populateNoteProjectFilter(data);
  list.innerHTML = '';
  data.forEach(p => {
    const slug  = p.slug || p.name || (p._filename || '').replace('.md','');
    const label = p.label || slug;
    const card  = document.createElement('div');
    card.style.cssText = 'border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:6px;padding:14px 16px;margin-bottom:10px;background:var(--surface)';
    const headerRow = document.createElement('div');
    headerRow.style.cssText = 'display:flex;align-items:baseline;justify-content:space-between;margin-bottom:4px';
    const labelEl = document.createElement('div');
    labelEl.style.cssText = 'font-family:Georgia,serif;font-size:15px;font-weight:bold;color:var(--text)';
    labelEl.textContent = label;
    const rightRow = document.createElement('div');
    rightRow.style.cssText = 'display:flex;gap:6px;align-items:center';
    const slugChip = document.createElement('span');
    slugChip.style.cssText = 'font-family:monospace;font-size:10px;color:var(--accent);background:var(--accent)11;border:1px solid var(--accent)44;padding:2px 7px;border-radius:3px';
    slugChip.textContent = slug;
    const editBtn = document.createElement('button');
    editBtn.className = 'ref-action';
    editBtn.textContent = 'Edit';
    editBtn.onclick = () => openProjectEdit(p);
    rightRow.appendChild(slugChip); rightRow.appendChild(editBtn);
    headerRow.appendChild(labelEl); headerRow.appendChild(rightRow);
    const framingEl = document.createElement('div');
    framingEl.style.cssText = 'font-size:12px;color:var(--muted);font-style:italic;margin:6px 0 8px';
    framingEl.textContent = p.framing || '— no framing set';
    const refsEl = document.createElement('div');
    refsEl.style.cssText = 'font-size:11px;font-family:monospace;color:var(--muted)';
    if (p.ref_count) {
      refsEl.textContent = p.ref_count + ' connected reference' + (p.ref_count !== 1 ? 's' : '');
      if (p.ref_titles && p.ref_titles.length) {
        const titlesEl = document.createElement('div');
        titlesEl.style.cssText = 'font-size:10px;color:var(--muted);margin-top:3px';
        titlesEl.textContent = p.ref_titles.join(' · ') + (p.ref_count > 5 ? ' +more' : '');
        refsEl.appendChild(titlesEl);
      }
    } else {
      refsEl.textContent = 'No references connected yet — add this slug to a reference\u2019s Connections field';
    }
    const footerEl = document.createElement('div');
    footerEl.style.cssText = 'font-size:10px;font-family:monospace;color:var(--muted);margin-top:8px;padding-top:6px;border-top:1px solid var(--border)';
    footerEl.textContent = 'Created ' + (p.created_at || '').slice(0,16).replace('T',' ') + ' UTC';
    card.appendChild(headerRow); card.appendChild(framingEl);
    card.appendChild(refsEl); card.appendChild(footerEl);
    list.appendChild(card);
  });
  // Populate intelligence project filter
  const sel = document.getElementById('intelligence-project-filter');
  if (sel) {
    sel.innerHTML = '<option value="">All references</option>';
    data.forEach(p => {
      const opt  = document.createElement('option');
      const slug = p.slug || p.name || p._filename.replace('.md','');
      opt.value = slug;
      opt.textContent = (p.label || slug) + ' (' + slug + ')';
      sel.appendChild(opt);
    });
  }
}

function createProject() {
  const label     = document.getElementById('new-project-label').value.trim();
  if (!label) return;
  const slugInput = document.getElementById('new-project-slug');
  if (!slugInput.value.trim())
    slugInput.value = label.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,30);
  document.getElementById('new-project-framing').style.display = 'block';
}
function cancelNewProject() {
  document.getElementById('new-project-framing').style.display = 'none';
  document.getElementById('new-project-label').value = '';
  document.getElementById('new-project-slug').value  = '';
}
async function saveNewProject() {
  const label   = document.getElementById('new-project-label').value.trim();
  const slug    = document.getElementById('new-project-slug').value.trim();
  const framing = document.getElementById('project-framing-input').value.trim();
  if (!label && !slug) return;
  await fetch('/api/projects', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ label, slug, framing }) });
  document.getElementById('new-project-label').value = '';
  document.getElementById('new-project-slug').value  = '';
  document.getElementById('project-framing-input').value = '';
  document.getElementById('new-project-framing').style.display = 'none';
  loadProjects();
  loadAutocomplete();
}

let _editingProjectSlug = null;
function openProjectEdit(p) {
  _editingProjectSlug = p.slug || p.name || p._filename.replace('.md','');
  document.getElementById('proj-edit-label').value   = p.label || _editingProjectSlug;
  document.getElementById('proj-edit-slug').value    = p.slug || _editingProjectSlug;
  document.getElementById('proj-edit-framing').value = p.framing || '';
  document.getElementById('proj-edit-modal').style.display = 'flex';
}
function closeProjectEdit() {
  document.getElementById('proj-edit-modal').style.display = 'none';
  _editingProjectSlug = null;
}
async function saveProjectEdit() {
  if (!_editingProjectSlug) return;
  const btn = document.getElementById('proj-edit-save-btn');
  btn.textContent = 'Saving…'; btn.disabled = true;
  await fetch('/api/projects/' + encodeURIComponent(_editingProjectSlug), {
    method: 'PUT', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      label:   document.getElementById('proj-edit-label').value.trim(),
      slug:    document.getElementById('proj-edit-slug').value.trim(),
      framing: document.getElementById('proj-edit-framing').value.trim()
    })
  });
  btn.textContent = 'Save'; btn.disabled = false;
  closeProjectEdit();
  loadProjects();
}


// ── Writing ───────────────────────────────────────────────────────────────
const WRITING_TYPE_LABELS = {
  blog: 'Blog post', conference: 'Conference paper', chapter: 'Dissertation chapter',
  grant: 'Grant', journal: 'Journal article', other: 'Other'
};
async function loadWriting() {
  const res  = await fetch('/api/writing');
  const data = await res.json();
  const list = document.getElementById('writing-list');
  if (!data.length) {
    list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);font-family:monospace;font-size:12px">No writing elements yet</div>';
    return;
  }
  list.innerHTML = '';
  data.forEach(w => {
    const card = document.createElement('div');
    card.style.cssText = 'border:1px solid var(--border);border-radius:6px;padding:14px 16px;margin-bottom:10px;background:var(--surface)';
    const top = document.createElement('div');
    top.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px';
    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-family:Georgia,serif;font-size:14px;font-weight:bold;color:var(--text)';
    titleEl.textContent = w.title || '';
    const typeEl = document.createElement('span');
    typeEl.style.cssText = 'font-family:monospace;font-size:10px;color:var(--muted);background:var(--bg);border:1px solid var(--border);padding:2px 7px;border-radius:3px';
    typeEl.textContent = WRITING_TYPE_LABELS[w.type] || w.type || 'other';
    top.appendChild(titleEl); top.appendChild(typeEl);
    const editBtn = document.createElement('button');
    editBtn.className = 'ref-action';
    editBtn.textContent = 'Edit';
    editBtn.onclick = () => openWritingEdit(w);
    top.appendChild(editBtn);
    const meta = document.createElement('div');
    meta.style.cssText = 'font-size:11px;font-family:monospace;color:var(--muted)';
    meta.textContent = (w.slug || '') + (w.project ? ' · ' + w.project : '') + ' · ' + (w.status || 'drafting');
    card.appendChild(top); card.appendChild(meta);
    list.appendChild(card);
  });
}

let _editingWritingSlug = null;
function openWritingEdit(w) {
  _editingWritingSlug = w.slug || w._filename.replace('.md','');
  document.getElementById('writing-edit-title').value   = w.title || '';
  document.getElementById('writing-edit-slug').value    = w.slug || _editingWritingSlug;
  document.getElementById('writing-edit-type').value    = w.type || 'other';
  document.getElementById('writing-edit-project').value = w.project || '';
  document.getElementById('writing-edit-status').value  = w.status || 'drafting';
  document.getElementById('writing-edit-modal').style.display = 'flex';
}
function closeWritingEdit() {
  document.getElementById('writing-edit-modal').style.display = 'none';
  _editingWritingSlug = null;
}
async function saveWritingEdit() {
  if (!_editingWritingSlug) return;
  const btn = document.getElementById('writing-edit-save-btn');
  btn.textContent = 'Saving…'; btn.disabled = true;
  await fetch('/api/writing/' + encodeURIComponent(_editingWritingSlug), {
    method: 'PUT', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      title:   document.getElementById('writing-edit-title').value.trim(),
      slug:    document.getElementById('writing-edit-slug').value.trim(),
      type:    document.getElementById('writing-edit-type').value,
      project: document.getElementById('writing-edit-project').value.trim(),
      status:  document.getElementById('writing-edit-status').value
    })
  });
  btn.textContent = 'Save'; btn.disabled = false;
  closeWritingEdit();
  loadWriting();
}

async function createWriting() {
  const title   = document.getElementById('new-writing-title').value.trim();
  const type    = document.getElementById('new-writing-type').value;
  const slug    = document.getElementById('new-writing-slug').value.trim();
  const project = document.getElementById('new-writing-project').value.trim();
  if (!title) return;
  await fetch('/api/writing', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ title, type, slug, project }) });
  document.getElementById('new-writing-title').value   = '';
  document.getElementById('new-writing-slug').value    = '';
  document.getElementById('new-writing-project').value = '';
  loadWriting();
}


// ── Intelligence ──────────────────────────────────────────────────────────
let _intelMode     = 'library';
// _lastSynthesis holds the raw text of the most recent synthesis output.
// Used by saveSynthesis() and saveSynthesisToProject() to save to canonical
// without re-reading the DOM (which now contains rendered cards, not text).
let _lastSynthesis = '';
let _intelAbort    = null;

function setIntelMode(mode, btn) {
  _intelMode = mode;
  document.querySelectorAll('#intel-mode-library, #intel-mode-sessions, #intel-mode-both, #intel-mode-predict')
    .forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const descs = {
    library:  'Themes, tensions, absent voices, and conversations across your connected sources',
    sessions: 'Recurring questions, evolution of thinking, and unresolved threads across your sessions',
    both:     'Full picture — references and sessions synthesised together',
    predict:  'What am I missing? Argument weaknesses, unasked questions, examiner challenges'
  };
  const descEl = document.getElementById('intel-mode-desc');
  if (descEl) descEl.textContent = descs[mode];
}

function cancelIntelSynthesis() {
  if (_intelAbort) { _intelAbort.abort(); _intelAbort = null; }
  const textEl    = document.getElementById('library-synthesis-text');
  const cancelBtn = document.getElementById('intel-cancel-btn');
  const runBtn    = document.getElementById('intel-run-btn');
  if (textEl)    { textEl.innerHTML = ''; textEl.style.fontStyle = 'italic'; textEl.style.color = 'var(--muted)'; textEl.textContent = 'Cancelled — model may still be running locally.'; }
  if (cancelBtn) cancelBtn.style.display = 'none';
  if (runBtn)    runBtn.disabled = false;
}

// Renders synthesis output as colour-coded section cards.
// Expects ## HEADER format from the model — splits on /\n##\s+/.
// Each section title maps to a colour in sectionColors.
// If the model ignores the format (returns plain text or numbered lists),
// falls back to plain text rendering — no error, just less visual structure.
// The colour assignments are not arbitrary: red=tension/conflict,
// blue=patterns/recurring, purple=absence/missing, green=connection/conversation.
function renderSynthesisSections(raw, container) {
  container.innerHTML = '';
  const sectionColors = {
    'CONSENSUS':            '#3d8b37',
    'DIVERGENCE':           '#c94242',
    'UNIQUE CONTRIBUTIONS': '#4285f4',
    'RECURRING THEMES':     '#4285f4',
    'RECURRING QUESTIONS':  '#4285f4',
    'TENSIONS':             '#c94242',
    'ABSENT VOICES':        '#6e56cf',
    'CONVERSATIONS':        '#3d8b37',
    'UNRESOLVED':           '#c9a832',
    'EVOLUTION':            '#0891b2',
    'MOMENTUM':             '#52c41a',
    'RESEARCH QUESTION FIT':'#8b4513',
    'UNASKED QUESTIONS':    '#6e56cf',
    'ARGUMENT WEAKNESSES':  '#c94242',
    'MISSING PERSPECTIVES': '#0891b2',
    'EXAMINER CHALLENGES':  '#c9a832',
    'NEXT MOVES':           '#3d8b37',
  };
  const parts = raw.split(/\n##\s+/);
  const preamble = parts[0].trim();
  if (preamble && !preamble.startsWith('##')) {
    const pre = document.createElement('div');
    pre.style.cssText = 'font-size:12px;color:var(--muted);font-style:italic;margin-bottom:12px;line-height:1.6';
    pre.textContent = preamble;
    container.appendChild(pre);
  }
  parts.slice(1).forEach(part => {
    const nl = part.indexOf('\n');
    if (nl === -1) return;
    const title   = part.slice(0, nl).trim().toUpperCase();
    const content = part.slice(nl + 1).trim();
    if (!content) return;
    const color = sectionColors[title] || 'var(--accent)';
    const card  = document.createElement('div');
    card.style.cssText = `border:1px solid var(--border);border-left:3px solid ${color};border-radius:4px;padding:12px 14px;margin-bottom:10px;background:var(--surface)`;
    const heading = document.createElement('div');
    heading.style.cssText = `font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:${color};margin-bottom:8px`;
    heading.textContent = title.charAt(0) + title.slice(1).toLowerCase().replace(/_/g,' ');
    const body = document.createElement('div');
    body.style.cssText = 'font-size:12px;color:var(--text);line-height:1.7;white-space:pre-wrap';
    body.textContent = content;
    card.appendChild(heading);
    card.appendChild(body);
    container.appendChild(card);
  });
  if (container.children.length === 0) {
    container.style.cssText = 'white-space:pre-wrap;font-size:12px;line-height:1.7';
    container.textContent = raw;
  }
}

async function runIntelSynthesis() {
  const project   = (document.getElementById('intelligence-project-filter')?.value || '').trim();
  const panel     = document.getElementById('library-synthesis-panel');
  const textEl    = document.getElementById('library-synthesis-text');
  const label     = document.getElementById('library-synthesis-label');
  const note      = document.getElementById('intel-scope-note');
  const saveBtn   = document.getElementById('save-synthesis-btn');
  const cancelBtn = document.getElementById('intel-cancel-btn');
  const runBtn    = document.getElementById('intel-run-btn');

  panel.classList.add('visible');
  textEl.innerHTML = '';
  textEl.style.color = 'var(--muted)';
  textEl.style.fontStyle = 'italic';
  textEl.textContent = 'Reading your research\u2026 DeepSeek R1 is mapping your collection.';
  if (label)     label.textContent       = '\u25C6 Synthesis';
  if (note)      note.textContent        = '';
  if (saveBtn)   saveBtn.style.display   = 'none';
  if (cancelBtn) cancelBtn.style.display = 'inline-block';
  if (runBtn)    runBtn.disabled         = true;

  _intelAbort = new AbortController();
  const signal = _intelAbort.signal;
  const results = {};

  try {
    if (_intelMode === 'library' || _intelMode === 'both') {
      const res  = await fetch('/api/references/library-synthesis', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ project, model: document.getElementById('intel-model-select')?.value || 'deepseek' }), signal
      });
      const data = await res.json();
      if (data.error) results.library = '\u26a0 References: ' + data.error;
      else { results.library = data.synthesis; results.refCount = data.ref_count; }
    }
    if (_intelMode === 'sessions' || _intelMode === 'both') {
      const res  = await fetch('/api/sessions/synthesis', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ project, model: document.getElementById('intel-model-select')?.value || 'deepseek' }), signal
      });
      const data = await res.json();
      if (data.error) results.sessions = '\u26a0 Sessions: ' + data.error;
      else { results.sessions = data.synthesis; results.sessionCount = data.session_count; }
    }

    if (_intelMode === 'predict') {
      const res  = await fetch('/api/sessions/predict', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ project, model: document.getElementById('intel-model-select')?.value || 'deepseek' }), signal
      });
      const data = await res.json();
      if (data.error) results.predict = '\u26a0 ' + data.error;
      else { results.predict = data.synthesis; results.sessionCount = data.session_count; }
    }
  } catch(e) {
    if (e.name === 'AbortError') return;
    textEl.textContent = '\u26a0 Error: ' + e.message;
    textEl.style.color = '#c94242';
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (runBtn)    runBtn.disabled = false;
    return;
  }

  _intelAbort = null;
  if (cancelBtn) cancelBtn.style.display = 'none';
  if (runBtn)    runBtn.disabled = false;

  let raw = '';
  if (_intelMode === 'both' && results.library && results.sessions) {
    raw = results.library + '\n\n## SESSIONS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n' + results.sessions;
  } else if (_intelMode === 'predict') {
    raw = results.predict || '\u26a0 No results returned.';
  } else {
    raw = results.library || results.sessions || '\u26a0 No results returned.';
  }

  _lastSynthesis = raw;
  textEl.style.fontStyle = 'normal';
  textEl.style.color     = 'var(--text)';
  renderSynthesisSections(raw, textEl);

  const parts = [];
  if (results.refCount     !== undefined) parts.push(results.refCount + ' references');
  if (results.sessionCount !== undefined) parts.push(results.sessionCount + ' sessions');
  const scopeLabel = project ? 'project: ' + project : 'all projects';
  if (note) note.textContent = parts.join(' \u00b7 ') + ' \u00b7 ' + scopeLabel;
  if (saveBtn && project) saveBtn.style.display = 'inline-block';
}

async function loadIntelligenceProjects() {
  const res  = await fetch('/api/projects');
  const data = await res.json();
  const sel  = document.getElementById('intelligence-project-filter');
  if (!sel) return;
  sel.innerHTML = '<option value="">All projects \u2014 full library &amp; all sessions</option>';
  data.forEach(p => {
    const opt  = document.createElement('option');
    const slug = p.slug || p.name || (p._filename || '').replace('.md','');
    opt.value       = slug;
    opt.textContent = (p.label || slug) + ' \u2014 ' + slug;
    sel.appendChild(opt);
  });
}

async function saveSynthesis() {
  const project = (document.getElementById('intelligence-project-filter')?.value || '').trim();
  if (!project || !_lastSynthesis) return;
  const btn = document.getElementById('save-synthesis-btn');
  btn.textContent = 'Saving\u2026'; btn.disabled = true;
  await fetch('/api/projects/' + encodeURIComponent(project) + '/synthesis', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ synthesis: _lastSynthesis })
  });
  btn.textContent = 'Saved \u2713';
  setTimeout(() => { btn.textContent = 'Save to project'; btn.disabled = false; }, 2000);
}

// ── Broadcast ─────────────────────────────────────────────────────────────
async function checkBroadcast() {
  try {
    const res  = await fetch('/api/broadcast');
    const data = await res.json();
    if (data.title) {
      document.getElementById('broadcast-text').textContent = data.title + ' \u2014 ' + data.body;
      document.getElementById('broadcast-banner').style.display = 'flex';
    }
  } catch(e) {}
}


// ── First-run setup check ─────────────────────────────────────────────────
async function checkSetupStatus() {
  try {
    const res  = await fetch('/api/setup-status');
    const data = await res.json();
    if (!data.configured) document.getElementById('setup-warning').style.display = 'block';
  } catch(e) {}
}
function dismissSetup() {
  document.getElementById('setup-warning').style.display = 'none';
}


// ── Save & Break ──────────────────────────────────────────────────────────
async function saveAndBreak() {
  const btn = document.getElementById('save-break-btn');
  btn.textContent = 'Saving...'; btn.disabled = true;
  const res  = await fetch('/api/save-break', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ message: 'Session \u2014 ' + new Date().toISOString().slice(0,16) })
  });
  const data = await res.json();
  btn.textContent = data.status === 'committed' ? 'Saved \u2713' : '\u26A0 Check terminal';
  btn.disabled = false;
  if (data.warnings && data.warnings.length) alert('Saved with warnings:\n\n' + data.warnings.join('\n'));
  setTimeout(() => { btn.textContent = '\u2191 Save & Take a Break'; }, 3000);
}


// ── Session timer — silent save every 30 min, note prompt every 2 hours ──
async function silentSave() {
  try {
    await fetch('/api/save-break', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ message: 'Auto-save \u2014 ' + new Date().toISOString().slice(0,16) })
    });
  } catch(e) {}
}

function showSessionNotePrompt() {
  document.getElementById('session-note-input').value = '';
  document.getElementById('session-note-overlay').style.display = 'flex';
}

async function submitSessionNote() {
  const note = document.getElementById('session-note-input').value.trim();
  const btn  = document.getElementById('session-note-submit');
  btn.textContent = 'Saving\u2026'; btn.disabled = true;
  try {
    await fetch('/api/save-break', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ message: note || 'Session note \u2014 ' + new Date().toISOString().slice(0,16) })
    });
  } catch(e) {}
  document.getElementById('session-note-overlay').style.display = 'none';
  btn.textContent = 'Save & Continue'; btn.disabled = false;
}

function dismissSessionNote() {
  document.getElementById('session-note-overlay').style.display = 'none';
}

setInterval(() => {
  sessionMinutes++;
  const h = Math.floor(sessionMinutes / 60), m = sessionMinutes % 60;
  document.getElementById('session-time').textContent =
    h > 0 ? 'Session: ' + h + 'h' + (m > 0 ? ' ' + m + 'm' : '') : 'Session: ' + m + 'm';

  // Silent save every 30 min
  if (sessionMinutes % 30 === 0) silentSave();

  // Session note prompt every 2 hours
  if (sessionMinutes % 120 === 0) showSessionNotePrompt();
}, 60000);


// ── Prompt synthesis save to project ─────────────────────────────────────
async function saveSynthesisToProject() {
  const project  = document.getElementById('synth-save-project')?.value?.trim();
  if (!project) { alert('Select a project first.'); return; }
  const synthesis = _lastSynthesis;
  if (!synthesis) return;
  const btn    = document.getElementById('synth-save-btn');
  const status = document.getElementById('synth-save-status');
  btn.disabled = true;
  try {
    await fetch('/api/projects/' + encodeURIComponent(project) + '/synthesis', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ synthesis })
    });
    if (status) { status.style.display = 'inline'; setTimeout(() => { status.style.display = 'none'; }, 3000); }
  } catch(e) { alert('Save failed: ' + e.message); }
  btn.disabled = false;
}

function populateSynthProjectDropdown(projects) {
  const sel = document.getElementById('synth-save-project');
  if (!sel) return;
  sel.innerHTML = '<option value="">Save to project\u2026</option>';
  projects.forEach(p => {
    const slug = p.slug || p.name || (p._filename || '').replace('.md','');
    const opt  = document.createElement('option');
    opt.value       = slug;
    opt.textContent = p.label || slug;
    sel.appendChild(opt);
  });
}


// ── PDF folder scan ───────────────────────────────────────────────────────
async function scanPDFFolder() {
  const path     = document.getElementById('pdf-folder-path')?.value?.trim() || '';
  const resultEl = document.getElementById('pdf-scan-result');
  const ocrEl    = document.getElementById('pdf-ocr-needed');
  resultEl.className = 'import-result'; resultEl.style.display = 'none';
  if (ocrEl) ocrEl.style.display = 'none';
  const btn = document.querySelector('[onclick="scanPDFFolder()"]');
  if (btn) { btn.textContent = 'Scanning\u2026'; btn.disabled = true; }
  try {
    const res  = await fetch('/api/ingest/scan-pdf-folder', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ path })
    });
    const data = await res.json();
    if (data.error) {
      resultEl.className = 'import-result error'; resultEl.style.display = 'block';
      resultEl.textContent = data.error;
    } else {
      resultEl.className = 'import-result success'; resultEl.style.display = 'block';
      resultEl.textContent = data.message;
      if (data.ocr_needed && data.ocr_needed.length) {
        ocrEl.style.display  = 'block';
        ocrEl.textContent    = '\u26a0 ' + data.ocr_needed.length + ' file(s) need Gemma OCR \u2014 drop them in Capture below: ' + data.ocr_needed.slice(0,5).join(', ') + (data.ocr_needed.length > 5 ? ' +more' : '');
      }
      if (data.imported > 0) loadReferences();
    }
  } catch(e) {
    resultEl.className = 'import-result error'; resultEl.style.display = 'block';
    resultEl.textContent = 'Scan failed: ' + e.message;
  }
  if (btn) { btn.textContent = '\u{1F4C4} Scan'; btn.disabled = false; }
}


// ── Capture OCR ───────────────────────────────────────────────────────────
function handleCaptureDragOver(e) { e.preventDefault(); document.getElementById('capture-drop-zone').classList.add('drag-over'); }
function handleCaptureDragLeave() { document.getElementById('capture-drop-zone').classList.remove('drag-over'); }
function handleCaptureDrop(e)     { e.preventDefault(); document.getElementById('capture-drop-zone').classList.remove('drag-over'); const f = e.dataTransfer.files[0]; if (f) runCapture(f); }
function handleCaptureSelect(e)   { const f = e.target.files[0]; if (f) runCapture(f); }

async function runCapture(file) {
  const label    = document.getElementById('capture-drop-label');
  const resultEl = document.getElementById('capture-result');
  const preview  = document.getElementById('capture-text-preview');
  const note     = document.getElementById('capture-note')?.value?.trim() || '';
  resultEl.style.display = 'none';
  preview.style.display  = 'none';

  // Clear any previous action buttons
  const existingActions = document.getElementById('capture-actions');
  if (existingActions) existingActions.remove();

  const isPDF = file.name.toLowerCase().endsWith('.pdf');
  label.textContent = isPDF
    ? 'Extracting\u2026 typed PDF: seconds \u00b7 scanned: Gemma OCR ~15\u201345s'
    : 'Running Gemma 4 OCR\u2026 (~15\u201345s)';

  const formData = new FormData();
  formData.append('file', file);
  formData.append('note', note);

  try {
    const res  = await fetch('/api/ingest/ocr', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.error) {
      resultEl.className = 'import-result error'; resultEl.style.display = 'block';
      resultEl.textContent = data.error;
    } else {
      resultEl.className = 'import-result success'; resultEl.style.display = 'block';
      resultEl.textContent = data.message;
      preview.style.display = 'block';
      preview.textContent   = data.text;

      // Action buttons — save extracted text as Note or Reference
      const actions = document.createElement('div');
      actions.id = 'capture-actions';
      actions.style.cssText = 'display:flex;gap:8px;margin-top:10px;align-items:center';

      const saveNoteBtn = document.createElement('button');
      saveNoteBtn.className = 'btn-primary';
      saveNoteBtn.style.fontSize = '11px';
      saveNoteBtn.textContent = '\u9670 Save as Note';
      saveNoteBtn.onclick = () => captureToNote(data.text, file.name, note);

      const saveRefBtn = document.createElement('button');
      saveRefBtn.className = 'btn-secondary';
      saveRefBtn.style.fontSize = '11px';
      saveRefBtn.textContent = '\u2117 Save as Reference';
      saveRefBtn.onclick = () => captureToReference(data.text, file.name);

      const hint = document.createElement('span');
      hint.style.cssText = 'font-family:monospace;font-size:10px;color:var(--muted)';
      hint.textContent = 'Note = your thinking \u00b7 Reference = someone else\u2019s work';

      actions.appendChild(saveNoteBtn);
      actions.appendChild(saveRefBtn);
      actions.appendChild(hint);
      preview.parentNode.insertBefore(actions, preview.nextSibling);
    }
  } catch(e) {
    resultEl.className = 'import-result error'; resultEl.style.display = 'block';
    resultEl.textContent = 'Capture failed: ' + e.message;
  }
  label.textContent = 'Click to choose or drag and drop';
}

function captureToNote(text, filename, contextNote) {
  // Pre-fill note editor and switch to Notes tab
  const titleInput = document.getElementById('new-note-title');
  const bodyInput  = document.getElementById('new-note-body');
  const sourceInput = document.getElementById('new-note-source');
  if (titleInput)  titleInput.value  = filename.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
  if (sourceInput) sourceInput.value = filename;
  if (bodyInput)   bodyInput.value   = text;
  // Also pre-fill context note if provided
  if (contextNote && document.getElementById('new-note-body')) {
    document.getElementById('new-note-body').value = contextNote
      ? contextNote + '\n\n---\n\n' + text
      : text;
  }
  // Switch to Notes tab
  const notesBtn = document.querySelector('[onclick*="notes"]');
  showView('notes', notesBtn);
  // Scroll to new note form
  setTimeout(() => {
    if (titleInput) titleInput.focus();
  }, 100);
}

function captureToReference(text, filename) {
  // Pre-fill the Add Reference panel with extracted text as annotation
  openAddPanel();
  const titleInput = document.getElementById('ref-title');
  const annoInput  = document.getElementById('ref-annotation');
  if (titleInput) titleInput.value = filename.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
  if (annoInput)  annoInput.value  = text.slice(0, 1000); // annotation field limit
}


// ── Notes ─────────────────────────────────────────────────────────────────
let allNotes = [];

async function loadNotes() {
  const res  = await fetch('/api/notes');
  allNotes   = await res.json();
  renderNotes();
}

function filterNotes() { renderNotes(); }

function renderNotes() {
  const q       = (document.getElementById('note-search')?.value || '').toLowerCase();
  const project = (document.getElementById('note-project-filter')?.value || '').trim();
  const list    = document.getElementById('note-list');
  if (!list) return;
  const filtered = allNotes.filter(n => {
    const matchSearch  = !q || [n.title, n.body, n.questions, n.connections, n.source].some(f => f && f.toLowerCase().includes(q));
    const matchProject = !project || (n.project || '').trim() === project;
    return matchSearch && matchProject;
  });
  if (!filtered.length) {
    list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);font-family:monospace;font-size:12px">No notes match</div>';
    return;
  }
  list.innerHTML = '';
  filtered.forEach(note => {
    const card = document.createElement('div');
    card.style.cssText = 'border:1px solid var(--border);border-left:3px solid var(--surfaced);border-radius:4px;padding:12px 14px;margin-bottom:8px;background:var(--surface)';
    // Header
    const topRow = document.createElement('div');
    topRow.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px';
    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-family:Georgia,serif;font-size:14px;font-weight:bold;color:var(--text)';
    titleEl.textContent = note.title || '';
    const metaEl = document.createElement('div');
    metaEl.style.cssText = 'font-family:monospace;font-size:10px;color:var(--muted)';
    metaEl.textContent = (note.created_at || '').slice(0,10);
    topRow.appendChild(titleEl);
    topRow.appendChild(metaEl);
    card.appendChild(topRow);
    // Chips
    const chips = [
      note.source  ? { label: '\u2117 ' + note.source,  color: '#4285f4' } : null,
      note.project ? { label: '\u25c6 ' + note.project, color: 'var(--accent)' } : null,
      note.writing ? { label: '\u270e ' + note.writing, color: '#0891b2' } : null,
    ].filter(Boolean);
    if (chips.length) {
      const chipRow = document.createElement('div');
      chipRow.style.cssText = 'margin-bottom:8px';
      chips.forEach(c => {
        const chip = document.createElement('span');
        chip.className = 'tag';
        chip.style.cssText = `background:${c.color}18;color:${c.color};border:1px solid ${c.color}44`;
        chip.textContent = c.label;
        chipRow.appendChild(chip);
      });
      card.appendChild(chipRow);
    }
    // Body preview
    if (note.body) {
      const bodyEl = document.createElement('div');
      bodyEl.style.cssText = 'font-size:12px;color:var(--text);line-height:1.7;margin-bottom:8px;font-family:Georgia,serif';
      bodyEl.textContent = note.body.length > 300 ? note.body.slice(0,300) + '\u2026' : note.body;
      card.appendChild(bodyEl);
    }
    // Questions preview
    if (note.questions) {
      const qEl = document.createElement('div');
      qEl.style.cssText = 'font-size:11px;color:var(--muted);font-style:italic;border-left:2px solid var(--border);padding-left:8px;margin-bottom:8px';
      qEl.textContent = note.questions.length > 150 ? note.questions.slice(0,150) + '\u2026' : note.questions;
      card.appendChild(qEl);
    }
    // Actions
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:6px;margin-top:6px';
    const editBtn = document.createElement('button');
    editBtn.className = 'ref-action';
    editBtn.textContent = 'Edit';
    editBtn.onclick = () => openNoteEdit(note);
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'ref-action ref-action-danger';
    deleteBtn.textContent = '\u2715 Delete';
    deleteBtn.onclick = () => deleteNote(note._filename, deleteBtn);
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    card.appendChild(actions);
    list.appendChild(card);
  });
}

async function saveNote() {
  const title   = document.getElementById('new-note-title')?.value?.trim();
  const source  = document.getElementById('new-note-source')?.value?.trim() || '';
  const project = document.getElementById('new-note-project')?.value?.trim() || '';
  const writing = document.getElementById('new-note-writing')?.value?.trim() || '';
  const body    = document.getElementById('new-note-body')?.value?.trim() || '';
  if (!title) { alert('Title required.'); return; }
  await fetch('/api/notes', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ title, source, project, writing, body })
  });
  document.getElementById('new-note-title').value  = '';
  document.getElementById('new-note-source').value = '';
  document.getElementById('new-note-project').value = '';
  document.getElementById('new-note-writing').value = '';
  document.getElementById('new-note-body').value   = '';
  loadNotes();
}

let _editingNoteFilename = null;
function openNoteEdit(note) {
  _editingNoteFilename = note._filename;
  document.getElementById('note-edit-title').value       = note.title || '';
  document.getElementById('note-edit-source').value      = note.source || '';
  document.getElementById('note-edit-project').value     = note.project || '';
  document.getElementById('note-edit-writing').value     = note.writing || '';
  document.getElementById('note-edit-body').value        = note.body || '';
  document.getElementById('note-edit-questions').value   = note.questions || '';
  document.getElementById('note-edit-connections').value = note.connections || '';
  document.getElementById('note-edit-modal').style.display = 'flex';
}
function closeNoteEdit() {
  document.getElementById('note-edit-modal').style.display = 'none';
  _editingNoteFilename = null;
}
async function saveNoteEdit() {
  if (!_editingNoteFilename) return;
  const btn = document.getElementById('note-edit-save-btn');
  btn.textContent = 'Saving\u2026'; btn.disabled = true;
  await fetch('/api/notes/' + encodeURIComponent(_editingNoteFilename), {
    method: 'PUT', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      title:       document.getElementById('note-edit-title').value.trim(),
      source:      document.getElementById('note-edit-source').value.trim(),
      project:     document.getElementById('note-edit-project').value.trim(),
      writing:     document.getElementById('note-edit-writing').value.trim(),
      body:        document.getElementById('note-edit-body').value.trim(),
      questions:   document.getElementById('note-edit-questions').value.trim(),
      connections: document.getElementById('note-edit-connections').value.trim(),
    })
  });
  btn.textContent = 'Save'; btn.disabled = false;
  closeNoteEdit();
  loadNotes();
}
async function deleteNote(filename, btn) {
  if (!filename) return;
  if (!confirm('Delete this note? This cannot be undone.')) return;
  btn.textContent = 'Deleting\u2026'; btn.disabled = true;
  await fetch('/api/notes/' + encodeURIComponent(filename), { method: 'DELETE' });
  loadNotes();
}

function populateNoteProjectFilter(projects) {
  const sel = document.getElementById('note-project-filter');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">All projects</option>';
  projects.forEach(p => {
    const slug = p.slug || p.name || (p._filename || '').replace('.md','');
    const opt  = document.createElement('option');
    opt.value       = slug;
    opt.textContent = p.label || slug;
    sel.appendChild(opt);
  });
  if (current) sel.value = current;
}


// ── Init ──────────────────────────────────────────────────────────────────
checkBroadcast();
updateLocalWarning();
checkKeyStatus();
checkSetupStatus();
checkLocalModels();
