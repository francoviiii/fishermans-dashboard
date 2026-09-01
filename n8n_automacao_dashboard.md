# Automação n8n — Dashboard da Equipe (ClickUp → GitHub)

## O que ela faz
Toda semana, sozinha:
1. calcula o período da semana;
2. busca no ClickUp as tarefas concluídas de cada pessoa (com tempo e categoria);
3. transforma no formato do dashboard e junta ao histórico;
4. grava o `dados_equipe.json` no GitHub. O dashboard mostra o novo automaticamente.

Fluxo dos nós:
`Agendamento → Período → ClickUp (buscar tarefas) → GitHub (ler JSON atual) → Transformar → GitHub (gravar JSON)`

---

## Pré-requisitos (o que você precisa ter em mãos)
- **Token do ClickUp** (Settings → Apps → API Token) e o **Team ID** (workspace).
- **Como a categoria está no ClickUp**: é um *campo personalizado* (dropdown) chamado "Categoria"? (confirmar — o código procura um campo cujo nome contenha "categor").
- **Repositório do GitHub**: `owner` (seu usuário), `repo`, o caminho do arquivo (`dados_equipe.json`) e um **token do GitHub** (Personal Access Token com permissão de repo).

---

## Nó 1 · Agendamento (Schedule Trigger)
Semanal — ex.: toda segunda às 07:00.

## Nó 2 · Período (Code)
```js
const now = new Date();
const end = now.getTime();
const start = end - 7*24*60*60*1000; // últimos 7 dias
const f = d => ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2);
const label = f(new Date(start)) + '–' + f(new Date(end));
return [{ json: { gt:start, lt:end, label, sub:'Semana de '+label } }];
```

## Nó 3 · ClickUp — buscar tarefas (HTTP Request)
- **Método:** GET
- **URL:** `https://api.clickup.com/api/v2/team/SEU_TEAM_ID/task`
- **Headers:** `Authorization: SEU_TOKEN_CLICKUP`
- **Query params:**
  - `include_closed = true`
  - `subtasks = true`
  - `date_done_gt = {{ $('Período').item.json.gt }}`
  - `date_done_lt = {{ $('Período').item.json.lt }}`
  - `page = 0`
> Observação: o ClickUp devolve 100 tarefas por página. Se a equipe passar de 100 por semana, é preciso repetir com `page = 1, 2…` (dá pra adicionar um loop). Hoje vocês estão perto disso, então vale já prever.

## Nó 4 · GitHub — ler JSON atual (HTTP Request)
- **Método:** GET
- **URL:** `https://api.github.com/repos/OWNER/REPO/contents/dados_equipe.json`
- **Headers:** `Authorization: Bearer SEU_TOKEN_GITHUB` · `User-Agent: n8n`
- Guarda o `sha` (necessário para gravar) e o `content` (base64 do JSON atual).

## Nó 5 · Transformar (Code)
```js
const PEOPLE = ["Jorge","Sabrina","Marcela","Samuel","Uri","Leandro"];

// tarefas do ClickUp:
const raw = $('ClickUp — buscar tarefas').first().json.tasks || [];

// JSON atual (decodifica o base64 vindo do GitHub):
let atual = { weeks: [] };
try {
  const b64 = $('GitHub — ler JSON atual').first().json.content.replace(/\n/g,'');
  atual = JSON.parse(Buffer.from(b64,'base64').toString('utf8'));
} catch(e) {}

const per = $('Período').first().json;

function categoria(t){
  const cf = (t.custom_fields||[]).find(f => /categor/i.test(f.name||''));
  if (cf && cf.value != null){
    const opts = (cf.type_config && cf.type_config.options) || [];
    const op = opts.find(o => o.id===cf.value || o.orderindex===cf.value);
    if (op) return op.name;
  }
  return "Sem categoria";
}
function primeiroNome(t){
  const a = (t.assignees && t.assignees[0]) || {};
  return (a.username || '').split(' ')[0];
}

const tasks = raw.map(t => {
  const cron = Math.round(parseInt(t.time_spent||0,10)/60000); // ms → min (cronômetro)
  const c = categoria(t);
  return {
    p: primeiroNome(t), nome: t.name, c,
    cron, prog: 0, m: cron,
    src: cron>0 ? 'cron' : (c!=='Sem categoria' ? 'cat' : 'none'),
    ts: parseInt(t.date_done || t.date_closed || Date.now(), 10),
    url: t.url
  };
}).filter(t => PEOPLE.includes(t.p));

const nova = { label: per.label, sub: per.sub, tasks };

let weeks = atual.weeks || [];
weeks = weeks.filter(w => w.label !== nova.label); // substitui se rodar de novo na mesma semana
weeks.push(nova);
weeks = weeks.slice(-12); // mantém as últimas 12 semanas

const conteudo = Buffer.from(JSON.stringify({ weeks }, null, 2), 'utf8').toString('base64');
const sha = $('GitHub — ler JSON atual').first().json.sha;
return [{ json: { conteudo, sha, total: tasks.length } }];
```

## Nó 6 · GitHub — gravar JSON (HTTP Request)
- **Método:** PUT
- **URL:** `https://api.github.com/repos/OWNER/REPO/contents/dados_equipe.json`
- **Headers:** `Authorization: Bearer SEU_TOKEN_GITHUB` · `User-Agent: n8n`
- **Body (JSON):**
```json
{
  "message": "Atualização semanal do dashboard da equipe",
  "content": "={{ $json.conteudo }}",
  "sha": "={{ $json.sha }}"
}
```

Pronto: ao rodar, o `dados_equipe.json` é reescrito com a semana nova + histórico, e o dashboard no GitHub Pages já mostra atualizado.

---

## Observações honestas
- **Tempo:** usei o `time_spent` do ClickUp (o cronômetro). Quem não cronometra aparece com tempo 0 (o próprio dashboard já trata isso). O “tempo em progresso” da versão manual não entra na automação — na automação, o cronômetro é a fonte.
- **Categoria:** o código assume um campo personalizado com “categoria” no nome. Se for tag ou outro nome, a gente ajusta.
- **Paginação:** acima de 100 tarefas/semana, adicionar o loop de páginas.
