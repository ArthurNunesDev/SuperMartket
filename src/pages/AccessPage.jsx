import React, { useState } from "react";

export default function AccessPage({ step, onSubmitPin, onSubmitName, onBack, error, busy }) {
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (step === "pin") {
      await onSubmitPin(pin);
      return;
    }
    await onSubmitName(name.trim());
  }

  return (
    <main className="page-content access-page">
      <div className="page-intro">
        <span className="eyebrow">{step === "pin" ? "ACESSO DA FAMÍLIA" : "IDENTIFICAÇÃO"}</span>
        <h1>{step === "pin" ? "Acesso protegido." : "Como podemos te chamar?"}</h1>
        <p>
          {step === "pin"
            ? "Informe o PIN compartilhado pela família para acessar a lista de compras."
            : "Seu nome será usado para identificar os produtos que você adicionar."}
        </p>
      </div>

      <form className="access-form" onSubmit={handleSubmit}>
        {step === "pin" ? (
          <label className="field field-full">
            <span>PIN familiar</span>
            <input
              autoComplete="one-time-code"
              autoFocus
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
              pattern="[0-9]{6}"
              placeholder="••••••"
              required
              type="password"
              value={pin}
            />
          </label>
        ) : (
          <label className="field field-full">
            <span>Seu nome</span>
            <input
              autoComplete="given-name"
              autoFocus
              maxLength={50}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Arthur"
              required
              value={name}
            />
          </label>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button form-submit" disabled={busy} type="submit">
          {busy ? "Aguarde..." : step === "pin" ? "Validar acesso" : "Continuar"}
        </button>
        {step === "name" && (
          <button className="text-button access-back" disabled={busy} onClick={onBack} type="button">
            ← Voltar para a lista
          </button>
        )}
      </form>
    </main>
  );
}
