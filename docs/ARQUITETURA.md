# Arquitetura — ClawMarket

Doc técnico para quem for manter/estender o código.

## Stack

| Camada | Tecnologia |
|---|---|
| Build/dev | Vite 5 |
| UI | React 18 |
| Estilo | Tailwind CSS v4 (`@tailwindcss/vite`, tokens em `@theme`) |
| Rotas | react-router-dom 6 (**HashRouter** — funciona em `file://` e hospedagem estática) |
| Ícones | lucide-react |
| Export | html2canvas + jsPDF |
| Persistência | localStorage (sem backend) |

## Fluxo de dados

Tudo passa por **um store central** — não há fetch nem estado duplicado por tela.

```
main.jsx
 └─ <HashRouter>
     └─ <StoreProvider>      ← src/store/StoreContext.jsx
         └─ <App>            ← rotas + <Protegida> (checa papel)
             └─ <Layout>     ← sidebar + header + <Outlet/>
                 └─ páginas  ← consomem useStore()
```

### Store (`src/store/StoreContext.jsx`)

Estado mantido e persistido em `localStorage['clawmarket:v1']`:
`usuario`, `produtos`, `ofertas`, `jornais`, `config`, `jornalOficial`.

Principais ações expostas por `useStore()`:

- **Auth:** `login(email,senha)`, `loginComoVisitante()`, `logout()`
- **Produtos:** `salvarProduto(p)` (cria ou atualiza), `excluirProduto(id)`
- **Fila do jornal:** `toggleFila(id, origem)`, `removerDaFila(id)` — `origem` é `'vencimento'` ou `'manual'`; `fila` é derivado (`produtos` com `naFila`)
- **Ofertas:** `criarOferta(produtoId, titulo, desconto, validade)`, `toggleOferta(id)`, `excluirOferta(id)`, `ofertaDoProduto(id)`
- **Jornais gerados:** `salvarJornal(j)`, `excluirJornal(id)`
- **Config / oficial:** `salvarConfig(c)`, `atualizarJornalOficial(dados)`
- **Util:** `toast(msg, tipo)`, `resetar()`, `statusValidade`

### Permissões

Definidas em `StoreContext.jsx`:
- `NAV` — itens do menu (chave, label, rota, ícone).
- `PERMISSOES` — mapa papel → chaves visíveis.
- `podeVer(papel, chave)` e `podeEditar(papel)`.
- Reforço duplo: o menu esconde itens **e** `<Protegida chave>` bloqueia a rota.

## Helpers (`src/lib/utils.js`)

- `SETORES` — os 9 setores com `id, nome, cor, corTag, icone` (nome do ícone lucide).
- Datas: `hoje`, `diasParaVencer`, `dataISOmaisDias`, `formatData`, `diaSemana`.
- **`statusValidade(iso)`** — fonte única da regra (≤2 crítico, ≤7 atenção, >7 normal, <0 vencido); retorna `{ id, label, cor, bg, dias }`.
- Dinheiro: `formatBRL`, `partesPreco` (separa reais/centavos para o preço varejo), `percentDesc`.

## Componentes de UI (`src/components/ui.jsx`)

`Icon` (resolve lucide por nome), `PrecoVarejo`, `StatusBadge`, `ProdutoThumb`
(foto ou ícone do setor), `Pill`, `EmptyState`, `Botao`, `Modal`, `Toasts`, `Campo`, `inputCls`.

## Export (`src/lib/exportar.js`)

`exportarPNG(el, nome)` e `exportarPDF(el, nome)` recebem um **elemento DOM** (via `ref`)
e usam html2canvas (scale 2) → PNG, ou → jsPDF no tamanho do canvas.

> ⚠️ **Restrição de cores:** html2canvas 1.4.1 lança erro em `color-mix()`/`oklch()`.
> O Tailwind v4 gera `color-mix` para classes com opacidade (`bg-x/10`, `text-x/80`).
> Por isso, **dentro do nó exportado** (pôster do Jornal, cartaz) usamos cores sólidas
> hex/rgba inline. Ao editar essas telas, não introduza classes de opacidade no pôster.

## Como adicionar...

- **Um setor:** acrescente em `SETORES` (`src/lib/utils.js`) — propaga para filtros,
  faixas do jornal, thumbs e relatórios automaticamente.
- **Uma tela nova:** crie em `src/pages/`, registre em `NAV` + `PERMISSOES`
  (`StoreContext.jsx`) e adicione a `<Route>` em `App.jsx`.
- **Um tema sazonal de jornal:** acrescente em `TEMAS` no topo de `src/pages/Jornal.jsx`
  (`{ nome, cor, selo, sub, acento }`).
- **Logo real:** coloque `public/logo.png` e troque o “B” em `Layout.jsx`, `Login.jsx`
  e no cabeçalho do pôster em `Jornal.jsx`.

## Backend leve (sincronização do jornal oficial)

- [`server/jornalOficial.js`](../server/jornalOficial.js) — função `buscarJornalOficial()`
  (Node, sem dependências) que lê a REST API do WordPress da Bengala.
- [`vite.config.js`](../vite.config.js) — plugin `jornalOficialApi()` expõe `GET /api/jornal-oficial`
  no servidor de dev.
- [`api/jornal-oficial.js`](../api/jornal-oficial.js) — mesma lógica como função serverless
  (estilo Vercel) para produção.
- O frontend (`OficialView` em `Jornal.jsx`) consome `/api/jornal-oficial`. Não há chamada
  cross-origin no navegador — quem fala com a Bengala é o servidor.

## Integração com o jornal oficial (Bengala)

O site é WordPress; a página `/jornal` publica **capa** e **contracapa** como imagens
(`/wp-content/uploads/AAAA/MM/Bengala-rede-capa-NN-scaled.jpg`). O navegador não pode ler
o site direto (CORS), então hoje o Admin informa edição/URLs em **Jornal → Jornal Oficial**.
Para automatizar: uma função serverless (ex.: Supabase Edge Function) que lê a página e
devolve as URLs em JSON, ou um endpoint próprio no WordPress.
