import React from "react";
import { calculatePurchaseTotal } from "../utils/calculations.js";
import { formatCurrency } from "../utils/currency.js";

function formatDate(dateValue) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateValue));
}

export default function HistoryPage({ purchases, onBack }) {
  return (
    <main className="page-content">
      <button className="back-button" onClick={onBack} type="button">← Voltar para o carrinho</button>
      <div className="page-intro">
        <span className="eyebrow">REGISTRO COMPARTILHADO</span>
        <h1>Compras anteriores</h1>
        <p>Consulte o histórico de compras finalizadas pela família.</p>
      </div>

      {purchases.length === 0 ? (
        <div className="empty-state history-empty">
          <div className="empty-icon" aria-hidden="true">📋</div>
          <h3>Nenhuma compra finalizada</h3>
          <p>Quando uma compra for finalizada, ela aparecerá aqui para todos.</p>
        </div>
      ) : (
        <ul className="history-list">
          {purchases.map((purchase) => (
            <li className="history-card" key={purchase.id}>
              <div>
                <strong>Compra de {formatDate(purchase.completedAt ?? purchase.createdAt)}</strong>
                <span>{purchase.items.length} {purchase.items.length === 1 ? "produto" : "produtos"}</span>
              </div>
              <strong>{formatCurrency(calculatePurchaseTotal(purchase.items))}</strong>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
