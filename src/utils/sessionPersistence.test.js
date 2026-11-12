import test from "node:test";
import assert from "node:assert/strict";
import {
  CURRENT_PAGE_STORAGE_KEY,
  LOCATION_SHARING_STORAGE_KEY,
  readCurrentPage,
  readLocationSharingPreference,
  writeCurrentPage,
  writeLocationSharingPreference,
} from "./sessionPersistence.js";

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test("restores only supported application pages", () => {
  const storage = createStorage({ [CURRENT_PAGE_STORAGE_KEY]: "history" });
  assert.equal(readCurrentPage(storage), "history");
  storage.setItem(CURRENT_PAGE_STORAGE_KEY, "unknown");
  assert.equal(readCurrentPage(storage), "shopping");
});

test("persists the selected page", () => {
  const storage = createStorage();
  writeCurrentPage("planned", storage);
  assert.equal(storage.getItem(CURRENT_PAGE_STORAGE_KEY), "planned");
  writeCurrentPage("invalid", storage);
  assert.equal(storage.getItem(CURRENT_PAGE_STORAGE_KEY), "planned");
});

test("restores location sharing only when explicitly enabled", () => {
  const storage = createStorage({ [LOCATION_SHARING_STORAGE_KEY]: "true" });
  assert.equal(readLocationSharingPreference(storage), true);
  storage.setItem(LOCATION_SHARING_STORAGE_KEY, "false");
  assert.equal(readLocationSharingPreference(storage), false);
});

test("clears the location sharing preference when sharing is stopped", () => {
  const storage = createStorage();
  writeLocationSharingPreference(true, storage);
  assert.equal(storage.getItem(LOCATION_SHARING_STORAGE_KEY), "true");
  writeLocationSharingPreference(false, storage);
  assert.equal(readLocationSharingPreference(storage), false);
});

test("storage failures fall back without breaking navigation or sharing", () => {
  const unavailableStorage = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); },
  };
  assert.equal(readCurrentPage(unavailableStorage), "shopping");
  assert.equal(readLocationSharingPreference(unavailableStorage), false);
  assert.doesNotThrow(() => writeCurrentPage("session", unavailableStorage));
  assert.doesNotThrow(() => writeLocationSharingPreference(true, unavailableStorage));
});
