import React, { useMemo, useState } from "react";
import { formatQuantity, parseQuantity, sanitizeQuantityInput } from "../utils/calculations.js";
import { formatCurrency, parseCurrency, sanitizeCurrencyInput } from "../utils/currency.js";
import { findDuplicateProduct, getFrequentProducts } from "../utils/productMatching.js";
import { filterShoppingItems } from "../utils/itemFilters.js";
import ItemFilters from "../components/ItemFilters.jsx";

const EMPTY_FORM = { name: "", quantity: "1", price: "" };
const MAX_QUANTITY = 2147483647;

export default function ShoppingListPage({ items, purchases = [], participantNames = [], onSave, onDelete, activeAccount, busy, onBack }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingItem, setEditingItem] = useState(null);
  const [error, setError] = useState("");
  const [duplicateMatch, setDuplicateMatch] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedParticipant, setSelectedParticipant] = useState("");
  const identityRequired = !activeAccount?.name;
  const frequentProducts = useMemo(() => getFrequentProducts(purchases), [purchases]);
  const filteredItems = useMemo(
    () => filterShoppingItems(items, searchQuery, selectedParticipant),
    [items, searchQuery, selectedParticipant]
  );
  const hasActiveFilters = Boolean(searchQuery.trim() || selectedParticipant);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingItem(null);
    setDuplicateMatch(null);
    setError("");
  }

  function startEditing(item) {
    setEditingItem(item);
    setForm({
      name: item.name,
      quantity: String(item.quantityMilli / 1000).replace(".", ","),
      price: item.unitPriceCents == null ? "" : (item.unitPriceCents / 100).toFixed(2).replace(".", ","),
    });
    setError("");
    setDuplicateMatch(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function persistItem(candidate) {
    try {
      await onSave(candidate);
      resetForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o item.");
    }
  }

  async function submitCandidate(candidate) {
    if (!editingItem) {
      const match = findDuplicateProduct(items, candidate.name);
      if (match) {
        setDuplicateMatch({ item: match.item, candidate });
        return;
      }
    }
    await persistItem(candidate);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const name = form.name.trim();
    const quantityMilli = parseQuantity(form.quantity);
    const unitPriceCents = form.price.trim() ? parseCurrency(form.price) : null;
    if (!name) return setError("Informe o nome do item.");
    if (quantityMilli === null || quantityMilli > MAX_QUANTITY) return setError("Informe uma quantidade válida.");
    if (form.price.trim() && (unitPriceCents === null || unitPriceCents > MAX_QUANTITY)) return setError("Informe um preço válido ou deixe o campo vazio.");
    await submitCandidate({ ...(editingItem ? { id: editingItem.id } : {}), name, quantityMilli, unitPriceCents });
  }

  async function confirmDuplicate(action) {
    if (!duplicateMatch) return;
    if (action === "sum") {
      const quantityMilli = duplicateMatch.item.quantityMilli + duplicateMatch.candidate.quantityMilli;
      if (!Number.isSafeInteger(quantityMilli) || quantityMilli > MAX_QUANTITY) {
        setError("A soma ultrapassa a quantidade máxima permitida.");
        return;
      }
      await persistItem({
        id: duplicateMatch.item.id,
        name: duplicateMatch.item.name,
        quantityMilli,
        unitPriceCents: duplicateMatch.item.unitPriceCents ?? duplicateMatch.candidate.unitPriceCents,
      });
      return;
    }
    await persistItem(duplicateMatch.candidate);
  }

  async function addFrequentProduct(product) {
    const candidate = { name: product.name, quantityMilli: product.quantityMilli, unitPriceCents: null };
    const match = findDuplicateProduct(items, candidate.name);
    if (match) {
      setDuplicateMatch({ item: match.item, candidate });
      return;
    }
    await persistItem(candidate);
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

      {frequentProducts.length > 0 && (
        <section className="frequent-products" aria-labelledby="frequent-products-title">
          <div className="section-heading">
            <div><span className="eyebrow">BASEADO NAS COMPRAS ANTERIORES</span><h2 id="frequent-products-title">Produtos frequentes</h2></div>
          </div>
          <div className="frequent-products-list">
            {frequentProducts.map((product) => (
              <button className="frequent-product-button" disabled={identityRequired || busy} key={product.name} onClick={() => addFrequentProduct(product)} type="button">
                <strong>{product.name}</strong>
                <span>{product.count} compras · {formatQuantity(product.quantityMilli)} na última compra</span>
                <small>Adicionar à lista +</small>
              </button>
            ))}
          </div>
          <p className="planned-cart-note">Sugestões calculadas automaticamente a partir do histórico disponível.</p>
        </section>
      )}

      <form className="product-form planned-list-form" onSubmit={handleSubmit}>
        <div className="section-heading">
          <div><span className="eyebrow">{editingItem ? "EDIÇÃO" : "NOVO ITEM"}</span><h2>{editingItem ? "Editar item" : "O que falta comprar?"}</h2></div>
          {editingItem && <button className="text-button" disabled={busy} onClick={resetForm} type="button">Cancelar</button>}
        </div>
        <label className="field field-full"><span>Nome</span><input disabled={identityRequired || busy} maxLength={80} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: Café" required value={form.name} /></label>
        <label className="field field-full"><span>Quantidade</span><input disabled={identityRequired || busy} inputMode="decimal" maxLength={14} onChange={(event) => setForm((current) => ({ ...current, quantity: sanitizeQuantityInput(event.target.value) }))} required value={form.quantity} /></label>
        <label className="field field-full"><span>Preço unitário (opcional)</span><div className="input-with-prefix"><span>R$</span><input disabled={identityRequired || busy} inputMode="decimal" maxLength={14} onChange={(event) => setForm((current) => ({ ...current, price: sanitizeCurrencyInput(event.target.value) }))} placeholder="Se souber" value={form.price} /></div></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button form-submit" disabled={identityRequired || busy} type="submit">{busy ? "Salvando..." : editingItem ? "Salvar alterações" : "Adicionar à lista"}</button>
      </form>

      <section className="planned-list-section">
        <div className="section-heading"><div><span className="eyebrow">PENDENTES</span><h2>Itens para comprar</h2></div><span className="item-count">{filteredItems.length} de {items.length}</span></div>
        {items.length > 0 && (
          <ItemFilters
            query={searchQuery}
            onQueryChange={setSearchQuery}
            participant={selectedParticipant}
            onParticipantChange={setSelectedParticipant}
            participants={participantNames}
            label="Pesquisar e filtrar lista de compras"
          />
        )}
        {items.length === 0 ? (
          <div className="empty-state"><div className="empty-icon" aria-hidden="true">📝</div><h3>Nenhum item planejado</h3><p>Adicione os produtos que você não quer esquecer.</p></div>
        ) : filteredItems.length === 0 ? (
          <div className="filter-empty-state" role="status">
            <strong>Nenhum item encontrado</strong>
            <span>{hasActiveFilters ? "Tente alterar a pesquisa ou o participante selecionado." : "Os itens aparecerão aqui."}</span>
          </div>
        ) : (
          <ul className="planned-list-items">
            {filteredItems.map((item) => <li className="planned-list-card" key={item.id}>
              <div><strong>{item.name}</strong><span>{formatQuantity(item.quantityMilli)} · Adicionado por {item.addedByName}</span></div>
              <div className="planned-list-meta">
                <strong>{item.unitPriceCents == null ? "Preço não informado" : formatCurrency(item.unitPriceCents)}</strong>
                <div className="product-actions">
                  <button aria-label={"Editar " + item.name} className="icon-button" disabled={busy || identityRequired} onClick={() => startEditing(item)} type="button">✎</button>
                  <button aria-label={"Remover " + item.name} className="icon-button danger-action" disabled={busy || identityRequired} onClick={() => onDelete(item.id)} type="button">×</button>
                </div>
              </div>
            </li>)}
          </ul>
        )}
      </section>

      {duplicateMatch && (
        <div className="duplicate-backdrop" role="presentation">
          <section aria-labelledby="planned-duplicate-title" aria-modal="true" className="duplicate-dialog" role="dialog">
            <span className="eyebrow">POSSÍVEL DUPLICIDADE</span>
            <h3 id="planned-duplicate-title">Este item já está na lista</h3>
            <p><strong>{duplicateMatch.item.name}</strong> já possui <strong>{formatQuantity(duplicateMatch.item.quantityMilli)}</strong>.</p>
            <p className="duplicate-detail">Você digitou “{duplicateMatch.candidate.name}”. Se somar, o preço já cadastrado será mantido.</p>
            <div className="duplicate-actions">
              <button className="secondary-button" disabled={busy} onClick={() => setDuplicateMatch(null)} type="button">Revisar nome</button>
              <button className="secondary-button" disabled={busy} onClick={() => confirmDuplicate("add")} type="button">Adicionar mesmo assim</button>
              <button className="primary-button" disabled={busy} onClick={() => confirmDuplicate("sum")} type="button">Somar quantidade</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
