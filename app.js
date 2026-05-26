/* ============================================================
   Dashboard Fishermans & Aristocrata — app logic
   ============================================================ */

const state = {
  brand: 'all',      // all | fishermans | aristocrata
  period: 'month',   // month | s1 | s2 | s3 | s4
  data: null,
};

// ===== Formatters =====
const fmt = {
  brl: (n, opts={}) => {
    if (n == null || isNaN(n)) return '—';
    const abs = Math.abs(n);
    if (opts.compact && abs >= 1000) {
      if (abs >= 1e6) return 'R$ ' + (n/1e6).toFixed(abs >= 1e7 ? 1 : 2) + 'M';
      return 'R$ ' + (n/1e3).toFixed(abs >= 1e5 ? 0 : 1) + 'k';
    }
    return 'R$ ' + n.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0});
  },
  pct: (n) => {
    if (n == null || isNaN(n)) return '—';
    return (n * 100).toFixed(n < 0.01 ? 2 : 1) + '%';
  },
  num: (n) => {
    if (n == null || isNaN(n)) return '—';
    return n.toLocaleString('pt-BR', {maximumFractionDigits: n < 10 ? 2 : 0});
  },
  dec: (n, d=2) => {
    if (n == null || isNaN(n)) return '—';
    return n.toFixed(d);
  }
};

// ===== Helpers =====
function valueForPeriod(metric, period){
  if (!metric) return null;
  if (period === 'month') {
    if (metric.total != null) return metric.total;
    // Fallback: sum weekly values if total missing
    const w = [metric.s1, metric.s2, metric.s3, metric.s4].filter(v => v != null);
    return w.length ? w.reduce((a,b) => a+b, 0) : null;
  }
  if (period === 's1') return metric.s1;
  if (period === 's2') return metric.s2;
  if (period === 's3') return metric.s3;
  if (period === 's4') return metric.s4;
  return null;
}

