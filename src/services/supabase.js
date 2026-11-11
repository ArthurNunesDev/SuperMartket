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
    try {
      const response = error.context;
      const payload = response instanceof Response ? await response.clone().json() : null;
      if (payload?.error) message = payload.error;
    } catch {
      // Keep a safe generic error if the response cannot be parsed.
    }
    const sessionError = new Error(message);
    sessionError.status = error.context?.status;
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

export async function saveSharedItem(purchaseId, item, addedByName, isUpdate = false) {
  const row = {
    purchase_id: purchaseId,
    name: item.name.trim(),
    quantity_milli: item.quantityMilli,
    unit_price_cents: item.unitPriceCents,
    added_by_name: addedByName,
  };
  const query = isUpdate
    ? supabase.from("purchase_items").update({
        name: row.name,
        quantity_milli: row.quantity_milli,
        unit_price_cents: row.unit_price_cents,
        edited_by_name: item.editedByName,
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

export async function saveShoppingListItem(item, addedByName) {
  const values = {
    name: item.name.trim(),
    quantity_milli: item.quantityMilli,
    unit_price_cents: item.unitPriceCents,
  };
  const query = item.id
    ? supabase.from("shopping_list_items").update(values).eq("id", item.id).eq("status", "pending")
    : supabase.from("shopping_list_items").insert({ ...values, added_by_name: addedByName });
  const { data, error } = await query.select("id").maybeSingle();
  if (error) throw error;
  if (item.id && !data) throw new Error("Este item não está mais disponível para edição.");
}

export async function deleteShoppingListItem(itemId) {
  const { error } = await supabase.from("shopping_list_items").delete().eq("id", itemId);
  if (error) throw error;
}

export async function purchasePlannedShoppingItem(itemId, purchaseId, priceCents, buyerName) {
  const { data, error } = await supabase.rpc("purchase_planned_shopping_item", {
    p_item_id: itemId,
    p_purchase_id: purchaseId,
    p_unit_price_cents: priceCents,
    p_buyer_name: buyerName,
  });
  if (error) throw error;
  return data;
}

export function subscribeToSharedPurchases(onChange, onError) {
  const channel = supabase
    .channel("shared-shopping-session")
    .on("postgres_changes", { event: "*", schema: "public", table: "purchases" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "purchase_items" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "shopping_list_items" }, onChange)
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        onError?.(new Error("A conexão em tempo real foi interrompida."));
      }
    });
  return () => { supabase.removeChannel(channel); };
}
