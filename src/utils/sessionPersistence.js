export const CURRENT_PAGE_STORAGE_KEY = "supermartket-current-page";
export const LOCATION_SHARING_STORAGE_KEY = "supermartket-location-sharing";

const VALID_PAGES = new Set(["shopping", "planned", "history", "session"]);

export function readCurrentPage(storage) {
  try {
    const page = storage?.getItem(CURRENT_PAGE_STORAGE_KEY);
    return VALID_PAGES.has(page) ? page : "shopping";
  } catch {
    return "shopping";
  }
}

export function writeCurrentPage(page, storage) {
  if (!VALID_PAGES.has(page)) return;
  try {
    storage?.setItem(CURRENT_PAGE_STORAGE_KEY, page);
  } catch {
    // Navigation continues normally when session storage is unavailable.
  }
}

export function readLocationSharingPreference(storage) {
  try {
    return storage?.getItem(LOCATION_SHARING_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeLocationSharingPreference(isSharing, storage) {
  try {
    if (isSharing) storage?.setItem(LOCATION_SHARING_STORAGE_KEY, "true");
    else storage?.removeItem(LOCATION_SHARING_STORAGE_KEY);
  } catch {
    // Location sharing remains available for the current page.
  }
}
