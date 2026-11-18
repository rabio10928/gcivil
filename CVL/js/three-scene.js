(() => {
  const canvas = document.getElementById('bg3d');
  if (!canvas || !window.THREE) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let r;
  try { r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
  catch (e) { canvas.remove(); return; }
  r.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a1628, 16, 38);
  const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  const ambient = new THREE.AmbientLight(0x8fb0ff, 0.7); scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(6, 12, 8); scene.add(sun);
  const rim = new THREE.PointLight(0x22d3ee, 1.6, 40); rim.position.set(-7, 5, -5); scene.add(rim);

  const grid = new THREE.GridHelper(40, 40, 0x22d3ee, 0x2f6bff);
  grid.material.transparent = true; grid.material.opacity = 0.2; scene.add(grid);

  const M = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.45, metalness: 0.35 }, o));
  const concrete = M(0xb9c7e0, { metalness: 0.1 }), steel = M(0x2f6bff), amber = M(0xffb020), white = M(0xffffff);
  const glass = M(0x22d3ee, { transparent: true, opacity: 0.28 });
  const model = new THREE.Group(); scene.add(model);
  const part = (w, h, d, m, x, y, z, p) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    s.position.set(x, y, z); (p || model).add(s); return s;
  };

  // مبنى قيد الإنشاء: بلاطات وأعمدة وواجهات زجاجية للطوابق السفلية
  for (let f = 0; f <= 6; f++) {
    part(3, 0.12, 3, concrete, 0, f * 0.9, 0);
    if (f < 6) {
      [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]].forEach(([x, z]) => part(0.14, 0.9, 0.14, concrete, x, f * 0.9 + 0.45, z));
      if (f < 4) part(2.9, 0.78, 2.9, glass, 0, f * 0.9 + 0.45, 0);
    }
  }

  // رافعة برجية
  part(0.2, 8, 0.2, amber, 3.4, 4, 0);
  const jib = new THREE.Group(); jib.position.set(3.4, 8, 0); model.add(jib);
  part(5.5, 0.18, 0.18, amber, -1.6, 0, 0, jib);
  part(1.4, 0.4, 0.4, steel, 1.6, -0.1, 0, jib);
  const hook = new THREE.Group(); hook.position.set(-3.6, 0, 0); jib.add(hook);
  part(0.02, 3, 0.02, white, 0, -1.5, 0, hook);
  part(0.3, 0.3, 0.3, steel, 0, -3, 0, hook);

  // جسر معلّق
  part(11, 0.25, 1.2, concrete, -1, 1.2, -4.5);
  const cable = new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.6 });
  [-4.5, 2.5].forEach(px => {
    part(0.3, 3.6, 0.3, steel, px, 1.8, -4.5);
    for (let i = -3; i <= 3; i++) {
      if (!i) continue;
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(px, 3.5, -4.5), new THREE.Vector3(px + i * 0.6, 1.3, -4.5)]);
      model.add(new THREE.Line(g, cable));
    }
  });

  const mouse = { x: 0, y: 0 }; let sy = 0, t = 0, raf;
  function draw() {
    cam.position.x += (mouse.x * 1.5 - cam.position.x) * 0.04;
    cam.position.y += (4.5 - mouse.y * 0.8 - cam.position.y) * 0.04;
    cam.lookAt(0, 3, 0);
    model.rotation.y = -0.5 + t * 0.12 + sy * 0.0012;
    jib.rotation.y = Math.sin(t * 0.5) * 0.35;
    r.render(scene, cam);
  }
  function loop(ms) { t = ms / 1000; draw(); raf = requestAnimationFrame(loop); }
  function layout() {
    const w = innerWidth, h = innerHeight, mob = w < 820;
    r.setSize(w, h, false); cam.aspect = w / h;
    model.position.set(mob ? 0 : -3.6, mob ? 1.2 : 0, 0);
    model.scale.setScalar(mob ? 0.8 : 1);
    cam.position.set(0, 4.5, mob ? 17 : 15);
    cam.updateProjectionMatrix(); draw();
  }

  addEventListener('resize', layout);
  addEventListener('scroll', () => { sy = pageYOffset; if (still) draw(); }, { passive: true });
  addEventListener('pointermove', e => { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf);
    if (!document.hidden && !still) raf = requestAnimationFrame(loop);
  });
  // يتكيف مع الوضع الفاتح/الداكن
  function applyTheme() {
    const l = document.documentElement.dataset.theme === 'light';
    scene.fog.color.set(l ? 0xf3f6fc : 0x0a1628); grid.material.opacity = l ? 0.45 : 0.2; ambient.intensity = l ? 1.0 : 0.7;
    draw();
  }
  addEventListener('themechange', applyTheme);
  applyTheme();
  layout();
  if (!still) raf = requestAnimationFrame(loop);
})();
