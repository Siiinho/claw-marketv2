# Jornal de Ofertas — especificação

A peça central do ClawMarket: um gerador de **encarte/jornal** no layout da Bengala,
que transforma os produtos de vencimento em **oferta interna destacada**.

Arquivo: [`src/pages/Jornal.jsx`](../src/pages/Jornal.jsx).

---

## As 3 abas

### 1. Gerar Jornal
Monta o encarte e gera o PDF. Controles à esquerda, **preview ao vivo** à direita.

**Enxuto e automático:** o jornal já vem preenchido com os produtos da fila — sem precisar
configurar. A **validade é automática**: do dia de hoje até a **última validade** dos produtos
adicionados (diferente do encarte oficial, que é semanal fixo). As células trazem **foto real
do produto, preço destacado e selo circular “−X% OFF”**. O tema sazonal muda só o visual.

**Tipos de jornal:**
- **Geral** — mistura o mercado todo; faixas por setor em sequência.
- **Por setor** — só o setor escolhido.
- **Sazonal** — tema de evento define a cor do cabeçalho. Temas em `TEMAS`:
  `diaB`, `copa`, `feijoada`, `junina`. O botão **“Aplicar modelo Dia B”** ajusta a
  validade para amanhã (o Dia B é a sexta de ofertas recorrente da Bengala).

**Regra fixa (a “grande ideia”):** independentemente do tipo, os produtos cuja origem
na fila é `vencimento` entram **sempre no topo**, numa faixa vermelha
**“GRANDE IDEIA · OFERTAS DE VENCIMENTO”**, cada um com selo coral **“OFERTA INTERNA”**,
preço antigo riscado, preço novo em destaque e a linha “vence em X dias · −Y%”.

**Saídas:** **Salvar** (guarda no histórico de jornais) e **PDF** (`exportarPDF`).

### 2. Fila de Produtos
Tudo que foi mandado pro jornal (botão de jornal em Produtos/Ofertas), **agrupado por setor**.
Mostra contadores (total, de vencimento, nº de setores) e permite remover itens.
Origem de cada item: `vencimento` (crítico/atenção) ou `manual`.

### 3. Jornal Oficial
Mostra o encarte oficial da Bengala (capa + contracapa) como imagens clicáveis.
O Admin **sincroniza** colando a edição e as URLs novas; quando o número da edição muda,
marca como **NOVO** e guarda a anterior no histórico. (Ver seção CORS abaixo.)

---

## Preço usado no jornal

Função `precoJornal(p)` (em `Jornal.jsx`), na ordem:
1. Oferta ativa do produto → aplica o desconto da oferta.
2. Senão, `precoPromo` do produto.
3. Senão, se for de **vencimento** → aplica o `descontoPadrao` das configurações.
4. Senão, `precoNormal`.

O percentual exibido vem de `percentDesc(precoNormal, precoJornal)`.

---

## Cores das faixas por setor

Definidas em `SETORES` (`src/lib/utils.js`) — `cor` (faixa) e `corTag` (preço):

| Setor | Faixa | Tag de preço |
|---|---|---|
| Padaria | `#C77E1A` | `#8A5310` |
| Laticínios | `#3E86C9` | `#1F5A93` |
| Frios | `#B23A48` | `#7C2230` |
| Hortifruti | `#2E9E6B` | `#1C6E48` |
| Bebidas | `#E23A2E` | `#9E2018` |
| Mercearia | `#D9641F` | `#964114` |
| Limpeza | `#178F86` | `#0C5F58` |
| Congelados | `#2C84B0` | `#1A597A` |
| Pet Shop | `#8A4FA0` | `#5C3070` |

A faixa de vencimento usa sempre o vermelho escuro `#C42B2B`; o cabeçalho do pôster e o
rodapé usam o brick `#7A241B`.

---

## Anatomia do pôster (preview)

```
┌───────────────────────────────────────────┐
│ Bengala SUPERMERCADO      [SELO]  validade │  ← cabeçalho brick
├───────────────────────────────────────────┤
│        GRANDE IDEIA · OFERTAS DE VENCIMENTO│  ← faixa #C42B2B (só se houver vencimento)
│  [OFERTA INTERNA] foto  nome               │
│   de R$ ··  →  R$ NN,NN  vence em Xd ·-Y%  │  ← grade 2 col
├───────────────────────────────────────────┤
│ ⬛ NOME DO SETOR                            │  ← faixa cor do setor
│  foto/nome/preço   ·   ·                   │  ← grade 3 col
│ ... (repete por setor) ...                 │
├───────────────────────────────────────────┤
│ reserva de direitos              [QR]      │  ← rodapé brick
└───────────────────────────────────────────┘
```

