const steps = [
  { label: "Perfil profissional", detail: "Dados pessoais e objetivos", done: true },
  { label: "Currículo aprovado", detail: "1 currículo principal", done: true },
  { label: "LinkedIn + Gupy", detail: "Conexões assistidas", done: false },
];

const applications = [
  { company: "Ambev", role: "Operador de Processo de Produção", status: "Em análise", tone: "blue" },
  { company: "Swissport", role: "Auxiliar de Mecânico de Equipamentos", status: "Enviada", tone: "green" },
  { company: "Piracanjuba", role: "Operador de Máquinas I", status: "Em análise", tone: "blue" },
];
import DashboardClient from "./dashboard-client";

function Mark({ children }: { children: React.ReactNode }) {
  return <span className="mark" aria-hidden="true">{children}</span>;
}

export default async function Home() {
  const authenticatedUser = await getChatGPTUser();
  const displayName = authenticatedUser?.fullName?.split(" ")[0] ?? "Gabriel";
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><Mark>↗</Mark><span>VagaCerta</span></div>
        <nav aria-label="Navegação principal">
          <a className="nav-item active" href="#inicio"><span>⌂</span>Visão geral</a>
          <a className="nav-item" href="#perfil"><span>◎</span>Meu perfil</a>
          <a className="nav-item" href="#curriculo"><span>▤</span>Meu currículo</a>
          <a className="nav-item" href="#vagas"><span>⌕</span>Buscar vagas</a>
          <a className="nav-item" href="#candidaturas"><span>✓</span>Candidaturas</a>
          <a className="nav-item" href="#integracoes"><span>⌁</span>Integrações</a>
          <a className="nav-item" href="#historico"><span>◷</span>Histórico</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="plan"><span>Plano inicial</span><strong>12 de 30 candidaturas</strong><i><b /></i></div>
          <a className="nav-item" href="#configuracoes"><span>⚙</span>Configurações</a>
          <div className="user-mini"><div className="avatar">{displayName.slice(0, 2).toUpperCase()}</div><div><strong>{displayName}</strong><small>{authenticatedUser ? "Conta conectada" : "Modo de demonstração"}</small></div><a className="logout" href={authenticatedUser ? chatGPTSignOutPath("/") : chatGPTSignInPath("/")}>{authenticatedUser ? "Sair" : "Entrar"}</a></div>
        </div>
      </aside>

      <section className="content" id="inicio">
        <header className="topbar">
          <div><p>SEU AMBIENTE DE CANDIDATURAS</p><h1>Olá, {displayName} <span>👋</span></h1></div>
          <a className="secondary" href={authenticatedUser ? "/api/me" : chatGPTSignInPath("/")}>{authenticatedUser ? "Minha conta" : "Entrar"}</a>
        </header>

        <section className="hero-card">
          <div className="hero-copy"><span className="eyebrow">CONFIGURAÇÃO DA CONTA</span><h2>Prepare seu ambiente para começar</h2><p>Conclua as etapas abaixo. Seus dados, currículo e sessões ficam separados dos demais usuários.</p></div>
          <div className="progress-ring"><strong>67%</strong><span>concluído</span></div>
          <div className="steps">
            {steps.map((step, index) => <article key={step.label} className={step.done ? "step done" : "step"}>
              <span className="step-number">{step.done ? "✓" : index + 1}</span><div><strong>{step.label}</strong><small>{step.detail}</small></div>{!step.done && <button>Configurar</button>}
            </article>)}
          </div>
        </section>

        <section className="stats" aria-label="Estatísticas">
          <article><span className="stat-icon blue">⌕</span><div><small>Vagas encontradas</small><strong>128</strong><em>+24 nesta semana</em></div></article>
          <article><span className="stat-icon violet">✓</span><div><small>Candidaturas enviadas</small><strong>25</strong><em>+8 hoje</em></div></article>
          <article><span className="stat-icon amber">◷</span><div><small>Em andamento</small><strong>9</strong><em>36% do total</em></div></article>
          <article><span className="stat-icon green">✦</span><div><small>Retornos</small><strong>2</strong><em>1 nova atualização</em></div></article>
        </section>

        <section className="grid">
          <article className="panel actions-panel">
            <div className="panel-title"><div><span className="eyebrow">PRÓXIMO PASSO</span><h3>O que você quer fazer?</h3></div></div>
            <div className="action-list">
              <button className="action primary-action"><Mark>⌕</Mark><div><strong>Buscar vagas compatíveis</strong><small>LinkedIn e Gupy, com seus filtros</small></div><span>→</span></button>
              <button className="action"><Mark>▤</Mark><div><strong>Revisar currículo principal</strong><small>O mesmo arquivo aprovado em todas as vagas</small></div><span>→</span></button>
              <button className="action"><Mark>⌁</Mark><div><strong>Conectar plataformas</strong><small>Login assistido e sessões individuais</small></div><span>→</span></button>
            </div>
          </article>

          <article className="panel recent-panel" id="candidaturas">
            <div className="panel-title"><div><span className="eyebrow">ATIVIDADE RECENTE</span><h3>Últimas candidaturas</h3></div><a href="#todas">Ver todas</a></div>
            <div className="application-list">
              {applications.map((item) => <div className="application" key={item.company + item.role}>
                <div className="company-logo">{item.company.slice(0, 1)}</div><div><strong>{item.role}</strong><small>{item.company}</small></div><span className={`status ${item.tone}`}>{item.status}</span>
              </div>)}
            </div>
          </article>
        </section>

        <section className="safety-note"><Mark>✓</Mark><div><strong>Seu ambiente é individual</strong><p>Currículo, perfil, respostas e conexões são associados somente à sua conta. Logins e etapas sensíveis continuam sob seu controle.</p></div><a href="#privacidade">Como protegemos seus dados</a></section>
        <DashboardClient />
      </section>
    </main>
  );
}
import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";
