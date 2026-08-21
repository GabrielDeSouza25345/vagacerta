"use client";

import { FormEvent, useEffect, useState } from "react";

type Profile = { city?: string | null; state?: string | null; profession?: string | null; objective?: string | null; desiredRoles?: string | null; skills?: string | null; availability?: string | null };
type Resume = { id: string; name: string; mimeType: string; version: number; approved: boolean; active: boolean; createdAt: string };
type Application = { id: string; company: string; role: string; platform: string; status: string; externalUrl?: string | null; createdAt: string };
const emptyProfile: Profile = { city: "", state: "RJ", profession: "", objective: "", desiredRoles: "", skills: "", availability: "Qualquer turno" };

export default function DashboardClient() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  async function refresh() {
    const [p, r, a] = await Promise.all([fetch("/api/profile"), fetch("/api/resumes"), fetch("/api/applications")]);
    if ([p, r, a].some(response => response.status === 401)) { setMessage("Entre com sua conta para salvar seus dados."); setLoading(false); return; }
    const [pd, rd, ad] = await Promise.all([p.json(), r.json(), a.json()]);
    setProfile({ ...emptyProfile, ...(pd.profile ?? {}) }); setResumes(rd.resumes ?? []); setApplications(ad.applications ?? []); setLoading(false);
  }
  useEffect(() => { refresh().catch(() => { setMessage("Não foi possível carregar seus dados agora."); setLoading(false); }); }, []);
  async function saveProfile(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setMessage("Salvando perfil..."); const response = await fetch("/api/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(profile) }); setMessage(response.ok ? "Perfil salvo com sucesso." : "Não foi possível salvar o perfil."); }
  async function uploadResume(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setMessage("Enviando currículo..."); const form = event.currentTarget; const response = await fetch("/api/resumes", { method: "POST", body: new FormData(form) }); const data = await response.json().catch(() => ({})); setMessage(response.ok ? "Currículo enviado e definido como principal." : data.error ?? "Falha no envio."); if (response.ok) { form.reset(); await refresh(); } }
  async function addApplication(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setMessage("Registrando candidatura..."); const form = event.currentTarget; const payload = Object.fromEntries(new FormData(form)); const response = await fetch("/api/applications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const data = await response.json().catch(() => ({})); setMessage(response.ok ? "Candidatura registrada." : data.error ?? "Falha ao registrar."); if (response.ok) { form.reset(); await refresh(); } }
  async function updateStatus(id: string, status: string) { const response = await fetch(`/api/applications/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) }); if (response.ok) await refresh(); else setMessage("Não foi possível atualizar o status."); }
  if (loading) return <section className="workspace-card"><p>Carregando seu ambiente...</p></section>;
  return <>
    {message && <div className="notice" role="status">{message}</div>}
    <section className="workspace-card" id="perfil"><div className="section-heading"><div><span className="eyebrow">SEUS DADOS</span><h2>Perfil profissional</h2></div><span>Salvo na sua conta</span></div>
      <form className="form-grid" onSubmit={saveProfile}>
        <label>Profissão atual<input value={profile.profession ?? ""} onChange={e => setProfile({ ...profile, profession: e.target.value })} placeholder="Ex.: Técnico em Mecânica" /></label><label>Cidade<input value={profile.city ?? ""} onChange={e => setProfile({ ...profile, city: e.target.value })} placeholder="Sua cidade" /></label><label>Estado<input value={profile.state ?? ""} onChange={e => setProfile({ ...profile, state: e.target.value })} maxLength={2} /></label>
        <label className="wide">Cargos desejados<input value={profile.desiredRoles ?? ""} onChange={e => setProfile({ ...profile, desiredRoles: e.target.value })} placeholder="Separe por vírgula" /></label><label className="wide">Objetivo profissional<textarea value={profile.objective ?? ""} onChange={e => setProfile({ ...profile, objective: e.target.value })} rows={3} /></label><label className="wide">Competências<textarea value={profile.skills ?? ""} onChange={e => setProfile({ ...profile, skills: e.target.value })} rows={3} /></label><label className="wide">Disponibilidade<input value={profile.availability ?? ""} onChange={e => setProfile({ ...profile, availability: e.target.value })} /></label><button className="primary-button" type="submit">Salvar perfil</button>
      </form></section>
    <section className="workspace-card" id="curriculo"><div className="section-heading"><div><span className="eyebrow">DOCUMENTOS</span><h2>Meus currículos</h2></div><span>{resumes.length} arquivo(s)</span></div><form className="upload-row" onSubmit={uploadResume}><label>Nome<input name="name" required placeholder="Currículo Técnico" /></label><label>PDF ou Word<input name="file" type="file" accept=".pdf,.doc,.docx" required /></label><button className="primary-button" type="submit">Enviar currículo</button></form><div className="record-list">{resumes.length ? resumes.map(resume => <div className="record" key={resume.id}><div><strong>{resume.name}</strong><small>Versão {resume.version} · {resume.mimeType}</small></div><span className={resume.approved ? "pill success" : "pill"}>{resume.approved ? "Principal aprovado" : "Em revisão"}</span></div>) : <p className="empty">Nenhum currículo enviado ainda.</p>}</div></section>
    <section className="workspace-card" id="historico"><div className="section-heading"><div><span className="eyebrow">ACOMPANHAMENTO</span><h2>Minhas candidaturas</h2></div><span>{applications.length} registrada(s)</span></div><form className="application-form" onSubmit={addApplication}><input name="company" required placeholder="Empresa" /><input name="role" required placeholder="Cargo" /><select name="platform" defaultValue="LINKEDIN"><option>LINKEDIN</option><option>GUPY</option><option>OUTRO</option></select><input name="externalUrl" type="url" placeholder="Link (opcional)" /><button className="primary-button" type="submit">Registrar</button></form><div className="record-list">{applications.length ? applications.map(item => <div className="record application-record" key={item.id}><div className="company-logo">{item.company[0]}</div><div><strong>{item.role}</strong><small>{item.company} · {item.platform}</small></div><select aria-label={`Status de ${item.role}`} value={item.status} onChange={e => updateStatus(item.id, e.target.value)}><option value="DRAFT">Rascunho</option><option value="SENT">Enviada</option><option value="IN_REVIEW">Em análise</option><option value="INTERVIEW">Entrevista</option><option value="REJECTED">Encerrada</option></select>{item.externalUrl && <a href={item.externalUrl} target="_blank" rel="noreferrer">Abrir vaga</a>}</div>) : <p className="empty">Registre sua primeira candidatura para acompanhar o processo.</p>}</div></section>
  </>;
}
