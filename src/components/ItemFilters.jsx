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
    <section className="item-filters" aria-label={label}>
      <label className="item-search-field">
        <span>Pesquisar produto</span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Digite o nome do produto..."
          aria-label="Pesquisar produtos pelo nome"
        />
      </label>
      <label className="item-participant-field">
        <span>Adicionado por</span>
        <select
          value={participant}
          onChange={(event) => onParticipantChange(event.target.value)}
          aria-label="Filtrar produtos por participante"
        >
          <option value="">Todos os participantes</option>
          {participants.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </label>
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
    </section>
  );
}
