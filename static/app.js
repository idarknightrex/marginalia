// ── Marginalia — app.js ───────────────────────────────────────────────────
// All frontend logic. Loaded by templates/index.html via <script src>.
// Organized sections: State · Navigation · Model chips · Prompt · References
//                     Import · Projects · Writing · Intelligence · Session
// ─────────────────────────────────────────────────────────────────────────

// ── State ─────────────────────────────────────────────────────────────────
// Cloud models start inactive — checkKeyStatus() activates only those with
// valid keys. Local models (Ollama) start active — no key required.
let allRefs = [], activeFilter = 'all', sessionMinutes = 0;
let activeModels = new Set(['deepseek']);  // HTML default; checkKeyStatus adds cloud chips with valid keys
let doiPreviewData = null;
let pasteFormat = 'bibtex';

const STATUS_COLORS = { verified: '#3d8b37', located: '#c9a832', surfaced: '#6e56cf', imported: '#4285f4', rejected: '#c94242' };
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
  if (name === 'references')   loadProjects();
  populateProjectSlugs();
  initFontSize();
  if (name === 'writing')      loadWriting();
  if (name === 'notes')        loadNotes();
  if (name === 'intelligence') loadIntelligenceProjects();
  if (name === 'ingest')       loadResearcherContext();
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  if (btn) btn.classList.add('active');
  if (name === 'references') { loadReferences(); checkAcademicHealth(); }
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
      const isCloud = ['gemini','anthropic','openai'].includes(model);
      if (keys[model] === false) {
        // No key — mark disabled, ensure inactive
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
      } else if (isCloud && keys[model] === true) {
        // Key present — activate this cloud chip
        chip.classList.remove('no-key', 'inactive');
        chip.classList.add('active');
        activeModels.add(model);
        const badge = chip.querySelector('.no-key-badge');
        if (badge) badge.remove();
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
        chip.classList.remove('no-key', 'inactive');
        chip.classList.add('active');
        activeModels.add(model);
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


function setLocalOnly() {
  // Deactivate all cloud chips, activate all installed local chips
  const CLOUD = new Set(['gemini','anthropic','openai']);
  document.querySelectorAll('.model-chip[data-model]').forEach(chip => {
    const model = chip.dataset.model;
    if (CLOUD.has(model)) {
      chip.classList.remove('active');
      chip.classList.add('inactive');
      activeModels.delete(model);
    } else if (!chip.classList.contains('no-key') && chip.closest('.chip-wrapper')?.style.display !== 'none') {
      chip.classList.add('active');
      chip.classList.remove('inactive');
      activeModels.add(model);
    }
  });
  updateLocalWarning();
}
document.addEventListener('DOMContentLoaded', function() {
  const promptInput = document.getElementById('prompt-input');
  if (promptInput) {
    promptInput.addEventListener('input', function() {
      const text   = this.value;
      const layers = text.split('+++');
      const counts = layers.map(l => Math.round(l.trim().split(/\s+/).filter(Boolean).length * 1.3));
      const total  = counts.reduce((a, b) => a + b, 0);
      const estEl  = document.getElementById('token-estimate');

      if (layers.length > 1) {
        // Show per-layer breakdown
        const parts   = counts.map((c, i) => (i === layers.length - 1 ? `<strong>${c}</strong>` : c));
        const finalPct = total > 0 ? counts[counts.length - 1] / total : 1;
        let label = `~${total} tokens (${parts.join(' + ')})`;
        if (finalPct < 0.2 && total > 50) {
          label += ' <span style="color:#c9a832" title="Final prompt is less than 20% of total context — models may weight the context layers more heavily than your question">⚠ final prompt light</span>';
          // Show focus button
          let focusBtn = document.getElementById('focus-prompt-btn');
          if (!focusBtn) {
            focusBtn = document.createElement('button');
            focusBtn.id = 'focus-prompt-btn';
            focusBtn.className = 'hide-inactive-btn';
            focusBtn.textContent = '⊙ Focus final';
            focusBtn.dataset.tooltip = 'Inject a focus instruction before the final prompt block so models weight it appropriately';
            focusBtn.onclick = injectFocusInstruction;
            estEl.parentNode.insertBefore(focusBtn, estEl.nextSibling);
          }
        } else {
          document.getElementById('focus-prompt-btn')?.remove();
        }
        estEl.innerHTML = label;
      } else {
        document.getElementById('focus-prompt-btn')?.remove();
        estEl.textContent = '~' + Math.round(text.trim().split(/\s+/).filter(Boolean).length * 1.3) + ' tokens';
      }
    });
  }
  // Apply saved font size on load
  initFontSize();
});

// ── Focus instruction injection ───────────────────────────────────────────────
// When the final prompt block is short relative to the context stack, models
// may weight the context more than the actual question. This injects a focus
// instruction before the final block to signal what the model should prioritise.
// Invisible in the model's output — a server-side concern made visible to the
// researcher as an optional one-click fix.
function injectFocusInstruction() {
  const input  = document.getElementById('prompt-input');
  if (!input) return;
  const FOCUS  = '[FOCUS: The following short prompt is the primary question. Use the context above as background only. Answer what is asked specifically, not what the context suggests.]';
  const layers = input.value.split('+++');
  if (layers.length < 2) return;
  // Insert focus instruction before the final block
  layers[layers.length - 1] = '\n' + FOCUS + '\n\n' + layers[layers.length - 1].trim();
  input.value = layers.join('+++');
  input.dispatchEvent(new Event('input'));
  document.getElementById('focus-prompt-btn')?.remove();
}

// ── Countdown bar durations ───────────────────────────────────────────────────
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

// ── Prompt state cleanup ──────────────────────────────────────────────────────
// Clears all animation, loading, and timer state from the previous prompt run.
// Called at the start of every sendPrompt to ensure a clean slate.
function cleanupPromptState() {
  // Stop all countdown timers
  Object.keys(countdownTimers).forEach(model => {
    clearTimeout(countdownTimers[model]);
    delete countdownTimers[model];
  });
  // Stop all card timer intervals
  Object.keys(cardTimerIntervals).forEach(model => {
    clearInterval(cardTimerIntervals[model]);
    delete cardTimerIntervals[model];
  });
  // Remove loading class from any lingering cards
  document.querySelectorAll('.response-card.loading').forEach(card => {
    card.classList.remove('loading');
  });
  // Remove pulsing from synthesis panel
  const panel = document.getElementById('synthesis-panel');
  if (panel) panel.classList.remove('pulsing');
  // Clear cancel button
  document.getElementById('cancel-btn')?.classList.remove('visible');
  // Reset send button
  document.getElementById('send-btn').disabled = false;
  // Cancel active reader if somehow still alive
  if (activeReader) { try { activeReader.cancel(); } catch(e) {} activeReader = null; }
  // Clear no-project nudge from previous session
  document.getElementById('no-project-nudge')?.remove();
  // Clear pre-flight panel if it exists
  document.getElementById('preflight-panel')?.remove();
}

async function sendPrompt() {
  const prompt = document.getElementById('prompt-input').value.trim();
  if (!prompt) return;
  cleanupPromptState();
  const grid = document.getElementById('response-grid');
  grid.innerHTML = '';
  document.getElementById('synthesis-panel').style.display = 'none';
  const CLOUD_CHIP_KEYS = new Set(['gemini', 'anthropic', 'openai']);
  const allChips   = [...document.querySelectorAll('.model-chip[data-model]')];
  const chipOrder  = allChips.map(c => c.dataset.model);
  const cloudFirst = chipOrder.filter(m => CLOUD_CHIP_KEYS.has(m) && activeModels.has(m));
  const localRest  = chipOrder.filter(m => !CLOUD_CHIP_KEYS.has(m) && activeModels.has(m));
  const models     = [...cloudFirst, ...localRest];
  if (!models.length) {
    grid.innerHTML = '<div style="color:#c9a832;font-family:monospace;font-size:12px;padding:12px">No active models — select at least one chip above before sending.</div>';
    return;
  }
  models.forEach(model => grid.appendChild(makeCard(model)));
  document.getElementById('cancel-btn').classList.add('visible');
  document.getElementById('send-btn').disabled = true;
  try {
    const res = await fetch('/api/prompt', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        prompt:           prompt,
        full_prompt:      prompt,
        models,
        synthesis_model:  document.getElementById('synthesis-model-select')?.value || 'deepseek',
        num_predict:      parseInt(document.getElementById('output-length-select')?.value || '-1'),
        project:          document.getElementById('session-project-select')?.value || '',
        writing:          document.getElementById('session-writing-select')?.value || '',
        synthesis_context: getSynthesisContext(),
      })
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
            'Surfacing what the council missed\u2026',
            'Finding where the outliers sit\u2026',
            'Reading the shape of disagreement\u2026',
          ];
          let msgIdx = Math.floor(Math.random() * splineMessages.length);
          text.textContent = splineMessages[msgIdx];
          const msgInterval = setInterval(() => {
            if (!panel.classList.contains('pulsing')) { clearInterval(msgInterval); return; }
            msgIdx = (msgIdx + 1) % splineMessages.length;
            text.textContent = splineMessages[msgIdx];
          }, 4000);
        } else if (evt.event === 'synthesis') {
          const panel = document.getElementById('synthesis-panel');
          const text  = document.getElementById('synthesis-text');
          panel.classList.remove('pulsing');
          text.style.color     = 'var(--text)';
          text.style.fontStyle = 'normal';
          _lastSynthesis = evt.text;
          renderSynthesisSections(evt.text, text);
          // Collect all model response text for refs chunk
          const allResponseText = [...document.querySelectorAll('.response-text')]
            .map(el => el.textContent).join(' ');
          renderSynthesisRefsChunk(
            document.getElementById('prompt-input')?.value || '',
            allResponseText,
            evt.text
          );
          showRelatedSessions();
          // Show cycling nudge banner
          const nudge = document.getElementById('synth-cycle-nudge');
          if (nudge) nudge.style.display = 'block';
          // Show inject checkbox with bias warning
          const synthModel = document.getElementById('synthesis-model-select')?.value || 'deepseek';
          showSynthesisInjectRow(synthModel, document.getElementById('synthesis-mode-select')?.value || 'survey');
        } else if (evt.event === 'done') {
        setTimeout(highlightAuthorsInResponses, 200);
          document.getElementById('cancel-btn').classList.remove('visible');
          document.getElementById('send-btn').disabled = false;
          activeReader = null;
          // Track the saved session filename for retroactive project write-back
          if (evt.session_filename) window._lastSessionFilename = evt.session_filename;
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
          // Gentle nudge if no project was selected when session was saved
          const activeProject = document.getElementById('session-project-select')?.value?.trim();
          if (evt.session_saved && !activeProject) {
            const synthPanel = document.getElementById('synthesis-panel');
            if (synthPanel) {
              let nudgeEl = document.getElementById('no-project-nudge');
              if (!nudgeEl) {
                nudgeEl = document.createElement('div');
                nudgeEl.id = 'no-project-nudge';
                nudgeEl.style.cssText = 'font-family:monospace;font-size:10px;color:var(--muted);margin-top:8px;padding:6px 8px;border:1px solid var(--border);border-radius:3px;background:var(--surface)';
                synthPanel.appendChild(nudgeEl);
              }
              nudgeEl.innerHTML = '\u25a1 Session saved without a project. Use the <em>Save to project</em> dropdown below to tag it retroactively.';
            }
          }
        }
      }
    }
  } catch(e) {
    if (e.name !== 'AbortError') {
      const msg = e.message === 'Load failed' || e.message === 'Failed to fetch'
        ? 'Connection lost — check that Marginalia is still running (tail /tmp/marginalia.log on the server)'
        : e.message;
      grid.innerHTML = '<div style="color:#c94242;font-family:monospace;font-size:12px">Error: ' + msg + '</div>';
    }
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
// ── Filter history ────────────────────────────────────────────────────────────
// Stores last 3 filter combinations for quick reapply
let _filterHistory = [];
function recordFilterHistory() {
  const q    = document.getElementById('ref-search')?.value?.trim() || '';
  const proj = document.getElementById('ref-project-filter')?.value || '';
  const state = { status: activeFilter, reading: activeReadingFilter, project: proj, search: q };
  // Don't record if it's just "all" with no search
  if (state.status === 'all' && state.reading === 'all' && !state.project && !state.search) return;
  // Don't duplicate last entry
  const last = _filterHistory[0];
  if (last && last.status === state.status && last.reading === state.reading &&
      last.project === state.project && last.search === state.search) return;
  _filterHistory.unshift(state);
  if (_filterHistory.length > 3) _filterHistory.pop();
  renderFilterHistory();
}
function renderFilterHistory() {
  let el = document.getElementById('filter-history');
  if (!el) {
    el = document.createElement('div');
    el.id = 'filter-history';
    el.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px';
    const filterPanel = document.querySelector('.filter-row[style*="margin:0"]');
    if (filterPanel) filterPanel.parentNode.insertBefore(el, filterPanel);
  }
  el.innerHTML = '';
  if (!_filterHistory.length) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  const label = document.createElement('span');
  label.style.cssText = 'font-family:monospace;font-size:9px;color:var(--muted);align-self:center;text-transform:uppercase;letter-spacing:.06em';
  label.textContent = 'Recent:';
  el.appendChild(label);
  _filterHistory.forEach(h => {
    const parts = [];
    if (h.status !== 'all') parts.push(h.status);
    if (h.reading !== 'all') parts.push(h.reading.replace('-', ' '));
    if (h.project) parts.push(h.project);
    if (h.search) parts.push(`"${h.search}"`);
    const chip = document.createElement('button');
    chip.className = 'filter-btn';
    chip.style.cssText = 'font-size:9px;padding:2px 7px;border-style:dashed';
    chip.textContent = parts.join(' · ') || 'all';
    chip.onclick = () => applyFilterHistory(h);
    el.appendChild(chip);
  });
}
function applyFilterHistory(h) {
  activeFilter = h.status;
  activeReadingFilter = h.reading;
  document.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.filter-btn[data-reading]').forEach(b => b.classList.remove('active'));
  const sf = document.querySelector(`.filter-btn[data-filter="${h.status}"]`);
  if (sf) sf.classList.add('active');
  const rf = document.querySelector(`.filter-btn[data-reading="${h.reading}"]`);
  if (rf) rf.classList.add('active');
  const proj = document.getElementById('ref-project-filter');
  if (proj) proj.value = h.project;
  const search = document.getElementById('ref-search');
  if (search) search.value = h.search;
  renderRefs();
}

function filterRefs() { renderRefs(); }
let activeReadingFilter = 'all';
function setFilter(btn) {
  document.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeFilter = btn.dataset.filter;
  renderRefs();
  recordFilterHistory();
}
function setReadingFilter(btn) {
  document.querySelectorAll('.filter-btn[data-reading]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeReadingFilter = btn.dataset.reading;
  renderRefs();
  recordFilterHistory();
}
function resetAllRefFilters() {
  // Hard reset all filter state — recovers from any stuck/corrupt filter combination
  activeFilter = 'all';
  activeReadingFilter = 'all';
  document.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.filter-btn[data-reading]').forEach(b => b.classList.remove('active'));
  const allBtn = document.getElementById('filter-all');
  const readingAllBtn = document.getElementById('reading-all');
  if (allBtn) allBtn.classList.add('active');
  if (readingAllBtn) readingAllBtn.classList.add('active');
  document.getElementById('ref-search').value = '';
  const projFilter = document.getElementById('ref-project-filter');
  if (projFilter) projFilter.value = '';
  const yearFilter = document.getElementById('ref-year-filter');
  if (yearFilter) yearFilter.value = '';
  renderRefs();
}
function setReadingStatus(btn) {
  document.querySelectorAll('.reading-status-btn').forEach(b => {
    b.classList.remove('active');
    b.style.background = 'var(--bg)';
    b.style.color      = 'var(--text)';
  });
  btn.classList.add('active');
  btn.style.background = 'var(--accent)';
  btn.style.color      = '#fff';
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
  const counts = { all: allRefs.length, verified: 0, located: 0, surfaced: 0, imported: 0 };
  const readingCounts = { unread: 0, skimmed: 0, read: 0, 'deeply-read': 0, 'needs-review': 0, 'has-link': 0 };
  allRefs.forEach(r => {
    const s = r.verification_status || 'surfaced';
    if (counts[s] !== undefined) counts[s]++;
    const rs = r.reading_status || 'unread';
    if (readingCounts[rs] !== undefined) readingCounts[rs]++;
    if (r.needs_review === 'true' || r.needs_review === true) readingCounts['needs-review']++;
    if (r.url_doi && r.url_doi.trim()) readingCounts['has-link']++;
  });
  const btn_all = document.getElementById('filter-all');
  if (btn_all) btn_all.textContent = 'all (' + counts.all + ')';
  ['verified','located','surfaced','imported'].forEach(s => {
    const btn = document.getElementById('filter-' + s);
    if (!btn) return;
    btn.textContent = s + (counts[s] ? ' (' + counts[s] + ')' : '');
  });
  // Reading filter counts
  const readingMap = { 'unread': 'reading-unread', 'skimmed': 'reading-skimmed', 'read': 'reading-read', 'deeply-read': 'reading-deeply', 'needs-review': 'reading-needs-review', 'has-link': 'reading-has-link' };
  Object.entries(readingMap).forEach(([key, id]) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const label = key === 'needs-review' ? '⚠ needs review' : key === 'deeply-read' ? 'deeply read' : key === 'has-link' ? '🔗 has link' : key;
    btn.textContent = label + (readingCounts[key] ? ' (' + readingCounts[key] + ')' : '');
  });
}

function renderRefs() {
  const q       = document.getElementById('ref-search').value.toLowerCase();
  const slug    = (document.getElementById('ref-project-filter')?.value || '').trim();
  const yearRaw = (document.getElementById('ref-year-filter')?.value || '').trim();
  const list    = document.getElementById('ref-list');
  list.innerHTML = '';

  // Year filter: accepts a single year ("1952") or a range ("1950-1960").
  // Blank passes everything through. Non-numeric input is ignored safely
  // rather than throwing -- a half-typed year shouldn't break the list.
  let yearMin = null, yearMax = null;
  if (yearRaw) {
    const rangeMatch = yearRaw.match(/^(\d{1,4})\s*-\s*(\d{1,4})$/);
    if (rangeMatch) {
      yearMin = parseInt(rangeMatch[1]);
      yearMax = parseInt(rangeMatch[2]);
    } else if (/^\d{1,4}$/.test(yearRaw)) {
      yearMin = yearMax = parseInt(yearRaw);
    }
    // else: unparseable input, yearMin/yearMax stay null, filter is a no-op
  }

  const filtered = allRefs.filter(r => {
    const matchFilter  = activeFilter === 'all' || r.verification_status === activeFilter;
    const searchFields = [r.title, r.authors, r.keywords, r.annotation, r.user_notes,
      (r.keywords_list || []).join(' ')];
    const matchSearch  = !q || searchFields.some(f => f && f.toLowerCase().includes(q));
    const matchProject = !slug ? true
      : slug === '__none__' ? !(r.conn_list || []).some(line => line.trim().length > 0)
      : (r.conn_list || []).some(line => line.split('|')[0].trim() === slug);
    const refYear      = parseInt(r.year);
    const matchYear    = yearMin === null || (!isNaN(refYear) && refYear >= yearMin && refYear <= yearMax);
    // Reading filter: 'needs-review' matches needs_review=true OR (unread AND imported)
    let matchReading = true;
    if (activeReadingFilter !== 'all') {
      if (activeReadingFilter === 'needs-review') {
        matchReading = r.needs_review === 'true' || r.needs_review === true ||
          ((r.reading_status === 'unread' || !r.reading_status) && r.verification_status === 'imported');
      } else if (activeReadingFilter === 'has-link') {
        matchReading = !!(r.url_doi && r.url_doi.trim());
      } else {
        matchReading = (r.reading_status || 'unread') === activeReadingFilter;
      }
    }
    return matchFilter && matchSearch && matchProject && matchYear && matchReading;
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
    const badgeGroup = document.createElement('div');
    badgeGroup.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0';
    const statusBadge = document.createElement('span');
    statusBadge.className = 'ref-status-badge status-' + status;
    statusBadge.textContent = status;
    statusBadge.title = 'Click to change verification status';
    statusBadge.style.cssText = 'cursor:pointer';
    statusBadge.onclick = () => cycleRefStatus(ref._filename || '', statusBadge);
    badgeGroup.appendChild(statusBadge);
    // Reading status indicator
    const rs = ref.reading_status || 'unread';
    const RS_COLORS = { 'unread': 'var(--muted)', 'skimmed': '#c9a832', 'read': '#4285f4', 'deeply-read': '#3d8b37' };
    const rsEl = document.createElement('span');
    rsEl.style.cssText = `font-family:monospace;font-size:9px;color:${RS_COLORS[rs] || 'var(--muted)'};text-transform:uppercase;letter-spacing:.05em`;
    rsEl.textContent = rs === 'deeply-read' ? 'deeply read' : rs;
    badgeGroup.appendChild(rsEl);
    // Needs review warning
    if (ref.needs_review === 'true' || ref.needs_review === true) {
      const nrEl = document.createElement('span');
      nrEl.style.cssText = 'font-family:monospace;font-size:9px;color:#c9a832';
      nrEl.textContent = '⚠ review';
      nrEl.title = 'This reference needs review — check annotation and reading status';
      badgeGroup.appendChild(nrEl);
    }
    topRow.appendChild(left);
    topRow.appendChild(badgeGroup);
    card.appendChild(topRow);

    // Tags + connections
    const tagsList = (ref.keywords || '').split(',').map(t => t.trim()).filter(Boolean);
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
    // DOI/URL button — only shown when url_doi is populated
    if (ref.url_doi && ref.url_doi.trim()) {
      const doi = ref.url_doi.trim();
      const isDoi = doi.startsWith('10.') || doi.includes('doi.org');
      const linkBtn = document.createElement('a');
      linkBtn.className = 'ref-action';
      linkBtn.textContent = isDoi ? 'DOI' : 'URL';
      linkBtn.href = isDoi && !doi.startsWith('http') ? 'https://doi.org/' + doi : doi;
      linkBtn.target = '_blank';
      linkBtn.rel = 'noopener noreferrer';
      linkBtn.style.cssText = 'text-decoration:none;color:var(--accent)';
      actions.appendChild(linkBtn);
    }
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    card.appendChild(actions);

    // Details
    const hasDetails = (ref.keywords_list && ref.keywords_list.length) ||
                       ref.annotation || ref.user_notes || ref.argument_connection;
    if (hasDetails) {
      const sep = document.createElement('hr');
      sep.style.cssText = 'border:none;border-top:1px solid var(--border);margin:10px 0 8px';
      card.appendChild(sep);
    }
    if (ref.keywords_list && ref.keywords_list.length) {
      const label = document.createElement('div');
      label.style.cssText = 'font-size:10px;font-family:monospace;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:4px';
      label.textContent = 'Keywords';
      const el = document.createElement('div');
      el.style.cssText = 'font-size:12px;color:var(--muted);line-height:1.6;margin-bottom:6px';
      const visible = ref.keywords_list.slice(0, 2);
      const rest    = ref.keywords_list.slice(2);
      el.textContent = visible.join(' · ') + (rest.length ? ' +' + rest.length + ' more' : '');
      el.title = ref.keywords_list.join('\n');
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
const STATUS_CYCLE = ['surfaced', 'imported', 'located', 'verified'];
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
  document.getElementById('edit-keywords').value           = ref.keywords || '';
  document.getElementById('edit-status').value             = ref.verification_status || 'surfaced';
  document.getElementById('edit-holding').value            = ref.physical_holding || 'none';
  document.getElementById('edit-holding-location').value   = ref.holding_location || '';

  document.getElementById('edit-connections').value        = ref.connections || '';
  document.getElementById('edit-abstract').value            = ref.abstract || '';
  document.getElementById('edit-annotation').value         = ref.annotation || '';
  document.getElementById('edit-user-notes').value         = ref.user_notes || '';
  document.getElementById('edit-argument').value           = ref.argument_connection || '';
  // Set reading status segmented selector
  const readingStatus = ref.reading_status || 'unread';
  document.querySelectorAll('.reading-status-btn').forEach(btn => {
    const isActive = btn.dataset.value === readingStatus;
    btn.classList.toggle('active', isActive);
    btn.style.background = isActive ? 'var(--accent)' : 'var(--bg)';
    btn.style.color      = isActive ? '#fff' : 'var(--text)';
  });
  // Clear stale enrich search state from any previous reference
  enrichCandidatesCache = [];
  const enrichPanel = document.getElementById('edit-enrich-candidates');
  if (enrichPanel) enrichPanel.innerHTML = '';
  const enrichQuery = document.getElementById('edit-enrich-query');
  if (enrichQuery) enrichQuery.value = '';
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
    keywords:            document.getElementById('edit-keywords').value.trim(),
    verification_status: document.getElementById('edit-status').value,
    reading_status:      document.querySelector('.reading-status-btn.active')?.dataset.value || 'unread',
    needs_review:        false,  // clearing needs_review on save is intentional — researcher has reviewed
    physical_holding:    document.getElementById('edit-holding').value,
    holding_location:    document.getElementById('edit-holding-location').value.trim(),
    connections:         document.getElementById('edit-connections').value.trim(),
    abstract:            document.getElementById('edit-abstract').value.trim(),
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
  // Gate: refuse to annotate references still at 'surfaced' status.
  // A model reasoning about a bare title the researcher hasn't even
  // confirmed is real is the highest-confabulation-risk case there is.
  // Verification is the human saying "I've looked at this, it's real" --
  // that should come before any model is allowed to start interpreting it.
  // See seeds.md, "A concrete confabulation, caught."
  const statusEl = document.getElementById('edit-status');
  if (statusEl && statusEl.value === 'surfaced') {
    alert('This reference is still marked "Surfaced" -- not yet verified.\n\nMark it Located or Verified first, so a model isn\'t reasoning about something nobody has confirmed is real. If the academic index has an abstract, try "Enrich from Index" first too -- it gives the model something real to ground on instead of just a title.');
    return;
  }
  const btn         = document.getElementById('edit-annotate-btn');
  const annotField  = document.getElementById('edit-annotation');
  const prevAnnot   = annotField ? annotField.value : '';
  if (btn) { btn.textContent = '\u29d7 Annotating\u2026'; btn.disabled = true; }
  // Show working state in the annotation field itself
  if (annotField) {
    annotField.value = 'Generating annotated bibliography entry\u2026';
    annotField.style.color = 'var(--muted)';
    annotField.disabled = true;
  }
  const localModels = [...activeModels].filter(m => ['deepseek','qwen','mistral','cohere','gemma','llama'].includes(m));
  const allActive   = [...activeModels];
  const models      = localModels.length > 0 ? localModels.slice(0,2) : allActive.length > 0 ? allActive.slice(0,1) : ['deepseek'];
  try {
    const res  = await fetch('/api/references/' + encodeURIComponent(filename) + '/annotate', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ models })
    });
    const data = await res.json();
    if (annotField) { annotField.style.color = 'var(--text)'; annotField.disabled = false; }
    if (data.status === 'annotated') {
      if (annotField) annotField.value = data.synthesis || '';
      if (btn) { btn.textContent = '\u2713 Done'; setTimeout(() => { btn.textContent = '\u25c6 Generate'; btn.disabled = false; }, 2000); }
    } else {
      if (annotField) annotField.value = prevAnnot;  // restore on error
      if (btn) { btn.textContent = '\u26a0 ' + (data.error || 'Failed'); btn.disabled = false; }
    }
  } catch(e) {
    if (annotField) { annotField.value = prevAnnot; annotField.style.color = 'var(--text)'; annotField.disabled = false; }
    if (btn) { btn.textContent = '\u26a0 Error'; btn.disabled = false; }
  }
}

// ── Enrich from Index — search, then human picks the candidate ────────────────
// Two-step flow: search returns candidates, nothing is written until the
// researcher explicitly selects one. Replaces the old single-shot version
// that auto-picked the top hit -- confirmed in the wild (Ken Bain reference,
// June 30 2026) that a top hit can be a real abstract for the WRONG paper
// (a Portuguese-language review, not the book itself), written silently.
// See seeds.md, "Enrich's false-success bug, and what it revealed."

let enrichCandidatesCache = [];   // holds last search results for selection

async function searchEnrichCandidates(filename) {
  if (!filename) return;
  const btn        = document.getElementById('edit-enrich-btn');
  const panel       = document.getElementById('edit-enrich-candidates');
  const queryInput  = document.getElementById('edit-enrich-query');
  const customQuery = queryInput ? queryInput.value.trim() : '';

  if (btn) { btn.textContent = 'Searching\u2026'; btn.disabled = true; }
  if (panel) { panel.style.display = 'block'; panel.innerHTML = '<div style="font-size:10px;color:var(--muted);font-family:monospace">Searching Semantic Scholar and OpenAlex\u2026</div>'; }

  try {
    const res  = await fetch('/api/references/' + encodeURIComponent(filename) + '/enrich/search', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ query: customQuery })
    });
    const data = await res.json();
    enrichCandidatesCache = data.candidates || [];

    if (btn) { btn.textContent = '\ud83d\udd0d Search Index'; btn.disabled = false; }
    renderEnrichCandidates(enrichCandidatesCache, data.query_used, filename);
  } catch(e) {
    if (btn) { btn.textContent = '\ud83d\udd0d Search Index'; btn.disabled = false; }
    if (panel) panel.innerHTML = '<div style="font-size:10px;color:#c94242">Search failed: ' + e.message + '</div>';
  }
}