function findMetric(sections, sectionName, metricNames){
  const sec = sections.find(s => normalize(s.title).includes(normalize(sectionName)));
  if (!sec) return null;
  const names = Array.isArray(metricNames) ? metricNames : [metricNames];
  for (const n of names) {
    const m = sec.metrics.find(mm => normalize(mm.name).includes(normalize(n)));
    if (m) return m;
  }
  return null;
}
function normalize(s){
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ===== Brand-specific data extraction =====
// Trafego sheet has GERAL section with FISHERMANS rows then ARISTOCRATA rows
function getTrafegoSplit(data){
  if (!data || !data.trafego || !data.trafego[0]) return {fish:[], aris:[]};
  const metrics = data.trafego[0].metrics;
  const fishIdx = metrics.findIndex(m => /^fishermans$/i.test(m.name));
  const arisIdx = metrics.findIndex(m => /^aristocrata$/i.test(m.name));
  return {
    fish: metrics.slice(fishIdx + 1, arisIdx),
    aris: metrics.slice(arisIdx + 1),
  };
}

function metricFromArr(arr, search){
  const target = normalize(search);
  return arr.find(m => normalize(m.name).includes(target));
}

// ===== Compute brand KPIs =====
function brandKpis(brand){
  const {fish, aris} = getTrafegoSplit(state.data);
  const p = state.period;
  const arr = brand === 'fishermans' ? fish : brand === 'aristocrata' ? aris : [...fish, ...aris];

  if (brand === 'all') {
    // Sum both
    const sumMetric = (name) => {
      const f = metricFromArr(fish, name);
      const a = metricFromArr(aris, name);
      return (valueForPeriod(f, p) || 0) + (valueForPeriod(a, p) || 0);
    };
    const avgMetric = (name) => {
      const f = metricFromArr(fish, name);
      const a = metricFromArr(aris, name);
      const fv = valueForPeriod(f, p);
      const av = valueForPeriod(a, p);
      if (fv == null && av == null) return null;
      return ((fv || 0) + (av || 0)) / [fv, av].filter(x=>x!=null).length;
    };
    return {
      revenue: sumMetric('Receita de Novos'),
      spend: sumMetric('Gasto Total em Midia'),
      amer: avgMetric('aMER'),
      mc: sumMetric('MC de Aquisicao'),
      mcPct: avgMetric('MC %'),
      nnc: sumMetric('NNC'),
      cpm: avgMetric('CPM'),
      ctr: avgMetric('CTR Link'),
      cvr: avgMetric('CVR de Checkout'),
      freq: avgMetric('Frequencia'),
      cpc: avgMetric('CPC'),
    };
  }
  return {
    revenue: valueForPeriod(metricFromArr(arr, 'Receita de Novos'), p),
    spend:   valueForPeriod(metricFromArr(arr, 'Gasto Total em Midia'), p),
    amer:    valueForPeriod(metricFromArr(arr, 'aMER'), p),
    mc:      valueForPeriod(metricFromArr(arr, 'MC de Aquisicao'), p),
    mcPct:   valueForPeriod(metricFromArr(arr, 'MC %'), p),
    nnc:     valueForPeriod(metricFromArr(arr, 'NNC'), p),
    cpm:     valueForPeriod(metricFromArr(arr, 'CPM'), p),
    ctr:     valueForPeriod(metricFromArr(arr, 'CTR Link'), p),
    cvr:     valueForPeriod(metricFromArr(arr, 'CVR de Checkout'), p),
    freq:    valueForPeriod(metricFromArr(arr, 'Frequencia'), p),
    cpc:     valueForPeriod(metricFromArr(arr, 'CPC'), p),
  };
}

// ===== Marketplaces =====
const MKT_CHANNELS = ['MERCADO LIVRE', 'AMAZON', 'SHOPEE', 'TIKTOK SHOP', 'SHEIN', 'MAGALU'];

function labelChannel(ch){
  const map = {
    'MERCADO LIVRE': 'Mercado Livre',
    'AMAZON': 'Amazon',
    'SHOPEE': 'Shopee',
    'TIKTOK SHOP': 'TikTok Shop',
    'SHEIN': 'Shein',
    'MAGALU': 'Magalu',
  };
  for (const k of Object.keys(map)) if (ch.includes(k)) return map[k];
  return ch;
}

function marketplaceData(brand){
  const sheets = [];
  if (brand === 'all' || brand === 'fishermans') sheets.push({brand:'fish', data: state.data.mktFishermans});
  if (brand === 'all' || brand === 'aristocrata') sheets.push({brand:'aris', data: state.data.mktAristocrata});

  const result = MKT_CHANNELS.map(ch => {
    const row = {channel: ch, gmv: 0, margin: 0, ads: 0, tacos: null};
    for (const sh of sheets) {
      const sec = sh.data.find(s => normalize(s.title).includes(normalize(ch)));
      if (!sec) continue;
      const gmv = valueForPeriod(sec.metrics.find(m => normalize(m.name).includes('receita (gmv)')), state.period) || 0;
      const margin = valueForPeriod(sec.metrics.find(m => normalize(m.name).includes('margem liquida')), state.period) || 0;
      const ads = valueForPeriod(sec.metrics.find(m => normalize(m.name).includes('gasto em ads')), state.period) || 0;
      row.gmv += gmv;
      row.margin += margin;
      row.ads += ads;
    }
    row.tacos = row.gmv > 0 ? row.ads / row.gmv : null;
    return row;
  });
  return result;
}

// ===== Creative =====
function creativeRows(brand){
  const rows = [];
  if (brand === 'all' || brand === 'fishermans') {
    for (const sec of state.data.creativeFishermans) {
      if (/consolidado|diagnosticas/i.test(normalize(sec.title))) continue;
      const clean = sec.title.replace(/^LINHA /, '');
      const titleCase = clean.charAt(0) + clean.slice(1).toLowerCase();
      rows.push({
        brand: 'fish',
        label: 'F · ' + titleCase,
        title: sec.title,
        ...readCreative(sec.metrics)
      });
    }
  }
  if (brand === 'all' || brand === 'aristocrata') {
    // Aristocrata creative is a single section in our data
    const sec = state.data.creativeAristocrata[0];
    if (sec) {
      rows.push({brand:'aris', label:'A · Geral', title: 'GERAL', ...readCreative(sec.metrics)});
    }
  }
  return rows;
}
function readCreative(metrics){
  const p = state.period;
  const m = (n) => valueForPeriod(metricFromArr(metrics, n), p);
  return {
    launched: m('Criativos Lancados'),
    winners: m('Criativos Vencedores'),
    winRate: m('Win Rate'),
    hook: m('Hook Rate'),
    hold: m('Hold Rate'),
    ctr: m('CTR Link'),
    cpm: m('CPM'),
    costHook: m('Custo por Hook'),
    freq: m('Frequencia'),
  };
}

// ===== Sales team (Fishermans only) =====
function salesRows(){
  const rows = [];
  const p = state.period;
  for (const sec of state.data.vendas) {
    if (/consolidado/i.test(sec.title)) continue;
    const m = (n) => valueForPeriod(metricFromArr(sec.metrics, n), p);
    rows.push({
      name: sec.title.split('—')[0].trim(),
      role: sec.title.split('—')[1]?.trim() || '',
      revenue: m('Faturamento'),
      sales: m('Vendas Fechadas'),
      leads: m('Leads'),
      cvr: m('CVR de Vendas'),
      ticket: m('Ticket Medio'),
      tmr: m('Tempo Medio de Resposta'),
      nps: m('NPS'),
    });
  }
  return rows;
}

// ===== Render =====
function render(){
  renderKpis();
  renderSnapshot();
  renderHistoricalTable();
  renderAlavancagem();
  renderFunnel();
  renderEvolutionChart();
  renderBrandCards();
  renderMarketplaces();
  renderCreatives();
  renderSales();
  document.getElementById('kpi-meta').textContent =
    (state.period === 'month' ? 'Total mês · maio/2026' : 'Semana ' + state.period.replace('s','') + ' · maio/2026');
}

function renderKpis(){
  const k = brandKpis(state.brand);
  const set = (id, val) => document.getElementById(id).innerHTML = val;

  set('kpi-revenue', `<span>${fmt.brl(k.revenue, {compact:true})}</span>`);
  // Synthetic MoM delta (no historical data yet); show static placeholder
  const monthlyTarget = state.brand === 'fishermans' ? 600000 : state.brand === 'aristocrata' ? 800000 : 1400000;
  const delta = k.revenue ? ((k.revenue / monthlyTarget - 1) * 100) : null;
  const deltaEl = document.getElementById('kpi-revenue-delta');
  if (delta != null) {
    const cls = delta >= 0 ? 'up' : 'down';
    const arrow = delta >= 0 ? '▲' : '▼';
    deltaEl.className = 'kpi-delta ' + cls;
    deltaEl.textContent = `${arrow} ${Math.abs(delta).toFixed(1)}% vs meta · ${fmt.brl(monthlyTarget,{compact:true})}`;
  }

  set('kpi-amer', fmt.dec(k.amer, 2) + '<span class="u">x</span>');
  document.getElementById('kpi-amer-sub').textContent =
    k.amer >= 2.5 ? 'Saudável · acima de 2,5x' : k.amer >= 1.5 ? 'Em vigilância' : 'Crítico · abaixo do mínimo';

  set('kpi-nnc', fmt.num(k.nnc));
  document.getElementById('kpi-nnc-sub').textContent = 'Clientes em primeira compra';

  set('kpi-mc', fmt.brl(k.mc, {compact:true}));
  document.getElementById('kpi-mc-sub').textContent = 'MC · ' + fmt.pct(k.mcPct);

  set('kpi-cvr', fmt.pct(k.cvr));
  document.getElementById('kpi-cvr-sub').textContent = 'Checkout · meta 8–12%';

  // Hook avg
  const creatives = creativeRows(state.brand).filter(r => r.hook != null);
  const hookAvg = creatives.length ? creatives.reduce((s,r) => s + r.hook, 0) / creatives.length : null;
  set('kpi-hook', fmt.pct(hookAvg));
  document.getElementById('kpi-hook-sub').textContent =
    hookAvg != null && hookAvg >= 0.20 ? 'Dentro da meta' : 'Abaixo da meta';

  renderSparkline();
}

function renderSparkline(){
  const ctx = document.getElementById('spark-revenue');
  if (!ctx) return;
  if (ctx._chart) ctx._chart.destroy();
  const {fish, aris} = getTrafegoSplit(state.data);
  const series = ['s1','s2','s3','s4'].map(p => {
    const sample = state.brand === 'fishermans' ? fish : state.brand === 'aristocrata' ? aris : [...fish, ...aris];
    let total = 0; let hasData = false;
    if (state.brand === 'all') {
      const fm = metricFromArr(fish, 'Receita de Novos');
      const am = metricFromArr(aris, 'Receita de Novos');
      const fv = valueForPeriod(fm, p);
      const av = valueForPeriod(am, p);
      if (fv != null || av != null) hasData = true;
      total = (fv || 0) + (av || 0);
    } else {
      const m = metricFromArr(sample, 'Receita de Novos');
      const v = valueForPeriod(m, p);
      hasData = v != null;
      total = v || 0;
    }
    return hasData ? total : null;
  });

  const color = state.brand === 'fishermans' ? css('--fish')
              : state.brand === 'aristocrata' ? css('--aris')
              : css('--ink');
  ctx._chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['S1','S2','S3','S4'],
      datasets: [{
        data: series, borderColor: color, backgroundColor: color + '22',
        borderWidth: 2, tension: .35, pointRadius: 3, pointBackgroundColor: color,
        fill: true,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: {legend:{display:false}, tooltip:{
        callbacks: { label: c => fmt.brl(c.raw, {compact:true}) }
      }},
      scales: {x:{display:false}, y:{display:false, beginAtZero: true}},
      elements: {point: {radius: 3}},
    }
  });
}

