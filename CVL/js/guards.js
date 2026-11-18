// حراس الصفحات: تحسين لتجربة المستخدم فقط. الحماية الفعلية في RLS داخل Supabase.
window.guards = (() => {
  const here = () => location.pathname.split('/').pop() + location.search;
  const stop = () => new Promise(() => {});
  async function requireAuth() {
    const s = await api.session();
    if (s) return s;
    location.replace('login.html?next=' + encodeURIComponent(here()));
    return stop();
  }
  async function requireGuest() { if (await api.session()) location.replace('student-dashboard.html'); }
  async function requireAdmin() {
    await requireAuth();
    const a = await api.access();
    if (!a.is_admin) { location.replace('student-dashboard.html'); return stop(); }
    return a;
  }
  return { requireAuth, requireGuest, requireAdmin };
})();
