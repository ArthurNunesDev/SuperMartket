import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const PIN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function generatePin(): string {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const pin = Array.from(bytes, (byte) => PIN_ALPHABET[byte % PIN_ALPHABET.length]).join("");
    if (/[A-Z]/.test(pin) && /[0-9]/.test(pin)) return pin;
  }
  throw new Error("Could not generate a valid session PIN.");
}
async function hmacFingerprint(secret: string, value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function errorMessage(error: unknown): string {
  return error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : "";
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return jsonResponse({ error: "O serviço de sessões não está configurado." }, 503);
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return jsonResponse({ error: "Autenticação necessária." }, 401);
  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(authorization.slice(7));
  if (authError || !authData.user || authData.user.is_anonymous !== true) return jsonResponse({ error: "Sessão anônima inválida neste dispositivo." }, 401);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const userId = authData.user.id;
  let payload: { action?: unknown; pin?: unknown; confirmEnd?: unknown };
  try { payload = await request.json(); } catch { return jsonResponse({ error: "Requisição inválida." }, 400); }
  const action = typeof payload.action === "string" ? payload.action : "";
  if (!["create", "join", "check", "leave"].includes(action)) return jsonResponse({ error: "Operação de sessão inválida." }, 400);

  if (action === "check") {
    const { data, error } = await admin.rpc("check_shopping_session", { p_user_id: userId });
    if (error) return jsonResponse({ error: "Não foi possível verificar sua sessão." }, 500);
    const session = Array.isArray(data) ? data[0] : null;
    return jsonResponse({ authorized: Boolean(session), session: session ? { id: session.session_id, pin: session.pin, memberCount: Number(session.member_count) } : null });
  }
  if (action === "leave") {
    const { data, error } = await admin.rpc("leave_shopping_session", { p_user_id: userId, p_confirm_end: payload.confirmEnd === true });
    if (error) return jsonResponse({ error: errorMessage(error).includes("DEVICE_NOT_IN_SESSION") ? "Este dispositivo não está em uma sessão ativa." : "Não foi possível sair da sessão. Tente novamente." }, 409);
    return jsonResponse(data as Record<string, unknown>);
  }
  if (action === "create") {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      let pin: string;
      try { pin = generatePin(); } catch { return jsonResponse({ error: "Não foi possível gerar um PIN. Tente novamente." }, 503); }
      const { data, error } = await admin.rpc("create_shopping_session", { p_user_id: userId, p_pin: pin });
      if (!error) return jsonResponse({ authorized: true, created: true, session: { id: data, pin, memberCount: 1 } });
      const message = errorMessage(error);
      if (message.includes("DEVICE_ALREADY_IN_SESSION")) return jsonResponse({ error: "Este dispositivo já participa de uma sessão." }, 409);
      if (message.includes("duplicate key") || (error as { code?: string }).code === "23505") continue;
      return jsonResponse({ error: "Não foi possível criar a sessão. Tente novamente." }, 500);
    }
    return jsonResponse({ error: "Não foi possível gerar um PIN exclusivo. Tente novamente." }, 503);
  }

  const pin = typeof payload.pin === "string" ? payload.pin.trim().toUpperCase() : "";
  if (!/^[A-Z0-9]{8}$/.test(pin) || !/[A-Z]/.test(pin) || !/[0-9]/.test(pin)) return jsonResponse({ error: "Informe um PIN válido de 8 letras e números." }, 400);
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = request.headers.get("cf-connecting-ip")?.trim() || forwarded || "unknown";
  const deviceFingerprint = await hmacFingerprint(serviceKey, "device:" + userId);
  const ipFingerprint = await hmacFingerprint(serviceKey, ip === "unknown" ? "fallback:" + userId : "ip:" + ip);
  const rateArgs = { p_device_fingerprint: deviceFingerprint, p_ip_fingerprint: ipFingerprint };
  const { data: allowed, error: rateError } = await admin.rpc("check_shopping_session_pin_attempt", { ...rateArgs, p_failed: true });
  if (rateError) return jsonResponse({ error: "Não foi possível validar a tentativa." }, 500);
  if (allowed !== true) return jsonResponse({ error: "Muitas tentativas. Aguarde 15 minutos." }, 429);
  const { data, error } = await admin.rpc("join_shopping_session", { p_user_id: userId, p_pin: pin });
  if (error) {
    const message = errorMessage(error);
    if (message.includes("DEVICE_ALREADY_IN_SESSION")) return jsonResponse({ error: "Este dispositivo já participa de uma sessão." }, 409);
    if (message.includes("SESSION_NOT_FOUND")) {
      return jsonResponse({ error: "PIN não encontrado ou sessão encerrada." }, 404);
    }
    return jsonResponse({ error: "Não foi possível entrar na sessão." }, 500);
  }
  const { data: sessionData, error: sessionError } = await admin.rpc("check_shopping_session", { p_user_id: userId });
  if (sessionError) return jsonResponse({ error: "Sessão acessada, mas não foi possível carregar seus dados." }, 500);
  const session = Array.isArray(sessionData) ? sessionData[0] : null;
  return jsonResponse({ authorized: true, created: false, session: { id: data, pin: session?.pin ?? pin, memberCount: Number(session?.member_count ?? 1) } });
});