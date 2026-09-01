# Central de Governança — Grupo Shrigma

Site interno que junta, num lugar só: **Organograma & Cartões de Cargo**, **Painel de Aderência**, **Dashboard da Equipe** e **Acompanhamento dos Planos**.
A página inicial é a `index.html`.

---

## 1. O que tem nesta pasta

| Arquivo | O que é | Como atualiza |
|---|---|---|
| `index.html` | Página inicial (o portal que junta tudo) | — |
| `organograma.html` | Organograma + cartão de cargo de cada cadeira | Manual (você) |
| `painel_aderencia.html` | Aderência aos padrões (SOPs, atas, 1:1, tempo) | Manual (você) |
| `dashboard_equipe.html` + `dados_equipe.json` | Produtividade da equipe | Automático (n8n) |
| `acompanhamento_planos.html` + `dados_planos.json` | Cobrança dos planos Fishermans e Aristo | Automático (n8n) |
| `n8n_automacao_dashboard.md` | Receita do robô do dashboard | — |
| `n8n_automacao_planos.md` | Receita do robô do acompanhamento | — |

> Os dois arquivos `.json` são a "memória" que os robôs atualizam. As páginas leem eles sozinhas.

---

## 2. Subir no GitHub (uma vez só)

Você não precisa saber programar. Passo a passo:

1. Crie uma conta em **github.com** (se ainda não tiver).
2. Clique em **New repository** (novo repositório). Dê um nome, ex.: `governanca-shrigma`. Deixe **Public** e clique **Create**.
3. Na página do repositório, clique em **Add file → Upload files** e **arraste todos os arquivos desta pasta** (inclusive os `.json`). Clique **Commit changes**.
4. Vá em **Settings → Pages**. Em "Branch", escolha **main** e a pasta **/(root)**. Clique **Save**.
5. Aguarde ~1 minuto. O GitHub mostra o endereço do site, algo como:
   `https://SEU-USUARIO.github.io/governanca-shrigma/`
6. Pronto — esse link é a sua Central de Governança. Salve nos favoritos e compartilhe com o Mateus.

---

## 3. Ligar as automações (n8n)

O **Dashboard** e o **Acompanhamento** se atualizam sozinhos com o ClickUp, por meio de um robô no **n8n**. Cada robô lê o ClickUp e **regrava o arquivo `.json`** aqui no GitHub — a página mostra atualizado na hora seguinte.

Para montar (ou pedir pra quem cuida do n8n), as receitas prontas estão em:
- `n8n_automacao_dashboard.md`
- `n8n_automacao_planos.md`

O que você precisa ter em mãos:
- **Token do ClickUp** (ClickUp → Settings → Apps → API Token).
- **Token do GitHub** (GitHub → Settings → Developer settings → Personal access token, com permissão de repositório).
- O **nome do repositório** que você criou no passo 2.

Enquanto o robô não estiver ligado, as páginas automáticas mostram o aviso *"aguardando 1ª sincronização"* — o que é normal.

---

## 4. No dia a dia

- **Organograma:** consulta e clica na caixa pra ver o cartão de cargo. Conforme os cartões forem validados, o selo muda de "Rascunho" para "Pronto".
- **Painel de Aderência:** toda semana você marca quem está seguindo os padrões. Salva sozinho no seu navegador.
- **Dashboard e Acompanhamento:** você **não** mexe na página — atualiza no **ClickUp** (status e comentários das tasks) e o robô traz pra cá.

---

*Preparado por Viviane · Governança — Grupo Shrigma.*
