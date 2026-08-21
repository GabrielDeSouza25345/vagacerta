# Auditoria da arquitetura atual

Data da auditoria: 2026-08-21

## Resultado executivo

O diretório disponibilizado não contém o sistema funcional de candidatura descrito no requisito. Ele contém um starter `vinext`/React/Cloudflare incompleto. Não é seguro iniciar a conversão multiusuário nesta árvore porque isso equivaleria a criar um sistema novo e perderia a lógica existente que deve ser preservada.

## Estrutura encontrada

- `package.json`: starter React 19 + vinext + Vite + Cloudflare + Drizzle.
- `worker/index.ts`: entrada genérica de Cloudflare Worker e otimização de imagens.
- `vite.config.ts`: espera bindings D1/R2 e importa arquivos ausentes.
- `drizzle.config.ts`: aponta para `db/schema.ts`, que está ausente.
- `tests/rendered-html.test.mjs`: testa apenas a tela skeleton do starter e referencia arquivos ausentes.
- `public/`: somente ícones do starter.
- `outputs/gabriel-montenegro-linkedin-cover.png`: artefato de banner, sem o gerador correspondente.
- `work/pdfs/curriculo-render/`: renderizações temporárias de duas páginas, sem o gerador de currículo correspondente.
- `README.md`: documentação do starter, não do produto de candidaturas.

## Componentes referenciados, porém ausentes

- `app/`
- `app/page.tsx`
- `app/layout.tsx`
- `app/chatgpt-auth.ts`
- `app/_sites-preview/`
- `db/schema.ts`
- `build/sites-vite-plugin`
- `.openai/hosting.json`
- migrations de banco
- código de currículo
- código de LinkedIn
- código de Gupy
- código do gerador de banner
- motor de busca de vagas
- motor de candidaturas
- persistência de perfil, preferências e histórico
- sessões ou perfis de navegador
- filas/workers de automação

## Dados fixos encontrados

Não foram encontrados nome, e-mail, telefone, credenciais, cookies, tokens, sessões ou perfil profissional hardcoded no código disponível. O único vínculo nominal é o nome do arquivo de banner gerado em `outputs/`.

## Banco e persistência

Não existe schema de banco disponível. Há apenas configuração conceitual para SQLite/D1 e um ID placeholder. Não há tabelas, migrations ou dados que possam ser migrados para `user_id`.

## Estado do repositório

- Branch `main` sem commits.
- Todos os arquivos aparecem como não rastreados.
- Portanto, não há histórico Git utilizável como backup ou fonte de recuperação.

## Backup

Backup pré-migração criado em:

`backups/pre-multiusuario-2026-08-21.zip`

SHA-256:

`EBF5B426766A81FF3AEB923AF8EBB9D778FA393F45B705287EF16C79DFD352A0`

O backup exclui dependências e artefatos regeneráveis (`node_modules`, `.git`, `dist`, `.next`, `.vinext`, `.wrangler`, `outputs` e `work`).

## Riscos atuais

1. Implementar autenticação agora criaria uma aplicação paralela, não uma migração.
2. Não é possível identificar nem preservar contratos internos dos módulos existentes.
3. Não é possível migrar o usuário atual sem o banco ou a fonte de dados.
4. Não é possível garantir isolamento de sessões sem o código que cria e reutiliza contextos de navegador.
5. Não é possível produzir uma lista exata de arquivos a modificar enquanto os arquivos funcionais estiverem ausentes.
6. Os testes atuais não cobrem o produto e também referenciam arquivos ausentes.

## Arquivos que serão modificados depois da recuperação

A lista exata depende da árvore real. As categorias obrigatórias são:

- schema e migrations do banco;
- middleware e serviços de autenticação;
- repositórios/queries de perfil, currículo, preferências, vagas e candidaturas;
- adaptadores de LinkedIn e Gupy;
- gerador e armazenamento de currículo/banner;
- motor de candidatura;
- fila e workers;
- gerenciamento de sessões de navegador;
- rotas e componentes do dashboard;
- armazenamento de arquivos;
- configuração de ambientes, Docker, CI/CD e observabilidade;
- testes de isolamento entre usuários.

Nenhum nome de arquivo novo deve ser fixado antes de localizar os equivalentes atuais, para evitar duplicação ou reescrita.

## Próxima ação segura

Recuperar ou anexar a raiz verdadeira do sistema funcional, incluindo código-fonte, schema/migrations, arquivos de configuração e uma cópia sanitizada do banco. Segredos, cookies e tokens reais não devem ser anexados; basta fornecer `.env.example` e indicar onde os segredos são injetados.

Após a recuperação, a sequência será:

1. inventário de módulos e fluxos;
2. backup completo e teste de restauração;
3. testes de caracterização do comportamento atual;
4. autenticação e tabela `users`;
5. migrations aditivas de `user_id`;
6. migração do usuário proprietário;
7. isolamento progressivo de dados, arquivos e sessões;
8. filas e browser workers;
9. dashboard/admin/planos;
10. testes com três usuários, staging e deploy.
