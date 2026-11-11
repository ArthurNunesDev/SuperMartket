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
  const headers = getCorsHeaders(request);
  const respond = (payload: Record<string, unknown>, status = 200) => jsonResponse(payload, status, headers);
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return respond({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const familyPin = Deno.env.get("FAMILY_PIN");
  const fingerprintSecret = Deno.env.get("FAMILY_RATE_LIMIT_SECRET");

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !familyPin || !fingerprintSecret) {
    return respond({ error: "Family access is not configured." }, 503);
  }
  if (!/^\d{6}$/.test(familyPin) || fingerprintSecret.length < 32) {
    return respond({ error: "Family access configuration is invalid." }, 503);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return respond({ error: "Authentication required." }, 401);

  const token = authorization.slice("Bearer ".length);
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user || authData.user.is_anonymous !== true) {
    return respond({ error: "A valid anonymous device session is required." }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const userId = authData.user.id;

  let payload: { pin?: unknown; checkOnly?: unknown; lock?: unknown };
  try {
    payload = await request.json();
  } catch {
    return respond({ error: "Invalid request body." }, 400);
  }

  if (payload.lock === true) {
    const { error: revokeError } = await admin.rpc("revoke_family_device", {
      p_user_id: userId,
    });
    if (revokeError) return respond({ error: "Could not lock device access." }, 500);
    return respond({ locked: true });
  }

  if (payload.checkOnly === true) return respond({ authorized: false });

  const submittedPin = typeof payload.pin === "string" ? payload.pin : "";
  if (!/^\d{6}$/.test(submittedPin)) return respond({ error: "Informe um PIN de seis dígitos." }, 400);

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
  if (rateLimitError) return respond({ error: "Could not validate access attempts." }, 500);
  if (allowed !== true) return respond({ error: "Muitas tentativas. Aguarde 15 minutos para tentar novamente." }, 429);

  if (!constantTimeEqual(submittedPin, familyPin)) {
    const { data: recorded, error: recordError } = await admin.rpc("check_family_pin_attempt", {
      p_device_fingerprint: deviceFingerprint,
      p_ip_fingerprint: ipFingerprint,
      p_failed: true,
    });
    if (recordError) return respond({ error: "Could not record access attempt." }, 500);
    if (recorded !== true) return respond({ error: "Muitas tentativas. Aguarde 15 minutos para tentar novamente." }, 429);
    return respond({ error: "PIN incorreto." }, 401);
  }

  const { error: authorizeError } = await admin.rpc("authorize_family_device", { p_user_id: userId });
  if (authorizeError) return respond({ error: "Não foi possível autorizar este dispositivo." }, 500);
  return respond({ authorized: true, alreadyAuthorized: false });
});
