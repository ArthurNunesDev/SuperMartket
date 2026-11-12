import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wdbjxmwotgmotbznmzlc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_lGezLpOwLXct0o55cX36xw_G46IsO7C";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

export async function ensureDeviceSession() {
  const { data: current, error: currentError } = await supabase.auth.getSession();
  if (currentError) throw currentError;
  if (current.session) return current.session;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!data.session) throw new Error("Não foi possível criar uma sessão neste dispositivo.");
  return data.session;
}

async function invokeShoppingSession(body) {
  const { data, error } = await supabase.functions.invoke("shopping-session", { body });
  if (error) {
    let message = "Não foi possível processar a sessão.";
    let code = "";
    try {
      const response = error.context;
      const payload = response instanceof Response ? await response.clone().json() : null;
      if (payload?.error) message = payload.error;
      if (typeof payload?.code === "string") code = payload.code;
    } catch {
      // Keep a safe generic error if the response cannot be parsed.
    }
    const sessionError = new Error(message);
    sessionError.status = error.context?.status;
    if (code) sessionError.code = code;
    throw sessionError;
  }
  return data;
}

export async function checkShoppingSession() {
  const result = await invokeShoppingSession({ action: "check" });
  return result.session ?? null;
}

export async function createShoppingSession() {
  const result = await invokeShoppingSession({ action: "create" });
  if (!result.authorized || !result.session) throw new Error("Não foi possível criar a sessão.");
  return result.session;
}

export async function joinShoppingSession(pin) {
  const result = await invokeShoppingSession({ action: "join", pin });
  if (!result.authorized || !result.session) throw new Error("Não foi possível entrar na sessão.");
  return result.session;
}

export async function leaveShoppingSession(confirmEnd = false) {
  return invokeShoppingSession({ action: "leave", confirmEnd });
}

export async function signOutDevice() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

function mapPurchase(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    status: row.status,
    items: (row.items ?? []).map((item) => ({
      id: item.id,
      plannedItemId: item.planned_item_id ?? null,
      name: item.name,
      quantityMilli: item.quantity_milli,
      unit: "un",
      unitPriceCents: item.unit_price_cents,
      addedByName: item.added_by_name,
      editedByName: item.edited_by_name,
    })),
  };
}

export async function getSharedPurchases() {
  const { data, error } = await supabase
    .from("purchases")
    .select("id,status,created_at,completed_at,items:purchase_items(id,planned_item_id,name,quantity_milli,unit_price_cents,added_by_name,edited_by_name,created_at)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapPurchase);
}

export async function createSharedPurchase() {
  const { data, error } = await supabase
    .from("purchases")
    .insert({ status: "active" })
    .select("id,status,created_at,completed_at")
    .single();
  if (!error) return mapPurchase({ ...data, items: [] });

  if (error.code === "23505") {
    const { data: existing, error: lookupError } = await supabase
      .from("purchases")
      .select("id,status,created_at,completed_at")
      .eq("status", "active")
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) return mapPurchase({ ...existing, items: [] });
  }
  throw error;
}

export async function saveSharedItem(purchaseId, item, isUpdate = false) {
  const row = {
    purchase_id: purchaseId,
    name: item.name.trim(),
    quantity_milli: item.quantityMilli,
    unit_price_cents: item.unitPriceCents,
  };
  const query = isUpdate
    ? supabase.from("purchase_items").update({
        name: row.name,
        quantity_milli: row.quantity_milli,
        unit_price_cents: row.unit_price_cents,
      }).eq("id", item.id)
    : supabase.from("purchase_items").insert({ ...row, id: item.id });
  const { error } = await query;
  if (error) throw error;
}

export async function getSharedItemEditHistory(itemId) {
  const { data, error } = await supabase
    .from("purchase_item_edit_history")
    .select("id,edited_by_name,edited_at")
    .eq("purchase_item_id", itemId)
    .order("edited_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((entry) => ({
    id: entry.id,
    editedByName: entry.edited_by_name,
    editedAt: entry.edited_at,
  }));
}

export function subscribeToSharedItemEditHistory(itemId, onChange, onError) {
  const channel = supabase
    .channel("purchase-item-edit-history-" + itemId)
    .on("postgres_changes", {
      event: "INSERT", schema: "public", table: "purchase_item_edit_history",
      filter: "purchase_item_id=eq." + itemId,
    }, onChange)
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        onError?.(new Error("Não foi possível acompanhar o histórico em tempo real."));
      }
    });
  return () => { supabase.removeChannel(channel); };
}

