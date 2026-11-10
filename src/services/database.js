const DATABASE_NAME = "supermartket-db";
const DATABASE_VERSION = 1;
const PURCHASES_STORE = "purchases";

let databasePromise;

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha ao acessar o banco local."));
  });
}

function transactionResult(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Falha na transação."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Transação cancelada."));
  });
}

function openDatabase() {
  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("Este navegador não oferece suporte ao armazenamento local necessário."));
  }

  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(PURCHASES_STORE)) {
          const store = database.createObjectStore(PURCHASES_STORE, { keyPath: "id" });
          store.createIndex("status", "status", { unique: false });
          store.createIndex("createdAt", "createdAt", { unique: false });
        }
      };

      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          databasePromise = undefined;
        };
        resolve(database);
      };

      request.onerror = () => {
        databasePromise = undefined;
        reject(request.error ?? new Error("Não foi possível abrir o banco local."));
      };

      request.onblocked = () => {
        databasePromise = undefined;
        reject(new Error("Feche outras abas do SuperMartket para atualizar o armazenamento."));
      };
    });
  }

  return databasePromise;
}

export async function savePurchase(purchase) {
  const database = await openDatabase();
  const transaction = database.transaction(PURCHASES_STORE, "readwrite");
  const completed = transactionResult(transaction);
  transaction.objectStore(PURCHASES_STORE).put(purchase);
  await completed;
  return purchase;
}

export async function getPurchases() {
  const database = await openDatabase();
  const transaction = database.transaction(PURCHASES_STORE, "readonly");
  const completed = transactionResult(transaction);
  const request = transaction.objectStore(PURCHASES_STORE).getAll();
  const [purchases] = await Promise.all([requestResult(request), completed]);
  return purchases;
}

export async function getActivePurchase() {
  const purchases = await getPurchases();
  return purchases
    .filter((purchase) => purchase.status === "active")
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))[0] ?? null;
}

export async function getCompletedPurchases() {
  const purchases = await getPurchases();
  return purchases
    .filter((purchase) => purchase.status === "completed")
    .sort((first, second) => (second.completedAt ?? second.createdAt).localeCompare(first.completedAt ?? first.createdAt));
}