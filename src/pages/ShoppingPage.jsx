import React, { useState } from "react";
import ProductForm from "../components/ProductForm.jsx";
import ProductList from "../components/ProductList.jsx";
import ShoppingSummary from "../components/ShoppingSummary.jsx";

export default function ShoppingPage({ purchase, onSaveProduct, onDeleteProduct, onFinish, onStart, onGetEditHistory, onHistoryLoadingChange, activeAccount, busy }) {
  const [editingProduct, setEditingProduct] = useState(null);
  const identityRequired = !activeAccount?.name;

  if (!purchase) {
    return (
      <main className="page-content">
        <div className="empty-purchase">
          <div className="empty-icon" aria-hidden="true">🧺</div>
          <h1>Nenhuma compra em andamento</h1>
          <p>Comece uma nova lista compartilhada para registrar os produtos e acompanhar o total.</p>
          <button className="primary-button" disabled={busy || identityRequired} onClick={onStart} type="button">Iniciar compra</button>
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
        onGetEditHistory={onGetEditHistory}
        onHistoryLoadingChange={onHistoryLoadingChange}
        product={editingProduct}
        activeAccount={activeAccount}
        disabled={identityRequired}
        busy={busy}
      />

      <ProductList items={purchase.items} onDelete={onDeleteProduct} onEdit={setEditingProduct} disabled={identityRequired} />
      <ShoppingSummary items={purchase.items} onFinish={onFinish} busy={busy} disabled={identityRequired} />
    </main>
  );
}