export async function deleteSharedItem(itemId) {
  const { error } = await supabase.from("purchase_items").delete().eq("id", itemId);
  if (error) throw error;
}

export async function completeSharedPurchase(purchaseId) {
  const { data, error } = await supabase
    .from("purchases")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", purchaseId)
    .eq("status", "active")
    .select("id,status,created_at,completed_at")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Esta compra já foi finalizada em outro dispositivo.");
  return mapPurchase({ ...data, items: [] });
}

export async function getShoppingListItems() {
  const { data, error } = await supabase
    .from("shopping_list_items")
    .select("id,name,quantity_milli,unit_price_cents,added_by_name,created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    quantityMilli: item.quantity_milli,
    unitPriceCents: item.unit_price_cents,
    addedByName: item.added_by_name,
    createdAt: item.created_at,
  }));
}

export async function saveShoppingListItem(item) {
  const values = {
    name: item.name.trim(),
    quantity_milli: item.quantityMilli,
    unit_price_cents: item.unitPriceCents,
  };
  if (item.id) {
    const { data, error } = await supabase.rpc("update_planned_shopping_item", {
      p_item_id: item.id,
      p_name: values.name,
      p_quantity_milli: values.quantity_milli,
      p_unit_price_cents: values.unit_price_cents,
    });
    if (error) throw error;
    if (!data) throw new Error("Este item não está mais disponível para edição.");
    return;
  }
  const { error } = await supabase.from("shopping_list_items").insert(values);
  if (error) throw error;
}

export async function deleteShoppingListItem(itemId) {
  const { error } = await supabase.from("shopping_list_items").delete().eq("id", itemId);
  if (error) throw error;
}

export async function purchasePlannedShoppingItem(itemId, purchaseId, priceCents) {
  const { data, error } = await supabase.rpc("purchase_planned_shopping_item", {
    p_item_id: itemId,
    p_purchase_id: purchaseId,
    p_unit_price_cents: priceCents,
    p_buyer_name: null,
  });
  if (error) throw error;
  return data;
}

export async function saveSessionMemberName(name) {
  const normalizedName = typeof name === "string" ? name.trim() : "";
  if (!normalizedName || normalizedName.length > 50) {
    throw new Error("Informe um nome válido, com até 50 caracteres.");
  }
  const result = await invokeShoppingSession({ action: "set-name", name: normalizedName });
  if (result?.saved !== true) throw new Error("Não foi possível salvar seu nome na sessão.");
  return result;
}

export async function getSessionMembers() {
  const result = await invokeShoppingSession({ action: "members" });
  return Array.isArray(result.members) ? result.members : [];
}

export async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error("Não foi possível identificar este dispositivo.");
  return data.user.id;
}

