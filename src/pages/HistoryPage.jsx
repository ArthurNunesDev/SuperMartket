import { calculatePurchaseTotal } from "../utils/calculations.js";
import { formatCurrency } from "../utils/currency.js";

function formatDate(dateValue) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dateValue));
}

export default function HistoryPage({ purchases }) {
  return (
    <main className="page-content">
      <div className="page-intro">
        <span className="eyebrow">SEU REGISTRO</span>
        <h1>Compras anteriores</h1>
        <p>Consulte os valores das compras que você já finalizou.</p>
      </div>

      {purchases.length === 0 ? (
        <div className="empty-state history-empty">
          <div className="empty-icon" aria-hidden="true">📋</div>
          <h3>Nenhuma compra finalizada</h3>
          <p>Quando você finalizar uma compra, ela aparecerá aqui.</p>
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