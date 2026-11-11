import React, { useMemo } from "react";

function getPresenceByMember(presence) {
  const grouped = new Map();
  Object.values(presence ?? {}).flat().forEach((entry) => {
    if (!entry?.userId) return;
    const current = grouped.get(entry.userId);
    const rank = (status) => status === "online" ? 2 : status === "inactive" ? 1 : 0;
    if (!current || rank(entry.status) > rank(current.status)
      || (entry.lastActiveAt && (!current.lastActiveAt || entry.lastActiveAt > current.lastActiveAt))) {
      grouped.set(entry.userId, entry);
    }
  });
  return grouped;
}

function formatInactive(lastActiveAt) {
  if (!lastActiveAt) return "Inativo";
  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(lastActiveAt).getTime()) / 1000));
  if (elapsed < 60) return "Inativo há menos de 1 minuto";
  const minutes = Math.floor(elapsed / 60);
  if (minutes < 60) return `Inativo há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `Inativo há ${hours} h`;
}

export default function SessionPage({ members = [], presence = {}, typing = {}, onBack }) {
  const presenceByMember = useMemo(() => getPresenceByMember(presence), [presence]);
  const counts = useMemo(() => members.reduce((total, member) => {
    const status = presenceByMember.get(member.userId)?.status ?? "offline";
    total[status] = (total[status] ?? 0) + 1;
    return total;
  }, { online: 0, inactive: 0, offline: 0 }), [members, presenceByMember]);

  return (
    <main className="page-content session-page-content">
      <button className="back-button" onClick={onBack} type="button"><span aria-hidden="true">←</span> Voltar</button>
      <div className="page-intro">
        <span className="eyebrow">ACOMPANHAMENTO EM TEMPO REAL</span>
        <h1>Sessão</h1>
        <p>Veja quem está participando e o estado de atividade de cada dispositivo.</p>
      </div>

      <section aria-label="Resumo dos participantes" className="session-overview">
        <div className="session-stat"><strong>{counts.online}</strong><span>Online</span></div>
        <div className="session-stat"><strong>{counts.inactive}</strong><span>Inativos</span></div>
        <div className="session-stat"><strong>{counts.offline}</strong><span>Offline</span></div>
      </section>

      {members.length === 0 ? (
        <div className="session-empty" role="status">Não há participantes cadastrados nesta sessão.</div>
      ) : (
        <ul aria-label="Participantes da sessão" className="session-members-list">
          {members.map((member) => {
            const currentPresence = presenceByMember.get(member.userId);
            const status = currentPresence?.status ?? "offline";
            const typingInfo = typing[member.userId];
            const statusLabel = status === "online" ? "Online"
              : status === "inactive" ? formatInactive(currentPresence?.lastActiveAt)
                : "Offline";
            return (
              <li className="session-member-card" key={member.userId}>
                <span aria-hidden="true" className="session-member-avatar">{member.name?.trim()?.charAt(0)?.toUpperCase() || "?"}</span>
                <span className="session-member-copy">
                  <strong>{member.name || "Participante sem nome"}</strong>
                  <span className="session-member-status">
                    <span className={`session-status-dot ${status}`} />
                    {statusLabel}
                  </span>
                  {typingInfo && status !== "offline" && (
                    <span className="session-typing" aria-label={`${typingInfo.name} está digitando`}>
                      {typingInfo.name} está digitando{typingInfo.field ? ` em ${typingInfo.field}` : ""}
                      <i /><i /><i />
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
