import React from "react";

export default function ItemFilters({
  query,
  onQueryChange,
  participant,
  onParticipantChange,
  participants = [],
  label = "Filtrar itens",
}) {
  const hasFilters = Boolean(query.trim() || participant);

  return (
    <div className="item-filters" role="group" aria-label={label}>
      <div className="item-filter-control">
        <label className="item-search-field">
          <span className="visually-hidden">Pesquisar produto</span>
          <input type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Pesquisar produto..." aria-label="Pesquisar produtos pelo nome" />
        </label>
        <label className="item-participant-field">
          <span className="visually-hidden">Filtrar por participante</span>
          <select value={participant} onChange={(event) => onParticipantChange(event.target.value)} aria-label="Filtrar produtos por participante">
            <option value="">Todos</option>
            {participants.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      </div>
      {hasFilters && (
        <button
          className="item-filters-reset"
          onClick={() => {
            onQueryChange("");
            onParticipantChange("");
          }}
          type="button"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