function renderEvolutionChart(){
  const ctx = document.getElementById('chart-revenue');
  if (!ctx) return;
  if (ctx._chart) ctx._chart.destroy();
  const {fish, aris} = getTrafegoSplit(state.data);

  const periods = ['s1','s2','s3','s4'];
  const fishRev = periods.map(p => valueForPeriod(metricFromArr(fish, 'Receita de Novos'), p) || null);
  const arisRev = periods.map(p => valueForPeriod(metricFromArr(aris, 'Receita de Novos'), p) || null);
  const fishSpend = periods.map(p => valueForPeriod(metricFromArr(fish, 'Gasto Total em Midia'), p) || null);
  const arisSpend = periods.map(p => valueForPeriod(metricFromArr(aris, 'Gasto Total em Midia'), p) || null);

  const datasets = [];
  if (state.brand === 'all' || state.brand === 'fishermans') {
    datasets.push({type:'bar', label:'Fishermans · Receita NC', data: fishRev,
      backgroundColor: css('--fish'), borderRadius: 3, stack:'rev', order: 2, yAxisID:'y'});
  }
  if (state.brand === 'all' || state.brand === 'aristocrata') {
    datasets.push({type:'bar', label:'Aristocrata · Receita NC', data: arisRev,
      backgroundColor: css('--aris'), borderRadius: 3, stack: state.brand==='all'?'rev2':'rev', order: 2, yAxisID:'y'});
  }
  if (state.brand === 'all' || state.brand === 'fishermans') {
    datasets.push({type:'line', label:'Fishermans · Gasto Mídia', data: fishSpend,
      borderColor: css('--fish-2'), backgroundColor:'transparent', borderWidth:2, borderDash:[6,4], tension:.3, pointRadius:4, order:1, yAxisID:'y1'});
  }
  if (state.brand === 'all' || state.brand === 'aristocrata') {
    datasets.push({type:'line', label:'Aristocrata · Gasto Mídia', data: arisSpend,
      borderColor: css('--aris-2'), backgroundColor:'transparent', borderWidth:2, borderDash:[6,4], tension:.3, pointRadius:4, order:1, yAxisID:'y1'});
  }

  ctx._chart = new Chart(ctx, {
    data: { labels: ['Semana 1','Semana 2','Semana 3','Semana 4'], datasets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: {mode:'index', intersect:false},
      plugins: {
        legend:{display:true, position:'bottom', labels:{font:{family:'Inter',size:11}, boxWidth:12, boxHeight:12, padding:14, color: css('--ink-2')}},
        tooltip:{callbacks:{ label: (c) => `${c.dataset.label}: ${fmt.brl(c.raw, {compact:true})}` }}
      },
      scales: {
        x:{grid:{display:false}, ticks:{color: css('--ink-3'), font:{family:'JetBrains Mono',size:11}}},
        y:{position:'left', grid:{color: css('--rule')}, ticks:{color: css('--ink-3'), font:{family:'JetBrains Mono',size:10}, callback: v => fmt.brl(v,{compact:true})}, beginAtZero:true},
        y1:{position:'right', grid:{display:false}, ticks:{color: css('--ink-3'), font:{family:'JetBrains Mono',size:10}, callback: v => fmt.brl(v,{compact:true})}, beginAtZero:true},
      }
    }
  });
}

