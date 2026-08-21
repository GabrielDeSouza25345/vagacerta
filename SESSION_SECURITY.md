# Segurança de sessão

- Isolamento por hash de `user_id` e plataforma.
- Lock obrigatório por perfil; padrão de um browser simultâneo.
- Fila e metadados cifrados com AES-256-GCM.
- Chave somente em `BROWSER_PROFILE_ENCRYPTION_KEY`.
- Token interno somente em `BROWSER_WORKER_TOKEN`.
- Perfis e `state.enc` nunca entram no Git ou frontend.
- Logs não incluem cookies, senhas, Authorization ou tokens.
- Logout do VagaCerta não remove sessões externas.
- `DISCONNECT_PLATFORM` remove somente a plataforma selecionada.

O volume do host deve usar criptografia de disco e backups criptografados.