function renderEnrichCandidates(candidates, queryUsed, filename) {
  const panel = document.getElementById('edit-enrich-candidates');
  if (!panel) return;

  if (!candidates.length) {
    panel.innerHTML = `
      <div style="font-size:10px;color:var(--muted);margin-bottom:8px">
        No results for "${queryUsed}" -- common for older books, essays, and non-indexed work.
        This reference may need a human-written entry instead.
      </div>
      <button class="btn-secondary" style="font-size:10px" onclick="searchEnrichCandidates('${filename}')">&#x21bb; Retry search</button>
    `;
    return;
  }

  const cards = candidates.map((c, idx) => {
    const meta = [c.authors, c.year, c.venue].filter(Boolean).join(' \u00b7 ');
    return `
      <div style="padding:8px;border:1px solid var(--border);border-radius:4px;margin-bottom:6px;background:var(--surface)">
        <div style="font-size:9px;font-family:monospace;color:var(--muted);margin-bottom:3px">${c.source === 'semantic_scholar' ? 'Semantic Scholar' : 'OpenAlex'}</div>
        <div style="font-weight:600;font-size:11px;margin-bottom:2px">${c.title || 'Untitled'}</div>
        <div style="font-size:10px;color:var(--muted);margin-bottom:6px">${meta}</div>
        <div style="font-size:10px;line-height:1.4;margin-bottom:8px;color:var(--text)">${c.preview || ''}${c.abstract && c.abstract.length > 220 ? '\u2026' : ''}</div>
        <button class="btn-primary" style="font-size:10px;padding:3px 8px" onclick="selectEnrichCandidate(${idx}, '${filename}')">Use this</button>
      </div>
    `;
  }).join('');

  panel.innerHTML = `
    <div style="font-size:10px;color:var(--muted);margin-bottom:8px">${candidates.length} result(s) for "${queryUsed}" -- pick the correct match, or retry with a different query</div>
    ${cards}
    <button class="btn-secondary" style="font-size:10px;margin-top:4px" onclick="searchEnrichCandidates('${filename}')">&#x21bb; Retry search</button>
  `;
}

