# Automação n8n — Dashboard de KPIs (Excel → GitHub)

## A ideia
Os líderes preenchem os KPIs **1x por semana** no **Excel**. O robô lê esse Excel uma vez por semana, separa por marca/área e regrava o `dados_kpis.json` no GitHub. O dashboard mostra atualizado.

`Agendamento → Microsoft Excel 365 (ler as 2 abas) → Code (transformar) → GitHub (gravar dados_kpis.json)`

---

## Pré-requisito: onde o Excel precisa estar
A planilha **continua sendo Excel** — só precisa ficar num lugar que o n8n acessa: o **OneDrive** ou o **SharePoint** (Microsoft 365). Não pode ser só numa pasta local do computador, senão o robô não alcança.
1. Salve o `Historico_KPIs_Marketing.xlsx` no **OneDrive/SharePoint** da empresa (se já usam Microsoft 365, é só mover pra lá).
2. Mantenha as **duas abas** com os nomes `Fishermans` e `Aristocrata` e o **mesmo layout** (linha 4 = cabeçalho das semanas; coluna A = área/líder; B = KPI; C = meta; D em diante = semanas).
3. No n8n, conecte sua conta Microsoft (credencial **Microsoft Excel 365 OAuth2**) — é o mesmo login do Office.

> Os líderes continuam abrindo e preenchendo o Excel normalmente. A única mudança é que ele "mora" no OneDrive.

---

## Nó 1 · Schedule Trigger
Semanal — ex.: toda **segunda às 08:00** (depois que todos preencheram).

## Nó 2 · Microsoft Excel 365 — ler a aba Fishermans
- Resource: **Worksheet** · Operation: **Get** (conteúdo da planilha)
- Workbook: selecione o `Historico_KPIs_Marketing.xlsx`
- Worksheet: `Fishermans`
- Range: deixe vazio (a aba toda) ou `A1:S41`
- Opção: retornar **valores brutos** (raw), sem usar a 1ª linha como cabeçalho.

## Nó 3 · Microsoft Excel 365 — ler a aba Aristocrata
Igual ao nó 2, só muda o Worksheet para `Aristocrata` (Range `A1:S27` ou vazio).

## Nó 4 · Code (transformar)
```js
function num(v){
  if(v===null||v===undefined) return null;
  if(typeof v==='number') return v;
  let s=String(v).trim().replace(/ /g,'').replace(/ /g,'').replace(/\t/g,'');
  if(s===''||/^(não iniciado|nao iniciado|x)$/i.test(s)) return null;
  const pct=s.endsWith('%');
  s=s.replace(/%/g,'').replace(/x/gi,'').replace(/r\$/gi,'').trim();
  if(s.includes(',')&&s.includes('.')) s=s.replace(/\./g,'').replace(',', '.');
  else if(s.includes(',')) s=s.replace(',', '.');
  const f=parseFloat(s); if(isNaN(f)) return null;
  return pct? f/100 : f;
}
function parseTab(rows){
  // rows = array de arrays (a grade crua da aba)
  const hdr = rows[3] || [];
  const weeks=[]; for(let i=3;i<hdr.length;i++){ if(hdr[i]) weeks.push(String(hdr[i]).replace(/\n/g,' ').trim()); }
  const nW=weeks.length; const areas=[]; let cur=null;
  for(let r=4;r<rows.length;r++){
    const row=rows[r]||[]; const area=row[0], kpi=row[1], meta=row[2];
    if(area){ cur={area:String(area).replace(/\n/g,' ').replace(/\s+/g,' ').trim(), kpis:[]}; areas.push(cur); }
    if(kpi && cur){
      const vals=[]; for(let i=0;i<nW;i++) vals.push(num(row[3+i]));
      cur.kpis.push({nome:String(kpi).trim(), meta:meta?String(meta).trim():'', valores:vals});
    }
  }
  const filled = areas.filter(a=>a.kpis.some(k=>k.valores.some(v=>v!==null)));
  return {weeks, areas:filled};
}

// O nó do Excel 365 devolve a grade; pegue os valores em ordem de coluna:
const fish = $('Microsoft Excel 365 — ler a aba Fishermans').all().map(i=>Object.values(i.json));
const aris = $('Microsoft Excel 365 — ler a aba Aristocrata').all().map(i=>Object.values(i.json));

const agora=new Date().toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
const data={ updated:agora, brands:{ Fishermans:parseTab(fish), Aristocrata:parseTab(aris) } };
const content=JSON.stringify(data,null,1);
return [{ json:{ content } }];
```
> Observação: dependendo de como o nó do Excel devolve as linhas, pode ser preciso ajustar as duas linhas do `.map(...)` para pegar a grade crua na ordem certa. É o ponto que vale a gente testar junto.

## Nó 5 · GitHub — gravar `dados_kpis.json`
- Nó **GitHub** → Resource **File** → Operation **Edit**
- Owner: `francoviiii` · Repository: `governanca-shrigma` · File Path: `dados_kpis.json`
- File Content: `={{ $json.content }}` · Commit Message: `Atualização semanal dos KPIs`

Ative o workflow. Toda segunda ele lê o Excel e atualiza o dashboard.

---

## Observações
- **Continua sendo Excel** — só muda o lugar (OneDrive/SharePoint) para o robô conseguir ler.
- **Números "bagunçados"** (R$, %, vírgula, "Não iniciado") já são tratados pelo código.
- Enquanto a automação não roda, o dashboard mostra o que já está no `dados_kpis.json`.
- É uma **saída provisória**: quando o marketing tiver a fonte definitiva, trocamos só o nó de leitura.

## E se o Excel tiver que ficar só no computador (sem OneDrive)?
Aí não dá pra ser 100% automático (o n8n é na nuvem e não enxerga o seu HD). Duas saídas:
- **Semiautomático:** 1x por semana você sobe o Excel num lugar acessível (OneDrive/link) e roda o fluxo — 1 clique.
- **Manual assistido:** você me manda o Excel toda semana e eu regenero o `dados_kpis.json` na hora. Simples, mas depende de você/mim.