export function subscribeToSessionActivity(sessionId, userId, name, onPresence, onTyping, onRosterChange, onChange, onError) {
  let active = true;
  let subscribed = false;
  let currentStatus = document.visibilityState === "visible" ? "online" : "inactive";
  let lastActivityAt = Date.now();
  let inactivityTimer = null;
  let typingTimer = null;
  let typing = false;
  let lastTypingField = "";
  let currentLocation = null;
  let trackRequested = false;
  let trackInProgress = false;
  let trackBlocked = false;

  const channel = supabase.channel(`session:${sessionId}`, {
    config: {
      private: true,
      presence: { key: `tab:${crypto.randomUUID()}` },
    },
  });

  const reportPresenceError = (error, fallbackMessage) => {
    const message = typeof error === "string"
      ? error
      : typeof error?.message === "string" && error.message.trim()
        ? error.message
        : fallbackMessage;
    onError?.(new Error(message));
  };

  const flushPresence = async () => {
    if (!active || !subscribed || trackInProgress || trackBlocked || !trackRequested) return;

    trackInProgress = true;
    try {
      while (active && subscribed && trackRequested) {
        trackRequested = false;
        const payload = {
          userId,
          name,
          status: currentStatus,
          lastActiveAt: new Date(lastActivityAt).toISOString(),
          location: currentLocation,
        };

        const result = await channel.track(payload);
        if (!active) return;
        if (result !== "ok") {
          trackRequested = true;
          trackBlocked = true;
          reportPresenceError(null, "Não foi possível atualizar sua presença. A conexão será sincronizada novamente.");
          break;
        }
      }
    } catch (trackError) {
      trackRequested = true;
      trackBlocked = true;
      if (active) reportPresenceError(trackError, "Não foi possível atualizar sua presença.");
    } finally {
      trackInProgress = false;
      if (active && subscribed && trackRequested && !trackBlocked) {
        queueMicrotask(() => { void flushPresence(); });
      }
    }
  };

  const requestPresenceUpdate = () => {
    if (!active) return;
    trackRequested = true;
    trackBlocked = false;
    if (subscribed) void flushPresence();
  };

  const trackStatus = (status, force = false) => {
    if (!active || (!force && status === currentStatus)) return;
    currentStatus = status;
    requestPresenceUpdate();
  };

  const setLocation = (location) => {
    if (!active) return;
    currentLocation = location;
    requestPresenceUpdate();
  };

  const stopTyping = () => {
    if (!typing) return;
    typing = false;
    if (typingTimer) clearTimeout(typingTimer);
    typingTimer = null;
    channel.send({
      type: "broadcast",
      event: "typing",
      payload: { userId, name, typing: false, field: lastTypingField },
    }).catch(() => {});
  };

  const sendTyping = (field) => {
    if (!active || document.visibilityState !== "visible") return;
    const fieldChanged = field !== lastTypingField;
    lastTypingField = field;
    if (!typing || fieldChanged) {
      typing = true;
      channel.send({
        type: "broadcast",
        event: "typing",
        payload: { userId, name, typing: true, field },
      }).catch(() => {});
    }
    if (typingTimer) clearTimeout(typingTimer);
    typingTimer = setTimeout(stopTyping, 1800);
  };

  const scheduleInactivity = () => {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      trackStatus("inactive");
      stopTyping();
    }, 120_000);
  };

  const recordActivity = () => {
    if (!active || document.visibilityState !== "visible") return;
    lastActivityAt = Date.now();
    trackStatus("online");
    scheduleInactivity();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState !== "visible") {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      trackStatus("inactive");
      stopTyping();
      return;
    }
    recordActivity();
  };

  const handleInput = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const isTextField = target.matches("input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, [contenteditable=true]");
    if (!isTextField) return;
    recordActivity();
    const field = target.getAttribute("aria-label")
      || target.getAttribute("placeholder")
      || target.closest("label")?.textContent?.trim()
      || "um campo";
    sendTyping(field.slice(0, 60));
  };

  const handleInteraction = () => recordActivity();
  const handlePointerMove = () => {
    if (Date.now() - lastActivityAt >= 5_000) recordActivity();
  };
  document.addEventListener("visibilitychange", handleVisibilityChange);
  document.addEventListener("pointerdown", handleInteraction, { passive: true });
  document.addEventListener("pointermove", handlePointerMove, { passive: true });
  document.addEventListener("keydown", handleInteraction);
  document.addEventListener("scroll", handleInteraction, { passive: true, capture: true });
  document.addEventListener("input", handleInput, true);
  document.addEventListener("touchstart", handleInteraction, { passive: true });

  channel
    .on("postgres_changes", { event: "*", schema: "public", table: "purchases" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "purchase_items" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "shopping_list_items" }, onChange)
    .on("presence", { event: "sync" }, () => {
      if (!active) return;
      onPresence?.(channel.presenceState());
      onRosterChange?.();
    })
    .on("presence", { event: "join" }, () => { if (active) onRosterChange?.(); })
    .on("presence", { event: "leave" }, () => { if (active) onRosterChange?.(); })
    .on("broadcast", { event: "typing" }, ({ payload }) => {
      if (payload?.userId && payload.userId !== userId) onTyping?.(payload);
    })
    .subscribe((status, error) => {
      if (!active) return;
      if (status === "SUBSCRIBED") {
        subscribed = true;
        trackBlocked = false;
        lastActivityAt = Date.now();
        currentStatus = document.visibilityState === "visible" ? "online" : "inactive";
        requestPresenceUpdate();
        scheduleInactivity();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        subscribed = false;
        reportPresenceError(
          error,
          `A conexão de presença foi interrompida (${status}).`,
        );
      }
    });

  scheduleInactivity();

  const cleanup = () => {
    active = false;
    subscribed = false;
    trackRequested = false;
    if (inactivityTimer) clearTimeout(inactivityTimer);
    if (typingTimer) clearTimeout(typingTimer);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    document.removeEventListener("pointerdown", handleInteraction);
    document.removeEventListener("pointermove", handlePointerMove);
    document.removeEventListener("keydown", handleInteraction);
    document.removeEventListener("scroll", handleInteraction, true);
    document.removeEventListener("input", handleInput, true);
    document.removeEventListener("touchstart", handleInteraction);
    channel.untrack().catch(() => {});
    supabase.removeChannel(channel);
  };

  cleanup.setLocation = setLocation;
  return cleanup;
}
