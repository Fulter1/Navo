/* Navo Cloud Config
   1) Create a Supabase project
   2) Run SUPABASE_SETUP.sql
   3) Paste Project URL + anon public key below
*/
window.NAVO_CLOUD = {
  supabaseUrl: "https://bsmivunyjbkowlgjwqyt.supabase.co",
  supabaseAnonKey: "sb_publishable_C9VWCoS0uF4v3Ujd5kB8kw_23SYEdZa"
};

window.NAVO_CONFIG = window.NAVO_CONFIG || {
  SUPABASE_URL: window.NAVO_CLOUD.supabaseUrl,
  SUPABASE_ANON_KEY: window.NAVO_CLOUD.supabaseAnonKey
};