function renderBrandCards(){
  const {fish, aris} = getTrafegoSplit(state.data);
  const p = state.period;
  const fK = {
    revenue: valueForPeriod(metricFromArr(fish, 'Receita de Novos'), p),
    spend: valueForPeriod(metricFromArr(fish, 'Gasto Total em Midia'), p),
    amer: valueForPeriod(metricFromArr(fish, 'aMER'), p),
    nnc: valueForPeriod(metricFromArr(fish, 'NNC'), p),
    cpm: valueForPeriod(metricFromArr(fish, 'CPM'), p),
    ctr: valueForPeriod(metricFromArr(fish, 'CTR Link'), p),
    cvr: valueForPeriod(metricFromArr(fish, 'CVR de Checkout'), p),
    freq: valueForPeriod(metricFromArr(fish, 'Frequencia'), p),
  };
  const aK = {
    revenue: valueForPeriod(metricFromArr(aris, 'Receita de Novos'), p),
    spend: valueForPeriod(metricFromArr(aris, 'Gasto Total em Midia'), p),
    amer: valueForPeriod(metricFromArr(aris, 'aMER'), p),
    nnc: valueForPeriod(metricFromArr(aris, 'NNC'), p),
    cpm: valueForPeriod(metricFromArr(aris, 'CPM'), p),
    ctr: valueForPeriod(metricFromArr(aris, 'CTR Link'), p),
    cvr: valueForPeriod(metricFromArr(aris, 'CVR de Checkout'), p),
    freq: valueForPeriod(metricFromArr(aris, 'Frequencia'), p),
  };
  document.getElementById('f-revenue').textContent = fmt.brl(fK.revenue, {compact:true});
  document.getElementById('f-spend').textContent = fmt.brl(fK.spend, {compact:true});
  document.getElementById('f-amer').textContent = fmt.dec(fK.amer,2);
  document.getElementById('f-nnc').textContent = fmt.num(fK.nnc);
  document.getElementById('f-cpm').textContent = fmt.brl(fK.cpm);
  document.getElementById('f-ctr').textContent = fmt.pct(fK.ctr);
  document.getElementById('f-cvr').textContent = fmt.pct(fK.cvr);
  document.getElementById('f-freq').textContent = fmt.dec(fK.freq, 2);

  document.getElementById('a-revenue').textContent = fmt.brl(aK.revenue, {compact:true});
  document.getElementById('a-spend').textContent = fmt.brl(aK.spend, {compact:true});
  document.getElementById('a-amer').textContent = fmt.dec(aK.amer,2);
  document.getElementById('a-nnc').textContent = fmt.num(aK.nnc);
  document.getElementById('a-cpm').textContent = fmt.brl(aK.cpm);
  document.getElementById('a-ctr').textContent = fmt.pct(aK.ctr);
  document.getElementById('a-cvr').textContent = fmt.pct(aK.cvr);
  document.getElementById('a-freq').textContent = fmt.dec(aK.freq, 2);
}