async function selectEnrichCandidate(idx, filename) {
  const candidate = enrichCandidatesCache[idx];
  if (!candidate) return;

  const panel = document.getElementById('edit-enrich-candidates');
  if (panel) panel.innerHTML = '<div style="font-size:10px;color:var(--muted);font-family:monospace">Writing to Abstract field\u2026</div>';

  try {
    const res  = await fetch('/api/references/' + encodeURIComponent(filename) + '/enrich/confirm', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ candidate })
    });
    const data = await res.json();

    if (data.status === 'enriched') {
      document.getElementById('edit-abstract').value = candidate.abstract || '';
      const metaEl = document.getElementById('edit-abstract-meta');
      if (metaEl) {
        metaEl.style.display = 'block';
        metaEl.textContent = 'Source: ' + (data.tldr_source || 'academic index') + '\nMatched: "' + (data.matched_title || '') + '"';
      }
      if (panel) panel.innerHTML = '<div style="font-size:10px;color:var(--verified)">\u2713 Written to Abstract field above.</div>';
      await loadRefs();
    } else {
      if (panel) panel.innerHTML = '<div style="font-size:10px;color:#c94242">' + (data.error || 'Write failed') + '</div>';
    }
  } catch(e) {
    if (panel) panel.innerHTML = '<div style="font-size:10px;color:#c94242">Error: ' + e.message + '</div>';
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
// ── Active framing preview ────────────────────────────────────────────────────
// Shows the active project's framing below the scope row so the researcher
// can see what context will be injected without leaving the prompt view.
let _framingPreviewExpanded = false;
let _framingCache = {};  // slug → framing text

async function updateFramingPreview() {
  const slug = document.getElementById('session-project-select')?.value?.trim();
  const el   = document.getElementById('framing-preview');
  if (!el) return;
  if (!slug) { el.style.display = 'none'; return; }

  // Use cache if available
  let framing = _framingCache[slug];
  if (!framing) {
    try {
      const res  = await fetch('/api/projects');
      const data = await res.json();
      const proj = data.find(p => (p.slug || (p._filename||'').replace('.md','')) === slug);
      framing = proj?.framing || '';
      _framingCache[slug] = framing;
    } catch(e) { framing = ''; }
  }

  if (!framing) { el.style.display = 'none'; return; }

  el.style.display = 'block';
  if (_framingPreviewExpanded) {
    el.textContent = framing;
  } else {
    el.textContent = framing.slice(0, 100) + (framing.length > 100 ? '\u2026 (click to expand)' : '');
  }
}

function toggleFramingPreview() {
  _framingPreviewExpanded = !_framingPreviewExpanded;
  updateFramingPreview();
}

// ── Argument Connection // autocomplete ──────────────────────────────────────
async function argConnectionAutocomplete(textarea) {
  const val  = textarea.value;
  const pos  = textarea.selectionStart;
  const suggestions = document.getElementById('arg-suggestions');
  if (!suggestions) return;
  const before  = val.slice(0, pos);
  const lastSep = before.lastIndexOf('//');
  if (lastSep === -1) { suggestions.style.display = 'none'; return; }
  const afterSep = before.slice(lastSep + 2).trimStart();
  if (before.slice(lastSep + 2).includes(':')) { suggestions.style.display = 'none'; return; }
  try {
    const res  = await fetch('/api/projects');
    const data = await res.json();
    const slugs = data.map(p => p.slug || (p._filename || '').replace('.md','')).filter(Boolean);
    const matches = slugs.filter(s => s.toLowerCase().startsWith(afterSep.toLowerCase()));
    if (!matches.length) { suggestions.style.display = 'none'; return; }
    suggestions.innerHTML = '';
    suggestions.style.display = 'block';
    matches.forEach(slug => {
      const item = document.createElement('div');
      item.style.cssText = 'padding:6px 10px;cursor:pointer;font-family:monospace;font-size:11px;color:var(--text)';
      item.textContent = slug + ': ';
      item.onmousedown = (e) => {
        e.preventDefault();
        const insertAt = lastSep + 2;
        const newVal = val.slice(0, insertAt) + slug + ': ' + val.slice(pos);
        textarea.value = newVal;
        textarea.selectionStart = textarea.selectionEnd = insertAt + slug.length + 2;
        suggestions.style.display = 'none';
      };
      item.onmouseover = () => item.style.background = 'var(--border)';
      item.onmouseout  = () => item.style.background = '';
      suggestions.appendChild(item);
    });
  } catch(e) { suggestions.style.display = 'none'; }
}
document.addEventListener('click', e => {
  const s = document.getElementById('arg-suggestions');
  if (s && !s.contains(e.target) && e.target.id !== 'edit-argument') s.style.display = 'none';
});

let _allTags = [], _allConns = [];
async function loadAutocomplete() {
  try {
    const [tr, cr] = await Promise.all([fetch('/api/keywords'), fetch('/api/connections')]);
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

async function launchPromptFromRef(filename) {
  // Build a prompt from the reference, using the active project framing as context
  // if a project is selected. Falls back to a generic editable template if not.
  // Tags from the reference are injected so the researcher sees the conceptual frame.
  const ref = allRefs.find(r => r._filename === filename);
  if (!ref) return;
  showView('prompt', document.querySelectorAll('.nav-btn')[0]);
  const input = document.getElementById('prompt-input');

  const activeProjectSlug = document.getElementById('session-project-select')?.value?.trim() || '';
  const refCitation = ref.authors + ' (' + ref.year + '). ' + ref.title + '.';
  const refTags     = (ref.keywords || '').split(',').map(t => t.trim()).filter(Boolean).join(', ');
  const tagsLine    = refTags ? '\nTags: ' + refTags : '';

  if (activeProjectSlug) {
    // Fetch projects to find framing for the active project
    let framing = '';
    try {
      const res  = await fetch('/api/projects');
      const data = await res.json();
      const proj = (Array.isArray(data) ? data : (data.projects || []))
        .find(p => (p.slug || (p._filename || '').replace('.md', '')) === activeProjectSlug);
      framing = proj?.framing || '';
    } catch(e) {}

    if (framing) {
      input.value = 'How does this source speak to the following research framing?\n\n' +
        'FRAMING: ' + framing + '\n\n' +
        'SOURCE: ' + refCitation + tagsLine;
    } else {
      // Project selected but no framing set -- nudge researcher to add one
      input.value = 'How does this source contribute to project \u201c' + activeProjectSlug + '\u201d?\n' +
        '(Tip: add a framing to this project to sharpen this prompt automatically.)\n\n' +
        'SOURCE: ' + refCitation + tagsLine;
    }
  } else {
    // No project selected -- generic editable template
    input.value = 'What does this source argue, and why does it matter to my research?\n\n' +
      'SOURCE: ' + refCitation + tagsLine;
  }

  input.dispatchEvent(new Event('input'));
}


// ── Projects ──────────────────────────────────────────────────────────────
// ── Project slug autocomplete ─────────────────────────────────────────────────
async function populateProjectSlugs() {
  try {
    const res  = await fetch('/api/projects');
    const data = await res.json();
    const dl   = document.getElementById('project-slugs-list');
    if (!dl) return;
    const projects = Array.isArray(data) ? data : (data.projects || []);
    dl.innerHTML = projects
      .map(p => {
        const slug = p.slug || (p._filename||'').replace('.md','');
        const label = p.label || slug;
        return `<option value="${slug}">${label}</option>`;
      })
      .join('');
  } catch(e) {}
}

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
  populateSessionScopeSelectors(data);
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
    framingEl.style.cssText = 'font-size:12px;color:var(--muted);font-style:italic;margin:6px 0 4px';
    framingEl.textContent = p.framing || '— no framing set';
    const abstractEl = document.createElement('div');
    abstractEl.style.cssText = 'font-size:12px;color:var(--text);margin:0 0 8px;line-height:1.5';
    abstractEl.textContent = p.abstract || '';
    abstractEl.style.display = p.abstract ? 'block' : 'none';
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
    card.appendChild(headerRow); card.appendChild(framingEl); card.appendChild(abstractEl);
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
  document.getElementById('proj-edit-label').value    = p.label || _editingProjectSlug;
  document.getElementById('proj-edit-slug').value     = p.slug || _editingProjectSlug;
  document.getElementById('proj-edit-framing').value  = p.framing || '';
  document.getElementById('proj-edit-abstract').value = p.abstract || '';
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
      label:    document.getElementById('proj-edit-label').value.trim(),
      slug:     document.getElementById('proj-edit-slug').value.trim(),
      framing:  document.getElementById('proj-edit-framing').value.trim(),
      abstract: document.getElementById('proj-edit-abstract').value.trim(),
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
    if (w.abstract) {
      const abstractEl = document.createElement('div');
      abstractEl.style.cssText = 'font-size:12px;color:var(--text);margin-top:6px;line-height:1.5';
      abstractEl.textContent = w.abstract;
      card.appendChild(top); card.appendChild(meta); card.appendChild(abstractEl);
    } else {
      card.appendChild(top); card.appendChild(meta);
    }
    list.appendChild(card);
  });
}

let _editingWritingSlug = null;
function openWritingEdit(w) {
  _editingWritingSlug = w.slug || w._filename.replace('.md','');
  document.getElementById('writing-edit-title').value    = w.title || '';
  document.getElementById('writing-edit-slug').value     = w.slug || _editingWritingSlug;
  document.getElementById('writing-edit-type').value     = w.type || 'other';
  document.getElementById('writing-edit-project').value  = w.project || '';
  document.getElementById('writing-edit-status').value   = w.status || 'drafting';
  document.getElementById('writing-edit-abstract').value = w.abstract || '';
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
      title:    document.getElementById('writing-edit-title').value.trim(),
      slug:     document.getElementById('writing-edit-slug').value.trim(),
      type:     document.getElementById('writing-edit-type').value,
      project:  document.getElementById('writing-edit-project').value.trim(),
      status:   document.getElementById('writing-edit-status').value,
      abstract: document.getElementById('writing-edit-abstract').value.trim(),
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
let _allIntelSessions = [];  // full session list cached for client-side filtering
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
  if (!raw || typeof raw !== 'string') return;
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
    'ASSUMED':              '#0891b2',
    'UNASKED':              '#6e56cf',
    'UNASKED QUESTIONS':    '#6e56cf',
    'ARGUMENT WEAKNESSES':  '#c94242',
    'MISSING PERSPECTIVES': '#0891b2',
    'EXAMINER CHALLENGES':  '#c9a832',
    'NEXT MOVES':           '#3d8b37',
    'SURVIVED':             '#3d8b37',
    'DESTABILIZED':         '#c94242',
    'STILL OPEN':           '#c9a832',
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
  const writing   = (document.getElementById('intelligence-writing-filter')?.value || '').trim();
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
  const selectedModel = document.getElementById('intel-model-select')?.options[document.getElementById('intel-model-select')?.selectedIndex]?.text || 'DeepSeek R1';
  textEl.textContent = `Reading your research\u2026 ${selectedModel} is mapping your collection.`;
  if (label) label.innerHTML = '\u25C6 Synthesis <span id="intel-pulse" style="font-family:monospace;font-size:10px;color:var(--muted);margin-left:8px"><span id="intel-elapsed" style="color:var(--accent)">0s</span> \u00B7 mapping <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--accent);margin-left:3px;vertical-align:middle;animation:blink 1s infinite"></span></span>';
  // Start elapsed timer
  let _intelSeconds = 0;
  const _intelTimer = setInterval(() => {
    _intelSeconds++;
    const el = document.getElementById('intel-elapsed');
    if (el) el.textContent = _intelSeconds + 's';
  }, 1000);
  window._intelTimer = _intelTimer;
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
        body: JSON.stringify({ project, writing, model: document.getElementById('intel-model-select')?.value || 'deepseek' }), signal
      });
      const data = await res.json();
      if (data.error) results.library = '\u26a0 References: ' + data.error;
      else { results.library = data.synthesis; results.refCount = data.ref_count; }
    }
    if (_intelMode === 'sessions' || _intelMode === 'both') {
      const res  = await fetch('/api/sessions/synthesis', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ project, writing, model: document.getElementById('intel-model-select')?.value || 'deepseek' }), signal
      });
      const data = await res.json();
      if (data.error) results.sessions = '\u26a0 Sessions: ' + data.error;
      else { results.sessions = data.synthesis; results.sessionCount = data.session_count; }
    }

    if (_intelMode === 'predict') {
      const res  = await fetch('/api/sessions/predict', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ project, writing, model: document.getElementById('intel-model-select')?.value || 'deepseek' }), signal
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
  if (window._intelTimer) { clearInterval(window._intelTimer); window._intelTimer = null; }
  // Populate network map panel
  populateNetworkMap(textEl.textContent || '');
}

async function loadIntelligenceProjects() {
  const [projRes, writRes] = await Promise.all([
    fetch('/api/projects'),
    fetch('/api/writing'),
  ]);
  const projects = await projRes.json();
  const writings = await writRes.json();

  const sel  = document.getElementById('intelligence-project-filter');
  if (sel) {
    sel.innerHTML = '<option value="">All projects</option>';
    projects.forEach(p => {
      const opt  = document.createElement('option');
      const slug = p.slug || p.name || (p._filename || '').replace('.md','');
      opt.value       = slug;
      opt.textContent = (p.label || slug);
      sel.appendChild(opt);
    });
  }

  const wSel = document.getElementById('intelligence-writing-filter');
  if (wSel) {
    wSel.innerHTML = '<option value="">All writing</option>';
    writings.forEach(w => {
      const opt  = document.createElement('option');
      const slug = w.slug || (w._filename || '').replace('.md','');
      opt.value       = slug;
      opt.textContent = w.title || slug;
      wSel.appendChild(opt);
    });
  }

  loadIntelSessionList();
}

// ── Intelligence session list ─────────────────────────────────────────────────
// Shows recent sessions with their project/writing tags so the researcher can
// see what Intelligence will draw from — and correct tags retroactively.
let _intelSessionProjects = [];
let _intelSessionWriting  = [];

