# Deploy do browser worker

O Sites hospeda a aplicação web. O worker exige host Docker com volume persistente; não deve rodar em função serverless efêmera.

Requisitos: HTTPS, volume `/data`, firewall, segredos do provedor e camada autenticada de noVNC/browser remoto para o primeiro login. Use uma réplica por volume até adotar lock distribuído.

Variáveis obrigatórias: `BROWSER_WORKER_TOKEN` e `BROWSER_PROFILE_ENCRYPTION_KEY`. Ajuste `MAX_BROWSER_WORKERS`, `MAX_BROWSER_JOBS_PER_USER` e `BROWSER_JOB_TIMEOUT`.

Limitação: a camada visual segura depende do domínio e provedor do Docker. Sem noVNC ou serviço equivalente, o primeiro login interativo não pode ser concluído em produção.
