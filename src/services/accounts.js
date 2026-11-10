const ACCOUNTS_STORAGE_KEY = "supermartket-accounts";

function readStorage() {
  try {
    const stored = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (!stored) return { accounts: [], activeAccountId: null };

    const parsed = JSON.parse(stored);
    const accounts = Array.isArray(parsed.accounts)
      ? parsed.accounts.filter((account) =>
          account &&
          typeof account.id === "string" &&
          typeof account.name === "string" &&
          account.name.trim()
        )
      : [];
    const activeAccountId = accounts.some((account) => account.id === parsed.activeAccountId)
      ? parsed.activeAccountId
      : null;

    return { accounts, activeAccountId };
  } catch {
    return { accounts: [], activeAccountId: null };
  }
}

function writeStorage(data) {
  try {
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    throw new Error("Não foi possível salvar as contas neste dispositivo.");
  }
}

export function getAccountsState() {
  return readStorage();
}

export function addAccount(name) {
  const normalizedName = String(name).trim();
  if (!normalizedName) throw new Error("Informe o nome da conta.");

  const state = readStorage();
  const existing = state.accounts.find(
    (account) => account.name.toLocaleLowerCase("pt-BR") === normalizedName.toLocaleLowerCase("pt-BR")
  );

  if (existing) {
    const nextState = { ...state, activeAccountId: existing.id };
    writeStorage(nextState);
    return nextState;
  }

  const account = { id: crypto.randomUUID(), name: normalizedName };
  const nextState = {
    accounts: [...state.accounts, account],
    activeAccountId: account.id,
  };

  writeStorage(nextState);
  return nextState;
}

export function selectAccount(accountId) {
  const state = readStorage();
  if (!state.accounts.some((account) => account.id === accountId)) {
    throw new Error("A conta selecionada não foi encontrada.");
  }

  const nextState = { ...state, activeAccountId: accountId };
  writeStorage(nextState);
  return nextState;
}
