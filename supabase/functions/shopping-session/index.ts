import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://arthurnunesdev.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function getCorsHeaders(request: Request) {
  const origin = request.headers.get("Origin");
  return {
    ...(origin && ALLOWED_ORIGINS.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonResponse(body: Record<string, unknown>, status = 200, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
const PIN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

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
  const headers = getCorsHeaders(request);
  const respond = (payload: Record<string, unknown>, status = 200) => jsonResponse(payload, status, headers);
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return respond({ error: "Method not allowed." }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return respond({ error: "O serviço de sessões não está configurado." }, 503);
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return respond({ error: "Autenticação necessária." }, 401);
  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(authorization.slice(7));
  if (authError || !authData.user || authData.user.is_anonymous !== true) return respond({ error: "Sessão anônima inválida neste dispositivo." }, 401);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const userId = authData.user.id;
  let payload: { action?: unknown; pin?: unknown; confirmEnd?: unknown; name?: unknown };
  try { payload = await request.json(); } catch { return respond({ error: "Requisição inválida." }, 400); }
  const action = typeof payload.action === "string" ? payload.action : "";
  if (!["create", "join", "check", "leave", "set-name", "members"].includes(action)) return respond({ error: "Operação de sessão inválida." }, 400);

  if (action === "check") {
    const { data, error } = await admin.rpc("check_shopping_session", { p_user_id: userId });
    if (error) return respond({ error: "Não foi possível verificar sua sessão." }, 500);
    const session = Array.isArray(data) ? data[0] : null;
    return respond({ authorized: Boolean(session), session: session ? { id: session.session_id, pin: session.pin, memberCount: Number(session.member_count) } : null });
  }
  if (action === "set-name") {
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    if (!name || name.length > 50) return respond({ error: "Informe um nome válido, com até 50 caracteres." }, 400);
    const { data, error } = await admin.rpc("set_shopping_session_member_name", {
      p_user_id: userId,
      p_display_name: name,
    });
    if (error) {
      const message = errorMessage(error);
      if (message.includes("DUPLICATE_MEMBER_NAME") || (error as { code?: string }).code === "23505") {
        return respond({
          error: "Esse nome já está sendo usado por outra pessoa nesta sessão. Escolha outro nome.",
          code: "DUPLICATE_MEMBER_NAME",
        }, 409);
      }
      return respond({ error: message.includes("DEVICE_NOT_IN_SESSION")
        ? "Este dispositivo não está em uma sessão ativa."
        : "Não foi possível salvar seu nome na sessão." }, 409);
    }
    return respond({ saved: data === true });
  }

  if (action === "members") {
    const { data, error } = await admin.rpc("list_shopping_session_members", { p_user_id: userId });
    if (error) return respond({ error: "Não foi possível carregar os participantes da sessão." }, 500);
    const members = Array.isArray(data) ? data.map((member) => ({
      userId: member.user_id,
      name: member.display_name || "Participante sem nome",
      joinedAt: member.joined_at,
    })) : [];
    return respond({ members });
  }

  if (action === "leave") {
    const { data, error } = await admin.rpc("leave_shopping_session", { p_user_id: userId, p_confirm_end: payload.confirmEnd === true });
    if (error) return respond({ error: errorMessage(error).includes("DEVICE_NOT_IN_SESSION") ? "Este dispositivo não está em uma sessão ativa." : "Não foi possível sair da sessão. Tente novamente." }, 409);
    return respond(data as Record<string, unknown>);
  }
  if (action === "create") {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      let pin: string;
      try { pin = generatePin(); } catch { return respond({ error: "Não foi possível gerar um PIN. Tente novamente." }, 503); }
      const { data, error } = await admin.rpc("create_shopping_session", { p_user_id: userId, p_pin: pin });
      if (!error) return respond({ authorized: true, created: true, session: { id: data, pin, memberCount: 1 } });
      const message = errorMessage(error);
      if (message.includes("DEVICE_ALREADY_IN_SESSION")) return respond({ error: "Este dispositivo já participa de uma sessão." }, 409);
      if (message.includes("duplicate key") || (error as { code?: string }).code === "23505") continue;
      return respond({ error: "Não foi possível criar a sessão. Tente novamente." }, 500);
    }
    return respond({ error: "Não foi possível gerar um PIN exclusivo. Tente novamente." }, 503);
  }

  const pin = typeof payload.pin === "string" ? payload.pin.trim().toUpperCase() : "";
  if (!/^[A-Z0-9]{8}$/.test(pin) || !/[A-Z]/.test(pin) || !/[0-9]/.test(pin)) return respond({ error: "Informe um PIN válido de 8 letras e números." }, 400);
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = request.headers.get("cf-connecting-ip")?.trim() || forwarded || "unknown";
  const deviceFingerprint = await hmacFingerprint(serviceKey, "device:" + userId);
  const ipFingerprint = await hmacFingerprint(serviceKey, ip === "unknown" ? "fallback:" + userId : "ip:" + ip);
  const rateArgs = { p_device_fingerprint: deviceFingerprint, p_ip_fingerprint: ipFingerprint };
  const { data: allowed, error: rateError } = await admin.rpc("check_shopping_session_pin_attempt", { ...rateArgs, p_failed: false });
  if (rateError) return respond({ error: "Não foi possível validar a tentativa." }, 500);
  if (allowed !== true) return respond({ error: "Muitas tentativas. Aguarde 15 minutos." }, 429);
  const { data, error } = await admin.rpc("join_shopping_session", { p_user_id: userId, p_pin: pin });
  if (error) {
    const message = errorMessage(error);
    if (message.includes("DEVICE_ALREADY_IN_SESSION")) return respond({ error: "Este dispositivo já participa de uma sessão." }, 409);
    if (message.includes("SESSION_NOT_FOUND")) {
      const { data: recorded, error: recordError } = await admin.rpc("check_shopping_session_pin_attempt", {
        ...rateArgs,
        p_failed: true,
      });
      if (recordError) return respond({ error: "Não foi possível registrar a tentativa." }, 500);
      if (recorded !== true) return respond({ error: "Muitas tentativas. Aguarde 15 minutos." }, 429);
      return respond({ error: "PIN não encontrado ou sessão encerrada." }, 404);
    }
    return respond({ error: "Não foi possível entrar na sessão." }, 500);
  }
  const { data: sessionData, error: sessionError } = await admin.rpc("check_shopping_session", { p_user_id: userId });
  if (sessionError) return respond({ error: "Sessão acessada, mas não foi possível carregar seus dados." }, 500);
  const session = Array.isArray(sessionData) ? sessionData[0] : null;
  return respond({ authorized: true, created: false, session: { id: data, pin: session?.pin ?? pin, memberCount: Number(session?.member_count ?? 1) } });
});