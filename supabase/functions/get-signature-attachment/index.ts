import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  let token: unknown;
  try {
    ({ token } = await request.json());
  } catch {
    return json({ error: "Solicitação inválida." }, 400);
  }
  if (typeof token !== "string" || !/^[a-f0-9]{48}$/.test(token)) {
    return json({ error: "Link de assinatura inválido." }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Serviço de anexo indisponível." }, 503);

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: access, error: accessError } = await admin.rpc(
    "get_signature_attachment_by_token",
    { p_token: token },
  );
  if (accessError || !access || typeof access.owner_id !== "string" || typeof access.object_path !== "string") {
    return json({ error: "Anexo indisponível para este link." }, 404);
  }

  const ownerId = access.owner_id as string;
  const objectPath = access.object_path as string;
  if (!objectPath.startsWith(`${ownerId}/contratos/`) || objectPath.includes("..")) {
    return json({ error: "Anexo indisponível para este link." }, 404);
  }

  const { data: file, error: fileError } = await admin
    .from("gm_files")
    .select("original_name, content_type")
    .eq("user_id", ownerId)
    .eq("bucket_id", "growmoney-files")
    .eq("object_path", objectPath)
    .maybeSingle();
  if (fileError || !file) return json({ error: "Arquivo do documento não encontrado." }, 404);

  const { data: signed, error: signedError } = await admin.storage
    .from("growmoney-files")
    .createSignedUrl(objectPath, 15 * 60);
  if (signedError || !signed?.signedUrl) {
    return json({ error: "Não foi possível abrir o anexo agora. Tente novamente." }, 503);
  }

  return json({
    url: signed.signedUrl,
    name: file.original_name,
    contentType: file.content_type,
    expiresIn: 15 * 60,
  });
});