function renderMarketplaces(){
  const ctx = document.getElementById('chart-marketplaces');
  if (ctx._chart) ctx._chart.destroy();
  const rows = marketplaceData(state.brand);

  // chart: bars per channel
  ctx._chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: rows.map(r => r.channel.replace('TIKTOK SHOP','TikTok Shop').replace('MERCADO LIVRE','Mercado Livre').replace(/MAGALU.*/,'Magalu').replace('AMAZON','Amazon').replace('SHOPEE','Shopee').replace('SHEIN','Shein')),
      datasets: [
        {label:'GMV', data: rows.map(r => r.gmv), backgroundColor: css('--fish'), borderRadius: 3, stack:'a'},
        {label:'Margem Líquida', data: rows.map(r => r.margin), backgroundColor: css('--fish-2'), borderRadius: 3, stack:'b'},
        {label:'Ads', data: rows.map(r => r.ads), backgroundColor: css('--aris-2'), borderRadius: 3, stack:'c'},
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins:{
        legend:{display:true, position:'bottom', labels:{font:{family:'Inter',size:11}, boxWidth:10, boxHeight:10, padding:14, color: css('--ink-2')}},
        tooltip:{callbacks:{ label: c => `${c.dataset.label}: ${fmt.brl(c.raw, {compact:true})}` }}
      },
      scales: {
        x:{grid:{display:false}, ticks:{color:css('--ink-3'), font:{family:'JetBrains Mono', size:10}}},
        y:{grid:{color:css('--rule')}, ticks:{color:css('--ink-3'), font:{family:'JetBrains Mono', size:10}, callback: v => fmt.brl(v, {compact:true})}, beginAtZero:true},
      }
    }
  });

  // table
  const tb = document.querySelector('#mkt-table tbody');
  tb.innerHTML = '';
  let totals = {gmv:0, margin:0, ads:0};
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="name">${labelChannel(r.channel)}</td>
      <td class="right">${fmt.brl(r.gmv, {compact:true})}</td>
      <td class="right">${fmt.brl(r.margin, {compact:true})}</td>
      <td class="right">${fmt.brl(r.ads, {compact:true})}</td>
      <td class="right">${fmt.pct(r.tacos)}</td>`;
    tb.appendChild(tr);
    totals.gmv += r.gmv; totals.margin += r.margin; totals.ads += r.ads;
  });
  const totalRow = document.createElement('tr');
  totalRow.className = 'total';
  const tacos = totals.gmv > 0 ? totals.ads / totals.gmv : null;
  totalRow.innerHTML = `<td class="name">Total</td>
    <td class="right">${fmt.brl(totals.gmv, {compact:true})}</td>
    <td class="right">${fmt.brl(totals.margin, {compact:true})}</td>
    <td class="right">${fmt.brl(totals.ads, {compact:true})}</td>
    <td class="right">${fmt.pct(tacos)}</td>`;
  tb.appendChild(totalRow);
}

function renderCreatives(){
  const rows = creativeRows(state.brand);
  const ctx = document.getElementById('chart-creative');
  if (ctx._chart) ctx._chart.destroy();

  const labels = rows.map(r => r.label);
  const hook = rows.map(r => (r.hook || 0) * 100);
  const ctr = rows.map(r => (r.ctr || 0) * 100);
  const hold = rows.map(r => (r.hold || 0) * 100);

  ctx._chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {label:'Hook Rate %', data: hook, backgroundColor: rows.map(r => r.brand==='fish' ? css('--fish') : css('--aris')), borderRadius: 3},
        {label:'Hold Rate %', data: hold, backgroundColor: rows.map(r => r.brand==='fish' ? css('--fish-2') : css('--aris-2')), borderRadius: 3},
        {label:'CTR %', data: ctr, backgroundColor: rows.map(r => r.brand==='fish' ? css('--fish-3') : css('--aris-3')), borderRadius: 3},
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins:{
        legend:{display:true, position:'bottom', labels:{font:{family:'Inter',size:11}, boxWidth:10, boxHeight:10, padding:14, color: css('--ink-2')}},
        tooltip:{callbacks:{ label: c => `${c.dataset.label}: ${c.raw.toFixed(2)}%` }}
      },
      scales: {
        x:{grid:{display:false}, ticks:{color:css('--ink-3'), font:{family:'JetBrains Mono', size:10}}},
        y:{grid:{color:css('--rule')}, ticks:{color:css('--ink-3'), font:{family:'JetBrains Mono', size:10}, callback: v => v.toFixed(0) + '%'}, beginAtZero:true},
      }
    }
  });

  const tb = document.querySelector('#creative-table tbody');
  tb.innerHTML = '';
  rows.forEach(r => {
    const tr = document.createElement('tr');
    const pillClass = r.brand === 'fish' ? 'fish' : 'aris';
    tr.innerHTML = `<td class="brand-pill ${pillClass}">${r.label}</td>
      <td class="right">${fmt.num(r.launched)}</td>
      <td class="right">${fmt.num(r.winners)}</td>
      <td class="right">${fmt.pct(r.winRate)}</td>
      <td class="right">${fmt.pct(r.hook)}</td>
      <td class="right">${fmt.pct(r.hold)}</td>
      <td class="right">${fmt.pct(r.ctr)}</td>
      <td class="right">${fmt.brl(r.cpm)}</td>
      <td class="right">${fmt.brl(r.costHook)}</td>
      <td class="right">${fmt.dec(r.freq, 2)}</td>`;
    tb.appendChild(tr);
  });
}

function renderSales(){
  const block = document.getElementById('sales-block');
  // Only show on Fishermans or all
  block.style.display = state.brand === 'aristocrata' ? 'none' : '';
  if (state.brand === 'aristocrata') return;

  const rows = salesRows();
  const tb = document.querySelector('#sales-table tbody');
  tb.innerHTML = '';
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="name">${r.name}<br><span style="font-weight:400;color:var(--ink-3);font-size:11px">${r.role}</span></td>
      <td class="right">${fmt.brl(r.revenue, {compact:true})}</td>
      <td class="right">${fmt.num(r.sales)}</td>
      <td class="right">${fmt.num(r.leads)}</td>
      <td class="right">${fmt.pct(r.cvr)}</td>
      <td class="right">${fmt.brl(r.ticket, {compact:true})}</td>
      <td class="right">${r.tmr != null ? (r.tmr/60).toFixed(0) + ' min' : '—'}</td>
      <td class="right">${fmt.num(r.nps)}</td>`;
    tb.appendChild(tr);
  });
}

