import React, { useState } from "react";
import ProductForm from "../components/ProductForm.jsx";
import ProductList from "../components/ProductList.jsx";
import ShoppingSummary from "../components/ShoppingSummary.jsx";
import PlannedItemsPanel from "../components/PlannedItemsPanel.jsx";
import ItemFilters from "../components/ItemFilters.jsx";
import { filterShoppingItems } from "../utils/itemFilters.js";

export default function ShoppingPage({ purchase, plannedItems, participantNames = [], onSaveProduct, onDeleteProduct, onFinish, onStart, onPurchasePlannedItem, onGetEditHistory, onHistoryLoadingChange, activeAccount, busy }) {
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedParticipant, setSelectedParticipant] = useState("");
  const identityRequired = !activeAccount?.name;
  const cartItems = purchase?.items ?? [];
  const filteredCartItems = filterShoppingItems(cartItems, searchQuery, selectedParticipant);
  const filteredPlannedItems = filterShoppingItems(plannedItems, searchQuery, selectedParticipant);
  const hasItems = cartItems.length > 0 || plannedItems.length > 0;
  const hasActiveFilters = Boolean(searchQuery.trim() || selectedParticipant);

  function renderFilters() {
    if (!hasItems) return null;
    return (
      <ItemFilters
        query={searchQuery}
        onQueryChange={setSearchQuery}
        participant={selectedParticipant}
        onParticipantChange={setSelectedParticipant}
        participants={participantNames}
        label="Pesquisar e filtrar itens do carrinho"
      />
    );
  }

  if (!purchase) {
    return (
      <main className="page-content">
        <div className="empty-purchase">
          <div className="empty-icon" aria-hidden="true">🧺</div>
          <h1>Nenhuma compra em andamento</h1>
          <p>Inicie uma compra para adicionar produtos e confirmar os itens da sua lista planejada.</p>
          <button className="primary-button" disabled={busy || identityRequired} onClick={onStart} type="button">Iniciar compra</button>
        </div>
        {renderFilters()}
        <PlannedItemsPanel
          items={filteredPlannedItems}
          totalItems={plannedItems.length}
          hasActiveFilters={hasActiveFilters}
          purchase={null}
          onPurchase={onPurchasePlannedItem}
          onStart={onStart}
          busy={busy}
        />
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
      {renderFilters()}
      <ProductForm
        key={editingProduct?.id ?? "new-product"}
        onCancel={() => setEditingProduct(null)}
        onSave={saveProduct}
        onGetEditHistory={onGetEditHistory}
        onHistoryLoadingChange={onHistoryLoadingChange}
        existingItems={cartItems}
        product={editingProduct}
        activeAccount={activeAccount}
        disabled={identityRequired}
        busy={busy}
      />
      <ProductList
        items={filteredCartItems}
        totalItems={cartItems.length}
        hasActiveFilters={hasActiveFilters}
        onDelete={onDeleteProduct}
        onEdit={setEditingProduct}
        disabled={identityRequired}
      />
      <PlannedItemsPanel
        items={filteredPlannedItems}
        totalItems={plannedItems.length}
        hasActiveFilters={hasActiveFilters}
        purchase={purchase}
        onPurchase={onPurchasePlannedItem}
        onStart={onStart}
        busy={busy}
      />
      <ShoppingSummary items={cartItems} onFinish={onFinish} busy={busy} disabled={identityRequired} />
    </main>
  );
}
