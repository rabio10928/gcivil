// يتطلب تحميل مكتبة supabase-js و js/config.js قبله (انظر README).
(() => {
  const c = window.APP_CONFIG;
  if (!window.supabase || !c || c.SUPABASE_URL.includes('YOUR-')) {
    console.error('Supabase غير مهيأ: عدّل js/config.js وتأكد من تحميل supabase-js.');
    return;
  }
  const sb = window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
  const ok = ({ data, error }) => { if (error) throw error; return data; };
  window.sb = sb;
  window.api = {
    session: async () => (await sb.auth.getSession()).data.session,
    access: async () => ok(await sb.rpc('my_access')),
    yearStats: async () => ok(await sb.rpc('year_stats')),
    signedUrl: async (bucket, path, secs = 3600) => (ok(await sb.storage.from(bucket).createSignedUrl(path, secs))).signedUrl,
    // ملفات HTML تُحمَّل كنص لتُعرض داخل iframe srcdoc مع sandbox (المرحلة 5)
    downloadText: async (bucket, path) => ok(await sb.storage.from(bucket).download(path)).text()
  };
})();
