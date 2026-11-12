import React, { useEffect, useMemo, useState } from "react";
import SessionLocationMap from "../components/SessionLocationMap.jsx";
import { isValidLocation, normalizeGeolocationPosition, shouldPublishLocation } from "../utils/locationSharing.js";
import { formatInactiveDuration, getPresenceStatus, groupPresenceByUser } from "../utils/sessionActivity.js";
import { readLocationSharingPreference, writeLocationSharingPreference } from "../utils/sessionPersistence.js";

const LOCATION_STALE_AFTER_MS = 90_000;

function getInitialLocationSharing() {
  try { return readLocationSharingPreference(window.sessionStorage); }
  catch { return false; }
}

function persistLocationSharing(isSharing) {
  try { writeLocationSharingPreference(isSharing, window.sessionStorage); }
  catch { /* Sharing remains available for the current page. */ }
}

function getGeolocationErrorMessage(error) {
  if (error?.code === 1) return "Permissão de localização negada. Autorize o acesso nas configurações do navegador.";
  if (error?.code === 2) return "Não foi possível determinar sua localização. Verifique o GPS do dispositivo.";
  if (error?.code === 3) return "O GPS demorou para responder. O compartilhamento foi interrompido; tente novamente.";
  return "Não foi possível acessar sua localização. O compartilhamento foi interrompido.";
}