async function loadIntelSessionList() {
  const list    = document.getElementById('intel-session-list');
  const countEl = document.getElementById('intel-session-count');
  if (!list) return;

  // Show hidden toggle state
  const showHidden = document.getElementById('intel-show-hidden')?.checked || false;

  try {
    const [pr, wr] = await Promise.all([fetch('/api/projects'), fetch('/api/writing')]);
    const pd = await pr.json();
    const wd = await wr.json();
    _intelSessionProjects = pd.map(p => ({ slug: p.slug || (p._filename||'').replace('.md',''), label: p.label || p.slug }));
    _intelSessionWriting  = wd.map(w => ({ slug: w.slug || (w._filename||'').replace('.md',''), label: (w.title || w.slug || '').slice(0,40) }));
  } catch(e) {}

  try {
    const url  = '/api/sessions/list?limit=200' + (showHidden ? '&show_hidden=true' : '');
    const res  = await fetch(url);
    const data = await res.json();
    const sessions = data.sessions || [];
    if (countEl) countEl.textContent = '— ' + sessions.length + (showHidden ? ' (incl. hidden)' : ' active');

    // Cache all sessions for client-side filtering
    _allIntelSessions = sessions;

    // Populate project filter dropdown
    const projFilter = document.getElementById('intel-session-project-filter');
    if (projFilter) {
      const currentProj = projFilter.value;
      projFilter.innerHTML = '<option value="">All projects</option>';
      const projSlugs = [...new Set(sessions.map(s => s.project).filter(Boolean))].sort();
      projSlugs.forEach(slug => {
        const o = document.createElement('option');
        o.value = slug; o.textContent = slug;
        if (slug === currentProj) o.selected = true;
        projFilter.appendChild(o);
      });
    }

    // Populate writing filter dropdown
    const writFilter = document.getElementById('intel-session-writing-filter');
    if (writFilter) {
      const currentWrit = writFilter.value;
      writFilter.innerHTML = '<option value="">All writing</option>';
      const writSlugs = [...new Set(sessions.map(s => s.writing).filter(Boolean))].sort();
      writSlugs.forEach(slug => {
        const o = document.createElement('option');
        o.value = slug; o.textContent = slug;
        if (slug === currentWrit) o.selected = true;
        writFilter.appendChild(o);
      });
    }

    filterIntelSessions();

  } catch(e) {
    const list = document.getElementById('intel-session-list');
    if (list) list.innerHTML = '<div style="font-family:monospace;font-size:11px;color:#c94242">Error loading sessions: ' + e.message + '</div>';
  }
}
function filterIntelSessions() {
  const q       = (document.getElementById('intel-session-search')?.value || '').toLowerCase().trim();
  const proj    = document.getElementById('intel-session-project-filter')?.value || '';
  const writ    = document.getElementById('intel-session-writing-filter')?.value || '';
  const dateQ   = (document.getElementById('intel-session-date-filter')?.value || '').trim();
  const countEl = document.getElementById('intel-session-count');
  const list    = document.getElementById('intel-session-list');
  if (!list) return;

  const filtered = _allIntelSessions.filter(s => {
    const matchQ    = !q || (s.title || s.filename || '').toLowerCase().includes(q);
    const matchProj = !proj || (s.project || '') === proj;
    const matchWrit = !writ || (s.writing || '') === writ;
    const matchDate = !dateQ || (s.created || s.filename || '').includes(dateQ);
    return matchQ && matchProj && matchWrit && matchDate;
  });

  if (countEl) countEl.textContent = '— ' + filtered.length + ' of ' + _allIntelSessions.length;

  if (!filtered.length) {
    list.innerHTML = '<div style="font-family:monospace;font-size:11px;color:var(--muted);font-style:italic;padding:8px 0">No sessions match filters</div>';
    return;
  }

  // Re-render using existing row-building logic from loadIntelSessionList
  // by calling it directly — simpler than duplicating the render logic
  list.innerHTML = '';
  filtered.forEach(s => {
    const isHidden = s.hidden === true || s.hidden === 'true';
    const row = document.createElement('div');
    row.style.cssText = 'padding:6px 0;border-bottom:1px solid var(--border);font-family:monospace;font-size:11px' + (isHidden ? ';opacity:0.5' : '');
    const dateEl = document.createElement('div');
    dateEl.style.cssText = 'font-size:9px;color:var(--muted);margin-bottom:2px';
    dateEl.textContent = (s.created || s.filename || '').slice(0,16).replace('T',' ') + ' UTC' +
      (s.project ? ' · ' + s.project : '') +
      (s.writing ? ' · ' + s.writing : '');
    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-family:Georgia,serif;font-size:12px;color:var(--text);cursor:pointer;margin-bottom:3px';
    titleEl.textContent = (s.title || s.filename || '').slice(0, 100);
    titleEl.onclick = () => openSessionModal(s.filename, s.title || s.filename);
    // Tags input — saves on blur
    const tagsRow = document.createElement('div');
    tagsRow.style.cssText = 'display:flex;align-items:center;gap:4px';
    const tagsLabel = document.createElement('span');
    tagsLabel.style.cssText = 'font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em';
    tagsLabel.textContent = 'tags';
    const tagsInput = document.createElement('input');
    tagsInput.type = 'text';
    tagsInput.placeholder = 'comma separated…';
    tagsInput.value = s.tags || '';
    tagsInput.style.cssText = 'font-family:monospace;font-size:9px;background:var(--bg);border:1px solid var(--border);border-radius:3px;color:var(--text);padding:2px 6px;flex:1';
    tagsInput.onblur = async () => {
      try {
        await fetch('/api/sessions/' + encodeURIComponent(s.filename), {
          method: 'PATCH', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ tags: tagsInput.value.trim() })
        });
      } catch(e) {}
    };
    tagsRow.appendChild(tagsLabel);
    tagsRow.appendChild(tagsInput);
    row.appendChild(dateEl);
    row.appendChild(titleEl);
    row.appendChild(tagsRow);
    list.appendChild(row);
  });
}

function clearIntelSessionFilters() {
  const ids = ['intel-session-search','intel-session-date-filter'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  ['intel-session-project-filter','intel-session-writing-filter'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  filterIntelSessions();
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
      const textEl = document.getElementById('broadcast-text');
      // Show title + body if body exists, otherwise just title
      // Body carries what changed — bug fixes, new features — so researchers
      // know what's different without having to go looking.
      if (data.body) {
        textEl.innerHTML =
          '<strong>' + data.title + '</strong>' +
          ' &mdash; ' + data.body;
      } else {
        textEl.textContent = data.title;
      }
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
// Always writes a full local snapshot zip first (primary safety net).
// Git commit fires only if MARGINALIA_GIT_ENABLED=true in setup.env.
async function saveAndBreak() {
  const btn = document.getElementById('save-break-btn');
  btn.textContent = 'Saving\u2026'; btn.disabled = true;
  try {
    const res  = await fetch('/api/save-break', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ message: 'Session \u2014 ' + new Date().toISOString().slice(0,16) })
    });
    const data = await res.json();
    if (data.ok) {
      btn.textContent = 'Saved \u2713';
      // Show amber git indicator if git is enabled but failed
      if (data.git_enabled && !data.git_ok) {
        const indicator = document.getElementById('git-status-indicator');
        if (indicator) { indicator.style.color = '#c9a832'; indicator.title = 'Git push lagging — local backup is safe'; }
      }
    } else {
      btn.textContent = '\u26A0 Backup failed';
      alert('Backup failed: ' + (data.snapshot || 'unknown error'));
    }
  } catch(e) {
    btn.textContent = '\u26A0 Error';
  }
  btn.disabled = false;
  // Track last snapshot time for delta comparison
  window._lastSnapshotAt = new Date().toISOString();
  setTimeout(() => { btn.textContent = '\u2191 Save & Take a Break'; }, 3000);
}


// ── Session timer — rolling delta every 30 min, nudge every 2 hours ──────────
// silentSave fires the delta endpoint -- writes only changed files since last save.
// No prompt, no interruption. The 2h nudge is a gentle banner to take a break.
async function silentSave() {
  // Guard: skip if this tab is hidden (another tab is active).
  if (document.hidden) return;
  try {
    await fetch('/api/save-delta', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ since: window._lastSnapshotAt || null })
    });
    window._lastDeltaAt = new Date().toISOString();
  } catch(e) {}
}

// ── 2h nudge banner ───────────────────────────────────────────────────────────
// Gentle reminder to take a break and do a full snapshot.
// Auto-dismisses to delta after 60 seconds if ignored.
// If researcher is away, delta already ran silently -- no stale prompt on return.
function show2hNudge() {
  // Fire delta silently regardless -- catches changes if researcher is away
  silentSave();
  // Only show banner if tab is visible (researcher is present)
  if (document.hidden) return;
  let existing = document.getElementById('nudge-banner');
  if (existing) return; // already showing
  const banner = document.createElement('div');
  banner.id = 'nudge-banner';
  banner.style.cssText = 'position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:var(--surface);border:1px solid var(--accent);border-radius:6px;padding:10px 16px;font-family:monospace;font-size:12px;color:var(--text);display:flex;gap:12px;align-items:center;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.15)';
  banner.innerHTML = `<span>Two hours in \u2014 time to get up and move.</span>
    <button onclick="saveAndBreak();document.getElementById('nudge-banner').remove()" style="font-family:monospace;font-size:11px;padding:3px 8px;border:1px solid var(--accent);border-radius:3px;background:var(--accent);color:#fff;cursor:pointer">Snapshot & Break</button>
    <button onclick="document.getElementById('nudge-banner').remove()" style="font-family:monospace;font-size:11px;padding:3px 8px;border:1px solid var(--border);border-radius:3px;background:transparent;cursor:pointer">Keep going</button>`;
  document.body.appendChild(banner);
  // Auto-dismiss after 60 seconds
  setTimeout(() => { if (document.getElementById('nudge-banner')) banner.remove(); }, 60000);
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

  // Rolling delta every 30 min -- silent, no prompt
  if (sessionMinutes % 30 === 0) silentSave();

  // 2h nudge -- gentle banner if researcher is active, delta runs silently if away
  if (sessionMinutes % 120 === 0) show2hNudge();
}, 60000);


// ── Related sessions strip ────────────────────────────────────────────────────
async function showRelatedSessions() {
  const strip    = document.getElementById('related-sessions-strip');
  const linksEl  = document.getElementById('related-sessions-links');
  const basisEl  = document.getElementById('related-sessions-basis');
  if (!strip || !linksEl) return;

  const projectSel = document.getElementById('synth-save-project');
  const project    = projectSel?.value?.trim() || '';
  const url        = '/api/sessions/list?limit=5' + (project ? '&project=' + encodeURIComponent(project) : '');

  try {
    const res  = await fetch(url);
    const data = await res.json();
    const sessions = (data.sessions || []).slice(0, 3);
    if (!sessions.length) { strip.style.display = 'none'; return; }

    // Cluster sessions by date + keyword overlap
    // Sessions from the same date with >40% shared keywords in title merge into one cluster
    const clusters = [];
    sessions.forEach(s => {
      const sDate  = (s.created || s.filename || '').slice(0,10);
      const sWords = new Set((s.title || s.filename || '').toLowerCase().split(/\W+/).filter(w => w.length > 3));
      // Try to merge into existing cluster
      let merged = false;
      for (const cluster of clusters) {
        if (cluster.date !== sDate) continue;
        const overlap = [...sWords].filter(w => cluster.words.has(w)).length;
        const unionSize = new Set([...sWords, ...cluster.words]).size;
        if (unionSize > 0 && overlap / unionSize > 0.3) {
          cluster.sessions.push(s);
          cluster.words = new Set([...cluster.words, ...sWords]);
          merged = true;
          break;
        }
      }
      if (!merged) clusters.push({ date: sDate, sessions: [s], words: sWords });
    });

    // Update basis label
    if (basisEl) {
      basisEl.textContent = project
        ? '— recent in project: ' + project
        : '— most recent sessions';
    }

    linksEl.innerHTML = '';
    clusters.forEach((cluster, i) => {
      if (i > 0) {
        const sep = document.createElement('span');
        sep.innerHTML = ' &nbsp;&middot;&nbsp; ';
        sep.style.color = 'var(--muted)';
        linksEl.appendChild(sep);
      }
      const s       = cluster.sessions[0];
      const count   = cluster.sessions.length;
      const display = (s.title || s.filename || '').slice(0, 70);
      // Truncate at word boundary if mid-word
      const trimmed = display.length < (s.title || '').length
        ? display.slice(0, display.lastIndexOf(' ')) || display
        : display;
      const link    = document.createElement('span');
      link.style.cssText = 'cursor:pointer;text-decoration:underline dotted;color:var(--accent)';
      link.title = count > 1 ? count + ' sessions clustered — click to view' : (s.filename || '');
      link.textContent   = trimmed + (count > 1 ? ' (' + count + ')' : '');
      link.onclick = count > 1
        ? () => openClusterModal(cluster.sessions, display)
        : () => openSessionModal(s.filename, s.title || s.filename);
      linksEl.appendChild(link);
    });
    strip.style.display = 'block';
  } catch(e) {
    strip.style.display = 'none';
  }
}


