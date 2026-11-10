import React, { useEffect, useState } from "react";

function isRunningAsInstalledApp() {
  return window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: fullscreen)").matches
    || navigator.standalone === true;
}

function isAppleMobileDevice() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export default function InstallPrompt() {
  const [installed, setInstalled] = useState(isRunningAsInstalledApp);
  const [installEvent, setInstallEvent] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [installing, setInstalling] = useState(false);
  const appleDevice = isAppleMobileDevice();

  useEffect(() => {
    const mediaQuery = window.matchMedia("(display-mode: standalone)");

    function syncInstalledState() {
      if (isRunningAsInstalledApp()) setInstalled(true);
    }

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setInstallEvent(event);
    }

    function handleAppInstalled() {
      setInstalled(true);
      setInstallEvent(null);
      setDismissed(false);
    }

    mediaQuery.addEventListener?.("change", syncInstalledState);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      mediaQuery.removeEventListener?.("change", syncInstalledState);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!installEvent) {
      setShowInstructions((visible) => !visible);
      return;
    }

    setInstalling(true);
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice?.outcome === "accepted") {
        setInstallEvent(null);
      } else {
        setDismissed(true);
      }
    } catch (error) {
      console.error("Não foi possível iniciar a instalação:", error);
      setShowInstructions(true);
    } finally {
      setInstalling(false);
    }
  }

  if (installed || dismissed) return null;

  const actionLabel = installEvent
    ? "Instalar agora"
    : appleDevice
      ? "Como instalar"
      : "Como instalar";

  return (
    <aside className="install-prompt" aria-label="Instalar SuperMartket">
      <div className="install-prompt-copy">
        <span className="install-prompt-icon" aria-hidden="true">↓</span>
        <div>
          <strong>Tenha o SuperMartket no seu celular</strong>
          <p>Instale o aplicativo para abrir suas compras direto pela tela inicial.</p>
        </div>
      </div>

      <div className="install-prompt-actions">
        <button
          className="install-prompt-button"
          type="button"
          onClick={handleInstall}
          disabled={installing}
        >
          {installing ? "Abrindo..." : actionLabel}
        </button>
        <button
          className="install-prompt-dismiss"
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Lembrar depois"
        >
          Agora não
        </button>
      </div>

      {showInstructions && (
        <p className="install-prompt-instructions">
          {appleDevice
            ? <>No Safari, toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.</>
            : <>No menu do navegador, procure <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.</>}
        </p>
      )}
    </aside>
  );
}
