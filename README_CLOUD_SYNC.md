/* Navo Cloud Config
   1) Create a Supabase project
   2) Run the SQL in SUPABASE_SETUP.sql
   3) Paste Project URL + anon public key below
*/
window.NAVO_CLOUD = {
  // Example: https://xxxxx.supabase.co  (without /rest/v1)
  supabaseUrl: "",
  // Use the public publishable/anon key only. Never paste a secret key here.
  supabaseAnonKey: ""
};

// Backward-compatible alias if you followed older instructions.
window.NAVO_CONFIG = window.NAVO_CONFIG || {
  SUPABASE_URL: window.NAVO_CLOUD.supabaseUrl,
  SUPABASE_ANON_KEY: window.NAVO_CLOUD.supabaseAnonKey
};
