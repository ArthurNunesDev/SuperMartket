import React, { useState } from "react";
import { parseQuantity, formatQuantity } from "../utils/calculations.js";
import { parseCurrency, formatCurrency } from "../utils/currency.js";

export default function ShoppingListPage({ items, onSave, onDelete, activeAccount, busy, onBack }) {
  const [form, setForm] = useState({ name: "", quantity: "1", price: "" });
  const [error, setError] = useState("");
  const identityRequired = !activeAccount?.name;

  async function handleSubmit(event) {
    event.preventDefault();
    const name = form.name.trim();
    const quantityMilli = parseQuantity(form.quantity);
    const unitPriceCents = form.price.trim() ? parseCurrency(form.price) : null;
    if (!name) return setError("Informe o nome do item.");
    if (quantityMilli === null || quantityMilli > 2147483647) return setError("Informe uma quantidade válida.");
    if (form.price.trim() && (unitPriceCents === null || unitPriceCents > 2147483647)) return setError("Informe um preço válido ou deixe o campo vazio.");
    try {
      await onSave({ name, quantityMilli, unitPriceCents });
      setForm({ name: "", quantity: "1", price: "" });
      setError("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o item.");
    }
  }

  return (
    <main className="page-content">
      <button className="back-button" onClick={onBack} type="button">← Voltar para o carrinho</button>
      <div className="page-intro">
        <span className="eyebrow">PLANEJAMENTO COMPARTILHADO</span>
        <h1>Lista de Compras</h1>
        <p>Anote o que precisa comprar. Quando estiver no carrinho, informe o preço para marcar o item como comprado.</p>
        {activeAccount && <p className="active-account-note">Adicionando como <strong>{activeAccount.name}</strong></p>}
      </div>

      <form className="product-form planned-list-form" onSubmit={handleSubmit}>
        <div className="section-heading"><div><span className="eyebrow">NOVO ITEM</span><h2>O que falta comprar?</h2></div></div>
        <label className="field field-full"><span>Nome</span><input disabled={identityRequired || busy} maxLength={80} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: Café" required value={form.name} /></label>
        <label className="field field-full"><span>Quantidade</span><input disabled={identityRequired || busy} inputMode="decimal" onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} required value={form.quantity} /></label>
        <label className="field field-full"><span>Preço unitário (opcional)</span><div className="input-with-prefix"><span>R$</span><input disabled={identityRequired || busy} inputMode="decimal" onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} placeholder="Se souber" value={form.price} /></div></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button form-submit" disabled={identityRequired || busy} type="submit">{busy ? "Salvando..." : "Adicionar à lista"}</button>
      </form>

      <section className="planned-list-section">
        <div className="section-heading"><div><span className="eyebrow">PENDENTES</span><h2>Itens para comprar</h2></div><span className="item-count">{items.length}</span></div>
        {items.length === 0 ? <div className="empty-state"><div className="empty-icon" aria-hidden="true">📝</div><h3>Nenhum item planejado</h3><p>Adicione os produtos que você não quer esquecer.</p></div> : (
          <ul className="planned-list-items">
            {items.map((item) => <li className="planned-list-card" key={item.id}>
              <div><strong>{item.name}</strong><span>{formatQuantity(item.quantityMilli)} · Adicionado por {item.addedByName}</span></div>
              <div className="planned-list-meta"><strong>{item.unitPriceCents == null ? "Preço não informado" : formatCurrency(item.unitPriceCents)}</strong><button aria-label={"Remover " + item.name} className="icon-button danger-action" disabled={busy || identityRequired} onClick={() => onDelete(item.id)} type="button">×</button></div>
            </li>)}
          </ul>
        )}
      </section>
    </main>
  );
}