// ===== NEW SECTIONS — 1.1 / 1.2 / 1.3 / 1.4 =====

function detectCurrentWeek(){
  const {fish} = getTrafegoSplit(state.data);
  const rev = metricFromArr(fish, 'Receita de Novos');
  if (!rev) return 4;
  for (let i = 4; i >= 1; i--) {
    if (rev['s' + i] != null) return i;
  }
  return 1;
}

function weekDateLabel(w){
  // Approximate week ranges for May 2026 (Mon-Fri)
  const ranges = ['27/04–03/05','04/05–10/05','11/05–17/05','18/05–24/05'];
  return ranges[w - 1] || '';
}

function brandWeeklyAcquisition(){
  const {fish, aris} = getTrafegoSplit(state.data);
  const fr = metricFromArr(fish, 'Receita de Novos');
  const fg = metricFromArr(fish, 'Gasto Total em Midia');
  const fm = metricFromArr(fish, 'aMER');
  const ar = metricFromArr(aris, 'Receita de Novos');
  const ag = metricFromArr(aris, 'Gasto Total em Midia');
  const am = metricFromArr(aris, 'aMER');
  const out = [];
  for (let i = 1; i <= 4; i++) {
    out.push({
      week: i,
      fishGasto: fg?.['s'+i] ?? null,
      fishRev:   fr?.['s'+i] ?? null,
      fishAmer:  fm?.['s'+i] ?? null,
      arisGasto: ag?.['s'+i] ?? null,
      arisRev:   ar?.['s'+i] ?? null,
      arisAmer:  am?.['s'+i] ?? null,
    });
  }
  return out;
}

function brandWeeklyCreative(){
  // Average hook rate across Fishermans products + Aristocrata consolidated
  const fishProducts = state.data.creativeFishermans.filter(s =>
    !/consolidado|diagnosticas/i.test(normalize(s.title))
  );
  const out = [];
  for (let i = 1; i <= 4; i++) {
    // Fishermans: average hook rate / win rate across products that have data
    const hooks = [], wins = [], launched = [], winners = [];
    for (const sec of fishProducts) {
      const h = metricFromArr(sec.metrics, 'Hook Rate')?.['s'+i];
      const l = metricFromArr(sec.metrics, 'Criativos Lancados')?.['s'+i];
      const w = metricFromArr(sec.metrics, 'Criativos Vencedores')?.['s'+i];
      if (h != null) hooks.push(h);
      if (l != null) launched.push(l);
      if (w != null) winners.push(w);
    }
    const fishHook = hooks.length ? hooks.reduce((a,b)=>a+b,0)/hooks.length : null;
    const totalLaunched = launched.reduce((a,b)=>a+b,0);
    const totalWinners = winners.reduce((a,b)=>a+b,0);
    const fishWin = totalLaunched > 0 ? totalWinners / totalLaunched : null;
    out.push({
      week: i,
      fishHook,
      fishWin,
      arisHook: null,  // not available per-week in current data
      arisWin: null,
    });
  }
  return out;
}

function renderSnapshot(){
  const w = detectCurrentWeek();
  const prev = w > 1 ? w - 1 : null;
  const data = brandWeeklyAcquisition();
  const cur = data[w - 1];
  const prv = prev ? data[prev - 1] : null;

  // Update week labels
  document.querySelectorAll('.snap-week-tag, #snap-week').forEach(el => el.textContent = `(Sem ${w})`);

  const setDelta = (id, cur, prev, isPct=false) => {
    const el = document.getElementById(id);
    if (cur == null || prev == null || prev === 0) { el.className = 'snap-delta flat'; el.textContent = '— sem comparativo'; return; }
    const diff = isPct ? (cur - prev) : ((cur - prev) / prev);
    const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '—';
    const cls = diff > 0.001 ? 'up' : diff < -0.001 ? 'down' : 'flat';
    el.className = 'snap-delta ' + cls;
    const txt = isPct ? Math.abs(diff).toFixed(2) : (Math.abs(diff)*100).toFixed(0) + '%';
    el.textContent = `${arrow} ${txt} vs Sem ${prev?w-1:'—'}`;
  };

  // aMER values are absolute - delta is absolute difference
  document.getElementById('snap-amer-fish').textContent = cur.fishAmer != null ? cur.fishAmer.toFixed(2).replace('.',',') : '—';
  setDelta('snap-amer-fish-delta', cur.fishAmer, prv?.fishAmer, true);

  document.getElementById('snap-amer-aris').textContent = cur.arisAmer != null ? cur.arisAmer.toFixed(2).replace('.',',') : '—';
  setDelta('snap-amer-aris-delta', cur.arisAmer, prv?.arisAmer, true);

  // Revenue - delta is %
  document.getElementById('snap-rev-fish').textContent = fmt.brl(cur.fishRev, {compact:true});
  setDelta('snap-rev-fish-delta', cur.fishRev, prv?.fishRev, false);

  document.getElementById('snap-rev-aris').textContent = fmt.brl(cur.arisRev, {compact:true});
  setDelta('snap-rev-aris-delta', cur.arisRev, prv?.arisRev, false);
}

