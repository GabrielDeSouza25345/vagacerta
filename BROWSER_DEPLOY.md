# Deploy do browser worker

O Sites hospeda a aplicação web. O worker exige host Docker com volume persistente; não deve rodar em função serverless efêmera.

Requisitos: HTTPS, volume `/data`, firewall, segredos do provedor e camada autenticada de noVNC/browser remoto para o primeiro login. Use uma réplica por volume até adotar lock distribuído.

Variáveis obrigatórias: `BROWSER_WORKER_TOKEN` e `BROWSER_PROFILE_ENCRYPTION_KEY`. Ajuste `MAX_BROWSER_WORKERS`, `MAX_BROWSER_JOBS_PER_USER` e `BROWSER_JOB_TIMEOUT`.

Limitação: a camada visual segura depende do domínio e provedor do Docker. Sem noVNC ou serviço equivalente, o primeiro login interativo não pode ser concluído em produção.

## Railway deploy

1. Envie este projeto para um repositório GitHub privado. Não envie `.env`, `/data`, cookies ou perfis.
2. Entre em `railway.com`, clique **New Project → Deploy from GitHub repo** e autorize somente o repositório necessário.
3. Nomeie o serviço como `browser-worker`. O `railway.json` seleciona `Dockerfile.browser-worker` e `/health/browser-worker`.
4. No canvas do projeto, clique com o botão direito → **Attach Volume**, selecione `browser-worker` e informe `/data` como Mount Path. Volumes Railway persistem entre restart e redeploy.
5. Abra **browser-worker → Variables → RAW Editor** e configure:

   ```text
   BROWSER_WORKER_TOKEN=<segredo aleatório forte>
   BROWSER_PROFILE_ENCRYPTION_KEY=<segredo aleatório diferente e permanente>
   DATA_DIR=/data
   MAX_BROWSER_WORKERS=1
   MAX_BROWSER_JOBS_PER_USER=2
   BROWSER_JOB_TIMEOUT=300000
   INTERACTIVE_SESSION_TTL=600
   BETA_MODE=true
   BETA_MAX_USERS=6
   NODE_ENV=production
   ```

6. Gere os dois segredos fora do Railway com `openssl rand -base64 48` executado duas vezes. Não reutilize valores e não troque a chave de criptografia após criar perfis.
7. Em **Settings → Networking**, clique **Generate Domain**. Copie a URL HTTPS.
8. Confirme que `https://SEU-DOMINIO/health/browser-worker` retorna `status: ok` e `worker: online`.
9. Configure no backend do Sites `BROWSER_WORKER_URL=https://SEU-DOMINIO` e o mesmo `BROWSER_WORKER_TOKEN`. Nunca configure esse token no frontend.
10. Faça um redeploy, confirme o health check e verifique pelo volume que `/data/state.enc` foi criado.

O Railway aceita Dockerfile personalizado por `dockerfilePath`, usa `PORT` injetada automaticamente e monta volumes apenas em runtime. Consulte a documentação oficial de [Dockerfiles](https://docs.railway.com/builds/dockerfiles), [volumes](https://docs.railway.com/volumes) e [configuração como código](https://docs.railway.com/config-as-code).

### Bloqueio manual atual

Ainda é necessário escolher e configurar a camada visual autenticada de noVNC/browser remoto. Não exponha a porta VNC diretamente. Somente depois de existir uma URL temporária protegida devem ser realizados os testes reais de LinkedIn, Gupy, restart e dois usuários.