// ── Cluster modal — view all sessions in a clustered thread ──────────────────
function openClusterModal(sessions, clusterTitle) {
  let modal = document.getElementById('session-view-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'session-view-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:center;justify-content:center';
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
  }
  modal.innerHTML = '<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;width:min(680px,92vw);max-height:80vh;display:flex;flex-direction:column;overflow:hidden">' +
    '<div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">' +
    '<div><span style="font-family:monospace;font-size:12px;color:var(--text)">' + clusterTitle + '</span>' +
    '<span style="font-family:monospace;font-size:10px;color:var(--muted);margin-left:10px">' + sessions.length + ' sessions in this thread</span></div>' +
    '<span onclick="document.getElementById(\'session-view-modal\').remove()" style="cursor:pointer;color:var(--muted);font-size:18px;line-height:1">&times;</span>' +
    '</div>' +
    '<div style="padding:10px 16px;overflow-y:auto;flex:1">' +
    sessions.map(s => '<div style="padding:8px 0;border-bottom:1px solid var(--border)">' +
      '<div style="font-family:monospace;font-size:9px;color:var(--muted);margin-bottom:3px">' + (s.created || s.filename || '').slice(0,16).replace('T',' ') + ' UTC</div>' +
      '<div style="font-family:Georgia,serif;font-size:12px;color:var(--accent);cursor:pointer;text-decoration:underline dotted" onclick="openSessionModal(\'' + s.filename + '\',\'' + (s.title || s.filename).replace(/'/g, "\\'") + '\')">' +
      (s.title || s.filename) + '</div>' +
      '</div>'
    ).join('') +
    '</div>' +
    '<div style="padding:10px 16px;border-top:1px solid var(--border)">' +
    '<button class="btn-secondary" style="font-size:10px" onclick="document.getElementById(\'session-view-modal\').remove()">Close</button>' +
    '</div></div>';
  modal.style.display = 'flex';
}

// ── Session modal — view related session content, inject or launch ────────────
async function openSessionModal(filename, title) {
  if (!filename) return;
  // Create or reuse modal
  let modal = document.getElementById('session-view-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'session-view-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:center;justify-content:center';
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
  }
  const project = document.getElementById('synth-save-project')?.value?.trim() || '';
  const basisNote = project ? 'recent in project: ' + project : 'most recent sessions';
  modal.innerHTML = '<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;width:min(680px,92vw);max-height:80vh;display:flex;flex-direction:column;overflow:hidden">' +
    '<div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">' +
    '<div><span style="font-family:monospace;font-size:12px;color:var(--text)">' + title + '</span>' +
    '<span style="font-family:monospace;font-size:10px;color:var(--muted);margin-left:10px;font-style:italic">surfaced by: ' + basisNote + '</span></div>' +
    '<span onclick="document.getElementById(\'session-view-modal\').remove()" style="cursor:pointer;color:var(--muted);font-size:18px;line-height:1">&times;</span>' +
    '</div>' +
    '<div id="session-modal-body" style="padding:14px 16px;overflow-y:auto;flex:1;font-family:monospace;font-size:11px;color:var(--muted)">Loading\u2026</div>' +
    '<div style="padding:10px 16px;border-top:1px solid var(--border);display:flex;gap:8px">' +
    '<button class="btn-secondary" style="font-size:10px" onclick="injectSessionIntoPrompt(\'' + filename + '\')">+++ Inject as context</button>' +
    '<button class="btn-secondary" style="font-size:10px" onclick="launchFollowUpFromSession(\'' + filename + '\')">&#8618; Launch follow-up</button>' +
    '<button class="btn-secondary" style="font-size:10px;margin-left:auto" onclick="document.getElementById(\'session-view-modal\').remove()">Close</button>' +
    '</div></div>';
  modal.style.display = 'flex';

  try {
    const res  = await fetch('/api/sessions/' + encodeURIComponent(filename) + '/raw');
    const data = await res.json();
    const body = document.getElementById('session-modal-body');
    if (!body) return;
    const content = data.content || '';
    // Extract prompt and synthesis for readable display
    const lines = content.split('\n');
    let display = '';
    let inSection = false;
    lines.forEach(line => {
      if (line.startsWith('## Prompt') || line.startsWith('## Synthesis') || line.startsWith('## Notes')) {
        inSection = true;
        display += '<div style="color:var(--accent);margin:8px 0 4px;text-transform:uppercase;font-size:10px;letter-spacing:.06em">' + line.replace('## ','') + '</div>';
      } else if (line.startsWith('## ') && inSection) {
        inSection = false;
      } else if (inSection && line.trim()) {
        display += '<div style="color:var(--text);line-height:1.6;margin-bottom:2px">' + line + '</div>';
      }
    });
    body.innerHTML = display || '<div style="color:var(--muted)">No readable content found.</div>';
  } catch(e) {
    const body = document.getElementById('session-modal-body');
    if (body) body.textContent = 'Could not load session.';
  }
}

async function injectSessionIntoPrompt(filename) {
  try {
    const res  = await fetch('/api/sessions/' + encodeURIComponent(filename) + '/raw');
    const data = await res.json();
    const content = data.content || '';
    // Extract just the prompt section for injection
    const promptMatch = content.match(/## Prompt\n([\s\S]*?)(?:\n## |$)/);
    const promptText  = promptMatch ? promptMatch[1].trim() : content.slice(0, 500);
    const input = document.getElementById('prompt-input');
    if (input) {
      input.value = (input.value ? input.value + '\n\n+++\n\n' : '') + promptText;
      input.dispatchEvent(new Event('input'));
    }
    document.getElementById('session-view-modal')?.remove();
    showView('prompt', document.querySelector('.nav-btn[onclick*="prompt"]'));
  } catch(e) {}
}

async function launchFollowUpFromSession(filename) {
  try {
    const res  = await fetch('/api/sessions/' + encodeURIComponent(filename) + '/raw');
    const data = await res.json();
    const content = data.content || '';
    const synthMatch = content.match(/## Synthesis\n([\s\S]*?)(?:\n## |$)/);
    const synthText  = synthMatch ? synthMatch[1].trim() : '';
    const promptMatch = content.match(/## Prompt\n([\s\S]*?)(?:\n## |$)/);
    const promptText  = promptMatch ? promptMatch[1].trim() : '';
    const input = document.getElementById('prompt-input');
    if (input) {
      input.value = (promptText ? promptText + '\n\n+++\n\n' : '') +
        (synthText ? synthText + '\n\n+++\n\n' : '') +
        'Following up on this session — ';
      input.dispatchEvent(new Event('input'));
    }
    document.getElementById('session-view-modal')?.remove();
    showView('prompt', document.querySelector('.nav-btn[onclick*="prompt"]'));
  } catch(e) {}
}

// ── Separator / prompt stacking ───────────────────────────────────────────────
function getActivePrompt() {
  const raw  = document.getElementById('prompt-input')?.value || '';
  const sep  = '+++';
  const parts = raw.split(sep).map(p => p.trim()).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : raw;
}


// ── Font size adjustment ──────────────────────────────────────────────────────
function adjustFontSize(delta) {
  const current = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const next    = Math.min(Math.max(current + delta, 11), 20);
  document.documentElement.style.fontSize = next + 'px';
  localStorage.setItem('marginalia-font-size', next);
}
function initFontSize() {
  const saved = localStorage.getItem('marginalia-font-size');
  if (saved) document.documentElement.style.fontSize = saved + 'px';
}


// ── Author surname extraction ─────────────────────────────────────────────────
// Handles two canonical author format conventions:
//   "Last, First" (comma-separated, surname is the first token before the comma)
//   "First Last" (space-separated, semicolon between authors)
// Also handles:
//   Particles: Van der Berg, de la Torre, Tuhiwai Smith (preserve full particle+surname)
//   Lowercase names: bell hooks, adrienne maree brown (match as-is)
//   Hyphenated: Merleau-Ponty, Tuhiwai-Smith
// Returns a Set of lowercase surname strings for matching.
const SURNAME_PARTICLES = new Set(['van','de','der','den','la','le','du','di','von','da','al','el','bin','bint','ter','ten']);
function extractSurnames(authorsString) {
  const surnames = new Set();
  if (!authorsString) return surnames;

  // Split on semicolons first (First Last; First Last format), then commas that
  // aren't followed by a space+lowercase (which would be "Last, First" pairs).
  // Strategy: detect format by checking if the string contains ", " — if the
  // first segment has ", " it's likely "Last, First" convention.
  const hasCsvLastFirst = /^[A-Z][a-z]+,\s+[A-Z]/.test(authorsString.trim());

  if (hasCsvLastFirst) {
    // "Last, First M.; Last, First" format — surname is everything before first comma
    authorsString.split(/;\s*|,\s*(?=[A-Z])/).forEach(chunk => {
      const part = chunk.trim();
      if (!part) return;
      // In "Last, First" — last name is the first word(s) before the comma
      const beforeComma = part.split(',')[0].trim();
      const tokens = beforeComma.split(/\s+/);
      // Check for particle prefix: "Van der Berg" → keep "Van der Berg" or just "Berg"
      // We store the final non-particle token as the match surname
      let surname = '';
      for (let i = tokens.length - 1; i >= 0; i--) {
        const t = tokens[i].toLowerCase();
        if (SURNAME_PARTICLES.has(t)) continue;
        surname = tokens.slice(i).join(' ');
        break;
      }
      if (!surname) surname = beforeComma;
      surname = surname.replace(/[^a-zA-Z\-\s]/g, '').trim();
      if (surname.length > 3) surnames.add(surname.toLowerCase());
    });
  } else {
    // "First Last" format — semicolon or & between authors
    authorsString.split(/[;&]/).forEach(chunk => {
      const part = chunk.trim();
      if (!part) return;
      const tokens = part.split(/\s+/);
      if (tokens.length === 0) return;

      // Check for entirely lowercase name (bell hooks, adrienne maree brown)
      const allLower = tokens.every(t => t === t.toLowerCase() && /^[a-z]/.test(t));
      if (allLower) {
        // Use last token as surname key, but also add full name for matching
        const surname = tokens[tokens.length - 1].replace(/[^a-z\-]/g, '');
        if (surname.length > 2) surnames.add(surname);
        return;
      }

      // Normal "First Last" — find the last non-particle token as surname
      // and include any preceding particle in the stored value
      let surnameStart = tokens.length - 1;
      while (surnameStart > 0 && SURNAME_PARTICLES.has(tokens[surnameStart - 1].toLowerCase())) {
        surnameStart--;
      }
      const surnameParts = tokens.slice(surnameStart).join(' ').replace(/[^a-zA-Z\-\s]/g, '').trim();
      if (surnameParts.length > 3) surnames.add(surnameParts.toLowerCase());
    });
  }
  return surnames;
}

// ── Author/reference highlighting in model responses ─────────────────────────
async function highlightAuthorsInResponses() {
  try {
    const [refsRes, tagsRes] = await Promise.all([
      fetch('/api/references?limit=200'),
      fetch('/api/keywords'),
    ]);
    const refsData = await refsRes.json();
    const refs     = refsData.references || [];
    const allTags  = await tagsRes.json();  // array of keyword strings

    // Build surname set using robust extraction helper
    const surnames = new Set();
    refs.forEach(r => {
      extractSurnames(r.authors || '').forEach(s => surnames.add(s));
    });

    // Build concept set from library tags and themes
    // Tags are hyphen-separated (embodied-cognition) — we match each word and the full phrase
    // Themes are comma-separated strings — we match each theme phrase
    const libraryConceptsSet = new Set();
    allTags.forEach(t => {
      libraryConceptsSet.add(t.toLowerCase());
      // Also add individual words from hyphenated tags that are substantive
      t.split('-').forEach(w => { if (w.length > 4) libraryConceptsSet.add(w.toLowerCase()); });
    });
    refs.forEach(r => {
      (r.keywords || '').split(',').forEach(th => {
        const clean = th.trim().toLowerCase();
        if (clean.length > 3) libraryConceptsSet.add(clean);
      });
    });

    // Core theoretical concepts that should always surface even if not yet in library
    // Rose (not in library) if absent from tags/themes, green/yellow if present
    const coreConceptsNotInLibrary = [
      'autopoiesis','enactivism','enactive','enaction',
      'polyvagal','zpd','zone of proximal development',
      'embodied cognition','somatic','interoception',
      'psychological safety','affect regulation',
      'decolonization','indigenization',
      'metacognition','self-efficacy',
    ].filter(c => !libraryConceptsSet.has(c));

    // Highlight in all response cards
    document.querySelectorAll('.response-text').forEach(el => {
      if (el.dataset.highlighted) return;
      el.dataset.highlighted = '1';
      let html = el.innerHTML;

      // Author surnames — amber
      surnames.forEach(s => {
        const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`\\b(${escaped})\\b`, 'gi');
        html = html.replace(re, `<mark style="background:rgba(200,146,42,0.25);color:var(--accent);border-radius:2px;padding:0 2px">$1</mark>`);
      });

      // Library concepts (tags/themes) — green tint
      libraryConceptsSet.forEach(c => {
        if (c.length < 5) return;  // skip short noise
        // Stoplist: high-frequency academic words too generic to signal anything.
        // A highlight on "learning" fires on every response and means nothing.
        // Same principle as the rose candidate skip list -- length alone doesn't
        // distinguish "enactivism" from "learning".
        const conceptStoplist = new Set([
          'learning','teaching','research','practice','knowledge','theory',
          'student','students','teacher','teachers','education','educational',
          'social','cultural','human','people','world','study','studies',
          'approach','process','experience','context','system','systems',
          'model','models','method','methods','analysis','framework',
          'based','using','through','within','across','about','their',
          'these','those','other','which','where','while','after',
          'understanding','development','thinking','reading','writing',
          'academic','university','school','course','class','program',
          'data','results','findings','evidence','review','literature',
        ]);
        if (conceptStoplist.has(c)) return;
        const escaped = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`\\b(${escaped})\\b`, 'gi');
        html = html.replace(re, `<mark style="background:rgba(61,139,55,0.15);color:#3d8b37;border-radius:2px;padding:0 2px">$1</mark>`);
      });

      // Core concepts not in library — rose tint, signals gap
      coreConceptsNotInLibrary.forEach(c => {
        const escaped = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`\\b(${escaped})\\b`, 'gi');
        html = html.replace(re, `<mark style="background:rgba(201,66,98,0.15);color:#c94262;border-radius:2px;padding:0 2px">$1</mark>`);
      });

      el.innerHTML = html;
    });
  } catch(e) {}
}


// ── Synthesis refs chunk ──────────────────────────────────────────────────────
// Scans all model responses + synthesis for author surnames. Discounts names
// already present in the prompt (known context). Shows frequency count with
// green/yellow/rose library status. Rose names open search-confirm modal.
async function renderSynthesisRefsChunk(promptText, responsesText, synthesisText) {
  const container = document.getElementById('synth-refs-chunk');
  if (!container) return;

  try {
    const res  = await fetch('/api/references?limit=200');
    const data = await res.json();
    const refs = data.references || [];

    // Build surname → ref map using robust extraction helper
    const surnameMap = {};  // surname (lowercase) → { surname (display), title, status }
    refs.forEach(r => {
      extractSurnames(r.authors || '').forEach(s => {
        // Display form: capitalize first letter of each word
        const display = s.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        surnameMap[s] = {
          surname: display,
          title:   r.title,
          status:  r.verification_status || 'surfaced',
        };
      });
    });

    // Extract surnames present in the prompt — these are known context, discount them
    const promptSurnames = new Set();
    const promptWords = promptText.split(/\s+/);
    promptWords.forEach(w => {
      const clean = w.replace(/[^a-zA-Z\-]/g, '').toLowerCase();
      if (clean.length > 3) promptSurnames.add(clean);
    });

    // Count surname appearances across responses + synthesis
    const allText = (responsesText + ' ' + synthesisText).toLowerCase();
    const counts  = {};
    Object.keys(surnameMap).forEach(s => {
      if (promptSurnames.has(s)) return;  // discount prompt names
      const re    = new RegExp(`\\b${s}\\b`, 'g');
      const hits  = (allText.match(re) || []).length;
      if (hits > 0) counts[s] = hits;
    });

    // Split rose candidates into two buckets:
    // (1) roseNames — surname-shaped tokens (potential missing references)
    // (2) roseConcepts — concept-shaped tokens (potential missing tags/themes)
    // Heuristic: concept suffixes (-tion, -ism, -ity, -ment, -ence, -ogy, -ness, -ing)
    // or known philosophical/academic vocabulary → concept bucket.
    // Single capitalised word or hyphenated name pattern → name bucket.
    const CONCEPT_SUFFIXES = /(?:tion|ism|ity|ment|ence|ogy|ness|ing|ics|phy|sis|ism)$/i;
    const KNOWN_CONCEPTS   = new Set([
      'phenomenology','embodiment','perception','consciousness','intentionality',
      'intersubjectivity','temporality','spatiality','materiality','ontology',
      'epistemology','hermeneutics','dialectics','positionality','relationality',
      'enactivism','autopoiesis','affordance','mediation','abstraction',
      'metacognition','cognition','motivation','regulation','integration',
      'constructivism','behaviourism','behaviorism','pragmatism','empiricism',
      'rationalism','idealism','realism','nominalism','structuralism',
      'poststructuralism','deconstruction','intersectionality',
    ]);

    const roseNames     = {};  // potential missing references
    const roseConcepts  = {};  // potential missing tags/themes
    const roseContextMap = {};

    const allResponseSentences = (responsesText + ' ' + synthesisText).split(/[.!?]+/);
    const tokens = (responsesText + ' ' + synthesisText).match(/\b[A-Z][a-z]{3,}(?:-[A-Z][a-z]{2,})?\b/g) || [];

    tokens.forEach(t => {
      const tl = t.toLowerCase();
      if (promptSurnames.has(tl)) return;
      if (surnameMap[tl]) return;
      if (t.includes('-') && t.split('-').some(p => surnameMap[p.toLowerCase()])) return;
      const skip = new Set([
        'this','that','they','their','there','these','those',
        'when','where','while','which','what','with','from','have','will','been',
        'also','into','over','than','then','each','more','most','such','both',
        'very','just','some','only','even','here','after','before','about',
        'through','between','during','however','although','therefore','furthermore',
        'consensus','divergence','unique','absent','voices','contributions',
        'survived','destabilized','unresolved','unasked','assumed','examiner',
        'survey','pressure','test','synthesis','model','research','study',
        'cognitive','embodied','learning','academic','physical','activity',
        'instead','rather','regarding','theory','zone','role','grounding',
        'proximal','concepts','section','above','below','across','within',
        'response','question','argument','approach','framework','perspective',
        'analysis','evidence','context','example','focus','sense','point',
        'given','found','noted','shows','takes','makes','based','used','using',
        'overall','similarly','likewise','furthermore','additionally','however',
        'therefore','specifically','particularly','essentially','generally',
        'bond','course','gauge','mortar','brick','bricks','masonry','mason',
        'simply','merely','directly','currently','recently','typically',
        'your','none','their','these','those','other','which','where',
        'buddhist','christian','islamic','western','eastern','ancient',
        'intentional','traditional','conventional','philosophical','psychological',
        'viewed','defined','without','regarding','stated','argued','noted',
        'proposed','suggested','described','explained','discussed','presented',
        // Common first names that appear without surnames
        'francisco','rene','immanuel','gottfried','baruch','george','thomas',
        'william','john','david','michael','james','robert','richard','charles',
        'gemini','deepseek','qwen','mistral','cohere','gemma','llama','claude',
        'openai','anthropic','chatgpt',
        'western','eastern','indigenous','canadian','english','french','latin',
        'january','february','march','april','june','july','august','september',
        'october','november','december','monday','tuesday','wednesday','thursday',
        'friday','saturday','sunday',
      ]);
      if (skip.has(tl)) return;

      // Capture sentence context
      if (!roseContextMap[tl]) {
        const sentence = allResponseSentences.find(s => s.includes(t));
        if (sentence) roseContextMap[tl] = sentence.trim().slice(0, 150);
      }

      // Classify: concept or name?
      if (CONCEPT_SUFFIXES.test(tl) || KNOWN_CONCEPTS.has(tl)) {
        roseConcepts[tl] = (roseConcepts[tl] || 0) + 1;
      } else {
        roseNames[tl] = (roseNames[tl] || 0) + 1;
      }
    });

    // Sort library hits by count descending
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    // Filter and sort rose buckets — threshold ≥ 2, cap at 6 each
    const roseNamesFiltered    = Object.entries(roseNames)
      .filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const roseConceptsFiltered = Object.entries(roseConcepts)
      .filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 6);

    if (!sorted.length && !roseNamesFiltered.length && !roseConceptsFiltered.length) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    container.innerHTML = '';

    // Header
    const hdr = document.createElement('div');
    hdr.style.cssText = 'font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:8px';
    hdr.textContent = 'References surfaced';
    container.appendChild(hdr);

    // Library entries
    sorted.forEach(([sl, count]) => {
      const info   = surnameMap[sl];
      const status = info.status;
      const color  = status === 'verified' ? '#3d8b37' : status === 'located' ? '#c9a832' : '#6e56cf';
      const row    = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:baseline;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border)';
      const left = document.createElement('span');
      left.style.cssText = `font-size:11px;color:${color};font-family:monospace`;
      left.textContent = info.surname;
      const right = document.createElement('span');
      right.style.cssText = 'font-size:10px;color:var(--muted);font-family:monospace';
      right.textContent = count + 'x · ' + (info.title || '').slice(0, 40) + (info.title && info.title.length > 40 ? '…' : '');
      row.appendChild(left);
      row.appendChild(right);
      container.appendChild(row);
    });

    // Rose names — potential missing references
    if (roseNamesFiltered.length) {
      const divider = document.createElement('div');
      divider.style.cssText = 'font-family:monospace;font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#c94262;margin:8px 0 4px';
      divider.textContent = 'Not in library — potential references';
      container.appendChild(divider);

      roseNamesFiltered.forEach(([tl, count]) => {
        const display = tl.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const context = roseContextMap[tl] || '';
        const row     = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:baseline;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border);cursor:pointer';
        row.title = context ? 'Context: ' + context : 'Search for ' + display;
        const left = document.createElement('span');
        left.style.cssText = 'font-size:11px;color:#c97a8a;font-family:monospace;text-decoration:underline dotted';
        left.textContent = display;
        const right = document.createElement('div');
        right.style.cssText = 'display:flex;gap:6px;align-items:center';
        const countEl = document.createElement('span');
        countEl.style.cssText = 'font-size:10px;color:var(--muted);font-family:monospace';
        countEl.textContent = count + 'x';
        const searchBtn = document.createElement('span');
        searchBtn.style.cssText = 'font-size:9px;color:#c97a8a;font-family:monospace;text-decoration:underline dotted;cursor:pointer';
        searchBtn.textContent = 'search';
        searchBtn.onclick = (e) => { e.stopPropagation(); openRoseAuthorSearch(display, context, row); };
        right.appendChild(countEl);
        right.appendChild(searchBtn);
        row.appendChild(left);
        row.appendChild(right);
        row.onclick = () => openRoseAuthorSearch(display, context, row);
        container.appendChild(row);
      });
    }

    // Rose concepts — potential missing tags/themes
    if (roseConceptsFiltered.length) {
      const divider2 = document.createElement('div');
      divider2.style.cssText = 'font-family:monospace;font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#6e56cf;margin:8px 0 4px';
      divider2.textContent = 'Not in library — concepts & themes';
      container.appendChild(divider2);

      roseConceptsFiltered.forEach(([tl, count]) => {
        const display = tl.charAt(0).toUpperCase() + tl.slice(1);
        const context = roseContextMap[tl] || '';
        const row     = document.createElement('div');
        row.style.cssText = 'padding:3px 0;border-bottom:1px solid var(--border)';
        const topRow = document.createElement('div');
        topRow.style.cssText = 'display:flex;align-items:baseline;justify-content:space-between';
        const left = document.createElement('span');
        left.style.cssText = 'font-size:11px;color:#6e56cf;font-family:monospace';
        left.textContent = display;
        const right = document.createElement('div');
        right.style.cssText = 'display:flex;gap:6px;align-items:center';
        const countEl = document.createElement('span');
        countEl.style.cssText = 'font-size:10px;color:var(--muted);font-family:monospace';
        countEl.textContent = count + 'x';
        const addTagBtn = document.createElement('span');
        addTagBtn.style.cssText = 'font-size:9px;color:#6e56cf;font-family:monospace;text-decoration:underline dotted;cursor:pointer';
        addTagBtn.textContent = '+ tag';
        addTagBtn.onclick = () => addConceptToLibrary(tl, 'tag', addTagBtn);
        const addThemeBtn = document.createElement('span');
        addThemeBtn.style.cssText = 'font-size:9px;color:#6e56cf;font-family:monospace;text-decoration:underline dotted;cursor:pointer';
        addThemeBtn.textContent = '+ theme';
        addThemeBtn.onclick = () => addConceptToLibrary(tl, 'theme', addThemeBtn);
        const searchBtn = document.createElement('span');
        searchBtn.style.cssText = 'font-size:9px;color:var(--muted);font-family:monospace;text-decoration:underline dotted;cursor:pointer';
        searchBtn.textContent = 'find sources';
        searchBtn.onclick = () => openRoseConceptSearch(tl, context, row);
        right.appendChild(countEl);
        right.appendChild(addTagBtn);
        right.appendChild(addThemeBtn);
        right.appendChild(searchBtn);
        topRow.appendChild(left);
        topRow.appendChild(right);
        row.appendChild(topRow);
        container.appendChild(row);
      });
    }

  } catch(e) {
    container.style.display = 'none';
  }
}

