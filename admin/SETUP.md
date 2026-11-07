# Configuração do painel administrativo

O arquivo `Code.gs` é o backend do painel e grava na aba `IMÓVEIS` da planilha informada.

1. Abra a planilha no Google Sheets.
2. Acesse `Extensões > Apps Script`.
3. Cole o conteúdo de `admin/Code.gs` e salve.
4. Em `Configurações do projeto > Propriedades do script`, crie:
   - `ADMIN_EMAILS`: e-mails autorizados separados por vírgula.
5. Em `Implantar > Nova implantação`, escolha `Aplicativo da web`.
6. Execute como sua conta e limite o acesso às contas autorizadas.
7. Informe a URL `/exec` gerada para configurar `VITE_ADMIN_API_URL` no build do site.
8. No editor do Apps Script, execute uma vez a função `installAdminTokenCleanupTrigger` e autorize o acesso solicitado. Ela instalará a limpeza diária dos tokens expirados.

O backend usa a sessão da conta Google, valida o e-mail autorizado e oferece:

- `GET ?action=list`: listar imóveis;
- `POST {"action":"update","property":{...}}`: atualizar por ID;
- `POST {"action":"create","property":{...}}`: criar um imóvel.

Não coloque senhas no JavaScript do site. A autenticação deve ser feita pelo Google Apps Script e pela conta Google autorizada.
