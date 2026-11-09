export function makeSupabaseJwt(role: "anon" | "service_role"): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iss: "supabase", role }),
  ).toString("base64url");
  return `${header}.${payload}.fixture_signature`;
}
