/* ============================================================
   updater.js — Atualização de dados via upload de Excel
   Lê a planilha semanal (mesmo template) e regenera data.json
   client-side, sem backend. Usa SheetJS.
   ============================================================ */

const SHEET_MAP = {
  'creative aristocrata': 'creativeAristocrata',
  'creative fishermans':  'creativeFishermans',
  'mkt fishermans':       'mktFishermans',
  'mkt aristocrata':      'mktAristocrata',
  'trafego':              'trafego',
  'vendas':               'vendas',
  'dashboard':            'dashboard',
};

function _norm(s){
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Replica a lógica de extração (mesma do parser original)
function extractSectionsFromRows(rows){
  const sections = [];
  let current = null;
  for (const row of rows){
    const a = row[0];
    if (a === undefined || a === null || a === '') continue;
    const aStr = typeof a === 'string' ? a : null;
    const B = row[1], F = row[5];
    const hasNoData = (B === undefined || B === null || B === '') && (F === undefined || F === null || F === '');

    // Cabeçalho de seção: texto com 2 espaços à frente, sem dados, e não é subtítulo
    if (aStr && aStr.startsWith('  ') && hasNoData && !aStr.match(/^\s+(MÉTRICAS|METRICAS|RESULTADOS|SAÚDE|SAUDE|META)/i)){
      current = {title: aStr.trim(), metrics: []};
      sections.push(current);
      continue;
    }
    // Linhas de cabeçalho/legenda a ignorar
    if (aStr && (aStr === 'Métrica' || aStr === 'Metrica' || aStr.startsWith('AZUL') ||
                 aStr.startsWith('Relatorio') || aStr.startsWith('Relatório') ||
                 aStr.startsWith('Gerente') || aStr.startsWith('Gestor') || aStr.startsWith('Creative'))) continue;
    if (aStr && aStr.match(/^\s+(MÉTRICAS|METRICAS|RESULTADOS|SAÚDE|SAUDE|META)/i)) continue;

    if (!current){ current = {title: 'GERAL', metrics: []}; sections.push(current); }
    if (aStr && aStr.trim()){
      const num = (v) => (v === undefined || v === null || v === '') ? undefined : (typeof v === 'number' ? v : (isNaN(parseFloat(v)) ? v : parseFloat(v)));
      current.metrics.push({
        name: aStr.trim(),
        s1: num(row[1]), s2: num(row[2]), s3: num(row[3]), s4: num(row[4]),
        total: num(row[5]), avg: num(row[6]), meta: num(row[7]),
        vsMeta: num(row[8]), mom: num(row[9]), obs: row[10],
      });
    }
  }
  return sections;
}

async function parseWorkbook(file){
  if (typeof XLSX === 'undefined') throw new Error('Biblioteca de leitura (SheetJS) não carregou. Verifique sua conexão.');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, {type: 'array'});
  const out = {
    generatedAt: new Date().toISOString().slice(0,10),
    source: file.name,
  };
  for (const sheetName of wb.SheetNames){
    const key = SHEET_MAP[_norm(sheetName).trim()];
    if (!key) continue;
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, {header: 1, raw: true, defval: undefined});
    out[key] = extractSectionsFromRows(rows);
  }
  // Validação mínima
  const missing = ['trafego','creativeFishermans','creativeAristocrata','mktFishermans','mktAristocrata','vendas']
    .filter(k => !out[k] || out[k].length === 0);
  if (missing.length === 7 || !out.trafego){
    throw new Error('A planilha não tem o formato esperado. Use o mesmo modelo (abas: Trafego, MKT, Creative, Vendas).');
  }
  return {data: out, missing};
}

// ===== UI =====
function openUpdater(){
  document.getElementById('updater-overlay').classList.add('open');
  renderArchiveList();
}
function closeUpdater(){
  document.getElementById('updater-overlay').classList.remove('open');
  document.getElementById('updater-status').innerHTML = '';
  document.getElementById('updater-month').innerHTML = '';
  document.getElementById('updater-actions').innerHTML = '';
}

let _pendingData = null;

