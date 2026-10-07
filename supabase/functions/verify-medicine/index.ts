import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type VerificationResult =
  | { status: "verified"; batch: { batch_number: string; expiry_date: string | null; medicine: { name: string; manufacturer: string | null } | null } }
  | { status: "invalid" | "expired" | "not_found" | "rate_limited"; message: string };

function jsonResponse(body: VerificationResult | { error: string }, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashClientIp(ip: string, secret: string) {
  const bytes = new TextEncoder().encode(`${secret}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Verification is temporarily unavailable." }, 503);
  }

  let input: { code?: unknown };
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: "Enter a valid QR code." }, 400);
  }

  if (typeof input.code !== "string" || !input.code.trim() || input.code.trim().length > 128) {
    return jsonResponse({ error: "Enter a valid QR code." }, 400);
  }
  const code = input.code.trim();

  const clientIp =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!clientIp) {
    return jsonResponse({ error: "Verification is temporarily unavailable." }, 503);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const clientHash = await hashClientIp(clientIp, serviceRoleKey);
  const { data: allowed, error: rateLimitError } = await admin.rpc(
    "consume_verification_attempt",
    { p_client_hash: clientHash },
  );
  if (rateLimitError || allowed === null) {
    return jsonResponse({ error: "Verification is temporarily unavailable." }, 503);
  }
  if (!allowed) {
    return jsonResponse({
      status: "rate_limited",
      message: "Too many attempts. Wait a minute and try again.",
    }, 429);
  }

  let userId: string | null = null;
  const authorization = request.headers.get("Authorization");
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (authorization && publicKey) {
    const authClient = createClient(supabaseUrl, publicKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data } = await authClient.auth.getUser();
    userId = data.user?.id ?? null;
  }

  const { data: batch, error: batchError } = await admin
    .from("medicine_batches")
    .select("medicine_id, batch_number, expiry_date, is_valid")
    .eq("qr_code", code)
    .maybeSingle();

  if (batchError) {
    return jsonResponse({ error: "Verification is temporarily unavailable." }, 503);
  }

  const recordLog = async (result: string) => {
    await admin.from("verification_logs").insert({
      qr_code: code,
      user_id: userId,
      result,
    });
  };

  if (!batch) {
    await recordLog("invalid");
    return jsonResponse({
      status: "not_found",
      message: "No registered batch matches this code. Check with the manufacturer or a pharmacist before use.",
    });
  }

  if (!batch.is_valid) {
    await recordLog("invalid");
    return jsonResponse({
      status: "invalid",
      message: "This batch has been flagged as invalid. Contact the manufacturer or a pharmacist.",
    });
  }

  if (batch.expiry_date && batch.expiry_date < new Date().toISOString().slice(0, 10)) {
    await recordLog("expired");
    return jsonResponse({
      status: "expired",
      message: "The registered batch is past its listed expiry date.",
    });
  }

  const { data: medicine, error: medicineError } = await admin
    .from("medicines")
    .select("name, manufacturer")
    .eq("id", batch.medicine_id)
    .maybeSingle();
  if (medicineError) {
    return jsonResponse({ error: "Verification is temporarily unavailable." }, 503);
  }

  await recordLog("authentic");
  return jsonResponse({
    status: "verified",
    batch: {
      batch_number: batch.batch_number,
      expiry_date: batch.expiry_date,
      medicine,
    },
  });
});
