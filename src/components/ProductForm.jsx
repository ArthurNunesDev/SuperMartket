import React, { useEffect, useState } from "react";
import { parseQuantity, sanitizeQuantityInput } from "../utils/calculations.js";
import { parseCurrency, sanitizeCurrencyInput } from "../utils/currency.js";
import { subscribeToSharedItemEditHistory } from "../services/supabase.js";
import { findDuplicateProduct } from "../utils/productMatching.js";

const EMPTY_FORM = { name: "", quantity: "1", unitPrice: "" };

export default function ProductForm({ product, existingItems = [], onSave, onCancel, onGetEditHistory, onHistoryLoadingChange, activeAccount, busy, disabled = false }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editHistory, setEditHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [duplicateMatch, setDuplicateMatch] = useState(null);

  useEffect(() => {
    if (!product) {
      setForm(EMPTY_FORM);
      setError("");
      return;
    }
    setForm({
      name: product.name,
      quantity: String(product.quantityMilli / 1000).replace(".", ","),
      unitPrice: (product.unitPriceCents / 100).toFixed(2).replace(".", ","),
    });
    setError("");
    setHistoryOpen(false);
    setEditHistory([]);
    setHistoryError("");
  }, [product]);

  useEffect(() => {
    if (!product || !historyOpen) return undefined;
    let active = true;

    async function loadHistory() {
      setHistoryLoading(true);
      onHistoryLoadingChange?.(true);
      setHistoryError("");
      try {
        const entries = await onGetEditHistory(product.id);
        if (active) setEditHistory(entries);
      } catch {
        if (active) setHistoryError("Não foi possível carregar o histórico de edições.");
      } finally {
        if (active) {
          setHistoryLoading(false);
          onHistoryLoadingChange?.(false);
        }
      }
    }

    loadHistory();
    const unsubscribe = subscribeToSharedItemEditHistory(product.id, () => {
      loadHistory();
    }, (subscriptionError) => {
      if (active) setHistoryError(subscriptionError.message);
    });

    return () => {
      active = false;
      onHistoryLoadingChange?.(false);
      unsubscribe();
    };
  }, [product, historyOpen, onGetEditHistory, onHistoryLoadingChange]);

  function toggleEditHistory() {
    setHistoryOpen((open) => !open);
  }

  function updateField(event) {
    const { name, value } = event.target;
    const sanitizedValue = name === "quantity"
      ? sanitizeQuantityInput(value)
      : name === "unitPrice"
        ? sanitizeCurrencyInput(value)
        : value;
    setForm((current) => ({ ...current, [name]: sanitizedValue }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const name = form.name.trim();
    const quantityMilli = parseQuantity(form.quantity);
    const unitPriceCents = parseCurrency(form.unitPrice);

    if (!name) return setError("Informe o nome do produto.");
    if (quantityMilli === null || quantityMilli > 2147483647) {
      return setError("Informe uma quantidade válida, de até 2.147.483,647.");
    }
    if (unitPriceCents === null || unitPriceCents > 2147483647) {
      return setError("Informe um preço válido de até R$ 21.474.836,47.");
    }

    const candidate = {
      ...(product ? { id: product.id } : {}),
      name,
      quantityMilli,
      unit: "un",
      unitPriceCents,
    };
    if (!product) {
      const match = findDuplicateProduct(existingItems, name);
      if (match) {
        setDuplicateMatch({ item: match.item, candidate });
        return;
      }
    }
    await persistProduct(candidate);
  }

  async function persistProduct(candidate) {
    try {
      await onSave(candidate);
      setForm(EMPTY_FORM);
      setError("");
      setDuplicateMatch(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o produto. Tente novamente.");
    }
  }

  async function confirmDuplicate(action) {
    if (!duplicateMatch) return;
    if (action === "sum") {
      const quantityMilli = duplicateMatch.item.quantityMilli + duplicateMatch.candidate.quantityMilli;
      if (!Number.isSafeInteger(quantityMilli) || quantityMilli > 2147483647) {
        setError("A soma ultrapassa a quantidade máxima permitida.");
        return;
      }
      await persistProduct({
        id: duplicateMatch.item.id,
        name: duplicateMatch.item.name,
        quantityMilli,
        unit: "un",
        unitPriceCents: duplicateMatch.item.unitPriceCents,
      });
      return;
    }
    await persistProduct(duplicateMatch.candidate);
  }

  return (
    <form className="product-form" onSubmit={handleSubmit}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">{product ? "EDIÇÃO" : "NOVO ITEM"}</span>
          <h2>{product ? "Editar produto" : "Adicionar produto"}</h2>
        </div>
        {product && <div className="product-form-actions"><button className="text-button" disabled={busy || disabled || !activeAccount?.name} type="button" onClick={toggleEditHistory}>Histórico de edições</button><button className="text-button" disabled={busy || disabled || !activeAccount?.name} type="button" onClick={onCancel}>Cancelar</button></div>}
      </div>

      <label className="field field-full">
        <span>Nome do produto</span>
        <input autoComplete="off" disabled={disabled || !activeAccount?.name} maxLength={80} name="name" onChange={updateField} placeholder="Ex.: Arroz" required value={form.name} />
      </label>
      <label className="field field-full">
        <span>Quantidade</span>
        <input disabled={disabled || !activeAccount?.name} inputMode="decimal" maxLength={14} name="quantity" onChange={updateField} placeholder="1" required value={form.quantity} />
      </label>
      <label className="field field-full">
        <span>Valor por unidade</span>
        <div className="input-with-prefix">
          <span>R$</span>
          <input disabled={disabled || !activeAccount?.name} inputMode="decimal" maxLength={14} name="unitPrice" onChange={updateField} placeholder="0,00" required value={form.unitPrice} />
        </div>
      </label>

      {!activeAccount && !product && <p className="account-required-note">Informe seu nome antes de adicionar produtos.</p>}
      {product && historyOpen && (
        <section className="edit-history" aria-label="Histórico de edições">
          <h3>Histórico de edições</h3>
          {historyLoading ? <p>Carregando histórico...</p>
            : historyError ? <p className="form-error" role="alert">{historyError}</p>
            : editHistory.length === 0 ? <p>Nenhuma edição registrada.</p>
            : <ol>{editHistory.map((entry) => (
              <li key={entry.id}>
                <strong>Editado por {entry.editedByName}</strong>
                <time dateTime={entry.editedAt}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.editedAt))}</time>
              </li>
            ))}</ol>}
        </section>
      )}
      {duplicateMatch && (
        <div className="duplicate-backdrop" role="presentation">
          <section aria-labelledby="duplicate-product-title" aria-modal="true" className="duplicate-dialog" role="dialog">
            <span className="eyebrow">POSSÍVEL DUPLICIDADE</span>
            <h3 id="duplicate-product-title">Este produto já está na compra</h3>
            <p><strong>{duplicateMatch.item.name}</strong> já possui <strong>{(duplicateMatch.item.quantityMilli / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}</strong> de quantidade.</p>
            <p className="duplicate-detail">Você digitou “{duplicateMatch.candidate.name}”. Se somar, o preço unitário existente será mantido.</p>
            <div className="duplicate-actions">
              <button className="secondary-button" disabled={busy} onClick={() => setDuplicateMatch(null)} type="button">Revisar nome</button>
              <button className="secondary-button" disabled={busy} onClick={() => confirmDuplicate("add")} type="button">Adicionar mesmo assim</button>
              <button className="primary-button" disabled={busy} onClick={() => confirmDuplicate("sum")} type="button">Somar quantidade</button>
            </div>
          </section>
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button form-submit" disabled={busy || disabled || !activeAccount?.name} type="submit">
        {busy ? "Salvando..." : product ? "Salvar alterações" : "Adicionar à compra"}
      </button>
    </form>
  );
}