function guessMonthYear(filename){
  const now = new Date();
  let month = now.getMonth()+1, year = now.getFullYear();
  const f = (filename||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const names = ['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  for (let i=0;i<12;i++){ if (f.includes(names[i])){ month = i+1; break; } }
  const ym = f.match(/(20\d{2})/); if (ym) year = +ym[1];
  return {month, year};
}

async function handleFile(file){
  const statusEl = document.getElementById('updater-status');
  const monthEl = document.getElementById('updater-month');
  const actionsEl = document.getElementById('updater-actions');
  actionsEl.innerHTML = ''; monthEl.innerHTML = '';
  if (!file) return;
  if (!/\.xlsx$/i.test(file.name)){
    statusEl.innerHTML = `<div class="up-msg err">⚠ Envie o arquivo <strong>.xlsx</strong> (mesmo modelo).</div>`;
    return;
  }
  statusEl.innerHTML = `<div class="up-msg">Lendo <strong>${file.name}</strong>…</div>`;
  try {
    const {data} = await parseWorkbook(file);
    _pendingData = data;

    const tr = data.trafego?.[0]?.metrics || [];
    const fishIdx = tr.findIndex(m => /^fishermans$/i.test(m.name));
    const arisIdx = tr.findIndex(m => /^aristocrata$/i.test(m.name));
    const fishRev = tr.slice(fishIdx+1, arisIdx).find(m => _norm(m.name).includes('receita de novos'));
    const arisRev = tr.slice(arisIdx+1).find(m => _norm(m.name).includes('receita de novos'));

    statusEl.innerHTML = `
      <div class="up-msg ok">✓ Planilha lida · ${data.source}</div>
      <div class="up-preview">
        <div><span>Fishermans · Receita NC (mês)</span><strong>${fishRev?.total != null ? 'R$ '+Number(fishRev.total).toLocaleString('pt-BR') : '—'}</strong></div>
        <div><span>Aristocrata · Receita NC (mês)</span><strong>${arisRev?.total != null ? 'R$ '+Number(arisRev.total).toLocaleString('pt-BR') : '—'}</strong></div>
      </div>`;

    const g = guessMonthYear(file.name);
    const opts = MONTH_NAMES.map((m,i)=>`<option value="${i+1}" ${i+1===g.month?'selected':''}>${m}</option>`).join('');
    monthEl.innerHTML = `
      <p class="up-hint">A que <strong>mês</strong> pertence esta planilha?</p>
      <div class="up-month-row">
        <select id="up-month" class="up-field">${opts}</select>
        <input type="number" id="up-year" class="up-field" min="2024" max="2031" value="${g.year}" />
      </div>`;

    actionsEl.innerHTML = `
      <button class="up-btn primary" id="up-apply">Adicionar ao histórico</button>
      <button class="up-btn" id="up-download">Baixar data.json (histórico)</button>`;
    document.getElementById('up-apply').addEventListener('click', addMonth);
    document.getElementById('up-download').addEventListener('click', downloadJson);
  } catch(e){
    statusEl.innerHTML = `<div class="up-msg err">⚠ ${e.message}</div>`;
  }
}

function addMonth(){
  if (!_pendingData) return;
  const month = +document.getElementById('up-month').value;
  const year = +document.getElementById('up-year').value;
  const meta = monthMeta(year, month);
  const d = _pendingData;
  const entry = { ...meta, source: d.source || '', generatedAt: d.generatedAt || '',
    data: { trafego:d.trafego, mktFishermans:d.mktFishermans, mktAristocrata:d.mktAristocrata,
            creativeFishermans:d.creativeFishermans, creativeAristocrata:d.creativeAristocrata,
            vendas:d.vendas, dashboard:d.dashboard } };
  const existed = state.archive.some(m => m.id === meta.id);
  upsertMonth(entry);
  persistArchive();
  selectMonth(state.archive.findIndex(m => m.id === meta.id));
  render();
  updateOverrideBadge();
  document.getElementById('updater-status').innerHTML =
    `<div class="up-msg ok">✓ <strong>${meta.label}</strong> ${existed?'atualizado':'adicionado'} no histórico. Para que <strong>todos</strong> vejam, baixe o data.json e suba no GitHub.</div>`;
  document.getElementById('updater-month').innerHTML = '';
  document.getElementById('updater-actions').innerHTML = `
    <button class="up-btn primary" id="up-download2">Baixar data.json (histórico)</button>
    <button class="up-btn ghost" id="up-close">Fechar</button>`;
  document.getElementById('up-download2').addEventListener('click', downloadJson);
  document.getElementById('up-close').addEventListener('click', closeUpdater);
  _pendingData = null;
  renderArchiveList();
}

function downloadJson(){
  const blob = new Blob([JSON.stringify(serializeArchive(), null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'data.json';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function removeMonth(id){
  const i = state.archive.findIndex(m => m.id === id);
  if (i < 0) return;
  if (!confirm(`Remover ${state.archive[i].label} do histórico?`)) return;
  state.archive.splice(i, 1);
  persistArchive();
  if (!state.archive.length){ localStorage.removeItem(ARCHIVE_KEY); location.reload(); return; }
  selectMonth(Math.min(state.monthIndex, state.archive.length - 1));
  render();
  updateOverrideBadge();
  renderArchiveList();
}

function renderArchiveList(){
  const el = document.getElementById('updater-archive');
  if (!el) return;
  if (!state.archive || !state.archive.length){ el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="up-arch-head">Histórico atual · ${state.archive.length} ${state.archive.length===1?'mês':'meses'}</div>
    <ul class="up-arch-list">
      ${state.archive.map(m => `<li><span class="up-arch-name">${m.label}</span>
        <button class="up-arch-x" data-id="${m.id}" title="Remover do histórico">&times;</button></li>`).join('')}
    </ul>`;
  el.querySelectorAll('.up-arch-x').forEach(b => b.addEventListener('click', () => removeMonth(b.dataset.id)));
}

function clearOverride(){
  localStorage.removeItem('dash_data_override');
  localStorage.removeItem(ARCHIVE_KEY);
  location.reload();
}

function updateOverrideBadge(){
  const badge = document.getElementById('override-badge');
  if (!badge) return;
  const has = !!(localStorage.getItem(ARCHIVE_KEY) || localStorage.getItem('dash_data_override'));
  badge.style.display = has ? 'inline-flex' : 'none';
}

function initUpdater(){
  const btn = document.getElementById('btn-update');
  if (btn) btn.addEventListener('click', openUpdater);
  const closeBtn = document.getElementById('updater-close');
  if (closeBtn) closeBtn.addEventListener('click', closeUpdater);
  const overlay = document.getElementById('updater-overlay');
  if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) closeUpdater(); });

  const input = document.getElementById('updater-input');
  const drop = document.getElementById('updater-drop');
  if (input) input.addEventListener('change', (e) => handleFile(e.target.files[0]));
  if (drop){
    drop.addEventListener('click', () => input && input.click());
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault(); drop.classList.remove('dragover');
      handleFile(e.dataTransfer.files[0]);
    });
  }
  const clearBtn = document.getElementById('override-clear');
  if (clearBtn) clearBtn.addEventListener('click', clearOverride);
  updateOverrideBadge();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initUpdater);
else initUpdater();
