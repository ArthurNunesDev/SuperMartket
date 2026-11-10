import { calculatePurchaseTotal } from "../utils/calculations.js";
import { formatCurrency } from "../utils/currency.js";

export default function ShoppingSummary({ items, onFinish }) {
  const total = calculatePurchaseTotal(items);

  return (
    <section className="shopping-summary" aria-label="Resumo da compra">
      <div>
        <span>VALOR ESTIMADO</span>
        <strong>{formatCurrency(total)}</strong>
        <small>{items.length} {items.length === 1 ? "produto registrado" : "produtos registrados"}</small>
      </div>
      <button className="finish-button" disabled={items.length === 0} onClick={onFinish} type="button">
        Finalizar compra
      </button>
    </section>
  );
}