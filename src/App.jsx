import React, { useEffect, useState } from "react";
import { getActivePurchase, getCompletedPurchases, savePurchase } from "./services/database.js";
import ShoppingPage from "./pages/ShoppingPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";

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

    const exists = activePurchase.items.some((item) => item.id === productData.id);
    const item = {
      ...productData,
      id: productData.id ?? crypto.randomUUID(),
    };
    const updatedPurchase = {
      ...activePurchase,
      items: exists
        ? activePurchase.items.map((current) => current.id === item.id ? item : current)
        : [...activePurchase.items, item],
    };

    await savePurchase(updatedPurchase);
    setActivePurchase(updatedPurchase);
    setError("");
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
      ) : (
        <ShoppingPage
          onDeleteProduct={deleteProduct}
          onFinish={finishPurchase}
          onSaveProduct={saveProduct}
          onStart={startPurchase}
          purchase={activePurchase}
        />
      )}

      <footer className="app-footer">Seus dados ficam salvos neste dispositivo.</footer>
    </div>
  );
}