function renderHistoricalTable(){
  const tb = document.querySelector('#hist-table tbody');
  if (!tb) return;
  tb.innerHTML = '';
  const cur = detectCurrentWeek();
  const data = brandWeeklyAcquisition();
  data.forEach(row => {
    const tr = document.createElement('tr');
    if (row.week === cur) tr.className = 'current';
    const star = row.week === cur ? ' ★' : '';
    tr.innerHTML = `
      <td class="semana">Sem ${row.week} — ${weekDateLabel(row.week)}${star}</td>
      <td class="fish">${row.fishGasto != null ? fmt.brl(row.fishGasto,{compact:true}) : '—'}</td>
      <td class="fish">${row.fishRev != null ? fmt.brl(row.fishRev,{compact:true}) : '—'}</td>
      <td class="fish">${row.fishAmer != null ? row.fishAmer.toFixed(2).replace('.',',') : '—'}</td>
      <td class="aris">${row.arisGasto != null ? fmt.brl(row.arisGasto,{compact:true}) : '—'}</td>
      <td class="aris">${row.arisRev != null ? fmt.brl(row.arisRev,{compact:true}) : '—'}</td>
      <td class="aris">${row.arisAmer != null ? row.arisAmer.toFixed(2).replace('.',',') : '—'}</td>
    `;
    tb.appendChild(tr);
  });
}

