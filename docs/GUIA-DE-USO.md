# Guia de uso — ClawMarket (dia a dia)

Guia prático para a equipe do mercado operar o sistema. Não precisa saber programar.

---

## 1. Entrar

1. Abra o sistema (no navegador).
2. Na tela de login, clique na sua conta de demonstração ou digite e-mail e senha.
3. Senha de todas as contas de teste: `demo123`.

Cada papel vê um menu diferente:
- **Administrador:** tudo.
- **Gerente:** tudo, menos Usuários e Configurações.
- **Repositor:** só Dashboard e Scanner.

Para sair: botão de **sair** no rodapé da barra lateral.

---

## 2. Dashboard (tela inicial)

É o resumo do dia:
- **Banner laranja** no topo avisa quantos produtos vencem em até 3 dias.
- **4 cards:** total em estoque, vencendo em 7 dias, ofertas ativas e perda potencial (R$).
- **Lista “Próximos ao vencimento”** com a etiqueta de dias restantes.
- **“Por setor”** mostra onde há produtos vencendo.

---

## 3. Produtos

Para **cadastrar**: botão **“Novo Produto”** (Admin/Gerente) → preencha nome, setor,
validade e preço (obrigatórios), além de marca, estoque, preço promocional e código de barras.

Para **editar/excluir**: ícones de lápis e lixeira na linha do produto.

Para **filtrar**: selects de setor e status no topo; ou a **busca** do cabeçalho (por nome/marca).

Para **mandar pro jornal**: ícone de **jornal** na linha do produto → ele entra na
**fila do jornal**. Produtos críticos/em atenção entram como “oferta interna (vencimento)”.

---

## 4. Ofertas

- **Sugestões automáticas** (faixa verde): um clique cria uma oferta de desconto para
  produtos vencendo que ainda não têm oferta.
- **Nova Oferta:** escolha o produto, ajuste o desconto no slider (vê o preço final na hora)
  e a validade.
- Cada oferta pode ser **pausada/ativada** ou **excluída**.

---

## 5. Cartazes

1. Escolha o produto (lista da esquerda — só aparecem produtos com promoção/oferta).
2. Escolha um dos **4 modelos** de cor.
3. O cartaz aparece pronto à direita.
4. Clique em **“Salvar PNG”** para baixar a imagem e imprimir.

---

## 6. Jornal de Ofertas ⭐

A tela tem 3 abas:

### a) Fila de Produtos
Lista, **agrupada por setor**, tudo que você mandou pro jornal a partir de Produtos/Ofertas.
Mostra quantos são de vencimento. Dá pra remover itens.

### b) Gerar Jornal
1. Escolha o **tipo**:
   - **Geral** — mistura o mercado todo;
   - **Por setor** — só um setor (ex.: Frios);
   - **Sazonal** — tema de evento (**Dia B**, Copa, Feijoada, Festa Junina).
   - Atalho **“Aplicar modelo Dia B”** já marca a validade para amanhã.
2. Marque/desmarque os itens da fila que vão entrar.
3. O **encarte aparece pronto** à direita, no estilo Bengala. Os produtos de vencimento
   entram **sempre no topo** como **“GRANDE IDEIA · oferta interna”** (selo coral).
4. **Salvar** (guarda no histórico) ou **PDF** (baixa o encarte para imprimir/divulgar).

### c) Jornal Oficial
Mostra o encarte oficial da semana (capa e contracapa) puxado do site da Bengala.
Quando sair uma edição nova no site, o Admin cola a **edição** e as **URLs** novas em
“Sincronizar” e o sistema marca como **NOVO**.

---

## 7. Scanner

Disponível inclusive para o Repositor.
- Digite/leia o **código de barras** e clique em Buscar (ou Enter), ou use os atalhos.
- Aparecem os dados do produto e você pode **atualizar o estoque** na hora.

---

## 8. Relatórios

- Valor total em estoque, economia gerada pelos descontos, perda potencial e total de ofertas.
- Gráfico de **valor por setor**.
- Contagem por **status de validade** e **top setores em alerta**.

---

## 9. Configurações (só Admin)

- Nome do mercado e moeda.
- Sliders de dias de alerta e desconto padrão das ofertas automáticas.
- Liga/desliga as sugestões automáticas.
- **Restaurar dados de demonstração** zera tudo de volta ao exemplo.

---

### Dúvidas comuns

- **“Perdi meus dados”** — os dados ficam no navegador. Trocar de navegador/computador ou
  limpar o cache começa do zero. (Versão com servidor é um próximo passo.)
- **“O cartaz/jornal não baixou”** — confira se o navegador bloqueou downloads automáticos.
