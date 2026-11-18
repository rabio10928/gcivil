const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const ROOT = process.env.ROOT || require('path').join(__dirname, '..') + '/';
const R = [], ERRS = [];
const ok = (n, c, i) => R.push([n, !!c, c ? '' : (i || '')]);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ids = 0;
const FUT = new Date(Date.now() + 5 * 86400000).toISOString();
const LID = '40000000-0000-0000-0000-000000000001';
const ACCESS = { has_access: true, is_admin: false, reason: 'trial', trial_ends_at: FUT, subscription_ends_at: null };
const base = () => ({
  profiles: [{ id: 'u1', full_name: 'أحمد', role: 'student', avatar_path: null, trial_ends_at: FUT, created_at: '2026-01-01T00:00:00Z' }],
  academic_years: [{ id: 'y1', title: 'السنة الأولى', description: 'وصف السنة', sort_order: 0, is_published: true, created_at: '2026-01-01' }],
  domains: [{ id: 'd1', year_id: 'y1', title: 'مجال البناء', sort_order: 0, is_published: true, created_at: '2026-01-01' }],
  units: [{ id: 'un1', domain_id: 'd1', title: 'الوحدة الأولى', sort_order: 0, is_published: true, created_at: '2026-01-01' }],
  lessons: [{ id: LID, unit_id: 'un1', title: 'درس الخرسانة', description: 'وصف', sort_order: 0, status: 'published', cover_path: null, created_at: '2026-01-02' }],
  lesson_contents: [
    { id: 'c1', lesson_id: LID, type: 'html', sort_order: 1, storage_path: LID + '/a.html', external_url: null, downloadable: false },
    { id: 'c2', lesson_id: LID, type: 'video', sort_order: 2, storage_path: LID + '/v.mp4', external_url: null, downloadable: false },
    { id: 'c3', lesson_id: LID, type: 'pdf', sort_order: 3, storage_path: LID + '/p.pdf', external_url: null, downloadable: true },
    { id: 'c4', lesson_id: LID, type: 'exercises', sort_order: 4, storage_path: LID + '/e.html', external_url: null, downloadable: false }],
  lesson_progress: [], favorites: [],
  announcements: [{ id: 'a1', title: 'إعلان مهم', body: 'نص الإعلان', is_published: true, created_at: '2026-01-03' }],
  payments: [], subscriptions: [],
  plans: [{ id: 'pl1', name: 'السنوي', description: '', price_da: 2500, duration_days: 365, features: ['ميزة 1'], is_active: true, is_featured: true, sort_order: 0, created_at: '2026-01-01' }],
  app_settings: [{ key: 'annual_price_da', value: 2500 }, { key: 'subscription_days', value: 365 }, { key: 'trial_days', value: 7 }, { key: 'payment_instructions', value: 'CCP 123 <b>x</b>' }]
});

function makeSb(db, opts, ctx) {
  const tbl = t => (db[t] = db[t] || []);
  const from = table => {
    const st = { f: [], ord: null, lim: null, one: null, op: 'select', pay: null, conf: null };
    const run = () => {
      const rows = tbl(table), match = r => st.f.every(fn => fn(r)); let res;
      if (st.op === 'insert') { res = [].concat(st.pay).map(r => Object.assign({ id: 'n' + (++ids), created_at: new Date().toISOString(), sort_order: 0 }, r)); rows.push(...res); }
      else if (st.op === 'update') { res = rows.filter(match); res.forEach(r => Object.assign(r, st.pay)); }
      else if (st.op === 'delete') { res = rows.filter(match); db[table] = rows.filter(r => !match(r)); }
      else if (st.op === 'upsert') {
        const keys = (st.conf || 'id').split(','); res = [];
        [].concat(st.pay).forEach(p => { let ex = rows.find(r => keys.every(k => r[k] === p[k])); if (ex) Object.assign(ex, p); else { ex = Object.assign({ id: 'n' + (++ids), created_at: new Date().toISOString() }, p); rows.push(ex); } res.push(ex); });
      } else res = rows.filter(match);
      if (st.ord) res = [...res].sort((a, b) => (a[st.ord[0]] > b[st.ord[0]] ? 1 : a[st.ord[0]] < b[st.ord[0]] ? -1 : 0) * (st.ord[1] ? 1 : -1));
      if (st.lim != null) res = res.slice(0, st.lim);
      if (st.one === 'single') return res.length === 1 ? { data: res[0], error: null } : { data: null, error: { message: 'single: ' + res.length + ' rows' } };
      if (st.one === 'maybe') return { data: res[0] || null, error: null };
      return { data: res, error: null };
    };
    const a = {
      select() { return a; }, eq(c, v) { st.f.push(r => r[c] === v); return a; }, in(c, vs) { st.f.push(r => vs.includes(r[c])); return a; },
      order(c, o) { st.ord = [c, !(o && o.ascending === false)]; return a; }, limit(n) { st.lim = n; return a; },
      single() { st.one = 'single'; return a; }, maybeSingle() { st.one = 'maybe'; return a; },
      insert(p) { st.op = 'insert'; st.pay = p; return a; }, update(p) { st.op = 'update'; st.pay = p; return a; }, delete() { st.op = 'delete'; return a; },
      upsert(p, o) { st.op = 'upsert'; st.pay = p; st.conf = o && o.onConflict; return a; },
      then(x, y) { return Promise.resolve().then(run).then(x, y); }
    };
    return a;
  };
  return {
    from,
    rpc: async (n, a) => { ctx.calls.push([n, a]); const f = opts.rpc && opts.rpc[n]; return f ? { data: f(a, db), error: null } : { data: null, error: { message: 'no rpc ' + n } }; },
    auth: {
      getSession: async () => ({ data: { session: opts.noSession ? null : { user: { id: 'u1', email: 'a@b.c' } } } }),
      signUp: async a => { ctx.calls.push(['signUp', a]); return { data: { user: { identities: [1] }, session: null }, error: null }; },
      signInWithPassword: async a => { ctx.calls.push(['signIn', a]); return { error: null }; },
      signOut: async () => { ctx.calls.push(['signOut']); return {}; },
      resetPasswordForEmail: async (e, o) => { ctx.calls.push(['reset', e, o]); return { error: null }; },
      updateUser: async u => { ctx.calls.push(['updateUser', u]); return { error: null }; },
      onAuthStateChange: cb => { ctx.authCb = cb; return { data: { subscription: { unsubscribe() {} } } }; }
    },
    storage: { from: b => ({
      getPublicUrl: p => ({ data: { publicUrl: 'https://x.supabase.co/storage/v1/object/public/' + b + '/' + p } }),
      download: async p => ({ data: b === 'lesson-html' ? { text: async () => '<h1>hi</h1>' } : new Blob(['%PDF']), error: null }),
      createSignedUrl: async p => ({ data: { signedUrl: 'https://x.supabase.co/s/' + p }, error: null }),
      upload: async (p, f) => { ctx.uploads.push([b, p, f.name, f.size]); return { error: null }; },
      remove: async ps => { ctx.removed.push([b, ps]); return { error: null }; } }) }
  };
}