function makeAlavancagemChart(canvas, data, brand){
  if (canvas._chart) canvas._chart.destroy();
  const isFish = brand === 'fish';
  const c1 = isFish ? css('--fish') : css('--aris');
  const c2 = isFish ? '#a8b8da' : '#e8d59f';
  const labels = data.map(d => `Sem ${d.week}\n${weekDateLabel(d.week)}`);
  canvas._chart = new Chart(canvas, {
    data: {
      labels,
      datasets: [
        {type:'bar', label:'Gasto Mídia', data: data.map(d => isFish ? d.fishGasto : d.arisGasto),
          backgroundColor: c2, borderRadius: 2, yAxisID:'y', order: 3},
        {type:'line', label:'Receita NC', data: data.map(d => isFish ? d.fishRev : d.arisRev),
          borderColor: c1, backgroundColor:'transparent', borderWidth: 2.5, tension: .25,
          pointRadius: 4, pointBackgroundColor: c1, yAxisID:'y', order: 1},
        {type:'line', label:'aMER', data: data.map(d => isFish ? d.fishAmer : d.arisAmer),
          borderColor: c1, backgroundColor:'transparent', borderWidth: 2, borderDash:[6,4],
          tension: .25, pointRadius: 3, pointStyle: 'rectRot', yAxisID:'y1', order: 2},
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: {mode:'index', intersect:false},
      plugins: {
        legend:{position:'bottom', labels:{font:{family:'Inter',size:10}, boxWidth:10, padding:10, color: css('--ink-2')}},
        tooltip:{callbacks:{
          label: (c) => `${c.dataset.label}: ${c.dataset.yAxisID==='y1' ? c.raw?.toFixed(2) : fmt.brl(c.raw,{compact:true})}`
        }}
      },
      scales: {
        x:{grid:{display:false}, ticks:{color: css('--ink-3'), font:{family:'JetBrains Mono', size:9}}},
        y:{position:'left', grid:{color: css('--rule')},
          ticks:{color: css('--ink-3'), font:{family:'JetBrains Mono', size:9}, callback: v => fmt.brl(v,{compact:true})},
          beginAtZero: true,
          title: {display: true, text: 'Receita NC / Gasto (R$)', color: css('--ink-3'), font:{size:10}}},
        y1:{position:'right', grid:{display:false},
          ticks:{color: css('--ink-3'), font:{family:'JetBrains Mono', size:9}, callback: v => v.toFixed(2)},
          beginAtZero: true, suggestedMax: 4.5,
          title: {display: true, text: 'aMER', color: css('--ink-3'), font:{size:10}}},
      }
    }
  });
}

function renderAlavancagem(){
  const data = brandWeeklyAcquisition();
  makeAlavancagemChart(document.getElementById('chart-alav-fish'), data, 'fish');
  makeAlavancagemChart(document.getElementById('chart-alav-aris'), data, 'aris');
}

function renderFunnel(){
  const creative = brandWeeklyCreative();
  const acquisition = brandWeeklyAcquisition();
  const labels = acquisition.map(d => `Sem ${d.week}\n${weekDateLabel(d.week)}`);

  // Hook + Win Rate chart
  const ch1 = document.getElementById('chart-funnel-hook');
  if (ch1._chart) ch1._chart.destroy();
  ch1._chart = new Chart(ch1, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {label:'Fishermans — Hook Rate', data: creative.map(c => c.fishHook != null ? c.fishHook * 100 : null),
          borderColor: css('--fish'), backgroundColor: css('--fish') + '22', borderWidth: 2.5, tension: .2,
          pointRadius: 4, pointBackgroundColor: css('--fish'), fill: false},
        {label:'Fishermans — Win Rate', data: creative.map(c => c.fishWin != null ? c.fishWin * 100 : null),
          borderColor: css('--fish'), borderWidth: 1.5, borderDash:[6,4], tension: .2,
          pointRadius: 3, pointStyle:'rectRot', pointBackgroundColor: css('--fish'), fill: false},
        {label:'O Aristocrata — Hook Rate', data: creative.map(c => c.arisHook != null ? c.arisHook * 100 : null),
          borderColor: css('--aris'), backgroundColor: css('--aris') + '22', borderWidth: 2.5, tension: .2,
          pointRadius: 4, pointBackgroundColor: css('--aris'), fill: false},
        {label:'O Aristocrata — Win Rate', data: creative.map(c => c.arisWin != null ? c.arisWin * 100 : null),
          borderColor: css('--aris'), borderWidth: 1.5, borderDash:[6,4], tension: .2,
          pointRadius: 3, pointStyle:'rectRot', pointBackgroundColor: css('--aris'), fill: false},
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: {
        legend:{position:'top', align:'end', labels:{font:{family:'Inter',size:10}, boxWidth:14, padding:8, color: css('--ink-2')}},
        tooltip:{callbacks:{label: c => `${c.dataset.label}: ${c.raw?.toFixed(1)}%`}},
        annotation: {} // placeholder if annotation plugin added later
      },
      scales: {
        x:{grid:{display:false}, ticks:{color: css('--ink-3'), font:{family:'JetBrains Mono', size:9}}},
        y:{grid:{color: css('--rule')},
          ticks:{color: css('--ink-3'), font:{family:'JetBrains Mono', size:9}, callback: v => v + '%'},
          beginAtZero: true, suggestedMax: 50,
          title: {display: true, text: 'Hook Rate / Win Rate (%)', color: css('--ink-3'), font:{size:10}}},
      }
    }
  });

  // aMER trend chart
  const ch2 = document.getElementById('chart-funnel-amer');
  if (ch2._chart) ch2._chart.destroy();
  ch2._chart = new Chart(ch2, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {label:'Fishermans', data: acquisition.map(d => d.fishAmer),
          borderColor: css('--fish'), backgroundColor: css('--fish') + '22', borderWidth: 2.5, tension: .2,
          pointRadius: 4, pointBackgroundColor: css('--fish'), fill: false},
        {label:'O Aristocrata', data: acquisition.map(d => d.arisAmer),
          borderColor: css('--aris'), backgroundColor: css('--aris') + '22', borderWidth: 2.5, tension: .2,
          pointRadius: 4, pointBackgroundColor: css('--aris'), fill: false},
        {label:'aMER mínimo (2.0)', data: [2,2,2,2],
          borderColor: '#dc2626', borderWidth: 1.2, borderDash:[4,4], pointRadius: 0, fill: false},
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: {
        legend:{position:'top', align:'end', labels:{font:{family:'Inter',size:10}, boxWidth:14, padding:8, color: css('--ink-2')}},
        tooltip:{callbacks:{label: c => `${c.dataset.label}: ${c.raw?.toFixed(2)}`}}
      },
      scales: {
        x:{grid:{display:false}, ticks:{color: css('--ink-3'), font:{family:'JetBrains Mono', size:9}}},
        y:{grid:{color: css('--rule')},
          ticks:{color: css('--ink-3'), font:{family:'JetBrains Mono', size:9}, callback: v => v.toFixed(1)},
          beginAtZero: true, suggestedMin: 1.5, suggestedMax: 4.5,
          title: {display: true, text: 'aMER', color: css('--ink-3'), font:{size:10}}},
      }
    }
  });
}

// ===== Theme + interactions =====
function css(varName){
  return getComputedStyle(document.body).getPropertyValue(varName).trim();
}

function setBrand(brand){
  state.brand = brand;
  document.querySelectorAll('.seg-brand .seg-btn').forEach(b => {
    b.classList.toggle('is-active', b.dataset.brand === brand);
  });
  render();
}
function setPeriod(period){
  state.period = period;
  document.querySelectorAll('.seg-period .seg-btn').forEach(b => {
    b.classList.toggle('is-active', b.dataset.period === period);
  });
  render();
}
function toggleTheme(){
  document.body.classList.toggle('theme-dark');
  document.body.classList.toggle('theme-light');
  // Re-render to update chart colors
  render();
}

// ===== Init =====
async function init(){
  try {
    const res = await fetch('data.json');
    state.data = await res.json();
  } catch (e) {
    console.error('Failed to load data', e);
    document.body.innerHTML = `<div style="padding:40px;font-family:Inter,sans-serif">
      <h1>Erro ao carregar dados</h1>
      <p>Não foi possível carregar dashboard/data.json — verifique se o arquivo está no servidor.</p>
      <pre style="background:#f5f5f5;padding:12px;border-radius:4px">${e.message}</pre>
    </div>`;
    return;
  }

  document.querySelectorAll('.seg-brand .seg-btn').forEach(b => {
    b.addEventListener('click', () => setBrand(b.dataset.brand));
  });
  document.querySelectorAll('.seg-period .seg-btn').forEach(b => {
    b.addEventListener('click', () => setPeriod(b.dataset.period));
  });
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
