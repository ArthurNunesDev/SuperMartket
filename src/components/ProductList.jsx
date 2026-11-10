import React from "react";
import { calculateItemSubtotal, formatQuantity } from "../utils/calculations.js";
import { formatCurrency } from "../utils/currency.js";

export default function ProductList({ items, onEdit, onDelete, disabled = false }) {
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon" aria-hidden="true">🛒</div>
        <h3>Sua lista está vazia</h3>
        <p>Adicione o primeiro produto para começar a acompanhar sua compra.</p>
      </div>
    );
  }

  return (
    <section className="product-list" aria-labelledby="items-title">
      <div className="section-heading list-heading">
        <div>
          <span className="eyebrow">SUA LISTA</span>
          <h2 id="items-title">Produtos</h2>
        </div>
        <span className="item-count">{items.length} {items.length === 1 ? "item" : "itens"}</span>
      </div>

      <ul>
        {items.map((item) => (
          <li className="product-row" key={item.id}>
            <div className="product-main">
              <strong>{item.name}</strong>
              <span>
                {formatQuantity(item.quantityMilli)} × {formatCurrency(item.unitPriceCents)}
                <span className="product-author">Adicionado por {item.addedByName || "não identificado"}</span>
                {item.editedByName && <span className="product-editor">Editado por {item.editedByName}</span>}
              </span>
            </div>
            <div className="product-end">
              <strong>{formatCurrency(calculateItemSubtotal(item.quantityMilli, item.unitPriceCents))}</strong>
              <div className="product-actions">
                <button aria-label={`Editar ${item.name}`} className="icon-button" disabled={disabled} onClick={() => onEdit(item)} type="button">✎</button>
                <button aria-label={`Excluir ${item.name}`} className="icon-button danger-action" disabled={disabled} onClick={() => onDelete(item.id)} type="button">×</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
