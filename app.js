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
    const res = await fetch('dashboard/data.json');
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
