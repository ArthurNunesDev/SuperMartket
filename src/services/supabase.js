import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wdbjxmwotgmotbznmzlc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_lGezLpOwLXct0o55cX36xw_G46IsO7C";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export async function ensureDeviceSession() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (sessionData.session) return sessionData.session;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!data.session) throw new Error("Não foi possível criar uma sessão neste dispositivo.");
  return data.session;
}

async function invokeFamilyAccess(body) {
  const { data, error } = await supabase.functions.invoke("family-access", { body });
  if (error) {
    let message = "Não foi possível validar o acesso familiar.";
    try {
      const response = error.context;
      const payload = response instanceof Response ? await response.clone().json() : null;
      if (payload?.error) message = payload.error;
    } catch {
      // Keep the generic message when the function response is unavailable.
    }
    const accessError = new Error(message);
    accessError.status = error.context?.status;
    throw accessError;
  }
  return data;
}

export async function checkDeviceAuthorization() {
  const result = await invokeFamilyAccess({ checkOnly: true });
  return result.authorized === true;
}

export async function authorizeWithFamilyPin(pin) {
  const result = await invokeFamilyAccess({ pin });
  if (result.authorized !== true) throw new Error("Não foi possível autorizar este dispositivo.");
  return true;
}

function mapPurchase(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    status: row.status,
    items: (row.items ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      quantityMilli: item.quantity_milli,
      unit: "un",
      unitPriceCents: item.unit_price_cents,
      addedByName: item.added_by_name,
    })),
  };
}

export async function getSharedPurchases() {
  const { data, error } = await supabase
    .from("purchases")
    .select("id,status,created_at,completed_at,items:purchase_items(id,name,quantity_milli,unit_price_cents,added_by_name,created_at)")
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

  if (!error) return { ...mapPurchase({ ...data, items: [] }) };

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

export async function saveSharedItem(purchaseId, item, addedByName) {
  const row = {
    id: item.id,
    purchase_id: purchaseId,
    name: item.name.trim(),
    quantity_milli: item.quantityMilli,
    unit_price_cents: item.unitPriceCents,
    added_by_name: addedByName,
  };

  const query = item.id
    ? supabase.from("purchase_items").update({
        name: row.name,
        quantity_milli: row.quantity_milli,
        unit_price_cents: row.unit_price_cents,
      }).eq("id", item.id)
    : supabase.from("purchase_items").insert(row);

  const { error } = await query;
  if (error) throw error;
}

export async function deleteSharedItem(itemId) {
  const { error } = await supabase.from("purchase_items").delete().eq("id", itemId);
  if (error) throw error;
}

export async function completeSharedPurchase(purchaseId) {
  const completedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("purchases")
    .update({ status: "completed", completed_at: completedAt })
    .eq("id", purchaseId)
    .eq("status", "active")
    .select("id,status,created_at,completed_at")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Esta compra já foi finalizada em outro dispositivo.");
  return mapPurchase({ ...data, items: [] });
}

export function subscribeToSharedPurchases(onChange, onError) {
  const channel = supabase
    .channel("shared-family-shopping")
    .on("postgres_changes", { event: "*", schema: "public", table: "purchases" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "purchase_items" }, onChange)
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        onError?.(new Error("A conexão em tempo real foi interrompida."));
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
