import React, { useEffect, useState } from "react";
import { getActivePurchase, getCompletedPurchases, savePurchase } from "./services/database.js";
import ShoppingPage from "./pages/ShoppingPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import AccountPage from "./pages/AccountPage.jsx";
import { addAccount, getAccountsState, selectAccount } from "./services/accounts.js";

const THEME_STORAGE_KEY = "supermartket-theme";

function getInitialTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function createPurchase() {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "active",
    items: [],
  };
}

export default function App() {
  const [activePurchase, setActivePurchase] = useState(null);
  const [completedPurchases, setCompletedPurchases] = useState([]);
  const [currentPage, setCurrentPage] = useState("shopping");
  const [theme, setTheme] = useState(getInitialTheme);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountsState, setAccountsState] = useState(getAccountsState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content",
      theme === "dark" ? "#111a15" : "#f4f7f5"
    );

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // The theme remains available for the current session if storage is unavailable.
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
        const [active, history] = await Promise.all([
          getActivePurchase(),
          getCompletedPurchases(),
        ]);

        if (!mounted) return;
        setActivePurchase(active);
        setCompletedPurchases(history);
      } catch (initializationError) {
        if (mounted) {
          setError(initializationError instanceof Error
            ? initializationError.message
            : "Não foi possível carregar os dados salvos.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initialize();
    return () => { mounted = false; };
  }, []);

  async function startPurchase() {
    const purchase = createPurchase();
    try {
      await savePurchase(purchase);
      setActivePurchase(purchase);
      setCurrentPage("shopping");
      setError("");
    } catch {
      setError("Não foi possível iniciar uma nova compra.");
    }
  }

  async function saveProduct(productData) {
    if (!activePurchase) throw new Error("Não existe uma compra em andamento.");

    const existingItem = activePurchase.items.find((item) => item.id === productData.id);
    if (!existingItem && !activeAccount) {
      throw new Error("Selecione uma conta antes de adicionar produtos.");
    }

    const item = {
      ...productData,
      id: productData.id ?? crypto.randomUUID(),
      ...(existingItem
        ? {
            addedByAccountId: existingItem.addedByAccountId,
            addedByName: existingItem.addedByName,
          }
        : {
            addedByAccountId: activeAccount.id,
            addedByName: activeAccount.name,
          }),
    };
    const updatedPurchase = {
      ...activePurchase,
      items: existingItem
        ? activePurchase.items.map((current) => current.id === item.id ? item : current)
        : [...activePurchase.items, item],
    };

    await savePurchase(updatedPurchase);
    setActivePurchase(updatedPurchase);
    setError("");
  }

  async function handleAddAccount(name) {
    const updatedState = addAccount(name);
    setAccountsState(updatedState);
  }

  function handleSelectAccount(accountId) {
    try {
      setAccountsState(selectAccount(accountId));
      setError("");
    } catch (accountError) {
      setError(accountError instanceof Error ? accountError.message : "Não foi possível selecionar a conta.");
    }
  }

  async function deleteProduct(productId) {
    if (!activePurchase) return;

    const updatedPurchase = {
      ...activePurchase,
      items: activePurchase.items.filter((item) => item.id !== productId),
    };

    try {
      await savePurchase(updatedPurchase);
      setActivePurchase(updatedPurchase);
      setError("");
    } catch {
      setError("Não foi possível excluir o produto.");
    }
  }

  async function finishPurchase() {
    if (!activePurchase || activePurchase.items.length === 0) return;

    const completedPurchase = {
      ...activePurchase,
      status: "completed",
      completedAt: new Date().toISOString(),
    };

    try {
      await savePurchase(completedPurchase);
      setActivePurchase(null);
      setCompletedPurchases((current) => [
        completedPurchase,
        ...current.filter((purchase) => purchase.id !== completedPurchase.id),
      ]);
      setCurrentPage("history");
      setError("");
    } catch {
      setError("Não foi possível finalizar a compra. Seus produtos continuam salvos.");
    }
  }

  const activeAccount = accountsState.accounts.find((account) => account.id === accountsState.activeAccountId) ?? null;

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="/" onClick={(event) => { event.preventDefault(); setCurrentPage("shopping"); setMenuOpen(false); }}>
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
                <span />
                <span />
                <span />
              </span>
            </button>

            {menuOpen && (
              <nav aria-label="Menu principal" className="dropdown-menu" id="main-menu">
                <button
                  aria-current={currentPage === "account" ? "page" : undefined}
                  className={currentPage === "account" ? "dropdown-item active" : "dropdown-item"}
                  onClick={() => {
                    setCurrentPage("account");
                    setMenuOpen(false);
                  }}
                  type="button"
                >
                  Conta{activeAccount ? ` · ${activeAccount.name}` : ""}
                </button>
                <button
                  aria-current={currentPage === "history" ? "page" : undefined}
                  className={currentPage === "history" ? "dropdown-item active" : "dropdown-item"}
                  onClick={() => {
                    setCurrentPage("history");
                    setMenuOpen(false);
                  }}
                  type="button"
                >
                  Histórico
                </button>
              </nav>
            )}
          </div>
        </div>
      </header>

      {error && <div className="app-error" role="alert">{error}</div>}

      {loading ? (
        <main className="loading-state" aria-live="polite">Carregando suas compras...</main>
      ) : currentPage === "history" ? (
        <HistoryPage purchases={completedPurchases} />
      ) : currentPage === "account" ? (
        <AccountPage accounts={accountsState.accounts} activeAccountId={accountsState.activeAccountId} onAddAccount={handleAddAccount} onSelectAccount={handleSelectAccount} />
      ) : (
        <ShoppingPage
          onDeleteProduct={deleteProduct}
          onFinish={finishPurchase}
          onSaveProduct={saveProduct}
          onStart={startPurchase}
          activeAccount={activeAccount}
          purchase={activePurchase}
        />
      )}

      <footer className="app-footer">Seus dados ficam salvos neste dispositivo.</footer>
    </div>
  );
}