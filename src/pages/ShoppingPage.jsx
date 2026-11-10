import React, { useState } from "react";
import ProductForm from "../components/ProductForm.jsx";
import ProductList from "../components/ProductList.jsx";
import ShoppingSummary from "../components/ShoppingSummary.jsx";

export default function ShoppingPage({ purchase, onSaveProduct, onDeleteProduct, onFinish, onStart, activeAccount, busy }) {
  const [editingProduct, setEditingProduct] = useState(null);

  if (!purchase) {
    return (
      <main className="page-content">
        <div className="empty-purchase">
          <div className="empty-icon" aria-hidden="true">🧺</div>
          <h1>Nenhuma compra em andamento</h1>
          <p>Comece uma nova lista compartilhada para registrar os produtos e acompanhar o total.</p>
          <button className="primary-button" disabled={busy} onClick={onStart} type="button">Iniciar compra</button>
        </div>
      </main>
    );
  }

  async function saveProduct(product) {
    await onSaveProduct(product);
    setEditingProduct(null);
  }

  return (
    <main className="page-content">
      <div className="page-intro">
        <span className="eyebrow">COMPRA EM ANDAMENTO</span>
        <h1>Vamos às compras.</h1>
        <p>Adicione os produtos conforme encontrar cada item.</p>
        {activeAccount && <p className="active-account-note">Adicionando como <strong>{activeAccount.name}</strong></p>}
      </div>

      <ProductForm
        key={editingProduct?.id ?? "new-product"}
        onCancel={() => setEditingProduct(null)}
        onSave={saveProduct}
        product={editingProduct}
        activeAccount={activeAccount}
      />

      <ProductList items={purchase.items} onDelete={onDeleteProduct} onEdit={setEditingProduct} />
      <ShoppingSummary items={purchase.items} onFinish={onFinish} busy={busy} />
    </main>
  );
}