// Rose name search — fires OpenAlex author search inline below the row
async function openRoseAuthorSearch(name, context, rowEl) {
  // Show inline results below the row rather than navigating away
  let resultsEl = rowEl.nextSibling;
  if (resultsEl && resultsEl.dataset.roseResults) {
    resultsEl.remove(); return;  // toggle off
  }
  resultsEl = document.createElement('div');
  resultsEl.dataset.roseResults = '1';
  resultsEl.style.cssText = 'background:var(--bg);border:1px solid var(--border);border-radius:3px;padding:6px 8px;margin:2px 0 4px;font-family:monospace;font-size:10px';
  resultsEl.textContent = 'Searching\u2026';
  rowEl.parentNode.insertBefore(resultsEl, rowEl.nextSibling);

  try {
    // Use existing academic fetch with the name as query
    const res  = await fetch('/api/academic/fetch', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ query: name, doi: '', preferred_source: 'semantic_scholar' })
    });
    if (!res.ok) { resultsEl.textContent = 'No results found.'; return; }
    const data = await res.json();
    resultsEl.innerHTML = '';
    // academic/fetch returns a single best match — surface it with a link to search more
    if (data.title) {
      const item = document.createElement('div');
      item.style.cssText = 'padding:3px 0;cursor:pointer;color:var(--text)';
      item.innerHTML = `<span>${data.title.slice(0,60)}</span> <span style="color:var(--muted)">${data.year||''} · ${(data.authors||'').slice(0,30)}</span>`;
      item.onclick = () => {
        showView('references', document.querySelector('.nav-btn[onclick*="references"]'));
        setTimeout(() => {
          const s = document.getElementById('academic-search-input');
          if (s) { s.value = name; s.focus(); }
        }, 300);
      };
      resultsEl.appendChild(item);
      const more = document.createElement('div');
      more.style.cssText = 'font-size:9px;color:var(--muted);margin-top:4px;cursor:pointer;text-decoration:underline dotted';
      more.textContent = 'Search for more \u2192';
      more.onclick = () => openRoseIngestSearch(name, context);
      resultsEl.appendChild(more);
    } else {
      resultsEl.textContent = 'No results — try the academic search manually.';
    }
  } catch(e) {
    resultsEl.textContent = 'Search failed — try the academic search manually.';
  }
}

// Rose concept search — fires local model pass to get refined terms, then OpenAlex
async function openRoseConceptSearch(concept, context, rowEl) {
  let resultsEl = rowEl.nextSibling;
  if (resultsEl && resultsEl.dataset.roseResults) {
    resultsEl.remove(); return;  // toggle off
  }
  resultsEl = document.createElement('div');
  resultsEl.dataset.roseResults = '1';
  resultsEl.style.cssText = 'background:var(--bg);border:1px solid var(--border);border-radius:3px;padding:6px 8px;margin:2px 0 4px;font-family:monospace;font-size:10px;color:var(--muted)';
  resultsEl.textContent = 'Finding related sources\u2026';
  rowEl.parentNode.insertBefore(resultsEl, rowEl.nextSibling);

  try {
    // Ask backend to run a model pass for refined search terms, then search
    const res  = await fetch('/api/refs-chunk/concept-search', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ concept, context })
    });
    const data = await res.json();
    const works = data.results || [];
    const terms = data.search_terms || concept;
    if (!works.length) {
      resultsEl.textContent = `No results for "${terms}".`;
      return;
    }
    resultsEl.innerHTML = `<div style="color:var(--muted);margin-bottom:4px">Searched: <em>${terms}</em></div>`;
    works.forEach(w => {
      const item = document.createElement('div');
      item.style.cssText = 'padding:3px 0;border-bottom:1px solid var(--border);cursor:pointer';
      item.innerHTML = `<span style="color:var(--text)">${(w.title||'').slice(0,60)}</span> <span style="color:var(--muted)">${w.year||''} · ${(w.authors||'').slice(0,30)}</span>`;
      item.onclick = () => {
        showView('references', document.querySelector('.nav-btn[onclick*="references"]'));
        setTimeout(() => {
          const s = document.getElementById('academic-search-input');
          if (s) { s.value = w.title || terms; s.focus(); }
        }, 300);
      };
      resultsEl.appendChild(item);
    });
  } catch(e) {
    resultsEl.textContent = 'Search failed — try the academic search manually.';
  }
}

// Add concept to library vocabulary as tag or theme
// For now surfaces a nudge to add it to a ref's tags/themes manually
// (Full vocabulary management comes in v1.7)
function addConceptToLibrary(concept, type, btn) {
  const original = btn.textContent;
  btn.textContent = '\u2713 noted';
  btn.style.color = '#3d8b37';
  // Route to References search with concept pre-filled so researcher can add it to a ref
  setTimeout(() => {
    showView('references', document.querySelector('.nav-btn[onclick*="references"]'));
    setTimeout(() => {
      const s = document.getElementById('ref-search');
      if (s) { s.value = concept; s.dispatchEvent(new Event('input')); }
    }, 300);
  }, 600);
}

// ── Researcher context block ──────────────────────────────────────────────────
// Stored in settings.json, injected into every model call via call_model().
// Without it the council defaults to assistant mode.
async function loadResearcherContext() {
  try {
    const res  = await fetch('/api/settings');
    const data = await res.json();
    const el   = document.getElementById('researcher-context-input');
    if (el && data.researcher_context) el.value = data.researcher_context;
  } catch(e) {}
}
async function saveResearcherContext() {
  const el  = document.getElementById('researcher-context-input');
  const ctx = el ? el.value.trim() : '';
  const statusEl = document.getElementById('researcher-context-status');
  try {
    const res  = await fetch('/api/settings');
    const data = await res.json();
    data.researcher_context = ctx;
    await fetch('/api/settings', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(data)
    });
    if (statusEl) { statusEl.textContent = ctx ? '\u2713 Context saved — active on next prompt' : '\u2713 Context cleared'; }
    setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
  } catch(e) {
    if (statusEl) statusEl.textContent = '\u26a0 Save failed';
  }
}

// ── BibTeX export panel ───────────────────────────────────────────────────────
function toggleBibTexPanel() {
  const panel = document.getElementById('bibtex-panel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}
function copyBibTexUrl() {
  const url = 'http://100.126.14.57:5001/api/export/bibtex';
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.querySelector('[onclick="copyBibTexUrl()"]');
    if (btn) { const orig = btn.textContent; btn.textContent = '\u2713 Copied'; setTimeout(() => btn.textContent = orig, 2000); }
  });
}

// ── Rose name search — legacy alias ──────────────────────────────────────────
function openRoseIngestSearch(name, context) {
  const query = context || name;
  showView('references', document.querySelector('.nav-btn[onclick*="references"]'));
  setTimeout(() => {
    const searchInput = document.getElementById('academic-search-input');
    if (searchInput) { searchInput.value = query; searchInput.focus(); }
  }, 300);
}

