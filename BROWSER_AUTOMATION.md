# VagaCerta Browser Automation

O navegador roda em um serviço Docker separado do Sites. O site autentica o usuário, ignora qualquer `user_id` enviado pela tela e encaminha somente a identidade autenticada ao worker.

Fluxo: `Sites -> API interna -> fila persistida -> lock user+platform -> Playwright persistent context -> LinkedIn/Gupy`.

Perfis ficam em `/data/profiles/<sha256(user_id)>/<platform>` no volume persistente. Metadados e fila ficam criptografados em `/data/state.enc`. Senhas não são armazenadas.

Jobs: `CONNECT_PLATFORM`, `VALIDATE_SESSION`, `DISCONNECT_PLATFORM` e `OPEN_PLATFORM`. O worker valida rotas e elementos de sessão antes de retornar `CONNECTED`. Login, CAPTCHA e MFA geram `ACTION_REQUIRED`.

## Execução local

1. Copie `.env.browser.example` para um arquivo local ignorado e gere dois segredos diferentes.
2. Construa: `docker build -f Dockerfile.browser-worker -t vagacerta-browser-worker .`
3. Execute com volume persistente em `/data`, porta 8080 e as variáveis locais.
4. Configure no site `BROWSER_WORKER_URL` e `BROWSER_WORKER_TOKEN`.

Saúde: `GET /health/browser-worker`.

## Sessão interativa

`INTERACTIVE_BROWSER_BASE_URL` aponta para a camada visual autenticada do host. Não exponha CDP, VNC ou Chromium diretamente à internet.