async function page(file, search, scripts, db, opts = {}) {
  const vc = new VirtualConsole(), ctx = { calls: [], uploads: [], removed: [], errs: [] };
  const rec = k => e => { const m = String((e && e.message) || e).slice(0, 160); if (!/Not implemented: navigation/.test(m)) ctx.errs.push(file + ' ' + k + ': ' + m); };
  vc.on('jsdomError', rec('jsdom')); vc.on('error', rec('console.error'));
  const dom = new JSDOM(fs.readFileSync(ROOT + file, 'utf8'), { url: 'http://localhost/' + file + (search || ''), runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window; ctx.w = w; ctx.db = db;
  const sb = makeSb(db, opts, ctx);
  w.supabase = { createClient: () => sb }; w.APP_CONFIG = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'k' };
  w.matchMedia = () => ({ matches: !!opts.light }); w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.scrollTo = () => {}; w.URL.createObjectURL = () => 'blob:test';
  if (opts.ls) Object.entries(opts.ls).forEach(([k, v]) => w.localStorage.setItem(k, v));
  const D = (w.HTMLDialogElement || w.HTMLElement).prototype;
  D.showModal = function () { this.setAttribute('open', ''); };
  D.close = function (v) { if (v !== undefined) this.returnValue = v; this.removeAttribute('open'); if (typeof this.onclose === 'function') this.onclose(); this.dispatchEvent(new w.Event('close')); };
  for (const s of ['supabase', 'ui', 'guards'].concat(scripts)) w.eval(fs.readFileSync(ROOT + 'js/' + s + '.js', 'utf8'));
  await sleep(120);
  const view = () => w.document.getElementById('view');
  if (opts.dcl && /جارٍ التحميل/.test(view().textContent)) { w.document.dispatchEvent(new w.Event('DOMContentLoaded')); await sleep(150); }
  ERRS.push(...ctx.errs);
  return Object.assign(ctx, { view, txt: () => view().textContent, doc: w.document });
}
const q = (c, s) => c.doc.querySelector(s);
const click = async (c, s) => { const el = q(c, s); if (!el) throw new Error('missing ' + s); el.click(); await sleep(70); };
const go = async (c, h) => { c.w.location.hash = h; await sleep(120); };
const setf = (c, n, v) => { const el = c.doc.getElementById('fform').elements[n]; if (!el) throw new Error('no field ' + n); el.value = v; };
const submitF = async c => { c.doc.getElementById('fform').dispatchEvent(new c.w.Event('submit', { cancelable: true, bubbles: true })); await sleep(200); };
const yes = async c => { c.doc.getElementById('cdlg').close('yes'); await sleep(150); };
const has = (c, t) => c.txt().includes(t);
const scen = async (name, fn) => { try { await fn(); } catch (e) { ok(name + ' (crashed)', false, String(e.stack || e).split('\n').slice(0, 3).join(' | ')); } };

(async () => {
  await scen('student', async () => {
    const db = base(); db.favorites.push({ id: 'f0', user_id: 'u1', lesson_id: LID });
    const c = await page('student-dashboard.html', '', ['auth', 'student'], db, { rpc: { my_access: () => ACCESS } });
    ok('student home renders name', has(c, 'أهلاً أحمد'), c.txt().slice(0, 80));
    ok('student home: years + announcement', has(c, 'السنة الأولى') && has(c, 'إعلان مهم'));
    ok('admin link hidden for student', q(c, '#adminLink').hidden === true);
    await go(c, '#years'); ok('years view', has(c, 'السنة الأولى') && has(c, 'وصف السنة'));
    ok('sidebar has no domains/units/all-lessons links', !q(c, '#sideNav [data-view=domains]') && !q(c, '#sideNav [data-view=units]') && !q(c, '#sideNav [data-view=lessons]'));
    await go(c, '#home'); ok('home shows years entry, not a lessons list', has(c, 'سنواتك الدراسية') && !!q(c, '#view a.card[href="academic-year.html?year=y1"]') && !q(c, '#view .lrow'), c.txt().slice(0, 80));
    for (const h of ['#domains', '#units', '#lessons']) { await go(c, h); ok('removed view ' + h + ' falls back to home', has(c, 'أهلاً أحمد') && !has(c, 'جميع الدروس')); }
    await go(c, '#favorites'); ok('favorites view lists saved lesson', has(c, 'درس الخرسانة') && !!q(c, '[data-fav]'));
    await click(c, '[data-fav]'); ok('favorite removed', db.favorites.length === 0);
    await go(c, '#progress'); ok('progress view', has(c, '0 من 1'));
    await go(c, '#account'); ok('account form', !!q(c, '#nameForm'));
    q(c, '#nameForm [name=full_name]').value = 'أحمد علي';
    q(c, '#nameForm').dispatchEvent(new c.w.Event('submit', { cancelable: true, bubbles: true })); await sleep(80);
    ok('name updated', db.profiles[0].full_name === 'أحمد علي');
    ok('logout bound', !!q(c, '#logoutBtn')); await click(c, '#logoutBtn'); ok('signOut called', c.calls.some(x => x[0] === 'signOut'));
  });

  await scen('academic (drill-down)', async () => {
    const rpc = { my_access: () => ACCESS };
    const y = await page('academic-year.html', '?year=1', ['academic'], base(), { rpc });
    ok('year level shows domains only', has(y, 'المجالات') && has(y, 'مجال البناء') && !has(y, 'الوحدة الأولى') && !has(y, 'درس الخرسانة'), y.txt().slice(0, 100));
    ok('year level: domain card -> domain page', !!q(y, 'a.card[href="academic-year.html?year=y1&domain=d1"]'));
    ok('year level: back to years', q(y, 'a.back').getAttribute('href') === 'student-dashboard.html#years');
    const d = await page('academic-year.html', '?year=y1&domain=d1', ['academic'], base(), { rpc });
    ok('domain level shows units only', has(d, 'الوحدات') && has(d, 'الوحدة الأولى') && !has(d, 'درس الخرسانة') && !has(d, 'مجال البناء الوحدات'));
    ok('domain level: unit card -> unit page', !!q(d, 'a.card[href="academic-year.html?year=y1&domain=d1&unit=un1"]'));
    ok('domain level: breadcrumb + back to year', q(d, '.crumb').textContent.includes('السنة الأولى') && q(d, 'a.back').getAttribute('href') === 'academic-year.html?year=y1');
    const u = await page('academic-year.html', '?year=y1&domain=d1&unit=un1', ['academic'], base(), { rpc });
    ok('unit level shows lessons', has(u, 'الدروس') && has(u, 'درس الخرسانة') && has(u, '0 من 1') && !!q(u, 'a[href="lesson.html?id=' + LID + '"]'));
    ok('unit level: back to domain', q(u, 'a.back').getAttribute('href') === 'academic-year.html?year=y1&domain=d1');
    const dn = base(); dn.lesson_progress.push({ id: 'p9', user_id: 'u1', lesson_id: LID, completed: true, progress_pct: 100 });
    const u2 = await page('academic-year.html', '?year=y1&domain=d1&unit=un1', ['academic'], dn, { rpc });
    ok('unit level: completed tick + 100%', has(u2, '1 من 1') && !!q(u2, '.lrow .tick'));
    const d2 = base(); d2.domains.push({ id: 'd2', year_id: 'y1', title: 'مجال آخر', sort_order: 1, is_published: true }); d2.units.push({ id: 'un2', domain_id: 'd2', title: 'وحدة أخرى', sort_order: 0, is_published: true });
    for (const [s, t, db] of [['?year=9', 'لم نجد هذه السنة', base()], ['?year=y1&domain=zzz', 'لم نجد هذا المجال', base()], ['?year=y1&domain=d1&unit=nope', 'لم نجد هذه الوحدة', base()], ['?year=y1&domain=d1&unit=un2', 'لم نجد هذه الوحدة', d2]])
      ok('not found: ' + s, has(await page('academic-year.html', s, ['academic'], db, { rpc }), t));
    const e = base(); e.units = []; ok('empty domain message', has(await page('academic-year.html', '?year=y1&domain=d1', ['academic'], e, { rpc }), 'لا توجد وحدات'));
  });

  await scen('lesson', async () => {
    const db = base(), c = await page('lesson.html', '?id=' + LID, ['progress', 'lesson-view'], db, { rpc: { my_access: () => ACCESS } });
    ok('lesson title + crumb', has(c, 'درس الخرسانة') && has(c, 'السنة الأولى'), c.txt().slice(0, 80));
    ok('3 sections in order', [...c.doc.querySelectorAll('.lsec')].map(s => s.id).join() === 's-html,s-video,s-pdf,s-exercises');
    const f = q(c, '#s-html iframe'); ok('html iframe sandboxed -> sandbox.html', f && f.getAttribute('sandbox') === 'allow-scripts' && f.getAttribute('src') === 'sandbox.html' && !f.hasAttribute('srcdoc'), f && f.outerHTML.slice(0, 120));
    ok('video element', !!q(c, '#s-video video'));
    const ex = q(c, '#s-exercises iframe'); ok('exercises section: sandboxed HTML frame', ex && ex.getAttribute('sandbox') === 'allow-scripts' && ex.getAttribute('src') === 'sandbox.html' && ex.title === 'تمارين HTML' && has(c, 'تمارين HTML'), ex && ex.outerHTML.slice(0, 120));
    ok('toc lists exercises', !!q(c, '.toc a[href="#s-exercises"]'));
    ok('crumb links domain + unit levels', !!q(c, '.crumb a[href="academic-year.html?year=y1&domain=d1"]') && !!q(c, '.crumb a[href="academic-year.html?year=y1&domain=d1&unit=un1"]'));
    ok('pdf iframe (blob) + download link', !!q(c, '#s-pdf iframe') && !!q(c, '#s-pdf a.btn.sm'), q(c, '#s-pdf') && q(c, '#s-pdf').innerHTML.slice(0, 160));
    ok('open tracked', db.lesson_progress.length === 1 && !!db.lesson_progress[0].last_opened_at);
    ok('prev disabled / next disabled', c.doc.querySelectorAll('.lnav [aria-disabled=true]').length === 2);
    await click(c, '#doneBtn'); await sleep(100);
    ok('complete saved', db.lesson_progress[0].completed === true && db.lesson_progress[0].progress_pct === 100, JSON.stringify(db.lesson_progress));
    ok('done button state', has(c, 'تم إتمام الدرس'));
    await click(c, '#doneBtn'); await sleep(100); ok('un-complete', db.lesson_progress[0].completed === false);
    await click(c, '#favBtn'); ok('favorite from lesson', db.favorites.length === 1 && has(c, 'في المفضلة'));
    // بلا صلاحية
    const c2 = await page('lesson.html', '?id=' + LID, ['progress', 'lesson-view'], base(), { rpc: { my_access: () => ({ has_access: false, is_admin: false, reason: 'none' }) } });
    ok('wall without access', has(c2, 'للمشتركين') && c2.doc.querySelectorAll('.lsec').length === 0 && !q(c2, '#doneBtn'));
    const c3 = await page('lesson.html', '?id=zzz', ['progress', 'lesson-view'], base(), { rpc: { my_access: () => ACCESS } }); ok('bad id', has(c3, 'غير صحيح'));
    const c4 = await page('lesson.html', '?id=40000000-0000-0000-0000-000000000009', ['progress', 'lesson-view'], base(), { rpc: { my_access: () => ACCESS } }); ok('missing lesson', has(c4, 'غير متاح'));
    // فيديو خارجي
    const d5 = base(); d5.lesson_contents = [{ id: 'c9', lesson_id: LID, type: 'video', sort_order: 1, storage_path: null, external_url: 'https://youtu.be/abcdefghijk', downloadable: false }];
    const c5 = await page('lesson.html', '?id=' + LID, ['progress', 'lesson-view'], d5, { rpc: { my_access: () => ACCESS } });
    const yf = q(c5, '#s-video iframe'); ok('youtube embed', yf && yf.getAttribute('src') === 'https://www.youtube-nocookie.com/embed/abcdefghijk' && /allow-same-origin/.test(yf.getAttribute('sandbox')));
    d5.lesson_contents[0].external_url = 'http://evil.com/x'; const c6 = await page('lesson.html', '?id=' + LID, ['progress', 'lesson-view'], d5, { rpc: { my_access: () => ACCESS } }); ok('http video rejected', has(c6, 'غير صالح'));
    d5.lesson_contents[0].external_url = 'javascript:alert(1)'; const c7 = await page('lesson.html', '?id=' + LID, ['progress', 'lesson-view'], d5, { rpc: { my_access: () => ACCESS } }); ok('js: video rejected', has(c7, 'غير صالح'));
  });

  await scen('subscription', async () => {
    const db = base();
    db.plans.push({ id: 'pl2', name: 'الشهري', description: 'شهر واحد', price_da: 900, duration_days: 30, features: [], is_active: true, is_featured: false, sort_order: 1, created_at: '2026-01-02' },
      { id: 'pl3', name: 'قديمة', description: '', price_da: 1, duration_days: 5, features: [], is_active: false, is_featured: false, sort_order: 2, created_at: '2026-01-03' });
    const rpc = { my_access: () => ({ has_access: false, is_admin: false, reason: 'none' }), public_pricing: (_, d) => ({ trial_days: 7, plans: d.plans.filter(p => p.is_active) }) };
    const c = await page('subscription.html', '', ['subscriptions'], db, { rpc });
    ok('plans from DB (inactive hidden)', has(c, 'السنوي') && has(c, 'الشهري') && has(c, '900 DA') && !has(c, 'قديمة'), c.txt().slice(0, 120));
    ok('trial card shown', has(c, 'تجربة مجانية'));
    ok('no payment form until plan chosen', !q(c, '#payForm') && has(c, 'اختر خطة'));
    await click(c, '[data-plan="pl2"]'); ok('form shows chosen plan', !!q(c, '#payForm') && q(c, '#payForm').textContent.includes('الشهري'));
    const pre = q(c, '.pre'); ok('instructions escaped', pre && pre.innerHTML.includes('&lt;b&gt;') && !pre.querySelector('b'), pre && pre.innerHTML);
    const f = q(c, '#payForm'); f.elements.reference.value = 'ab'; f.dispatchEvent(new c.w.Event('submit', { cancelable: true })); await sleep(60);
    ok('short reference rejected', db.payments.length === 0 && has(c, 'رقم العملية'));
    f.elements.reference.value = 'CCP-12345'; f.elements.paid_on.value = '2026-11-01'; f.dispatchEvent(new c.w.Event('submit', { cancelable: true })); await sleep(200);
    const p = db.payments[0];
    ok('payment snapshot of plan', p && p.status === 'pending' && p.plan_id === 'pl2' && p.plan_name === 'الشهري' && p.amount_da === 900 && p.duration_days === 30 && p.user_id === 'u1' && p.reference === 'CCP-12345', JSON.stringify(p));
    ok('pending notice replaces form + plan buttons disabled', has(c, 'قيد المراجعة') && !q(c, '#payForm') && q(c, '[data-plan]').disabled);
    const d2 = base(); d2.plans = []; const c2 = await page('subscription.html', '', ['subscriptions'], d2, { rpc: Object.assign({}, rpc, { public_pricing: () => ({ trial_days: 0, plans: [] }) }) });
    ok('no plans message', has(c2, 'لا توجد خطط') && !has(c2, 'تجربة مجانية —'));
  });

  await scen('landing + register trial text', async () => {
    const db = base(); db.plans[0].price_da = 3000;
    const rpc = { public_pricing: (_, d) => ({ trial_days: 10, plans: d.plans.filter(p => p.is_active) }) };
    const c = await page('index.html', '', ['home'], db, { rpc, noSession: true }), g = q(c, '#planGrid');
    ok('landing: plans + trial from DB', g.textContent.includes('3000 DA') && !g.textContent.includes('2500 DA') && g.textContent.includes('10 أيام'), g.textContent.slice(0, 100));
    ok('landing: guest CTA -> register', !!g.querySelector('.plan.featured a[href="register.html"]'));
    ok('landing: hero trial note updated', q(c, '[data-trial]').textContent === '10');
    const c2 = await page('index.html', '', ['home'], db, { rpc });
    ok('landing: logged-in CTA -> subscription', !!q(c2, '#planGrid .plan.featured a[href="subscription.html"]'));
    db.plans[0].is_active = false; const c3 = await page('index.html', '', ['home'], db, { rpc: { public_pricing: (_, d) => ({ trial_days: 0, plans: d.plans.filter(p => p.is_active) }) }, noSession: true });
    ok('landing: no plans + no trial', q(c3, '#planGrid').textContent.includes('غير متاحة') && q(c3, '[data-trial-line]').hidden === true);
    const c4 = await page('index.html', '', ['home'], base(), { noSession: true });
    ok('landing: static fallback when RPC fails', q(c4, '#planGrid').textContent.includes('الاشتراك السنوي'));
    const r = await page('register.html', '', ['auth'], db, { noSession: true, rpc: { public_pricing: () => ({ trial_days: 14, plans: [] }) } });
    ok('register: trial days from DB', q(r, '[data-trial]').textContent === '14');
  });

  await scen('auth', async () => {
    const c = await page('register.html', '', ['auth'], base(), { noSession: true }), f = q(c, '#registerForm');
    const set = (n, v) => { f.elements[n].value = v; }, sub = async () => { f.dispatchEvent(new c.w.Event('submit', { cancelable: true })); await sleep(80); };
    set('full_name', 'سارة بن علي'); set('email', 's@x.com'); set('password', '12345678'); set('confirm', '1234567x'); await sub(); ok('mismatch blocked', q(c, '#formMsg').textContent.includes('غير متطابقتين'));
    set('confirm', '12345678'); await sub(); const s = c.calls.find(x => x[0] === 'signUp'); ok('signUp with metadata', s && s[1].options.data.full_name === 'سارة بن علي' && s[1].email === 's@x.com');
    ok('confirm-email message', q(c, '#formMsg').textContent.includes('أكّد بريدك'));
    const l = await page('login.html', '?next=lesson.html%3Fid%3D1', ['auth'], base(), { noSession: true, rpc: { my_access: () => ACCESS } });
    const lf = q(l, '#loginForm'); lf.elements.email.value = 'a@b.c'; lf.elements.password.value = 'x'; lf.dispatchEvent(new l.w.Event('submit', { cancelable: true })); await sleep(100);
    ok('signIn called', l.calls.some(x => x[0] === 'signIn'));
  });

  await scen('admin', async () => {
    const db = base();
    db.profiles.push({ id: 'u2', full_name: 'طالب ثانٍ', role: 'student', trial_ends_at: FUT, created_at: '2026-02-01T00:00:00Z' });
    db.payments.push({ id: 'p1', user_id: 'u2', amount_da: 2500, method: 'CCP', reference: 'R-1', paid_on: '2026-02-01', status: 'pending', created_at: '2026-02-02' });
    const stats = { students: 5, active_subscriptions: 1, trial_students: 3, expired_students: 1, expired_subscriptions: 0, revenue_da: 5000, pending_payments: 1, top_lessons: [{ id: LID, title: 'درس الخرسانة', opens: 4 }], top_years: [{ id: 'y1', title: 'السنة الأولى', opens: 4 }] };
    const c = await page('admin-dashboard.html', '', ['auth', 'uploads', 'admin', 'lessons', 'billing', 'plans'], db, { dcl: true, rpc: {
      my_access: () => ({ has_access: true, is_admin: true, reason: 'admin' }), admin_stats: () => stats,
      confirm_payment: ({ pid }, d) => { d.payments.find(x => x.id === pid).status = 'confirmed'; d.subscriptions.push({ id: 's1', user_id: 'u2', status: 'active', starts_at: '2026-01-01', ends_at: '2027-01-01', payment_id: pid }); return 's1'; },
      reject_payment: ({ pid, note }, d) => { const p = d.payments.find(x => x.id === pid); p.status = 'rejected'; p.admin_note = note; return null; } } });
    ok('admin dashboard stats + charts', has(c, 'إجمالي الطلاب') && has(c, 'أكثر الدروس مشاهدة') && has(c, 'درس الخرسانة') && !!q(c, '.donut'), c.txt().slice(0, 100));
    await go(c, '#years'); ok('years list', has(c, 'السنة الأولى'));
    await click(c, '[data-add="years"]'); setf(c, 'title', 'السنة الثانية'); await submitF(c);
    ok('year added', db.academic_years.length === 2 && db.academic_years[1].title === 'السنة الثانية' && has(c, 'السنة الثانية'), JSON.stringify(db.academic_years.map(y => y.title)));
    await click(c, '[data-pub^="years:' + db.academic_years[1].id + '"]'); ok('year unpublished', db.academic_years[1].is_published === false);
    await click(c, '[data-down^="years:y1"]'); ok('year reorder', db.academic_years.find(y => y.id === 'y1').sort_order === 1, JSON.stringify(db.academic_years.map(y => [y.title, y.sort_order])));
    await click(c, '[data-del^="years:' + db.academic_years[1].id + '"]'); await yes(c); ok('year deleted', db.academic_years.length === 1);
    await go(c, '#domains'); ok('domains view', has(c, 'مجال البناء'));
    await click(c, '[data-add="domains"]'); setf(c, 'title', 'مجال الأشغال'); await submitF(c); ok('domain added under selected year', db.domains.length === 2 && db.domains[1].year_id === 'y1');
    await go(c, '#units'); ok('units view', has(c, 'الوحدة الأولى'));
    await go(c, '#lessons'); ok('lessons view + badge', has(c, 'درس الخرسانة') && has(c, 'منشور'));
    await click(c, '[data-ladd]');
    setf(c, 'title', 'درس جديد'); setf(c, 'status', 'published'); setf(c, 'html_text', '<p>مرحبا</p>'); setf(c, 'exercises_text', '<button>تمرين</button>'); setf(c, 'video_url', 'https://youtu.be/abcdefghijk'); setf(c, 'ord_video', '1'); setf(c, 'ord_html', '2');
    await submitF(c);
    const nl = db.lessons.find(l => l.title === 'درس جديد'); ok('lesson created', nl && nl.unit_id === 'un1' && nl.status === 'published', JSON.stringify(db.lessons.map(l => l.title)));
    const nc = db.lesson_contents.filter(x => nl && x.lesson_id === nl.id);
    ok('contents saved (html upload + external video)', nc.length === 3 && nc.some(x => x.type === 'exercises' && x.storage_path.startsWith(nl.id + '/') && x.sort_order === 4) && nc.find(x => x.type === 'html').storage_path.startsWith(nl.id + '/') && nc.find(x => x.type === 'video').external_url === 'https://youtu.be/abcdefghijk' && nc.find(x => x.type === 'html').sort_order === 2, JSON.stringify(nc));
    ok('html uploaded to lesson-html', c.uploads.some(u => u[0] === 'lesson-html' && u[2] === 'lesson.html'));
    ok('exercises uploaded as separate HTML file', c.uploads.some(u => u[0] === 'lesson-html' && u[2] === 'exercises.html') && c.uploads.filter(u => u[0] === 'lesson-html').length === 2);
    await click(c, '[data-ledit="' + nl.id + '"]'); ok('edit form shows existing + remove option', !!c.doc.getElementById('fform').elements.rm_html && !!c.doc.getElementById('fform').elements.rm_video);
    c.doc.getElementById('fform').elements.rm_video.checked = true; ok('exercises preview button + remove option', !!q(c, '#prevEx') && !!c.doc.getElementById('fform').elements.rm_exercises); c.doc.getElementById('fform').elements.rm_exercises.checked = true; setf(c, 'title', 'درس معدّل'); await submitF(c);
    ok('edit + remove video & exercises', !db.lesson_contents.some(x => x.lesson_id === nl.id && x.type === 'exercises') && db.lessons.find(l => l.id === nl.id).title === 'درس معدّل' && !db.lesson_contents.some(x => x.lesson_id === nl.id && x.type === 'video'));
    await click(c, '[data-lpub="' + nl.id + '"]'); ok('hide lesson', db.lessons.find(l => l.id === nl.id).status === 'hidden');
    await click(c, '[data-ldel="' + nl.id + '"]'); await yes(c);
    ok('lesson deleted + files purged', !db.lessons.some(l => l.id === nl.id) && c.removed.some(r => r[0] === 'lesson-html'), JSON.stringify(c.removed));
    await go(c, '#students'); ok('students list', has(c, 'طالب ثانٍ') && has(c, 'تجربة حتى'));
    await go(c, '#payments'); ok('payments pending shown', has(c, 'R-1') && !!q(c, '[data-pconf]'));
    await click(c, '[data-pconf]'); await yes(c);
    ok('payment confirmed via rpc', c.calls.some(x => x[0] === 'confirm_payment' && x[1].pid === 'p1') && db.subscriptions.length === 1);
    db.payments.push({ id: 'p2', user_id: 'u2', amount_da: 2500, method: 'CCP', reference: 'R-2', paid_on: '2026-02-03', status: 'pending', created_at: '2026-02-04' });
    await go(c, '#subscriptions'); await go(c, '#payments'); await click(c, '[data-prej="p2"]'); c.doc.getElementById('fform').elements.note.value = 'المبلغ غير مطابق'; await submitF(c);
    ok('payment rejected with note', c.calls.some(x => x[0] === 'reject_payment' && x[1].note === 'المبلغ غير مطابق'));
    await go(c, '#subscriptions'); ok('subscriptions list', has(c, 'طالب ثانٍ') && has(c, 'فعّال'), c.txt().slice(0, 120));
    await click(c, '[data-scancel]'); await yes(c); ok('subscription cancelled', db.subscriptions[0].status === 'cancelled');
    await click(c, '[data-sgrant]'); await sleep(80); setf(c, 'user', 'u2'); setf(c, 'days', '30'); await submitF(c); ok('manual grant', db.subscriptions.length === 2 && db.subscriptions[1].user_id === 'u2', JSON.stringify(db.subscriptions.length));
    await go(c, '#settings'); const sf = q(c, '#setForm');
    ok('settings: trial + instructions only', !!sf && sf.elements.trial_days.value === '7' && !sf.elements.annual_price_da && !sf.elements.subscription_days);
    sf.elements.trial_days.value = '10'; sf.dispatchEvent(new c.w.Event('submit', { cancelable: true, bubbles: true })); await sleep(100);
    ok('settings saved', db.app_settings.find(x => x.key === 'trial_days').value === 10, JSON.stringify(db.app_settings));
    await go(c, '#plans'); ok('plans list', has(c, 'السنوي') && has(c, '2500 DA') && has(c, 'مفعّلة') && has(c, 'مميزة'), c.txt().slice(0, 100));
    await click(c, '[data-padd]'); setf(c, 'name', 'الشهري'); setf(c, 'price_da', '900'); setf(c, 'duration_days', '30'); setf(c, 'features', 'ميزة أ\nميزة ب\n\n'); await submitF(c);
    const np = db.plans.find(x => x.name === 'الشهري');
    ok('plan added', np && np.price_da === 900 && np.duration_days === 30 && np.features.length === 2 && np.is_active === true && np.sort_order === 1, JSON.stringify(db.plans));
    await click(c, '[data-padd]'); setf(c, 'name', 'سيئة'); setf(c, 'price_da', '0'); await submitF(c);
    ok('invalid price rejected', db.plans.length === 2 && c.doc.getElementById('fmsg').textContent.includes('السعر'));
    c.doc.getElementById('fdlg').close();
    await click(c, '[data-pdown="pl1"]'); ok('plans reorder', db.plans.find(x => x.id === 'pl1').sort_order === 1, JSON.stringify(db.plans.map(x => [x.name, x.sort_order])));
    await click(c, '[data-ptog="' + np.id + '"]'); ok('plan disabled', db.plans.find(x => x.id === np.id).is_active === false && has(c, 'معطّلة'));
    await click(c, '[data-ptog="' + np.id + '"]'); ok('plan re-enabled', db.plans.find(x => x.id === np.id).is_active === true);
    await click(c, '[data-pedit="' + np.id + '"]'); setf(c, 'price_da', '1000'); c.doc.getElementById('fform').elements.is_featured.checked = true; await submitF(c);
    ok('plan edited', db.plans.find(x => x.id === np.id).price_da === 1000 && db.plans.find(x => x.id === np.id).is_featured === true);
    await click(c, '[data-pdel="' + np.id + '"]'); await yes(c); ok('plan deleted', !db.plans.some(x => x.id === np.id));
    ERRS.push(...c.errs);
  });

  await scen('forgot/reset', async () => {
    const ev = (c, el) => el.dispatchEvent(new c.w.Event('submit', { cancelable: true, bubbles: true }));
    const f = await page('forgot-password.html', '', ['auth'], base(), { noSession: true }), fm = q(f, '#forgotForm');
    fm.elements.email.value = 'bad'; ev(f, fm); await sleep(60);
    ok('forgot: bad email blocked', f.calls.every(x => x[0] !== 'reset') && q(f, '#formMsg').textContent.includes('بريداً'));
    fm.elements.email.value = 'a@b.com'; ev(f, fm); await sleep(80);
    const rc = f.calls.find(x => x[0] === 'reset');
    ok('forgot: reset requested with redirect', rc && rc[1] === 'a@b.com' && rc[2].redirectTo === 'http://localhost/reset-password.html', JSON.stringify(rc));
    ok('forgot: generic message + cooldown', q(f, '#formMsg').textContent.includes('إن كان') && q(f, 'button[type=submit]').disabled);
    const l = await page('login.html', '', ['auth'], base(), { noSession: true }); ok('login links to forgot', !!q(l, 'a[href="forgot-password.html"]'));
    const r = await page('reset-password.html', '#access_token=a&type=recovery', ['reset'], base(), {}), rf = q(r, '#resetForm');
    ok('reset: form shown for recovery link', rf.hidden === false && q(r, '#resetState').hidden === true);
    rf.elements.password.value = 'short'; rf.elements.confirm.value = 'short'; ev(r, rf); await sleep(50);
    ok('reset: short blocked', !r.calls.some(x => x[0] === 'updateUser'));
    rf.elements.password.value = 'longenough1'; rf.elements.confirm.value = 'different1'; ev(r, rf); await sleep(50);
    ok('reset: mismatch blocked', !r.calls.some(x => x[0] === 'updateUser') && q(r, '#formMsg').textContent.includes('غير متطابقتين'));
    rf.elements.confirm.value = 'longenough1'; ev(r, rf); await sleep(100);
    ok('reset: updateUser called', r.calls.some(x => x[0] === 'updateUser' && x[1].password === 'longenough1'));
    const e = await page('reset-password.html', '#error=access_denied&error_code=otp_expired', ['reset'], base(), {});
    ok('reset: expired link', q(e, '#resetForm').hidden === true && q(e, '#again').hidden === false && q(e, '#resetState').textContent.includes('غير صالح'));
    const n = await page('reset-password.html', '', ['reset'], base(), { noSession: true }); await sleep(1000);
    ok('reset: no link -> invalid', q(n, '#resetForm').hidden === true && q(n, '#again').hidden === false);
    const v = await page('reset-password.html', '', ['reset'], base(), { noSession: true }); v.authCb('PASSWORD_RECOVERY', {}); await sleep(50);
    ok('reset: PASSWORD_RECOVERY event shows form', q(v, '#resetForm').hidden === false);
  });

  await scen('theme', async () => {
    const th = c => c.doc.documentElement.dataset.theme;
    const a = await page('login.html', '', ['theme'], base(), { noSession: true });
    ok('theme: default dark + floating toggle', th(a) === 'dark' && !!q(a, '.theme-fab'), th(a));
    let n = 0; a.w.addEventListener('themechange', () => n++);
    await click(a, '.theme-fab'); ok('theme: toggle -> light, saved, event fired', th(a) === 'light' && a.w.localStorage.getItem('theme') === 'light' && n === 1, th(a) + n);
    await click(a, '.theme-fab'); ok('theme: toggle back to dark', th(a) === 'dark' && a.w.localStorage.getItem('theme') === 'dark');
    ok('theme: saved choice applied on load', th(await page('login.html', '', ['theme'], base(), { noSession: true, ls: { theme: 'light' } })) === 'light');
    ok('theme: admin default light', th(await page('login.html', '', ['theme'], base(), { noSession: true, ls: { site_theme: 'light' } })) === 'light');
    ok('theme: user choice beats admin default', th(await page('login.html', '', ['theme'], base(), { noSession: true, ls: { site_theme: 'light', theme: 'dark' } })) === 'dark');
    ok('theme: system -> light', th(await page('login.html', '', ['theme'], base(), { noSession: true, ls: { site_theme: 'system' }, light: true })) === 'light');
    ok('theme: system -> dark', th(await page('login.html', '', ['theme'], base(), { noSession: true, ls: { site_theme: 'system' } })) === 'dark');
    ok('theme: junk value ignored', th(await page('login.html', '', ['theme'], base(), { noSession: true, ls: { theme: '<x>' } })) === 'dark');
    const h = await page('index.html', '', ['theme'], base(), { noSession: true }); ok('theme: nav slot used (no fab)', !!q(h, '[data-theme-slot] .theme-btn') && !q(h, '.theme-fab'));
    const i = await page('student-dashboard.html', '', ['theme', 'auth', 'student'], base(), { rpc: { my_access: () => ACCESS } }); ok('theme: sidebar slot', !!q(i, '.side [data-theme-slot] .theme-btn'));
    for (const f of ['academic-year', 'forgot-password', 'lesson', 'login', 'register', 'reset-password', 'student-dashboard', 'subscription', 'admin-dashboard', 'index'])
      ok('theme.js in <head> of ' + f, /<head>[\s\S]*js\/theme\.js[\s\S]*<\/head>/.test(require('fs').readFileSync(ROOT + f + '.html', 'utf8')));
  });

  await scen('site identity', async () => {
    const SITE = { site_name: 'أكاديمية البناء', logo_path: 'logo/a.png', hero_title: 'عنوان جديد', hero_text: 'وصف جديد', years_title: 'سنواتنا', pricing_title: 'الباقات', contact_email: 'info@acad.dz',
      contact_phone: '+213 (555) 12-34-56', footer_text: 'جميع الحقوق محفوظة', default_theme: 'light' };
    const rpc = { public_site: (_, d) => (d.app_settings.find(x => x.key === 'site') || { value: {} }).value, public_pricing: () => ({ trial_days: 7, plans: [] }) };
    const db = base(); db.app_settings.push({ key: 'site', value: SITE });
    const c = await page('index.html', '', ['theme', 'site', 'home'], db, { rpc, noSession: true });
    const logo = q(c, '.nav .logo img.logo-img');
    ok('site: logo image from site-assets bucket', logo && logo.getAttribute('src') === 'https://x.supabase.co/storage/v1/object/public/site-assets/logo/a.png' && logo.alt === 'أكاديمية البناء', logo && logo.outerHTML);
    ok('site: hero + section titles', q(c, '[data-site=hero_title]').textContent === 'عنوان جديد' && q(c, '[data-site=hero_text]').textContent === 'وصف جديد' && q(c, '[data-site=years_title]').textContent === 'سنواتنا' && q(c, '[data-site=pricing_title]').textContent === 'الباقات');
    ok('site: untouched titles keep default', q(c, '[data-site=features_title]').textContent.includes('ثلاث طرق'));
    ok('site: footer name + text', q(c, '.foot').textContent.includes('أكاديمية البناء') && q(c, '.foot').textContent.includes('جميع الحقوق'));
    ok('site: contact mailto/tel', q(c, '[data-site-email]').getAttribute('href') === 'mailto:info@acad.dz' && q(c, '[data-site-phone]').getAttribute('href') === 'tel:+213555123456' && q(c, '[data-site-row=contact_email]').hidden === false && q(c, '[data-site-empty]').hidden === true);
    ok('site: title uses site name', c.doc.title.startsWith('أكاديمية البناء') && !c.doc.title.includes('Civil'), c.doc.title);
    ok('site: favicon = logo', /site-assets\/logo\/a\.png$/.test((q(c, 'link[rel=icon]') || {}).href || ''));
    ok('site: admin default theme applied', c.doc.documentElement.dataset.theme === 'light');
    ok('site: cached for instant paint', JSON.parse(c.w.localStorage.getItem('site_cache')).site_name === 'أكاديمية البناء');
    // لا محتوى مخصص
    const e = await page('index.html', '', ['theme', 'site', 'home'], base(), { rpc: Object.assign({}, rpc, { public_site: () => ({}) }), noSession: true });
    ok('site: empty -> defaults, contact rows hidden, hint shown', q(e, '.nav .logo').textContent.includes('Civil Academy 3D') && !q(e, '.nav .logo img') && q(e, '[data-site-row=contact_email]').hidden === true && q(e, '[data-site-row=contact_phone]').hidden === true && q(e, '[data-site-empty]').hidden === false);
    // حقن
    const evil = Object.assign({}, SITE, { hero_title: '<img src=x onerror=alert(1)>', contact_email: 'a@b.co" onclick="x', site_name: '<b>x</b>' }), d2 = base(); d2.app_settings.push({ key: 'site', value: evil });
    const m = await page('index.html', '', ['theme', 'site', 'home'], d2, { rpc, noSession: true });
    ok('site: no HTML injection (text only)', !q(m, 'h1 img') && q(m, 'h1').textContent === '<img src=x onerror=alert(1)>' && !q(m, '.nav .logo b') && !q(m, '.foot b'));
    ok('site: unsafe email not linked', q(m, '[data-site-row=contact_email]').hidden === true);
    // اسم يحوي النص الافتراضي: لا حلقة في العنوان
    const d3 = base(); d3.app_settings.push({ key: 'site', value: { site_name: 'My Civil Academy 3D' } });
    const t = await page('login.html', '', ['theme', 'site'], d3, { rpc, noSession: true }); await sleep(100);
    ok('site: title stable when name contains default', t.doc.title === 'تسجيل الدخول | My Civil Academy 3D', t.doc.title);
    // من الذاكرة المحلية عند تعذّر الخادم
    const k = await page('login.html', '', ['theme', 'site'], base(), { noSession: true, ls: { site_cache: JSON.stringify(SITE) } });
    ok('site: cache applied when RPC fails', !!q(k, '.logo img.logo-img'));
    for (const f of ['academic-year', 'forgot-password', 'lesson', 'login', 'register', 'reset-password', 'student-dashboard', 'subscription', 'index'])
      ok('site.js loaded in ' + f, /js\/site\.js/.test(require('fs').readFileSync(ROOT + f + '.html', 'utf8')));
  });

  await scen('admin site identity', async () => {
    const db = base(), stats = { students: 0, active_subscriptions: 0, trial_students: 0, expired_students: 0, expired_subscriptions: 0, revenue_da: 0, pending_payments: 0, top_lessons: [], top_years: [] };
    const rpc = { my_access: () => ({ has_access: true, is_admin: true, reason: 'admin' }), admin_stats: () => stats, public_site: (_, d) => (d.app_settings.find(x => x.key === 'site') || { value: {} }).value };
    const c = await page('admin-dashboard.html', '', ['theme', 'site', 'auth', 'uploads', 'admin', 'site-admin'], db, { dcl: true, rpc });
    await go(c, '#site');
    let sf = q(c, '#siteForm'); ok('admin site: form with theme default + logo + section titles', !!sf && sf.elements.default_theme.value === 'dark' && !!sf.elements.logo_file && !!sf.elements.years_title && !!sf.elements.contact_title, c.txt().slice(0, 60));
    const FD = c.w.FormData, withFile = (name, type) => { c.w.FormData = function (f) { const fd = new FD(f); fd.set('logo_file', new c.w.File([new Uint8Array(10)], name, { type })); return fd; }; };
    const sub = async () => { q(c, '#siteForm').dispatchEvent(new c.w.Event('submit', { cancelable: true, bubbles: true })); await sleep(250); };
    sf.elements.contact_email.value = 'bad'; await sub(); ok('admin site: bad email rejected', !db.app_settings.some(x => x.key === 'site') && q(c, '#siteMsg').textContent.includes('غير صحيح'));
    sf.elements.contact_email.value = ''; withFile('logo.gif', 'image/gif'); await sub();
    ok('admin site: gif rejected', !db.app_settings.some(x => x.key === 'site') && q(c, '#siteMsg').textContent.includes('صيغة'), q(c, '#siteMsg').textContent);
    sf = q(c, '#siteForm'); sf.elements.site_name.value = 'أكاديمية'; sf.elements.hero_title.value = 'عنوان'; sf.elements.years_title.value = 'سنواتنا'; sf.elements.contact_email.value = 'x@y.dz'; sf.elements.default_theme.value = 'light';
    withFile('logo.png', 'image/png'); await sub();
    const row = (db.app_settings.find(x => x.key === 'site') || {}).value || {};
    ok('admin site: saved fields', row.site_name === 'أكاديمية' && row.hero_title === 'عنوان' && row.years_title === 'سنواتنا' && row.contact_email === 'x@y.dz' && row.default_theme === 'light', JSON.stringify(row));
    ok('admin site: logo uploaded to site-assets', /^logo\/.+\.png$/.test(row.logo_path || '') && c.uploads.some(u => u[0] === 'site-assets' && u[1] === row.logo_path && u[2] === 'logo.png'), JSON.stringify(c.uploads));
    ok('admin site: preview shown + default theme applied live', !!q(c, '.logo-prev') && c.doc.documentElement.dataset.theme === 'light');
    const old = row.logo_path; c.w.FormData = FD; q(c, '#siteForm').elements.rm_logo.checked = true; await sub();
    const row2 = db.app_settings.find(x => x.key === 'site').value;
    ok('admin site: logo removed + file purged', row2.logo_path === null && c.removed.some(r => r[0] === 'site-assets' && r[1].includes(old)), JSON.stringify(c.removed));
    q(c, '#siteForm').elements.site_name.value = ''; await sub(); ok('admin site: empty name allowed (back to default)', db.app_settings.find(x => x.key === 'site').value.site_name === '');
    ok('admin nav has site page', !!q(c, '#sideNav [data-view=site]'));
  });

  const pass = R.filter(r => r[1]).length, fail = R.filter(r => !r[1]);
  console.log(`PASSED ${pass} / ${R.length}`);
  fail.forEach(r => console.log('FAIL:', r[0], '=>', r[2]));
  const uniq = [...new Set(ERRS)]; console.log('console/jsdom errors:', uniq.length ? '\n' + uniq.join('\n') : 'none');
  process.exit(0);
})();
