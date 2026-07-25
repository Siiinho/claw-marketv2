# Importar catálogo (Cartaz Fácil / ERP)

Como trazer os produtos reais do mercado (que ficam no **Cartaz Fácil** ou no ERP) para o
ClawMarket, em vez dos dados de exemplo.

## Como extrair do Cartaz Fácil
O Cartaz Fácil integra com o sistema de gestão (ERP) — os produtos vêm de lá. Não dá para
acessar a conta do cliente de fora, então use um destes caminhos:

1. **Exportar (recomendado)** — no Cartaz Fácil ou no ERP, exporte a lista de produtos em
   **CSV / Excel / TXT**. É o caminho mais confiável e pega tudo de uma vez.
2. **Automação no navegador** — com a extensão *Claude para Chrome* e você logado, dá para
   navegar e extrair (de preferência achando o endpoint interno que lista os produtos).
3. **Relatório PDF** — se só houver PDF, dá para ler e converter.

## Importar no app
Em **Produtos → Importar planilha**: envie o arquivo (`.csv`/`.txt`) ou cole o conteúdo.
O sistema (`src/lib/importarCatalogo.js`):
- **detecta o separador** (`;`, `,` ou tab — Excel BR costuma usar `;`);
- **mapeia as colunas** por palavra-chave no cabeçalho (com ou sem acento);
- entende **preço no formato BR** (`1.234,56`) e **datas** `dd/mm/aaaa`;
- **mapeia/infere o setor** (casa com os 9 setores ou deduz pelo nome);
- opcionalmente **busca a imagem** pelo código de barras (Open Food Facts, até 40).

### Colunas reconhecidas (cabeçalho)
| Campo | Cabeçalhos aceitos (exemplos) |
|---|---|
| Nome | descrição, produto, nome, mercadoria |
| Marca | marca, fabricante |
| Código de barras | código de barras, ean, gtin, código |
| Preço | preço venda, preço, valor |
| Promoção | promo, oferta |
| Setor | setor, categoria, grupo, departamento, seção |
| Estoque | estoque, qtd, quantidade, saldo |
| Validade | validade, vencimento |

Só **nome** é obrigatório; o resto é preenchido quando existe (validade ausente vira +30 dias;
preço ausente vira 0). Os produtos entram na **loja ativa** (multi-filial).

### Exemplo de planilha
```
Descrição;Marca;Código de Barras;Preço Venda;Setor;Estoque;Validade
Iogurte Morango 540g;Danone;7891025111481;8,99;Laticínios;40;15/07/2026
Linguiça Calabresa kg;Seara;7891234777777;19,90;Frios;14;05/07/2026
```

## Guardar na nuvem (Supabase)
Hoje a importação grava no navegador (localStorage). Para os produtos ficarem no **Supabase**
(multi-dispositivo, multi-tenant), falta concluir a wiring da Fase 2 — ver
[FASE2-SUPABASE.md](FASE2-SUPABASE.md). A lógica de importação é a mesma; muda só o destino.
