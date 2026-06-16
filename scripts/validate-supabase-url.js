const u = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const count = (u.match(/supabase\.co/gi) || []).length;
const valid =
  !!u && count === 1 && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(u);

if (!valid) {
  console.error("Invalid NEXT_PUBLIC_SUPABASE_URL at build:", u);
  process.exit(1);
}

console.log("NEXT_PUBLIC_SUPABASE_URL validated:", u);
