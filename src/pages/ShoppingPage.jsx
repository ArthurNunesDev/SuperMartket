import { useState } from "react";
import ProductForm from "../components/ProductForm.jsx";
import ProductList from "../components/ProductList.jsx";
import ShoppingSummary from "../components/ShoppingSummary.jsx";

export default function ShoppingPage({ purchase, onSaveProduct, onDeleteProduct, onFinish, onStart }) {
  const [editingProduct, setEditingProduct] = useState(null);

  if (!purchase) {
    return (
      <main className="page-content">
        <div className="empty-purchase">
          <div className="empty-icon" aria-hidden="true">🧺</div>
          <h1>Nenhuma compra em andamento</h1>
          <p>Comece uma nova lista para registrar os produtos e acompanhar o total.</p>
          <button className="primary-button" onClick={onStart} type="button">Iniciar compra</button>
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
      </div>

      <ProductForm
        key={editingProduct?.id ?? "new-product"}
        onCancel={() => setEditingProduct(null)}
        onSave={saveProduct}
        product={editingProduct}
      />

      <ProductList
        items={purchase.items}
        onDelete={onDeleteProduct}
        onEdit={setEditingProduct}
      />

      <ShoppingSummary items={purchase.items} onFinish={onFinish} />
    </main>
  );
}