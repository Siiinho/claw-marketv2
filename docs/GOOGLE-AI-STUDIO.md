# Continuação no Google AI Studio

Este repositório é a fonte oficial do piloto do ClawMarket para a Loja 3 do
Supermercado Bengala. O projeto deve ser **importado**, não recriado.

## Como importar

1. Abra o Google AI Studio e entre em **Build**.
2. Selecione **Import from GitHub**.
3. Escolha este repositório privado.
4. Aguarde o primeiro build antes de solicitar mudanças.
5. Publique somente depois de testar o fluxo descrito em `PILOTO-LOJA3.md`.

## Limites para qualquer alteração

- Preservar a logo oficial e os tokens visuais em `src/index.css`.
- Preservar os templates, QR Codes e o rodapé em `public/templates`.
- Não regenerar textos, contatos ou QR Codes do rodapé com IA.
- Não trocar o `HashRouter` sem revisar a hospedagem.
- Não expor chaves em variáveis iniciadas por `VITE_`, exceto chaves públicas.
- Não substituir imagens aprovadas de produtos sem mudança de embalagem.
- Não remover o modo PWA, o scanner físico, a câmera ou a exportação A4.
- Nomes de produtos nunca podem usar reticências ou `text-overflow: ellipsis`
  no jornal final.

## Prioridade da próxima etapa

O Google AI Studio deve concentrar o trabalho em acabamento visual e backend:

1. conectar autenticação e persistência reais;
2. sincronizar a fila offline;
3. melhorar microinterações sem aumentar a quantidade de etapas;
4. validar a interface em Android e iPhone;
5. manter o fluxo principal em uma única sequência:
   **bipar → validade → confirmar → próximo produto**.

## Prompt inicial recomendado

> Analise o repositório inteiro antes de editar. Preserve a identidade exclusiva
> do Supermercado Bengala, os templates A4, os ativos oficiais e todas as
> funcionalidades. Melhore a experiência mobile-first e a acessibilidade sem
> recriar o aplicativo. O piloto é da Loja 3. O fluxo principal é bipar o código,
> reconhecer o produto, informar validade/lote/quantidade, confirmar uma única
> vez, adicionar à fila do jornal e preparar o próximo bip. Execute o build e
> apresente a lista de arquivos alterados ao concluir.

