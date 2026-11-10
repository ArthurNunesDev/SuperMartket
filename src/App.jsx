import React, { useCallback, useEffect, useRef, useState } from "react";
import InstallPrompt from "./components/InstallPrompt.jsx";
import ShoppingPage from "./pages/ShoppingPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import AccessPage from "./pages/AccessPage.jsx";
import {
  authorizeWithFamilyPin,
  checkDeviceAccess,
  completeSharedPurchase,
  createSharedPurchase,
  deleteSharedItem,
  ensureDeviceSession,
  getSharedPurchases,
  getSharedItemEditHistory,
  saveSharedItem,
  subscribeToSharedPurchases,
} from "./services/supabase.js";

const THEME_STORAGE_KEY = "supermartket-theme";
const DEVICE_NAME_STORAGE_KEY = "supermartket-device-name";

function getInitialTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function getStoredDeviceName() {
  try {
    const name = localStorage.getItem(DEVICE_NAME_STORAGE_KEY);
    return typeof name === "string" && name.trim() ? name.trim() : "";
  } catch {
    return "";
  }
}

export default function App() {
  const [activePurchase, setActivePurchase] = useState(null);
  const [completedPurchases, setCompletedPurchases] = useState([]);
  const [currentPage, setCurrentPage] = useState("shopping");
  const [accessStep, setAccessStep] = useState("loading");
  const [authorized, setAuthorized] = useState(false);
  const [deviceName, setDeviceName] = useState(getStoredDeviceName);
  const [theme, setTheme] = useState(getInitialTheme);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const refreshCountRef = useRef(0);
  const [error, setError] = useState("");
  const [accessError, setAccessError] = useState("");
  const realtimeCleanupRef = useRef(null);

  const refreshPurchases = useCallback(async () => {
    refreshCountRef.current += 1;
    setRefreshing(true);
    try {
      const purchases = await getSharedPurchases();
      const active = purchases.find((purchase) => purchase.status === "active") ?? null;
      const history = purchases
        .filter((purchase) => purchase.status === "completed")
        .sort((first, second) =>
          (second.completedAt ?? second.createdAt).localeCompare(first.completedAt ?? first.createdAt)
        );
      setActivePurchase(active);
      setCompletedPurchases(history);
    } finally {
      refreshCountRef.current -= 1;
      setRefreshing(refreshCountRef.current > 0);
    }
  }, []);

  const handleHistoryLoadingChange = useCallback((isLoading) => {
    setHistoryLoading(isLoading);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content",
      theme === "dark" ? "#111a15" : "#f4f7f5"
    );
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Theme remains available for the current session.
    }
  }, [theme]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  useEffect(() => {
    let mounted = true;
    async function initialize() {
      try {
        await ensureDeviceSession();
        const deviceIsAuthorized = await checkDeviceAccess();
        if (!mounted) return;

        setAccessError("");
        if (!deviceIsAuthorized) {
          setAuthorized(false);
          setAccessStep("pin");
          return;
        }

        setAuthorized(true);
        const storedName = getStoredDeviceName();
        setDeviceName(storedName);
        setAccessStep(storedName ? "ready" : "name");
        await refreshPurchases();
        realtimeCleanupRef.current?.();
        realtimeCleanupRef.current = subscribeToSharedPurchases(() => {
          refreshPurchases().catch(() => setError("Não foi possível atualizar a lista compartilhada."));
        }, (subscriptionError) => setError(subscriptionError.message));
      } catch (initializationError) {
        if (mounted) {
          setError(initializationError instanceof Error
            ? initializationError.message
            : "Não foi possível conectar ao serviço compartilhado.");
          setAccessStep("error");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initialize();
    return () => {
      mounted = false;
      realtimeCleanupRef.current?.();
      realtimeCleanupRef.current = null;
    };
  }, [refreshPurchases]);

  async function handleSubmitPin(pin) {
    setBusy(true);
    setAccessError("");
    try {
      await authorizeWithFamilyPin(pin);
      setAuthorized(true);
      await refreshPurchases();
      const storedName = getStoredDeviceName();
      setDeviceName(storedName);
      setAccessStep(storedName ? "ready" : "name");
      setError("");
      realtimeCleanupRef.current?.();
      realtimeCleanupRef.current = subscribeToSharedPurchases(() => {
        refreshPurchases().catch(() => setError("Não foi possível atualizar a lista compartilhada."));
      }, (subscriptionError) => setError(subscriptionError.message));

    } catch (pinError) {
      setAccessError(pinError instanceof Error ? pinError.message : "Não foi possível validar o PIN.");
    } finally {
      setBusy(false);
    }
  }

  function handleSubmitName(name) {
    if (!name || name.length > 50) {
      setAccessError("Informe um nome válido, com até 50 caracteres.");
      return;
    }
    try {
      localStorage.setItem(DEVICE_NAME_STORAGE_KEY, name);
    } catch {
      setAccessError("Não foi possível salvar seu nome neste dispositivo.");
      return;
    }
    setDeviceName(name);
    setAccessError("");
    setAccessStep("ready");
    setCurrentPage("shopping");
  }

  async function startPurchase() {
    if (!authorized || !deviceName || accessStep !== "ready") {
      setAccessStep("name");
      return;
    }
    setBusy(true);
    try {
      await createSharedPurchase();
      await refreshPurchases();
      setCurrentPage("shopping");
      setError("");
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Não foi possível iniciar uma nova compra.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProduct(productData) {
    if (!authorized || !deviceName || accessStep !== "ready") {
      throw new Error("Informe seu nome antes de utilizar a lista.");
    }
    if (busy) throw new Error("Aguarde a operação atual terminar.");
    if (!activePurchase) throw new Error("Não existe uma compra em andamento.");
    if (!deviceName) throw new Error("Informe seu nome antes de adicionar produtos.");

    const existingItem = activePurchase.items.find((item) => item.id === productData.id);
    const item = {
      ...productData,
      id: productData.id ?? crypto.randomUUID(),
      addedByName: existingItem?.addedByName ?? deviceName,
      editedByName: existingItem
        ? (
          existingItem.name !== productData.name
          || existingItem.quantityMilli !== productData.quantityMilli
          || existingItem.unitPriceCents !== productData.unitPriceCents
        ) ? deviceName : existingItem.editedByName ?? null
        : null,
    };

    setBusy(true);
    try {
      await saveSharedItem(activePurchase.id, item, item.addedByName, Boolean(productData.id));
      await refreshPurchases();
      setError("");
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct(productId) {
    if (!authorized || !deviceName || accessStep !== "ready" || busy) return;
    setBusy(true);
    try {
      await deleteSharedItem(productId);
      await refreshPurchases();
      setError("");
    } catch {
      setError("Não foi possível excluir o produto.");
    } finally {
      setBusy(false);
    }
  }

  async function finishPurchase() {
    if (!authorized || !deviceName || accessStep !== "ready") {
      setAccessStep("name");
      return;
    }
    if (!activePurchase || activePurchase.items.length === 0) return;
    setBusy(true);
    try {
      await completeSharedPurchase(activePurchase.id);
      await refreshPurchases();
      setCurrentPage("history");
      setError("");
    } catch (finishError) {
      setError(finishError instanceof Error
        ? finishError.message
        : "Não foi possível finalizar a compra.");
    } finally {
      setBusy(false);
    }
  }

  const historyPurchases = completedPurchases;
  const showLoader = loading || accessStep === "loading" || refreshing || historyLoading || busy;

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="/" onClick={(event) => {
          event.preventDefault();
          setCurrentPage("shopping");
          setMenuOpen(false);
        }}>
          <span className="brand-mark" aria-hidden="true">S</span>
          <span>SuperMartket</span>
        </a>

        <div className="header-actions">
          <button
            aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
            className="header-icon-button theme-toggle"
            onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
            title={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
            type="button"
          >
            <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
          </button>

          {authorized && deviceName && accessStep === "ready" && (
            <div className="menu-container">
              <button
                aria-expanded={menuOpen}
                aria-controls="main-menu"
                aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
                className="header-icon-button menu-toggle"
                onClick={() => setMenuOpen((open) => !open)}
                type="button"
              >
                <span className={menuOpen ? "hamburger-icon is-open" : "hamburger-icon"} aria-hidden="true">
                  <span /><span /><span />
                </span>
              </button>
              {menuOpen && (
                <nav aria-label="Menu principal" className="dropdown-menu" id="main-menu">
                  {deviceName && <span className="dropdown-caption">Usando como {deviceName}</span>}
                  <button
                    aria-current={currentPage === "shopping" ? "page" : undefined}
                    className={currentPage === "shopping" ? "dropdown-item active" : "dropdown-item"}
                    onClick={() => { setCurrentPage("shopping"); setMenuOpen(false); }}
                    type="button"
                  >Lista de compras</button>
                  <button
                    aria-current={currentPage === "history" ? "page" : undefined}
                    className={currentPage === "history" ? "dropdown-item active" : "dropdown-item"}
                    onClick={() => { setCurrentPage("history"); setMenuOpen(false); }}
                    type="button"
                  >Histórico</button>
                </nav>
              )}
            </div>
          )}
        </div>
      </header>

      <InstallPrompt />

      {error && <div className="app-error" role="alert">{error}</div>}

      {loading || accessStep === "loading" ? (
        <main className="loading-state" aria-live="polite">Conectando à lista da família...</main>
      ) : accessStep === "error" ? (
        <main className="page-content">
          <div className="empty-state">
            <h3>Não foi possível conectar</h3>
            <p>Verifique a conexão e a configuração do acesso familiar e recarregue a página.</p>
          </div>
        </main>
      ) : !authorized || accessStep === "pin" ? (
        <AccessPage
          step="pin"
          onSubmitPin={handleSubmitPin}
          error={accessError}
          busy={busy}
        />
      ) : accessStep === "name" || !deviceName ? (
        <AccessPage
          step="name"
          onSubmitName={handleSubmitName}
          error={accessError}
          busy={busy}
        />
      ) : currentPage === "history" ? (
        <HistoryPage purchases={historyPurchases} onBack={() => setCurrentPage("shopping")} />
      ) : (
        <>
          <ShoppingPage
            onDeleteProduct={deleteProduct}
            onFinish={finishPurchase}
            onSaveProduct={saveProduct}
            onGetEditHistory={getSharedItemEditHistory}
            onHistoryLoadingChange={handleHistoryLoadingChange}
            onStart={startPurchase}
            activeAccount={deviceName ? { name: deviceName } : null}
            purchase={activePurchase}
            busy={busy}
          />
        </>
      )}

      <footer className="app-footer">
        {authorized ? "Lista compartilhada entre os dispositivos da família." : "Acesso restrito à família."}
      </footer>

      {showLoader && (
        <div className="app-loading-overlay" role="status" aria-live="polite" aria-label="Carregando">
          <div className="app-loading-brand">
            <span className="app-loading-mark" aria-hidden="true">S</span>
            <strong>SuperMartket</strong>
          </div>
          <div className="app-loading-track" aria-hidden="true"><span /></div>
          <p>Preparando sua experiência</p>
        </div>
      )}
    </div>
  );
}