export default function SessionPage({ members = [], presence = {}, typing = {}, onLocationChange, onBack }) {
  const [now, setNow] = useState(Date.now());
  const [sharingLocation, setSharingLocation] = useState(getInitialLocationSharing);
  const [locationStatus, setLocationStatus] = useState("idle");
  const [locationMessage, setLocationMessage] = useState("");
  const presenceByMember = useMemo(() => groupPresenceByUser(presence), [presence]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!sharingLocation) {
      onLocationChange?.(null);
      return undefined;
    }

    if (!navigator.geolocation) {
      persistLocationSharing(false);
      setLocationStatus("error");
      setLocationMessage("Este navegador não oferece suporte à geolocalização.");
      setSharingLocation(false);
      onLocationChange?.(null);
      return undefined;
    }

    if (!window.isSecureContext) {
      persistLocationSharing(false);
      setLocationStatus("error");
      setLocationMessage("A localização exige uma conexão segura (HTTPS).");
      setSharingLocation(false);
      onLocationChange?.(null);
      return undefined;
    }

    let active = true;
    let failed = false;
    let watchId = null;
    let previousLocation = null;
    let visible = document.visibilityState === "visible";

    const stopWatching = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      previousLocation = null;
      onLocationChange?.(null);
    };

    const startWatching = () => {
      if (!active || !visible || watchId !== null || failed) return;
      setLocationStatus("requesting");

      try {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            if (!active || !visible || failed) return;
            const nextLocation = normalizeGeolocationPosition(position);
            if (!nextLocation) return;

            setLocationStatus("sharing");
            setLocationMessage(
              nextLocation.accuracy == null
                ? "Sua localização está sendo compartilhada."
                : `Sua localização está sendo compartilhada. Precisão aproximada: ${nextLocation.accuracy} m.`,
            );

            if (!shouldPublishLocation(nextLocation, previousLocation)) return;
            previousLocation = nextLocation;
            onLocationChange?.(nextLocation);
          },
          (geolocationError) => {
            if (!active || !visible || failed) return;
            failed = true;
            stopWatching();
            persistLocationSharing(false);
            setLocationStatus("error");
            setLocationMessage(getGeolocationErrorMessage(geolocationError));
            setSharingLocation(false);
          },
          { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
        );
      } catch {
        failed = true;
        stopWatching();
        persistLocationSharing(false);
        setLocationStatus("error");
        setLocationMessage("Não foi possível iniciar o compartilhamento de localização.");
        setSharingLocation(false);
      }
    };

    const handleVisibilityChange = () => {
      visible = document.visibilityState === "visible";
      if (visible) {
        startWatching();
      } else {
        stopWatching();
        setLocationStatus("paused");
        setLocationMessage("Compartilhamento pausado enquanto o site não está visível.");
      }
    };

    const handlePageHide = () => stopWatching();
    const handlePageShow = () => {
      visible = document.visibilityState === "visible";
      startWatching();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    startWatching();

    return () => {
      active = false;
      stopWatching();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [sharingLocation, onLocationChange]);

  const mapLocations = useMemo(() => members.flatMap((member) => {
    const location = presenceByMember.get(member.userId)?.location;
    if (!isValidLocation(location) || now - Date.parse(location.updatedAt) > LOCATION_STALE_AFTER_MS) return [];
    return [{ ...location, userId: member.userId, name: member.name || "Participante" }];
  }), [members, presenceByMember, now]);

  const counts = useMemo(() => members.reduce((total, member) => {
    const status = getPresenceStatus(member.userId, presenceByMember);
    total[status] = (total[status] ?? 0) + 1;
    return total;
  }, { online: 0, inactive: 0, offline: 0 }), [members, presenceByMember]);

  const locationButtonLabel = locationStatus === "requesting"
    ? "Cancelar solicitação"
    : sharingLocation ? "Parar de compartilhar" : "Compartilhar localização";

  return (
    <main className="page-content session-page-content">
      <button className="back-button" onClick={onBack} type="button"><span aria-hidden="true">←</span> Voltar</button>
      <div className="page-intro">
        <span className="eyebrow">ACOMPANHAMENTO EM TEMPO REAL</span>
        <h1>Sessão</h1>
        <p>Veja quem está participando e encontre quem estiver compartilhando a localização.</p>
      </div>

      <section aria-label="Resumo dos participantes" className="session-overview">
        <div className="session-stat"><strong>{counts.online}</strong><span>Online</span></div>
        <div className="session-stat"><strong>{counts.inactive}</strong><span>Inativos</span></div>
        <div className="session-stat"><strong>{counts.offline}</strong><span>Offline</span></div>
      </section>

      <section aria-labelledby="session-location-title" className="session-location-panel">
        <div className="session-location-heading">
          <div>
            <span className="eyebrow">LOCALIZADOR DA SESSÃO</span>
            <h2 id="session-location-title">Onde estão os participantes?</h2>
            <p>Compartilhe sua posição para que as outras pessoas da sessão possam encontrar você.</p>
          </div>
          <button
            aria-pressed={sharingLocation}
            className={sharingLocation ? "session-location-toggle active" : "session-location-toggle"}
            onClick={() => {
              if (sharingLocation) {
                persistLocationSharing(false);
                setSharingLocation(false);
                setLocationStatus("idle");
                setLocationMessage("Você parou de compartilhar sua localização.");
                return;
              }
              persistLocationSharing(true);
              setLocationMessage("Obtendo sua localização...");
              setLocationStatus("requesting");
              setSharingLocation(true);
            }}
            type="button"
          >
            <span aria-hidden="true">{sharingLocation ? "●" : "⌖"}</span>
            {locationButtonLabel}
          </button>
        </div>

        {locationMessage && (
          <p aria-live="polite" className="session-location-message" role="status">
            {locationMessage}
          </p>
        )}

        {mapLocations.length > 0 ? (
          <SessionLocationMap locations={mapLocations} />
        ) : (
          <div className="session-location-empty" role="status">
            <span aria-hidden="true">⌖</span>
            <strong>Nenhuma localização compartilhada no momento</strong>
            <p>Quando alguém ativar o compartilhamento, sua posição aparecerá aqui no mapa.</p>
          </div>
        )}

        <p className="session-location-disclaimer">
          O compartilhamento é opcional e é pausado quando você oculta o site. Ao sair desta tela ou fechar a aba, sua posição deixa de ser compartilhada. O GPS pode ser impreciso dentro de supermercados.
        </p>
      </section>

      {members.length === 0 ? (
        <div className="session-empty" role="status">Não há participantes cadastrados nesta sessão.</div>
      ) : (
        <ul aria-label="Participantes da sessão" className="session-members-list">
          {members.map((member) => {
            const currentPresence = presenceByMember.get(member.userId);
            const status = getPresenceStatus(member.userId, presenceByMember);
            const typingInfo = typing[member.userId];
            const hasLocation = mapLocations.some((entry) => entry.userId === member.userId);
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
                  <span className="session-location-member-status">
                    {hasLocation ? "Compartilhando localização" : "Localização não compartilhada"}
                  </span>
                  {typingInfo && status !== "offline" && (
                    <span className="session-typing" aria-label={`${member.name} está digitando`}>
                      {member.name} está digitando{typingInfo.field ? ` em ${typingInfo.field}` : ""}
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