Largura fixa de 440px (formato retrato de encarte). O nó é capturado pelo `ref` no export.

---

## Integração com o site (CORS)

O site da Bengala é WordPress. **Atenção:** a página pública `/jornal` está
**desatualizada** — ainda referencia a capa de 2023 (`/2023/04/Bengala-rede-capa-14-scaled.jpg`,
tema Outubro Rosa). O encarte **atual** aparece via WP REST API
(`wp-json/wp/v2/pages?slug=jornal` e `wp-json/wp/v2/media`): edição **SEMANA B 25.06–01.07.26**,
capa `/2026/06/Bengala-rede-capa-scaled.jpg`, PDF `/2026/06/JORNAL-SEMANA-B-25.06-a-01.07.26.pdf`.

Por isso, o **jornal oficial embutido** no app (`JORNAL_OFICIAL_SEED`) usa a capa/contracapa
da edição de junho renderizadas do PDF (`src/assets/jornal-oficial-capa.jpg` e `-contra.jpg`),
com link “Ver PDF completo”. Há uma migração em `StoreContext` que substitui instalações
antigas cuja capa contém `capa-14`.

### Sincronização automática (implementada)

O navegador não pode ler o site direto por **CORS**, então a leitura roda no **servidor**:

- **Lógica:** [`server/jornalOficial.js`](../server/jornalOficial.js) — `buscarJornalOficial()`
  consulta `wp-json/wp/v2/pages?slug=jornal` e `.../media`, junta os arquivos e escolhe a
  capa mais nova (por mês de upload) como sinal da edição atual; o período sai do **nome do PDF**.
  Retorna `{ edicao, titulo, data, ym, capa, contracapa, pdf }` (`ym` = ano*100+mês).
- **Exposição:** rota `GET /api/jornal-oficial` — em dev via middleware do Vite
  ([`vite.config.js`](../vite.config.js)); em produção via função serverless
  ([`api/jornal-oficial.js`](../api/jornal-oficial.js), estilo Vercel).
- **Frontend:** a aba “Jornal Oficial” chama essa rota ao abrir (silencioso) e no botão
  “Buscar edição mais recente”. Só substitui quando `ym` é **estritamente maior** que o salvo —
  assim não rebaixa o seed preciso de junho. Sem servidor (build estático), cai no modo manual.

> Cuidado descoberto: a pasta `/uploads/AAAA/MM/` é a data de **upload**, não do encarte; o
> período real está no **nome do PDF**. E a página `/jornal` mistura a capa atual com capas
> de 2023 — por isso a heurística usa a imagem “capa” mais nova e o nome do PDF.

Possíveis evoluções:

- **Supabase Edge Function** (ou qualquer função serverless) que faz `fetch` da página,
  extrai as URLs por regex e devolve JSON ao app; pode rodar em cron e detectar edição nova.
- **Endpoint no próprio WordPress** (REST API / campo customizado) expondo a edição atual.

Enquanto isso, o fluxo manual já cobre o caso de uso (ver, comparar e usar o mesmo layout).

---

## Como estender

## Paginação A4 adaptável

- Cada página A4 comporta até **7 produtos**: 1 destaque principal e até 6 ofertas complementares.
- De **1 a 3 produtos**, os módulos crescem para evitar espaços vazios e melhorar a leitura.
- De **4 a 7 produtos**, o sistema usa uma frente A4 completa.
- De **8 a 14 produtos**, o PDF é gerado automaticamente em **frente e verso**.
- Acima de 14 produtos, novas folhas são criadas, sempre agrupadas em pares de frente e verso.
- O PDF multipágina mantém todas as páginas no tamanho A4, prontas para impressão.

- **Novo tema sazonal:** adicione a `TEMAS` no topo de `Jornal.jsx`
  (`meutema: { nome, cor, selo, sub, acento }`) e um caso em `BandaTema` (a faixa
  decorativa logo abaixo do cabeçalho). Os temas atuais têm motivo próprio: **Dia B**
  (vermelho, “a sexta mais barata”), **Copa** (verde, troféu/estrela), **Feijoada**
  (vinho, panela/fogo) e **Festa Junina** (bandeirinhas SVG coloridas + “Arraiá”).
  Tudo com cores sólidas/SVG para o export PDF não quebrar.
- **Mudar a regra do “grande ideia”:** a separação está em `vencimento`/`regulares`
  dentro do componente `Jornal`.
- **Fotos reais nos itens:** `ProdutoThumb` já usa `produto.imagem` quando existe;
  basta popular esse campo (upload/URL) no cadastro de Produtos.
