import React, { useState } from "react";

export default function AccessPage({ step, onSubmitPin, onSubmitName, onCreateSession, error, busy }) {
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (step === "session") {
      await onSubmitPin(pin.trim().toUpperCase());
      return;
    }
    await onSubmitName(name.trim());
  }

  if (step === "session") {
    return (
      <main className="page-content access-page">
        <div className="page-intro">
          <span className="eyebrow">SESSÕES COMPARTILHADAS</span>
          <h1>Comece uma lista.</h1>
          <p>Crie uma sessão ou informe o PIN de uma sessão existente para compartilhar a lista em outros dispositivos.</p>
        </div>
        <div className="session-access-card">
          <button className="primary-button form-submit" disabled={busy} onClick={onCreateSession} type="button">
            {busy ? "Aguarde..." : "Criar nova sessão"}
          </button>
          <div className="session-access-divider"><span>ou entre em uma sessão</span></div>
          <form className="access-form access-form-inner" onSubmit={handleSubmit}>
            <label className="field field-full">
              <span>PIN da sessão</span>
              <input
                autoComplete="off"
                autoCapitalize="characters"
                maxLength={8}
                onChange={(event) => setPin(event.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8))}
                placeholder="EX.: A7K2M9Q4"
                required
                value={pin}
              />
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button form-submit" disabled={busy || pin.length !== 8} type="submit">
              {busy ? "Aguarde..." : "Entrar na sessão"}
            </button>
          </form>
          {error && <p className="form-error session-access-error" role="alert">{error}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="page-content access-page">
      <div className="page-intro">
        <span className="eyebrow">IDENTIFICAÇÃO</span>
        <h1>Como podemos te chamar?</h1>
        <p>Seu nome será usado para identificar os produtos que você adicionar.</p>
      </div>
      <form className="access-form" onSubmit={handleSubmit}>
        <label className="field field-full">
          <span>Seu nome</span>
          <input autoComplete="given-name" autoFocus maxLength={50} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Arthur" required value={name} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button form-submit" disabled={busy} type="submit">
          {busy ? "Aguarde..." : "Continuar"}
        </button>
      </form>
    </main>
  );
}
