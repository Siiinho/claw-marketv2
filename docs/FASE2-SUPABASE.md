# Fase 2 — Backend (Supabase) + Deploy (Vercel)

Plano e terreno preparado para tirar o ClawMarket do localStorage e colocar na nuvem,
com **multi-tenant** (cada rede de mercado é um cliente isolado), **login real** e
**dados compartilhados** entre dispositivos. Nada disso está ativo ainda — o app continua
rodando no localStorage até estas etapas serem executadas.

## O que já está pronto (terreno)
- `supabase/schema.sql` — esquema completo: tabelas, índices e **RLS** (isolamento por tenant).
- `src/lib/supabase.js` — cliente **dormente** (só liga quando há variáveis de ambiente).
- `.env.example` — variáveis a preencher.
- `vercel.json` — config de deploy (SPA + função serverless `/api`).
- Já existe `api/jornal-oficial.js` (função serverless) — funciona direto na Vercel.

## Passo a passo (quando quiser ativar)

### 1. Criar o projeto Supabase
1. Crie uma conta em supabase.com e um projeto novo.
2. No **SQL Editor**, cole e rode o conteúdo de `supabase/schema.sql`.
3. Em **Authentication → Providers**, habilite e-mail/senha (e Google, se quiser).
4. (Opcional) **Storage**: crie um bucket `produtos` para as fotos.

### 2. Conectar o app
1. Copie `.env.example` para `.env`.
2. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (em Project Settings → API).
3. `src/lib/supabase.js` passa a exportar um cliente ativo (`supabaseAtivo === true`).

### 3. Deploy na Vercel
1. Suba o repositório no GitHub e importe na Vercel (framework detectado: **Vite**).
2. Em **Environment Variables**, adicione as mesmas `VITE_SUPABASE_*`.
3. Deploy. A função `api/jornal-oficial.js` vira `/api/jornal-oficial` automaticamente.

## Estratégia de migração (recomendada: adapter)
Para não reescrever o app de uma vez, troque a fonte de dados por baixo do `StoreContext`,
mantendo a mesma interface que as páginas já usam:

1. Crie `src/lib/db/` com dois adaptadores que expõem os mesmos métodos:
   - `localAdapter` (atual: lê/grava no localStorage);
   - `supabaseAdapter` (novo: lê/grava nas tabelas via `supabase`).
2. No `StoreProvider`, escolha o adapter por `supabaseAtivo` (de `src/lib/supabase.js`).
3. Migre **uma entidade por vez** (ex.: produtos primeiro), verificando no preview.
4. Troque o login local (`USUARIOS` em `data/seed.js`) por **Supabase Auth** + tabela `profiles`
   (papel + tenant). As permissões do app (`PERMISSOES`) continuam valendo no front; a RLS
   garante no banco.

## Mapa: store atual → tabelas
| Store (localStorage)        | Tabela Supabase      |
|-----------------------------|----------------------|
| `usuario` / `USUARIOS`      | `auth.users` + `profiles` |
| `lojas` / `LOJAS`           | `lojas`              |
| `produtos`                  | `produtos`           |
| `ofertas`                   | `ofertas`            |
| `jornais`                   | `jornais`            |
| `jornalOficial`             | `jornal_oficial`     |
| `config` (incl. regrasPreco)| `configuracoes`      |

> Multi-filial já está modelado no front (`loja_id`) e no schema, então a migração preserva
> a rede de lojas e o comparativo entre filiais.

## Depois da Fase 2 (destrava)
Com backend + multi-tenant no ar, abrem-se: integrações ERP/PDV, IA preditiva de encalhe,
benchmark setorial entre clientes (anônimo) e os módulos pagos do roadmap.
