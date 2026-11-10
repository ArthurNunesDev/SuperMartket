import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hmacFingerprint(secret: string, value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const familyPin = Deno.env.get("FAMILY_PIN");
  const fingerprintSecret = Deno.env.get("FAMILY_RATE_LIMIT_SECRET");

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !familyPin || !fingerprintSecret) {
    return jsonResponse({ error: "Family access is not configured." }, 503);
  }
  if (!/^\d{6}$/.test(familyPin) || fingerprintSecret.length < 32) {
    return jsonResponse({ error: "Family access configuration is invalid." }, 503);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return jsonResponse({ error: "Authentication required." }, 401);

  const token = authorization.slice("Bearer ".length);
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user || authData.user.is_anonymous !== true) {
    return jsonResponse({ error: "A valid anonymous device session is required." }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const userId = authData.user.id;
  const { data: alreadyAuthorized, error: authorizationError } = await admin.rpc(
    "family_device_is_authorized", { p_user_id: userId },
  );
  if (authorizationError) return jsonResponse({ error: "Could not verify device authorization." }, 500);
  if (alreadyAuthorized === true) return jsonResponse({ authorized: true, alreadyAuthorized: true });

  let payload: { pin?: unknown; checkOnly?: unknown };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }
  if (payload.checkOnly === true) return jsonResponse({ authorized: false });

  const submittedPin = typeof payload.pin === "string" ? payload.pin : "";
  if (!/^\d{6}$/.test(submittedPin)) return jsonResponse({ error: "Informe um PIN de seis dígitos." }, 400);

  const deviceFingerprint = await hmacFingerprint(fingerprintSecret, `device:${userId}`);
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientIp = request.headers.get("cf-connecting-ip") ?? forwardedFor ?? "unknown";
  const ipFingerprint = await hmacFingerprint(
    fingerprintSecret,
    clientIp === "unknown" ? `fallback:${userId}` : `ip:${clientIp}`,
  );

  const { data: allowed, error: rateLimitError } = await admin.rpc("check_family_pin_attempt", {
    p_device_fingerprint: deviceFingerprint,
    p_ip_fingerprint: ipFingerprint,
    p_failed: false,
  });
  if (rateLimitError) return jsonResponse({ error: "Could not validate access attempts." }, 500);
  if (allowed !== true) return jsonResponse({ error: "Muitas tentativas. Aguarde 15 minutos para tentar novamente." }, 429);

  if (!constantTimeEqual(submittedPin, familyPin)) {
    const { data: recorded, error: recordError } = await admin.rpc("check_family_pin_attempt", {
      p_device_fingerprint: deviceFingerprint,
      p_ip_fingerprint: ipFingerprint,
      p_failed: true,
    });
    if (recordError) return jsonResponse({ error: "Could not record access attempt." }, 500);
    if (recorded !== true) return jsonResponse({ error: "Muitas tentativas. Aguarde 15 minutos para tentar novamente." }, 429);
    return jsonResponse({ error: "PIN incorreto." }, 401);
  }

  const { error: authorizeError } = await admin.rpc("authorize_family_device", { p_user_id: userId });
  if (authorizeError) return jsonResponse({ error: "Não foi possível autorizar este dispositivo." }, 500);
  return jsonResponse({ authorized: true, alreadyAuthorized: false });
});
