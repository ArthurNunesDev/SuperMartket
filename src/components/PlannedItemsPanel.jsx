import React, { useState } from "react";
import { formatQuantity } from "../utils/calculations.js";
import { parseCurrency } from "../utils/currency.js";

export default function PlannedItemsPanel({ items, purchase, onPurchase, onStart, busy }) {
  const [prices, setPrices] = useState({});
  if (items.length === 0) return null;

  return (
    <section className="planned-cart-panel" aria-labelledby="planned-cart-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">AINDA NÃO COMPRADOS</span>
          <h2 id="planned-cart-title">Itens planejados</h2>
        </div>
        <span className="item-count">{items.length} {items.length === 1 ? "item" : "itens"}</span>
      </div>
      <ul className="planned-cart-list">
        {items.map((item) => {
          const priceText = prices[item.id] ?? (item.unitPriceCents == null ? "" : (item.unitPriceCents / 100).toFixed(2).replace(".", ","));
          const priceCents = parseCurrency(priceText);
          return (
            <li className="planned-cart-row" key={item.id}>
              <div className="planned-cart-info">
                <strong>{item.name}</strong>
                <span>{formatQuantity(item.quantityMilli)} · Adicionado por {item.addedByName}</span>
              </div>
              <div className="planned-cart-action">
                <label className="planned-price-field">
                  <span>Preço unitário</span>
                  <div className="input-with-prefix"><span>R$</span>
                    <input aria-label={"Preço de " + item.name} inputMode="decimal" onChange={(event) => setPrices((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="0,00" value={priceText} />
                  </div>
                </label>
                <button className="planned-purchase-button" disabled={busy || !purchase || priceCents === null || priceCents > 2147483647} onClick={() => onPurchase(item.id, priceCents)} type="button">
                  Marcar como comprado
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {!purchase && <button className="primary-button planned-start-button" disabled={busy} onClick={onStart} type="button">Iniciar compra para confirmar itens</button>}
      {!purchase && <p className="planned-cart-note">Os itens só entram no carrinho após iniciar uma compra e informar o preço.</p>}
      <p className="planned-cart-note">Itens planejados não entram no total até serem marcados como comprados.</p>
    </section>
  );
}
