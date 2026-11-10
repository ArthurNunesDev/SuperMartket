import React, { useState } from "react";

export default function AccountPage({ accounts, activeAccountId, onAddAccount, onSelectAccount }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      await onAddAccount(name);
      setName("");
      setError("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar a conta.");
    }
  }

  return (
    <main className="page-content">
      <div className="page-intro">
        <span className="eyebrow">PESSOAS</span>
        <h1>Contas</h1>
        <p>Cadastre os nomes da família e selecione quem está adicionando os produtos.</p>
      </div>

      <form className="account-form" onSubmit={handleSubmit}>
        <label className="field field-full">
          <span>Nome da pessoa</span>
          <input
            autoComplete="name"
            maxLength={50}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Arthur"
            required
            value={name}
          />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button form-submit" type="submit">Adicionar nome</button>
      </form>

      <section className="account-list" aria-labelledby="accounts-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">CADASTRADAS</span>
            <h2 id="accounts-title">Quem está usando?</h2>
          </div>
        </div>

        {accounts.length === 0 ? (
          <div className="empty-state">
            <h3>Nenhum nome cadastrado</h3>
            <p>Adicione o primeiro nome para começar a identificar os produtos.</p>
          </div>
        ) : (
          <ul>
            {accounts.map((account) => (
              <li className="account-row" key={account.id}>
                <span>{account.name}</span>
                <button
                  aria-pressed={activeAccountId === account.id}
                  className={activeAccountId === account.id ? "account-select active" : "account-select"}
                  onClick={() => onSelectAccount(account.id)}
                  type="button"
                >
                  {activeAccountId === account.id ? "Selecionada" : "Usar esta conta"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
