# Segurança

O piloto atual funciona com dados locais para testes controlados. Antes de abrir
o sistema para uso público:

- substitua as contas demonstrativas por autenticação real;
- use regras de acesso no banco por loja e por função;
- mantenha segredos apenas no servidor;
- ative backups e registro de auditoria;
- revise LGPD, retenção e exportação dos dados;
- remova ou desative contas de demonstração;
- sirva o aplicativo exclusivamente por HTTPS.

Não publique `.env`, chaves privadas, tokens, senhas reais ou dados pessoais no
repositório. Em caso de vazamento, revogue a credencial antes de abrir uma issue.