// ── Network map — live session connections ────────────────────────────────────
async function populateNetworkMap(synthesisText) {
  const panel  = document.getElementById('network-map-panel');
  const body   = document.getElementById('network-map-body');
  const status = document.getElementById('network-map-status');
  if (!panel || !body) return;

  try {
    const res  = await fetch('/api/references?limit=200');
    const data = await res.json();
    const refs = data.references || [];

    // Find which authors/titles appear in the synthesis text
    const found = [];
    refs.forEach(r => {
      const authors = (r.authors || '').split(/[,;&]/);
      authors.forEach(a => {
        const surname = a.trim().split(/\s+/).pop()?.replace(/[^a-zA-Z\-]/g, '');
        if (surname && surname.length > 3 && synthesisText.includes(surname)) {
          if (!found.find(f => f.title === r.title)) {
            found.push({ surname, title: r.title, year: r.year, authors: r.authors });
          }
        }
      });
    });

    if (found.length === 0) {
      if (status) status.textContent = '— no canonical references surfaced';
      body.innerHTML = '<span style="color:var(--muted);font-size:11px">No references from your canonical record appeared in this synthesis. Consider adding the sources the model cited.</span>';
      return;
    }

    if (status) status.textContent = `— ${found.length} reference${found.length > 1 ? 's' : ''} surfaced`;
    body.innerHTML = found.map(f =>
      `<div style="padding:3px 0;border-bottom:1px solid var(--border)">
        <span style="color:var(--accent);font-family:monospace;font-size:10px">${f.surname} ${f.year || ''}</span>
        <span style="color:var(--text);font-size:11px;margin-left:6px">${f.title || ''}</span>
      </div>`
    ).join('');
  } catch(e) {
    if (status) status.textContent = '— unavailable';
  }
}

// ── Synthesis mode description ────────────────────────────────────────────────
// Updates the small descriptor line under the mode selector when mode changes,
// and syncs the "Currently: X" indicator at the top of the synthesis panel.
const SYNTH_MODE_DESCRIPTIONS = {
  survey:         'All models respond independently \u2014 find consensus, divergence, and what\u2019s still open.',
  pressure:       'After responses: what survived scrutiny, what was destabilized, what remains unresolved.',
  prompt_pressure:'Examines your question before firing \u2014 what are you assuming? What are you not asking?',
};
const SYNTH_MODE_LABELS = {
  survey:         'Survey',
  pressure:       'Pressure Test',
  prompt_pressure:'Prompt Pressure Test',
};
function updateSynthesisModeDescription() {
  const sel   = document.getElementById('synthesis-mode-select');
  const desc  = document.getElementById('synthesis-mode-desc');
  const label = document.getElementById('synthesis-mode-label');
  if (!sel) return;
  if (desc)  desc.textContent  = SYNTH_MODE_DESCRIPTIONS[sel.value] || '';
  if (label) label.textContent = SYNTH_MODE_LABELS[sel.value] || sel.value;
}

// ── Re-synthesise ─────────────────────────────────────────────────────────────
// Runs synthesis on the current prompt + existing model responses using the
// newly selected mode and model. Does not re-fire the models.
async function reSynthesise() {
  const prompt = document.getElementById('prompt-input')?.value?.trim();
  if (!prompt) { return; }
  const textEl    = document.getElementById('synthesis-text');
  const panel     = document.getElementById('synthesis-panel');
  const btn       = document.getElementById('resynth-btn');
  const synthMode = document.getElementById('synthesis-mode-select')?.value || 'survey';
  const synthModel= document.getElementById('synthesis-model-select')?.value || 'deepseek';

  if (!textEl || !panel) return;

  // Collect current response card text as the responses object
  const responseCards = [...document.querySelectorAll('.response-text')];
  const responses = {};
  responseCards.forEach(el => {
    const card  = el.closest('[id^="card-"]');
    const model = card?.id?.replace('card-', '');
    if (model && el.textContent.trim()) responses[model] = el.textContent.trim();
  });

  if (btn) { btn.textContent = '\u29d7 Synthesising\u2026'; btn.disabled = true; }
  panel.classList.add('pulsing');
  textEl.style.color     = 'var(--muted)';
  textEl.style.fontStyle = 'italic';
  textEl.innerHTML = '<div style="font-family:monospace;font-size:11px;color:var(--muted)">Re-synthesising\u2026</div>';

  try {
    const res  = await fetch('/api/synthesise', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ prompt, responses, synthesis_model: synthModel, synth_mode: synthMode })
    });
    const data = await res.json();
    panel.classList.remove('pulsing');
    textEl.style.color     = 'var(--text)';
    textEl.style.fontStyle = 'normal';
    if (data.synthesis) {
      _lastSynthesis = data.synthesis;
      renderSynthesisSections(data.synthesis, textEl);
      showSynthesisInjectRow(synthModel, synthMode);
      updateSynthesisModeDescription();
    } else {
      textEl.textContent = data.error || 'Re-synthesis failed.';
    }
  } catch(e) {
    panel.classList.remove('pulsing');
    textEl.textContent = 'Error: ' + e.message;
  } finally {
    if (btn) { btn.textContent = '\u21ba Re-synthesise'; btn.disabled = false; }
  }
}

// ── Prompt synthesis save to project ─────────────────────────────────────
// ── Prompt Pressure Test ──────────────────────────────────────────────────────
// Examines the researcher's question before firing — what is assumed, what is
// unasked, what would an examiner challenge. Targets the prompt itself, not
// model responses. Hardcore version of shower thought: moves inward not forward.
async function promptPressureTest() {
  const prompt = document.getElementById('prompt-input').value.trim();
  if (!prompt) {
    alert('Write a prompt first — Prompt Pressure Test examines your question before firing.');
    return;
  }
  // Find the button by its onclick attribute so we can show working state
  const btn = document.querySelector('[onclick*="promptPressureTest"]');
  const synthModel = document.getElementById('synthesis-model-select')?.value || 'deepseek';
  const panel      = document.getElementById('synthesis-panel');
  const textEl     = document.getElementById('synthesis-text');
  if (!panel || !textEl) return;

  // Show working state on button and panel immediately
  if (btn) { btn.textContent = '\u29d7 Examining\u2026'; btn.disabled = true; }
  panel.style.display = 'block';
  panel.classList.add('pulsing');
  textEl.style.color     = 'var(--muted)';
  textEl.style.fontStyle = 'italic';
  textEl.innerHTML = '<div style="font-family:monospace;font-size:11px;color:var(--muted)">Examining your prompt \u2014 checking assumptions, gaps, and examiner challenges\u2026</div>';

  try {
    const res  = await fetch('/api/synthesise', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        prompt,
        responses: {},
        synthesis_model: synthModel,
        synth_mode: 'prompt_pressure'
      })
    });
    const data = await res.json();
    panel.classList.remove('pulsing');
    textEl.style.color     = 'var(--text)';
    textEl.style.fontStyle = 'normal';
    if (data.synthesis) {
      renderSynthesisSections(data.synthesis, textEl);
      showSynthesisInjectRow(synthModel, 'prompt_pressure');
    } else {
      textEl.textContent = data.error || 'Prompt pressure test unavailable.';
    }
  } catch(e) {
    panel.classList.remove('pulsing');
    textEl.textContent = 'Error: ' + e.message;
  } finally {
    if (btn) { btn.textContent = '\u25c6 Test prompt'; btn.disabled = false; }
  }
}

function showSynthesisInjectRow(modelName, mode) {
  // Show the inject checkbox after synthesis runs, with bias warning
  const row     = document.getElementById('synth-inject-row');
  const warning = document.getElementById('synth-inject-warning');
  if (!row) return;
  row.style.display = 'block';
  if (warning) {
    warning.textContent = '⚠ Synthesis was generated by ' + modelName.toUpperCase() +
      '. Adding it as context may amplify its framing in subsequent prompts.';
  }
}

function getSynthesisContext() {
  // Returns synthesis text if inject checkbox is checked, empty string otherwise
  const checkbox = document.getElementById('synth-inject-checkbox');
  if (!checkbox?.checked) return '';
  const textEl = document.getElementById('synthesis-text');
  return textEl ? textEl.innerText.trim() : '';
}

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
    // Retroactive write-back: if the last session was saved without a project,
    // PATCH it now so the canonical file reflects the project connection.
    if (window._lastSessionFilename) {
      const currentProject = document.getElementById('session-project-select')?.value?.trim();
      if (!currentProject) {
        // Session was fired without a project -- write it back now
        try {
          await fetch('/api/sessions/' + encodeURIComponent(window._lastSessionFilename), {
            method: 'PATCH', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ project })
          });
          // Also update the session-project-select so it reflects the new state
          const sel = document.getElementById('session-project-select');
          if (sel) sel.value = project;
          // Dismiss the no-project nudge
          const nudge = document.getElementById('no-project-nudge');
          if (nudge) nudge.remove();
        } catch(e) {} // write-back is best-effort, don't block on failure
      }
    }
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
// ── Capture mode selector hint ────────────────────────────────────────────────
function updateCaptureHint() {
  const mode    = document.querySelector('input[name="capture-mode"]:checked')?.value || 'typed';
  const subtitle = document.querySelector('#view-ingest .import-section .import-section-title + div');
  if (!subtitle) return;
  if (mode === 'handwritten') {
    subtitle.innerHTML = 'Drop a photo or scanned PDF.<br>Gemma 4 OCR will read the handwriting (~15–45s per page). Accuracy on cursive varies — review the output before saving.';
  } else {
    subtitle.innerHTML = 'Drop a typed/digital PDF.<br>Text extracts in seconds via pdfplumber.';
  }
}

function handleCaptureDragOver(e) { e.preventDefault(); document.getElementById('capture-drop-zone').classList.add('drag-over'); }
function handleCaptureDragLeave() { document.getElementById('capture-drop-zone').classList.remove('drag-over'); }
function handleCaptureDrop(e) {
  e.preventDefault();
  document.getElementById('capture-drop-zone').classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f) stageCapture(f);
}
function handleCaptureSelect(e) {
  const f = e.target.files[0];
  if (f) stageCapture(f);
}

let _stagedCaptureFile = null;

function stageCapture(file) {
  _stagedCaptureFile = file;
  const label  = document.getElementById('capture-drop-label');
  const goBtn  = document.getElementById('capture-go-btn');
  label.textContent = '✓ ' + file.name + ' — set mode above, then click Run Capture';
  if (goBtn) goBtn.style.visibility = 'visible';
}

