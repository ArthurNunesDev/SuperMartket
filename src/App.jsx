import React, { useCallback, useEffect, useRef, useState } from "react";
import InstallPrompt from "./components/InstallPrompt.jsx";
import ShoppingPage from "./pages/ShoppingPage.jsx";
import ShoppingListPage from "./pages/ShoppingListPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import AccessPage from "./pages/AccessPage.jsx";
import {
  checkShoppingSession, completeSharedPurchase, createSharedPurchase, createShoppingSession,
  deleteSharedItem, deleteShoppingListItem, ensureDeviceSession, getSharedPurchases,
  getSharedItemEditHistory, getShoppingListItems, joinShoppingSession, leaveShoppingSession,
  purchasePlannedShoppingItem, saveSharedItem, saveShoppingListItem, signOutDevice,
  subscribeToSharedPurchases,
} from "./services/supabase.js";

const THEME_STORAGE_KEY = "supermartket-theme";
const DEVICE_NAME_STORAGE_KEY = "supermartket-device-name";

function getInitialTheme() {
  try { return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light"; }
  catch { return "light"; }
}
function getStoredDeviceName() {
  try {
    const name = localStorage.getItem(DEVICE_NAME_STORAGE_KEY);
    return typeof name === "string" && name.trim() ? name.trim() : "";
  } catch { return ""; }
}

export default function App() {
  const [activePurchase, setActivePurchase] = useState(null);
  const [completedPurchases, setCompletedPurchases] = useState([]);
  const [plannedItems, setPlannedItems] = useState([]);
  const [session, setSession] = useState(null);
  const [currentPage, setCurrentPage] = useState("shopping");
  const [accessStep, setAccessStep] = useState("loading");
  const [authorized, setAuthorized] = useState(false);
  const [deviceName, setDeviceName] = useState(getStoredDeviceName);
  const [theme, setTheme] = useState(getInitialTheme);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accessError, setAccessError] = useState("");
  const [leaveConfirmation, setLeaveConfirmation] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const refreshCountRef = useRef(0);
  const realtimeCleanupRef = useRef(null);

  const refreshPurchases = useCallback(async () => {
    refreshCountRef.current += 1;
    setRefreshing(true);
    try {
      const [purchases, planned] = await Promise.all([getSharedPurchases(), getShoppingListItems()]);
      setActivePurchase(purchases.find((purchase) => purchase.status === "active") ?? null);
      setCompletedPurchases(purchases.filter((purchase) => purchase.status === "completed")
        .sort((first, second) => (second.completedAt ?? second.createdAt).localeCompare(first.completedAt ?? first.createdAt)));
      setPlannedItems(planned);
    } finally {
      refreshCountRef.current -= 1;
      setRefreshing(refreshCountRef.current > 0);
    }
  }, []);

  const handleHistoryLoadingChange = useCallback((isLoading) => setHistoryLoading(isLoading), []);

  const activateSession = useCallback(async (nextSession) => {
    setSession(nextSession);
    setAuthorized(true);
    setAccessError("");
    const storedName = getStoredDeviceName();
    setDeviceName(storedName);
    setAccessStep(storedName ? "ready" : "name");
    await refreshPurchases();
    realtimeCleanupRef.current?.();
    realtimeCleanupRef.current = subscribeToSharedPurchases(() => {
      refreshPurchases().catch(() => setError("Não foi possível atualizar os dados da sessão."));
    }, (subscriptionError) => setError(subscriptionError.message));
  }, [refreshPurchases]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#111827" : "#f4f7f5");
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* Keep theme for this visit. */ }
  }, [theme]);

  useEffect(() => {
    let mounted = true;
    async function initialize() {
      try {
        await ensureDeviceSession();
        const existingSession = await checkShoppingSession();
        if (!mounted) return;
        setAccessError("");
        if (!existingSession) {
          setAuthorized(false);
          setSession(null);
          setAccessStep("session");
          return;
        }
        setSession(existingSession);
        setAuthorized(true);
        const storedName = getStoredDeviceName();
        setDeviceName(storedName);
        setAccessStep(storedName ? "ready" : "name");
        await refreshPurchases();
        if (!mounted) return;
        realtimeCleanupRef.current?.();
        realtimeCleanupRef.current = subscribeToSharedPurchases(() => {
          refreshPurchases().catch(() => setError("Não foi possível atualizar os dados da sessão."));
        }, (subscriptionError) => setError(subscriptionError.message));
      } catch (initializationError) {
        if (mounted) {
          setError(initializationError instanceof Error ? initializationError.message : "Não foi possível conectar ao serviço.");
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

  async function withAccessAction(action) {
    setBusy(true);
    setAccessError("");
    try {
      const nextSession = await action();
      await activateSession(nextSession);
      setCurrentPage("shopping");
      setError("");
    } catch (actionError) {
      setAccessError(actionError instanceof Error ? actionError.message : "Não foi possível acessar a sessão.");
    } finally { setBusy(false); }
  }

  function handleCreateSession() { return withAccessAction(createShoppingSession); }
  function handleSubmitPin(pin) { return withAccessAction(() => joinShoppingSession(pin)); }

  function handleSubmitName(name) {
    if (!name || name.length > 50) { setAccessError("Informe um nome válido, com até 50 caracteres."); return; }
    try { localStorage.setItem(DEVICE_NAME_STORAGE_KEY, name); }
    catch { setAccessError("Não foi possível salvar seu nome neste dispositivo."); return; }
    setDeviceName(name);
    setAccessError("");
    setAccessStep("ready");
    setCurrentPage("shopping");
  }

  function openNameEditor() {
    setNameDraft(deviceName);
    setEditingName(true);
    setAccessError("");
  }

  function saveDeviceName(event) {
    event.preventDefault();
    const nextName = nameDraft.trim();
    if (!nextName || nextName.length > 50) {
      setAccessError("Informe um nome válido, com até 50 caracteres.");
      return;
    }
    try {
      localStorage.setItem(DEVICE_NAME_STORAGE_KEY, nextName);
    } catch {
      setAccessError("Não foi possível salvar seu nome neste dispositivo.");
      return;
    }
    setDeviceName(nextName);
    setEditingName(false);
    setAccessError("");
  }

  async function startPurchase() {
    if (!authorized || !deviceName || accessStep !== "ready") { setAccessStep("name"); return; }
    setBusy(true);
    try {
      await createSharedPurchase();
      await refreshPurchases();
      setCurrentPage("shopping");
      setError("");
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Não foi possível iniciar uma compra.");
    } finally { setBusy(false); }
  }

  async function saveProduct(productData) {
    if (!authorized || !deviceName || accessStep !== "ready") throw new Error("Informe seu nome antes de utilizar a lista.");
    if (busy) throw new Error("Aguarde a operação atual terminar.");
    if (!activePurchase) throw new Error("Não existe uma compra em andamento.");
    const existingItem = activePurchase.items.find((item) => item.id === productData.id);
    const item = {
      ...productData,
      id: productData.id ?? crypto.randomUUID(),
      addedByName: existingItem?.addedByName ?? deviceName,
      editedByName: existingItem
        ? ((existingItem.name !== productData.name || existingItem.quantityMilli !== productData.quantityMilli
          || existingItem.unitPriceCents !== productData.unitPriceCents) ? deviceName : existingItem.editedByName ?? null)
        : null,
    };
    setBusy(true);
    try {
      await saveSharedItem(activePurchase.id, item, item.addedByName, Boolean(productData.id));
      await refreshPurchases();
      setError("");
    } finally { setBusy(false); }
  }

  async function deleteProduct(productId) {
    if (!authorized || !deviceName || accessStep !== "ready" || busy) return;
    setBusy(true);
    try { await deleteSharedItem(productId); await refreshPurchases(); setError(""); }
    catch { setError("Não foi possível excluir o produto."); }
    finally { setBusy(false); }
  }

  async function finishPurchase() {
    if (!authorized || !deviceName || accessStep !== "ready") { setAccessStep("name"); return; }
    if (!activePurchase || activePurchase.items.length === 0) return;
    setBusy(true);
    try {
      await completeSharedPurchase(activePurchase.id);
      await refreshPurchases();
      setCurrentPage("history");
      setError("");
    } catch (finishError) {
      setError(finishError instanceof Error ? finishError.message : "Não foi possível finalizar a compra.");
    } finally { setBusy(false); }
  }

  async function savePlannedItem(item) {
    if (!authorized || !deviceName || accessStep !== "ready") throw new Error("Informe seu nome antes de utilizar a lista.");
    setBusy(true);
    try { await saveShoppingListItem(item, deviceName); await refreshPurchases(); }
    finally { setBusy(false); }
  }

  async function deletePlannedItem(itemId) {
    if (!authorized || busy) return;
    setBusy(true);
    try { await deleteShoppingListItem(itemId); await refreshPurchases(); }
    catch { setError("Não foi possível remover o item planejado."); }
    finally { setBusy(false); }
  }

  async function purchasePlannedItem(itemId, priceCents) {
    if (!activePurchase) { setError("Inicie uma compra antes de confirmar um item."); return; }
    if (!deviceName || !authorized) return;
    setBusy(true);
    try {
      await purchasePlannedShoppingItem(itemId, activePurchase.id, priceCents, deviceName);
      await refreshPurchases();
      setError("");
    } catch (purchaseError) {
      setError(purchaseError instanceof Error ? purchaseError.message : "Não foi possível confirmar o item.");
    } finally { setBusy(false); }
  }

  async function performLeave(confirmEnd) {
    setBusy(true);
    try {
      const result = await leaveShoppingSession(confirmEnd);
      if (result.needsConfirmation) { setLeaveConfirmation(true); return; }
      setLeaveConfirmation(false);
      realtimeCleanupRef.current?.();
      realtimeCleanupRef.current = null;
      setAuthorized(false);
      setSession(null);
      setActivePurchase(null);
      setCompletedPurchases([]);
      setPlannedItems([]);
      setCurrentPage("shopping");
      setAccessStep("session");
      setError("");
      setAccessError("");
      try {
        await signOutDevice();
      } catch {
        // Membership has already been removed server-side; the current auth user can still create or join.
      }
      await ensureDeviceSession();
    } catch (leaveError) {
      setError(leaveError instanceof Error ? leaveError.message : "Não foi possível sair da sessão.");
    } finally { setBusy(false); }
  }

  const showLoader = loading || accessStep === "loading" || refreshing || historyLoading || busy;
  const showNavigation = authorized && Boolean(deviceName) && accessStep === "ready";

  return (
    <div className={showNavigation ? "app-shell has-sidebar" : "app-shell"}>
      <header className="app-header">
        <a className="brand" href="/" onClick={(event) => {
          event.preventDefault();
          setCurrentPage("shopping");
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
        </div>
      </header>

      {showNavigation && (
        <aside aria-label="Navegação da sessão" className="app-sidebar">
          <div className="sidebar-top">
            <div className="sidebar-profile">
              <span className="sidebar-avatar" aria-hidden="true">{deviceName.trim().charAt(0).toUpperCase()}</span>
              <span className="sidebar-profile-copy">
                <strong>{deviceName}</strong>
                <small>Participante da sessão</small>
                <button className="sidebar-profile-edit" onClick={openNameEditor} type="button">Alterar nome</button>
              </span>
            </div>
            {session?.pin && (
              <div className="sidebar-session">
                <span>PIN DA SESSÃO</span>
                <strong>{session.pin}</strong>
              </div>
            )}
          </div>

          <nav aria-label="Menu principal" className="sidebar-navigation">
            <span className="sidebar-section-title">MENU PRINCIPAL</span>
            <button
              aria-current={currentPage === "shopping" ? "page" : undefined}
              className={currentPage === "shopping" ? "sidebar-item active" : "sidebar-item"}
              onClick={() => setCurrentPage("shopping")}
              type="button"
            >
              <span aria-hidden="true">🛒</span>
              Carrinho
            </button>
            <button
              aria-current={currentPage === "planned" ? "page" : undefined}
              className={currentPage === "planned" ? "sidebar-item active" : "sidebar-item"}
              onClick={() => setCurrentPage("planned")}
              type="button"
            >
              <span aria-hidden="true">📝</span>
              Lista de Compras
            </button>
            <button
              aria-current={currentPage === "history" ? "page" : undefined}
              className={currentPage === "history" ? "sidebar-item active" : "sidebar-item"}
              onClick={() => setCurrentPage("history")}
              type="button"
            >
              <span aria-hidden="true">📋</span>
              Histórico
            </button>
          </nav>

          <div className="sidebar-bottom">
            <button
              className="sidebar-leave-button"
              disabled={busy}
              onClick={() => performLeave(false)}
              type="button"
            >
              <span aria-hidden="true">↪</span>
              Sair da sessão
            </button>
          </div>
        </aside>
      )}

      <div className="app-main-column">
        <InstallPrompt />
        {error && <div className="app-error" role="alert">{error}</div>}

        {loading || accessStep === "loading" ? <main className="loading-state" aria-live="polite">Conectando à sessão...</main>
          : accessStep === "error" ? <main className="page-content"><div className="empty-state"><h3>Não foi possível conectar</h3><p>Verifique a conexão e recarregue a página.</p></div></main>
          : !authorized || accessStep === "session" ? <AccessPage step="session" onCreateSession={handleCreateSession} onSubmitPin={handleSubmitPin} error={accessError} busy={busy} />
          : accessStep === "name" || !deviceName ? <AccessPage step="name" onSubmitName={handleSubmitName} error={accessError} busy={busy} />
          : currentPage === "history" ? <HistoryPage purchases={completedPurchases} onBack={() => setCurrentPage("shopping")} />
          : currentPage === "planned" ? <ShoppingListPage items={plannedItems} purchases={completedPurchases} onSave={savePlannedItem} onDelete={deletePlannedItem}
              activeAccount={{ name: deviceName }} busy={busy} onBack={() => setCurrentPage("shopping")} />
          : <ShoppingPage purchase={activePurchase} plannedItems={plannedItems} onSaveProduct={saveProduct} onDeleteProduct={deleteProduct}
              onFinish={finishPurchase} onStart={startPurchase} onPurchasePlannedItem={purchasePlannedItem}
              onGetEditHistory={getSharedItemEditHistory} onHistoryLoadingChange={handleHistoryLoadingChange}
              activeAccount={{ name: deviceName }} busy={busy} />}

        <footer className="app-footer">{authorized ? "Sessão compartilhada entre os dispositivos conectados." : "Crie uma sessão ou entre com um PIN."}</footer>
      </div>

      {editingName && (
        <div className="duplicate-backdrop" role="presentation">
          <section aria-labelledby="change-name-title" aria-modal="true" className="duplicate-dialog" role="dialog">
            <span className="eyebrow">IDENTIFICAÇÃO DO PARTICIPANTE</span>
            <h2 id="change-name-title">Alterar nome</h2>
            <p>O novo nome será usado nas próximas alterações. Os registros anteriores manterão a identificação original.</p>
            <form className="name-change-form" onSubmit={saveDeviceName}>
              <label className="field"><span>Seu nome</span><input autoFocus maxLength={50} onChange={(event) => setNameDraft(event.target.value)} required value={nameDraft} /></label>
              {accessError && <p className="form-error" role="alert">{accessError}</p>}
              <div className="duplicate-actions">
                <button className="secondary-button" disabled={busy} onClick={() => setEditingName(false)} type="button">Cancelar</button>
                <button className="primary-button" disabled={busy} type="submit">Salvar nome</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {leaveConfirmation && (
        <div className="session-confirm-backdrop" role="presentation">
          <section aria-labelledby="session-confirm-title" aria-modal="true" className="session-confirm-card" role="dialog">
            <div className="empty-icon" aria-hidden="true">⚠️</div>
            <h2 id="session-confirm-title">Encerrar esta sessão?</h2>
            <p>Você é a última pessoa nesta sessão. Ao sair, a sessão será apagada permanentemente, incluindo o carrinho, a lista e o histórico. O PIN deixará de funcionar e os dados não poderão ser recuperados.</p>
            <div className="session-confirm-actions">
              <button className="secondary-button" disabled={busy} onClick={() => setLeaveConfirmation(false)} type="button">Continuar na sessão</button>
              <button className="danger-button" disabled={busy} onClick={() => performLeave(true)} type="button">{busy ? "Encerrando..." : "Encerrar permanentemente"}</button>
            </div>
          </section>
        </div>
      )}

      {showLoader && (
        <div className="app-loading-overlay" role="status" aria-live="polite" aria-label="Carregando">
          <div className="app-loading-brand"><span className="app-loading-mark" aria-hidden="true">S</span><strong>SuperMartket</strong></div>
          <div className="app-loading-track" aria-hidden="true"><span /></div>
          <p>Preparando sua experiência</p>
        </div>
      )}
    </div>
  );
}
