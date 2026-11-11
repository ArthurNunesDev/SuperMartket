import React, { useMemo, useState } from "react";
import { calculateItemSubtotal, calculatePurchaseTotal, formatQuantity } from "../utils/calculations.js";
import { formatCurrency } from "../utils/currency.js";
import { normalizeProductName } from "../utils/productMatching.js";

function formatDate(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function HistoryPage({ purchases, onBack }) {
  const [search, setSearch] = useState("");
  const [expandedPurchase, setExpandedPurchase] = useState(null);
  const summary = useMemo(() => {
    const total = purchases.reduce((sum, purchase) => sum + calculatePurchaseTotal(purchase.items), 0);
    return { total, count: purchases.length, average: purchases.length ? Math.round(total / purchases.length) : 0 };
  }, [purchases]);
  const filteredPurchases = useMemo(() => {
    const term = normalizeProductName(search);
    if (!term) return purchases;
    return purchases.filter((purchase) => {
      const date = normalizeProductName(formatDate(purchase.completedAt ?? purchase.createdAt));
      const items = purchase.items.map((item) => normalizeProductName(item.name + " " + (item.addedByName ?? ""))).join(" ");
      return date.includes(term) || items.includes(term);
    });
  }, [purchases, search]);

  return (
    <main className="page-content">
      <button className="back-button" onClick={onBack} type="button">← Voltar para o carrinho</button>
      <div className="page-intro">
        <span className="eyebrow">REGISTRO COMPARTILHADO</span>
        <h1>Compras anteriores</h1>
        <p>Consulte os detalhes e acompanhe os gastos das compras finalizadas.</p>
      </div>

      {purchases.length > 0 && (
        <section className="history-summary" aria-label="Resumo dos gastos">
          <div><span>GASTO TOTAL</span><strong>{formatCurrency(summary.total)}</strong></div>
          <div><span>COMPRAS</span><strong>{summary.count}</strong></div>
          <div><span>MÉDIA POR COMPRA</span><strong>{formatCurrency(summary.average)}</strong></div>
        </section>
      )}

      {purchases.length > 0 && (
        <label className="history-search field">
          <span>Buscar no histórico</span>
          <input onChange={(event) => setSearch(event.target.value)} placeholder="Produto, participante ou data..." type="search" value={search} />
        </label>
      )}

      {purchases.length === 0 ? (
        <div className="empty-state history-empty"><div className="empty-icon" aria-hidden="true">📋</div><h3>Nenhuma compra finalizada</h3><p>Quando uma compra for finalizada, ela aparecerá aqui para todos.</p></div>
      ) : filteredPurchases.length === 0 ? (
        <div className="empty-state history-empty"><h3>Nenhum resultado encontrado</h3><p>Tente buscar por outro produto ou participante.</p></div>
      ) : (
        <ul className="history-list">
          {filteredPurchases.map((purchase) => {
            const expanded = expandedPurchase === purchase.id;
            return (
              <li className="history-card history-entry" key={purchase.id}>
                <button aria-expanded={expanded} className="history-entry-toggle" onClick={() => setExpandedPurchase(expanded ? null : purchase.id)} type="button">
                  <span><strong>Compra de {formatDate(purchase.completedAt ?? purchase.createdAt)}</strong><small>{purchase.items.length} {purchase.items.length === 1 ? "produto" : "produtos"}</small></span>
                  <span className="history-entry-total"><strong>{formatCurrency(calculatePurchaseTotal(purchase.items))}</strong><span>{expanded ? "Ocultar detalhes −" : "Ver detalhes +"}</span></span>
                </button>
                {expanded && (
                  <ul className="history-detail-list">
                    {purchase.items.map((item) => (
                      <li key={item.id}>
                        <div><strong>{item.name}</strong><span>{formatQuantity(item.quantityMilli)} × {formatCurrency(item.unitPriceCents)} · {item.addedByName || "Participante não identificado"}</span></div>
                        <strong>{formatCurrency(calculateItemSubtotal(item.quantityMilli, item.unitPriceCents))}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
