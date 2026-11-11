import React, { useState } from "react";
import ItemFilters from "./ItemFilters.jsx";
import { formatQuantity } from "../utils/calculations.js";
import { parseCurrency, sanitizeCurrencyInput } from "../utils/currency.js";

export default function PlannedItemsPanel({ items, totalItems = items.length, hasActiveFilters = false, query = "", onQueryChange, participant = "", onParticipantChange, participants = [], purchase, onPurchase, onStart, busy }) {
  const [prices, setPrices] = useState({});
  if (totalItems === 0) return null;

  return (
    <section className="planned-cart-panel" aria-labelledby="planned-cart-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">AINDA NÃO COMPRADOS</span>
          <h2 id="planned-cart-title">Itens planejados</h2>
        </div>
        <span className="item-count">{items.length} de {totalItems} {totalItems === 1 ? "item" : "itens"}</span>
      </div>
      <ItemFilters query={query} onQueryChange={onQueryChange} participant={participant} onParticipantChange={onParticipantChange} participants={participants} label="Pesquisar itens planejados" />
      {items.length === 0 ? (
        <div className="filter-empty-state" role="status">
          <strong>Nenhum item planejado encontrado</strong>
          <span>{hasActiveFilters ? "Tente alterar a pesquisa ou o participante selecionado." : "Os itens aparecerão aqui."}</span>
        </div>
      ) : (
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
                      <input aria-label={"Preço de " + item.name} inputMode="decimal" maxLength={14} onChange={(event) => setPrices((current) => ({ ...current, [item.id]: sanitizeCurrencyInput(event.target.value) }))} placeholder="0,00" value={priceText} />
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
      )}
      {!purchase && items.length > 0 && <button className="primary-button planned-start-button" disabled={busy} onClick={onStart} type="button">Iniciar compra para confirmar itens</button>}
      {!purchase && <p className="planned-cart-note">Os itens só entram no carrinho após iniciar uma compra e informar o preço.</p>}
      <p className="planned-cart-note">Itens planejados não entram no total até serem marcados como comprados.</p>
    </section>
  );
}
