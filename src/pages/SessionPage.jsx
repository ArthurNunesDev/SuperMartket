import React, { useEffect, useMemo, useState } from "react";
import { formatInactiveDuration, getPresenceStatus, groupPresenceByUser } from "../utils/sessionActivity.js";

export default function SessionPage({ members = [], presence = {}, typing = {}, onBack }) {
  const [now, setNow] = useState(Date.now());
  const presenceByMember = useMemo(() => groupPresenceByUser(presence), [presence]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const counts = useMemo(() => members.reduce((total, member) => {
    const status = getPresenceStatus(member.userId, presenceByMember);
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
            const status = getPresenceStatus(member.userId, presenceByMember);
            const typingInfo = typing[member.userId];
            const statusLabel = status === "online" ? "Online"
              : status === "inactive" ? formatInactiveDuration(currentPresence?.lastActiveAt, now)
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
