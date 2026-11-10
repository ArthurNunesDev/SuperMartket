import { useEffect, useState } from "react";
import { parseQuantity } from "../utils/calculations.js";
import { parseCurrency } from "../utils/currency.js";

const EMPTY_FORM = {
  name: "",
  quantity: "1",
  unit: "un",
  unitPrice: "",
};

export default function ProductForm({ product, onSave, onCancel }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!product) {
      setForm(EMPTY_FORM);
      setError("");
      return;
    }

    setForm({
      name: product.name,
      quantity: String(product.quantityMilli / 1000).replace(".", ","),
      unit: product.unit,
      unitPrice: (product.unitPriceCents / 100).toFixed(2).replace(".", ","),
    });
    setError("");
  }, [product]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const name = form.name.trim();
    const quantityMilli = parseQuantity(form.quantity);
    const unitPriceCents = parseCurrency(form.unitPrice);

    if (!name) {
      setError("Informe o nome do produto.");
      return;
    }
    if (quantityMilli === null) {
      setError("Informe uma quantidade maior que zero, com até três casas decimais.");
      return;
    }
    if (unitPriceCents === null) {
      setError("Informe um preço válido. Exemplo: 12,90.");
      return;
    }

    try {
      await onSave({
        ...(product ? { id: product.id } : {}),
        name,
        quantityMilli,
        unit: form.unit,
        unitPriceCents,
      });
      setForm(EMPTY_FORM);
      setError("");
    } catch {
      setError("Não foi possível salvar o produto. Tente novamente.");
    }
  }

  return (
    <form className="product-form" onSubmit={handleSubmit}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">{product ? "EDIÇÃO" : "NOVO ITEM"}</span>
          <h2>{product ? "Editar produto" : "Adicionar produto"}</h2>
        </div>
        {product && (
          <button className="text-button" type="button" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>

      <label className="field field-full">
        <span>Nome do produto</span>
        <input
          autoComplete="off"
          maxLength={80}
          name="name"
          onChange={updateField}
          placeholder="Ex.: Arroz"
          required
          value={form.name}
        />
      </label>

      <div className="form-grid">
        <label className="field">
          <span>Quantidade</span>
          <input
            inputMode="decimal"
            name="quantity"
            onChange={updateField}
            placeholder="1"
            value={form.quantity}
          />
        </label>

        <label className="field">
          <span>Unidade</span>
          <select name="unit" onChange={updateField} value={form.unit}>
            <option value="un">Unidade (un)</option>
            <option value="kg">Quilograma (kg)</option>
            <option value="g">Grama (g)</option>
            <option value="L">Litro (L)</option>
            <option value="ml">Mililitro (ml)</option>
          </select>
        </label>
      </div>

      <label className="field field-full">
        <span>Preço por {form.unit}</span>
        <div className="input-with-prefix">
          <span>R$</span>
          <input
            inputMode="decimal"
            name="unitPrice"
            onChange={updateField}
            placeholder="0,00"
            value={form.unitPrice}
          />
        </div>
      </label>

      {error && <p className="form-error" role="alert">{error}</p>}

      <button className="primary-button form-submit" type="submit">
        {product ? "Salvar alterações" : "Adicionar à compra"}
      </button>
    </form>
  );
}