function runStagedCapture() {
  if (!_stagedCaptureFile) return;
  const goBtn = document.getElementById('capture-go-btn');
  if (goBtn) goBtn.style.visibility = 'hidden';
  runCapture(_stagedCaptureFile);
}

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

  const mode   = document.querySelector('input[name="capture-mode"]:checked')?.value || 'typed';
  const isPDF  = file.name.toLowerCase().endsWith('.pdf');
  if (mode === 'handwritten') {
    label.textContent = 'Running Gemma 4 OCR… (~15–45s per page)';
  } else {
    label.textContent = isPDF ? 'Extracting…' : 'Running Gemma 4 OCR… (~15–45s)';
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('note', note);
  formData.append('mode', mode);

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
      saveNoteBtn.onclick = () => captureToNote(data.full_text || data.text, file.name, note);

      const saveRefBtn = document.createElement('button');
      saveRefBtn.className = 'btn-secondary';
      saveRefBtn.style.fontSize = '11px';
      saveRefBtn.textContent = '\u2117 Save as Reference';
      saveRefBtn.onclick = () => captureToReference(data.full_text || data.text, file.name);

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
  // Pre-fill note editor and switch to Notes tab.
  // Also auto-saves a draft immediately so OCR text is never lost
  // if the researcher navigates away before hitting Save.
  const titleInput   = document.getElementById('new-note-title');
  const bodyInput    = document.getElementById('new-note-body');
  const sourceInput  = document.getElementById('new-note-source');
  const projectInput = document.getElementById('new-note-project');
  const title = filename.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
  const body  = contextNote ? contextNote + '\n\n---\n\n' + text : text;
  if (titleInput)  titleInput.value  = title;
  if (sourceInput) sourceInput.value = filename;
  if (bodyInput)   bodyInput.value   = body;
  const activeProject = document.getElementById('note-project-filter')?.value?.trim();
  if (projectInput && activeProject && activeProject !== 'all') {
    projectInput.value = activeProject;
  }

  // Auto-save draft to canonical immediately — text survives navigation
  fetch('/api/notes', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      title:   '[DRAFT] ' + title,
      body:    body,
      source:  filename,
      project: (projectInput && activeProject !== 'all') ? activeProject : '',
      questions_raised: '',
      connections: '',
      writing: ''
    })
  }).then(() => {
    // Refresh note list so draft appears immediately
    if (typeof loadNotes === 'function') loadNotes();
  }).catch(() => {});

  // Switch to Notes tab
  const notesBtn = document.querySelector('[onclick*="notes"]');
  showView('notes', notesBtn);
  setTimeout(() => {
    if (titleInput) titleInput.focus();
    // Banner: remind researcher OCR needs review
    const existing = document.getElementById('ocr-review-banner');
    if (!existing) {
      const banner = document.createElement('div');
      banner.id = 'ocr-review-banner';
      banner.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:4px;padding:8px 12px;margin-bottom:10px;font-family:monospace;font-size:11px;color:var(--muted)';
      banner.innerHTML = '&#9685; OCR draft saved — review the text above for accuracy, edit if needed, then save again to confirm. The draft marked [DRAFT] is already in your notes.';
      if (titleInput?.parentNode) titleInput.parentNode.insertBefore(banner, titleInput);
    }
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
      note.source  ? { label: '\u2117 ' + decodeURIComponent(note.source),  color: '#4285f4' } : null,
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

function populateSessionScopeSelectors(projects) {
  // Populate the "Working on" project + writing selectors above the prompt.
  // Called whenever projects load — preserves current selection.
  const pSel = document.getElementById('session-project-select');
  const wSel = document.getElementById('session-writing-select');
  if (!pSel) return;
  const curP = pSel.value, curW = wSel ? wSel.value : '';
  pSel.innerHTML = '<option value="">No project</option>';
  projects.forEach(p => {
    const slug = p.slug || (p._filename || '').replace('.md','');
    const opt  = document.createElement('option');
    opt.value       = slug;
    opt.textContent = p.label || slug;
    pSel.appendChild(opt);
  });
  if (curP) pSel.value = curP;
  // Writing elements loaded separately
  loadWritingForScope(wSel, curW);
}

async function loadWritingForScope(sel, preserve) {
  if (!sel) return;
  try {
    const res  = await fetch('/api/writing');
    const data = await res.json();
    sel.innerHTML = '<option value="">No writing element</option>';
    data.forEach(w => {
      const slug = w.slug || (w._filename || '').replace('.md','');
      const opt  = document.createElement('option');
      opt.value       = slug;
      opt.textContent = (w.title || slug).slice(0, 40);
      sel.appendChild(opt);
    });
    if (preserve) sel.value = preserve;
  } catch(e) {}
}


// ── Broadcast detail helper ────────────────────────────────────────────────────
// The broadcast banner now shows what changed, not just that something changed.
// BROADCAST_URL (in paths.py) should serve JSON:
// { "broadcast": { "active": true, "expires": "ISO", "title": "v1.4.0 live",
//   "body": "Session lock, read-only phone mode, what's changed detail in broadcast" } }

// ── UTC clock — updates every minute, visible in status bar ──────────────────
function updateUTCClock() {
  const now = new Date();
  const hh  = String(now.getUTCHours()).padStart(2,'0');
  const mm  = String(now.getUTCMinutes()).padStart(2,'0');
  const dd  = String(now.getUTCDate()).padStart(2,'0');
  const mo  = String(now.getUTCMonth()+1).padStart(2,'0');
  const el  = document.getElementById('utc-clock');
  if (el) el.textContent = `UTC ${hh}:${mm}`;
  // Also store as stamp format for build reference
  const stamp = mo + dd + '-' + hh + mm;
  if (el) el.dataset.stamp = stamp;
}
updateUTCClock();
setInterval(updateUTCClock, 60000);

// ── Init ──────────────────────────────────────────────────────────────────
checkBroadcast();
updateLocalWarning();
checkKeyStatus();
checkSetupStatus();
checkLocalModels();
// Check for recently saved session — models may still be running if page was refreshed
(async () => {
  try {
    const res  = await fetch('/api/sessions/list?limit=1');
    const data = await res.json();
    const sessions = data.sessions || data || [];
    if (sessions.length) {
      const latest = sessions[0];
      const created = new Date(latest.created || latest.created_at || 0);
      const ageMs  = Date.now() - created.getTime();
      if (ageMs < 90000) {  // within 90 seconds
        const banner = document.createElement('div');
        banner.id = 'recent-session-banner';
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999;background:#c9a832;color:#1a1a1a;font-family:monospace;font-size:11px;padding:6px 16px;display:flex;align-items:center;justify-content:space-between';
        banner.innerHTML = '<span>&#9711; A session was saved recently — models may still be running. <a href="#" onclick="showView(\'intelligence\',document.querySelector(\'.nav-btn[onclick*=intelligence]\'));document.getElementById(\'recent-session-banner\').remove();return false;" style="color:#1a1a1a;text-decoration:underline">Check Intelligence tab</a></span>' +
          '<span style="cursor:pointer;padding:0 8px" onclick="document.getElementById(\'recent-session-banner\').remove()">&#215;</span>';
        document.body.prepend(banner);
        setTimeout(() => banner.remove(), 15000);
      }
    }
  } catch(e) {}
})();
// Pre-populate session scope selectors and synth save dropdown on load
(async () => {
  try {
    const [projRes, writRes] = await Promise.all([
      fetch('/api/projects'),
      fetch('/api/writing'),
    ]);
    const projects = await projRes.json();
    const writings = await writRes.json();
    if (projects.length) {
      populateSessionScopeSelectors(projects);
      populateSynthProjectDropdown(projects);
      populateNoteProjectFilter(projects);
      updateFramingPreview();
    }
    // Writing selector loads independently — not gated on projects existing
    const wSel = document.getElementById('session-writing-select');
    if (wSel && writings.length) {
      wSel.innerHTML = '<option value="">No writing element</option>';
      writings.forEach(w => {
        const slug = w.slug || (w._filename || '').replace('.md','');
        const opt  = document.createElement('option');
        opt.value       = slug;
        opt.textContent = (w.title || slug).slice(0, 40);
        wSel.appendChild(opt);
      });
    }
  } catch(e) {}
})();


// ── Academic Sources — Semantic Scholar, OpenAlex, Crossref ───────────────────
// Health checks, paper search, save to references, citation leads.
// Source is always stamped. Failover is automatic. Researcher decides what to chase.

let academicSource    = 'semantic_scholar';
let academicResult    = null;   // holds last fetch result for save

function setAcademicSource(src, btn) {
  academicSource = src;
  document.querySelectorAll('#src-ss, #src-oa').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

// Health check — called on References tab open
async function checkAcademicHealth() {
  const indicators = {
    'semantic_scholar': document.getElementById('health-ss'),
    'openalex':         document.getElementById('health-oa'),
    'crossref':         document.getElementById('health-cr'),
  };
  // Reset to neutral while checking
  Object.values(indicators).forEach(el => { if (el) el.style.color = 'var(--muted)'; });

  try {
    const res  = await fetch('/api/academic/health');
    const data = await res.json();

    const map = {
      'semantic_scholar': indicators['semantic_scholar'],
      'openalex':         indicators['openalex'],
      'crossref':         indicators['crossref'],
    };
    const sourceMap = {
      'semantic_scholar': data.semantic_scholar,
      'openalex':         data.openalex,
      'crossref':         data.crossref,
    };

    for (const [key, el] of Object.entries(map)) {
      if (!el) continue;
      const status = sourceMap[key];
      if (status && status.status === 'ok') {
        el.style.color = '#7a9e7e';  // muted green -- warm not alarming
        el.title = `${key.replace('_', ' ')}: available`;
      } else if (status && status.status === 'rate_limited') {
        el.style.color = '#c9a04a';  // warm yellow -- distinct from amber/red, "busy not broken"
        el.title = `${key.replace('_', ' ')}: rate limited right now -- the service is up, just temporarily throttling this client. Try again shortly.`;
      } else {
        el.style.color = '#b87a4a';  // amber -- genuinely unreachable
        el.title = `${key.replace('_', ' ')}: unreachable`;
      }
    }
  } catch(e) {
    // Network error -- leave indicators neutral, do not alarm
  }
}

// Search or DOI lookup
async function academicSearch() {
  const input = document.getElementById('academic-search-input');
  const query = input ? input.value.trim() : '';
  if (!query) return;

  const preview = document.getElementById('academic-preview');
  if (preview) preview.style.display = 'none';
  closeLeadsPanel();

  // Determine if input looks like a DOI
  const isDOI = query.startsWith('10.') || query.includes('doi.org/');

  try {
    const res  = await fetch('/api/academic/fetch', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        query:            isDOI ? '' : query,
        doi:              isDOI ? query : '',
        preferred_source: academicSource,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      showAcademicError(err.error || 'No results found');
      return;
    }

    academicResult = await res.json();
    renderAcademicPreview(academicResult);
  } catch(e) {
    showAcademicError('Request failed -- check your connection');
  }
}

function renderAcademicPreview(result) {
  const preview = document.getElementById('academic-preview');
  if (!preview) return;

  const sourceEl   = document.getElementById('academic-preview-source');
  const titleEl    = document.getElementById('academic-preview-title');
  const metaEl     = document.getElementById('academic-preview-meta');
  const abstractEl = document.getElementById('academic-preview-abstract-text');
  const leadsBtn   = document.getElementById('academic-leads-btn');

  if (sourceEl)   sourceEl.textContent   = result.tldr_source || result.source || '';
  if (titleEl)    titleEl.textContent    = result.title || 'Untitled';
  if (metaEl)     metaEl.textContent     = [result.authors, result.year, result.venue].filter(Boolean).join(' · ');
  if (abstractEl) abstractEl.textContent = result.abstract || 'Abstract not available';

  // Show leads button only if DOI is present
  if (leadsBtn) {
    leadsBtn.style.display = result.url_doi ? 'inline-block' : 'none';
  }

  preview.style.display = 'block';
}

function showAcademicError(msg) {
  const preview = document.getElementById('academic-preview');
  if (!preview) return;
  document.getElementById('academic-preview-source').textContent = 'Error';
  document.getElementById('academic-preview-title').textContent  = msg;
  document.getElementById('academic-preview-meta').textContent   = '';
  document.getElementById('academic-preview-abstract-text').textContent = '';
  const leadsBtn = document.getElementById('academic-leads-btn');
  if (leadsBtn) leadsBtn.style.display = 'none';
  preview.style.display = 'block';
  academicResult = null;
}

function closeAcademicPreview() {
  const preview = document.getElementById('academic-preview');
  if (preview) preview.style.display = 'none';
  academicResult = null;
  closeLeadsPanel();
}

async function academicSaveToReferences() {
  if (!academicResult) return;
  try {
    const res  = await fetch('/api/academic/save-to-references', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(academicResult),
    });
    const data = await res.json();
    if (data.status === 'saved') {
      closeAcademicPreview();
      loadReferences();
      const input = document.getElementById('academic-search-input');
      if (input) input.value = '';
    }
  } catch(e) {
    // Silent -- loadReferences will show current state
  }
}

// Citation leads via Crossref
async function academicFetchLeads() {
  if (!academicResult || !academicResult.url_doi) return;

  const panel = document.getElementById('academic-leads-panel');
  const list  = document.getElementById('leads-list');
  const count = document.getElementById('leads-count');

  if (list)  list.innerHTML  = '<div style="font-size:11px;color:var(--muted);font-family:monospace">Fetching from Crossref...</div>';
  if (panel) panel.style.display = 'block';

  try {
    const res  = await fetch('/api/academic/leads', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ doi: academicResult.url_doi }),
    });
    const data = await res.json();

    if (data.error || !data.leads) {
      if (list) list.innerHTML = `<div style="font-size:11px;color:var(--muted)">No leads available: ${data.error || 'empty response'}</div>`;
      return;
    }

    if (count) count.textContent = `(${data.total} references)`;
    renderLeads(data.leads, list);
  } catch(e) {
    if (list) list.innerHTML = '<div style="font-size:11px;color:var(--muted)">Crossref unreachable</div>';
  }
}

// Leads state
let currentLeads = [];   // full leads array from last Crossref fetch

function renderLeads(leads, container) {
  currentLeads = leads || [];
  if (!container) return;
  if (!currentLeads.length) {
    container.innerHTML = '<div style="font-size:11px;color:var(--muted)">No reference list available for this paper</div>';
    updateLeadsSaveBtn();
    return;
  }

  const html = currentLeads.map((lead, idx) => {
    const title  = lead.title || lead.unstructured || 'Untitled reference';
    const meta   = [lead.author, lead.year, lead.journal].filter(Boolean).join(' · ');
    const inLib  = lead.already_in_library;
    const isOA   = lead.is_likely_oa;
    const hasDOI = !!lead.doi;

    const libBadge = inLib
      ? '<span style="font-size:9px;color:#7a9e7e;font-family:monospace;margin-left:4px">in library</span>'
      : '';
    const oaBadge = isOA && hasDOI
      ? '<span style="font-size:9px;color:#7a9e7e;font-family:monospace;margin-left:4px">open access</span>'
      : '';
    const doiLink = hasDOI
      ? `<a href="${lead.doi}" target="_blank" style="font-size:9px;font-family:monospace;color:var(--muted);text-decoration:none;margin-left:4px">${lead.doi_raw}</a>`
      : '';

    // Checkbox: only for leads not already in library
    const checkbox = !inLib
      ? `<input type="checkbox" data-lead-idx="${idx}" onchange="updateLeadsSaveBtn()" style="margin-right:6px;cursor:pointer;accent-color:var(--accent)">`
      : '<span style="display:inline-block;width:18px"></span>';

    // Preview toggle: only for leads with DOI
    const previewBtn = hasDOI && !inLib
      ? `<button onclick="toggleLeadPreview(${idx})" style="font-size:9px;padding:2px 6px;background:transparent;border:1px solid var(--border);border-radius:3px;color:var(--muted);cursor:pointer;margin-left:4px;font-family:monospace" id="lead-preview-btn-${idx}">+ preview</button>`
      : '';

    return `<div id="lead-row-${idx}" style="padding:6px 0;border-bottom:1px solid var(--border);opacity:${inLib ? '0.5' : '1'}">
      <div style="display:flex;align-items:flex-start;gap:4px">
        ${checkbox}
        <div style="flex:1">
          <div style="font-size:11px;font-weight:500;margin-bottom:2px">${title}${libBadge}${oaBadge}</div>
          <div style="font-size:10px;color:var(--muted)">${meta}${doiLink}${previewBtn}</div>
          <div id="lead-preview-${idx}" style="display:none;margin-top:6px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:4px;font-size:10px;line-height:1.5;color:var(--text)">
            <span style="color:var(--muted);font-family:monospace">Fetching abstract...</span>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  container.innerHTML = html;
  updateLeadsSaveBtn();
}

function updateLeadsSaveBtn() {
  const btn      = document.getElementById('leads-save-btn');
  if (!btn) return;
  const checked  = document.querySelectorAll('input[data-lead-idx]:checked');
  btn.style.display = checked.length > 0 ? 'inline-block' : 'none';
  btn.textContent   = checked.length === 1
    ? 'Save 1 lead to References'
    : `Save ${checked.length} leads to References`;
}

function toggleAllLeads() {
  const boxes   = document.querySelectorAll('input[data-lead-idx]');
  const allOn   = Array.from(boxes).every(b => b.checked);
  boxes.forEach(b => { b.checked = !allOn; });
  updateLeadsSaveBtn();
}

async function toggleLeadPreview(idx) {
  const pane = document.getElementById(`lead-preview-${idx}`);
  const btn  = document.getElementById(`lead-preview-btn-${idx}`);
  if (!pane) return;

  if (pane.style.display !== 'none') {
    pane.style.display = 'none';
    if (btn) btn.textContent = '+ preview';
    return;
  }

  pane.style.display = 'block';
  if (btn) btn.textContent = '- hide';

  const lead = currentLeads[idx];
  if (!lead || !lead.doi_raw) {
    pane.innerHTML = '<span style="color:var(--muted)">No DOI -- abstract unavailable</span>';
    return;
  }

  // Already fetched?
  if (pane.dataset.fetched) return;

  try {
    const res    = await fetch('/api/academic/fetch', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ doi: lead.doi_raw, preferred_source: academicSource }),
    });
    if (!res.ok) throw new Error('not found');
    const data = await res.json();
    const abstract = data.abstract || 'Abstract not available from index';
    const source   = data.tldr_source || data.source || '';
    pane.innerHTML = `<div style="font-size:9px;color:var(--muted);font-family:monospace;margin-bottom:4px">${source}</div>${abstract}`;
    pane.dataset.fetched = '1';
    // Auto-check this lead now that researcher has seen the abstract
    const box = document.querySelector(`input[data-lead-idx="${idx}"]`);
    if (box && !box.checked) box.checked = true;
    updateLeadsSaveBtn();
  } catch(e) {
    pane.innerHTML = '<span style="color:var(--muted)">Abstract unavailable from index</span>';
    pane.dataset.fetched = '1';
  }
}

async function saveCheckedLeads() {
  const checked = Array.from(document.querySelectorAll('input[data-lead-idx]:checked'));
  if (!checked.length) return;

  const btn = document.getElementById('leads-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  let saved = 0;
  for (const box of checked) {
    const idx  = parseInt(box.dataset.leadIdx);
    const lead = currentLeads[idx];
    if (!lead) continue;

    try {
      // Fetch full record (abstract etc) if not already previewed
      const pane = document.getElementById(`lead-preview-${idx}`);
      let result = null;

      if (lead.doi_raw) {
        const res = await fetch('/api/academic/fetch', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ doi: lead.doi_raw, preferred_source: academicSource }),
        });
        if (res.ok) result = await res.json();
      }

      // Fall back to what Crossref gave us if fetch failed or no DOI
      if (!result) {
        result = {
          title:      lead.title || lead.unstructured || '',
          authors:    lead.author || '',
          year:       lead.year || '',
          url_doi:    lead.doi || '',
          abstract:   '',
          tldr_source: 'Crossref lead (no abstract retrieved)',
        };
      }

      await fetch('/api/academic/save-to-references', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(result),
      });
      saved++;

      // Mark row as saved
      box.checked   = false;
      box.disabled  = true;
      const row = document.getElementById(`lead-row-${idx}`);
      if (row) row.style.opacity = '0.4';
    } catch(e) {}
  }

  if (btn) { btn.disabled = false; }
  updateLeadsSaveBtn();
  loadReferences();
  // Refresh leads to update in-library flags
  if (saved > 0) academicFetchLeads();
}

function closeLeadsPanel() {
  const panel = document.getElementById('academic-leads-panel');
  if (panel) panel.style.display = 'none';
  currentLeads = [];
}
