# Automação n8n — Acompanhamento dos Planos (ClickUp → painel)

## O que ela faz
De tempos em tempos (ex.: toda manhã), sozinha:
1. lê as tasks dos planos na sua lista **Viviane** no ClickUp;
2. pega o **status** e a **última observação (comentário)** de cada uma;
3. grava o `dados_planos.json` no GitHub.
4. O painel `acompanhamento_planos.html` mostra tudo atualizado sozinho.

Fluxo dos nós:
`Agendamento → ClickUp (buscar tarefas) → (loop) ClickUp (comentários) → Transformar → GitHub (ler JSON) → GitHub (gravar JSON)`

---

## Pré-requisitos (o que ter em mãos)
- **Token do ClickUp** (Settings → Apps → API Token).
- **ID da lista Viviane:** `901327080406` (já é o certo).
- **Repositório do GitHub:** `owner`, `repo`, e um **token do GitHub** (PAT com permissão de repo).

---

## Nó 1 · Agendamento (Schedule Trigger)
Diário, ex.: todo dia às 07:30. (Pode ser toda segunda, se preferir só na weekly.)

## Nó 2 · ClickUp — buscar tarefas (HTTP Request)
- **Método:** GET
- **URL:** `https://api.clickup.com/api/v2/list/901327080406/task`
- **Headers:** `Authorization: SEU_TOKEN_CLICKUP`
- **Query params:** `include_closed = true` · `subtasks = false`
> Retorna as tasks da lista, cada uma com `id`, `name`, `status` e `due_date`.

## Nó 3 · Pegar a última observação (comentário)
As observações são os **comentários** de cada task. Para lê-los:
- Um nó **Loop / Split in Batches** sobre as tasks, e dentro dele:
- **HTTP Request GET** `https://api.clickup.com/api/v2/task/{{ $json.id }}/comment` (mesmo header de Authorization).
- Guarde o texto do comentário mais recente (`comments[0].comment_text`).

> **Alternativa mais simples (sem loop):** se preferir, use a **descrição** da task como observação — aí pula o Nó 3 e no transform lê `t.description`. (Mas o comentário é mais natural pra atualização semanal.)

## Nó 4 · Transformar (Code)
```js
// tarefas do ClickUp:
const raw = $('ClickUp — buscar tarefas').first().json.tasks || [];

// mapa de comentários por task (monte a partir do Nó 3; ou deixe {} se usar descrição)
const coment = {}; // { taskId: "texto do último comentário" }

const now = Date.now();
function statusPlano(t){
  const tipo = (t.status && t.status.type) || '';
  const nome = ((t.status && t.status.status) || '').toLowerCase();
  let s = 'afazer';
  if (tipo === 'closed' || nome.includes('closed') || nome.includes('complete')) s = 'feito';
  else if (nome.includes('progress') || nome.includes('andamento')) s = 'andamento';
  // atrasado: tem prazo, já passou e não está feito
  const due = parseInt(t.due_date || 0, 10);
  if (s !== 'feito' && due && due < now) s = 'atrasado';
  return s;
}

const items = {};
raw.forEach(t => {
  const nome = t.name || '';
  if (!/^FISH ·|^ARISTO ·/.test(nome)) return;   // só as tasks dos planos
  items[t.id] = {
    status: statusPlano(t),
    obs: coment[t.id] || (t.description ? String(t.description).split('\n')[0] : '')
  };
});

const agora = new Date().toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
const conteudo = Buffer.from(JSON.stringify({ updated: agora, items }, null, 2), 'utf8').toString('base64');
return [{ json: { conteudo } }];
```

## Nó 5 · GitHub — ler JSON atual (HTTP Request)
- **GET** `https://api.github.com/repos/OWNER/REPO/contents/dados_planos.json`
- **Headers:** `Authorization: Bearer SEU_TOKEN_GITHUB` · `User-Agent: n8n`
- Guarde o `sha` (necessário para gravar). *(Se o arquivo ainda não existir, a 1ª vez grava sem sha.)*

## Nó 6 · GitHub — gravar JSON (HTTP Request)
- **PUT** `https://api.github.com/repos/OWNER/REPO/contents/dados_planos.json`
- **Headers:** `Authorization: Bearer SEU_TOKEN_GITHUB` · `User-Agent: n8n`
- **Body (JSON):**
```json
{
  "message": "Atualização do acompanhamento dos planos",
  "content": "={{ $json.conteudo }}",
  "sha": "={{ $('GitHub — ler JSON atual').item.json.sha }}"
}
```

Pronto: ao rodar, o `dados_planos.json` é reescrito com o status e a observação de cada task, e o painel mostra atualizado.

---

## Mapa das tasks (id no ClickUp → linha do painel)
**Fishermans:** f1 `86ak8b33v` · f2 `86ak8b33z` · f3 `86ak8b346` · f4 `86ak8b34a` · f5 `86ak8b34g` · f6 `86ak8b35g` · f7 `86ak8b35t` · f8 `86ak8b362`
**O Aristocrata:** a1 `86ak8b36b` · a2 `86ak8b36f` · a3 `86ak8b36m` · a4 `86ak8b36r` · a5 `86ak8b379`

## Observações honestas
- **Status:** o painel usa 4 cores. "A fazer" = Open · "Em andamento" = in progress · "Feito" = Closed · "Atrasado" é **calculado sozinho** (prazo passou e não fechou). Se você quiser marcar "em risco/travado" manualmente, dá pra criar um campo "Status do Plano" no ClickUp depois — aí eu ajusto o transform.
- **Observação:** vem do **último comentário** da task (ou da 1ª linha da descrição, na versão simples).
- **Datas:** as datas da Fishermans foram calculadas assumindo início do plano em **01/09**. Se o Mateus definir outro D0, é só ajustar as due dates das tasks.
