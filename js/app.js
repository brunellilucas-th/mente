// Mente — núcleo de la app: navegación, guardado, récords, racha y actualizaciones.
const APP_VERSION = "3";
const CACHE = "mente";

const App = (() => {
  const games = [];
  let cleanup = null;

  // ---------- helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "html") e.innerHTML = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
    return e;
  }
  const store = {
    get(k, d) { try { const v = localStorage.getItem("mente:" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("mente:" + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem("mente:" + k); } catch (e) {} },
  };
  let toastT;
  function toast(msg, ms = 2200) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), ms);
  }
  const fmtTime = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const dayNum = (d = new Date()) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);

  // Cronómetro que se pausa solo cuando la app pasa a segundo plano.
  function timer(onTick, start = 0) {
    let base = start, t0 = null, iv = null;
    const now = () => base + (t0 ? (Date.now() - t0) / 1000 : 0);
    const run = () => { if (t0) return; t0 = Date.now(); iv = setInterval(() => onTick(now()), 250); onTick(now()); };
    const stop = () => { if (!t0) return; base = now(); t0 = null; clearInterval(iv); };
    const vis = () => { if (document.hidden) { stop(); T.paused = true; } else if (T.paused) { T.paused = false; if (!T.ended) run(); } };
    document.addEventListener("visibilitychange", vis);
    const T = { run, stop, get: now, paused: false, ended: false,
      end() { T.ended = true; stop(); }, kill() { stop(); document.removeEventListener("visibilitychange", vis); } };
    return T;
  }

  // ---------- récords y racha ----------
  // better: "low" (menos es mejor: tiempos, movimientos) o "high" (puntaje)
  function record(game, key, value, better) {
    const all = store.get("rec", {}); const g = all[game] || (all[game] = {});
    const prev = g[key];
    const isBest = prev == null || (better === "low" ? value < prev : value > prev);
    if (isBest) { g[key] = value; store.set("rec", all); }
    return { isBest, prev };
  }
  const getRec = (game, key) => (store.get("rec", {})[game] || {})[key];

  function played() {
    const days = store.get("days", []); const t = dayNum();
    if (days[days.length - 1] !== t) { days.push(t); store.set("days", days.slice(-400)); }
    const c = store.get("count", 0) + 1; store.set("count", c);
  }
  function streak() {
    const days = store.get("days", []); if (!days.length) return 0;
    const t = dayNum(); let last = days[days.length - 1];
    if (last < t - 1) return 0;
    let n = 1;
    for (let i = days.length - 2; i >= 0; i--) { if (days[i] === last - 1) { n++; last = days[i]; } else break; }
    return n;
  }

  // ---------- niveles que se desbloquean ----------
  // Un nivel se habilita después de ganar NEED partidas en el nivel anterior.
  const NEED = 3;
  const winsOf = (game, id) => (store.get("wins", {})[game + ":" + id] || 0);
  function unlocked(game, levels, i) {
    if (i === 0) return true;
    return winsOf(game, levels[i - 1].id) >= NEED || winsOf(game, levels[i].id) > 0 || getRec(game, levels[i].id) != null;
  }
  // Botón para la lista de niveles: jugable o con candado.
  function levelBtn(game, levels, i, sub, onPick) {
    const L = levels[i];
    if (unlocked(game, levels, i)) return el("button", { onclick: () => onPick(L) }, el("b", {}, L.name), el("small", {}, sub));
    const prev = levels[i - 1], falta = NEED - winsOf(game, prev.id);
    return el("button", { class: "locked", disabled: true }, el("b", {}, "🔒 " + L.name),
      el("small", {}, `Ganá ${falta} ${falta === 1 ? "partida" : "partidas"} más en ${prev.name} para desbloquearlo`));
  }
  // Suma una victoria; si con ella se habilita el nivel siguiente, lo devuelve.
  function winLevel(game, levels, id) {
    const i = levels.findIndex(l => l.id === id), next = levels[i + 1];
    const before = next ? unlocked(game, levels, i + 1) : true;
    const w = store.get("wins", {}); w[game + ":" + id] = (w[game + ":" + id] || 0) + 1; store.set("wins", w);
    return next && !before && unlocked(game, levels, i + 1) ? next : null;
  }
  const unlockText = nx => nx ? `<br><b>🔓 ¡Desbloqueaste ${nx.name}!</b>` : "";

  // ---------- ventana de resultado ----------
  function modal({ icon = "🎉", title, text, buttons = [] }) {
    const ov = el("div", { class: "overlay" });
    const close = () => ov.remove();
    ov.append(el("div", { class: "card" },
      el("div", { class: "big" }, icon), el("h2", {}, title), text ? el("p", { class: "muted", html: text }) : null,
      el("div", { class: "row" }, buttons.map(b => el("button", { class: "btn" + (b.ghost ? " ghost" : ""), onclick: () => { close(); b.do && b.do(); } }, b.label)))));
    document.body.append(ov);
    return close;
  }

  // ---------- navegación ----------
  function register(g) { games.push(g); }
  function setHeader(title, isHome) {
    $("#title").textContent = title; $("#back").hidden = isHome; $("#right").innerHTML = "";
  }
  function render() {
    if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
    document.querySelectorAll(".overlay").forEach(o => o.remove());
    const id = location.hash.replace(/^#\/?/, "");
    const g = games.find(x => x.id === id);
    const view = $("#view"); view.innerHTML = ""; window.scrollTo(0, 0);
    if (!g) { setHeader("Mente", true); home(view); return; }
    setHeader(g.name, false);
    const ctx = { right: (...nodes) => { $("#right").innerHTML = ""; $("#right").append(...nodes); }, title: t => $("#title").textContent = t };
    cleanup = g.mount(view, ctx) || null;
  }
  const go = id => { location.hash = id ? "#/" + id : ""; };

  function home(view) {
    const s = streak(), n = store.get("count", 0);
    view.append(
      el("div", { class: "hero" },
        el("div", { class: "card" }, el("b", {}, s + (s === 1 ? " día" : " días")), el("span", {}, "racha jugando")),
        el("div", { class: "card" }, el("b", {}, String(n)), el("span", {}, "partidas terminadas"))),
      el("div", { class: "games" }, games.map(g => el("button", { class: "game", onclick: () => go(g.id) },
        el("span", { class: "ic" }, g.icon), el("b", {}, g.name), el("small", {}, g.desc),
        el("span", { class: "rec" }, (g.summary && g.summary()) || ""))))
    );
    const btn = el("button", { class: "btn ghost", onclick: () => update(btn, false) }, "Actualizar");
    view.append(el("div", { class: "foot card" },
      el("div", { class: "spread" }, el("b", {}, "Actualizaciones"), el("span", { class: "muted stat" }, "versión " + APP_VERSION)),
      el("p", {}, "La app funciona sin internet. Si le hago cambios, tocá Actualizar estando en Wi-Fi."),
      btn));
  }

  // ---------- actualizaciones ----------
  // Solo usa internet cuando tocás "Actualizar", o sola si el teléfono informa que está en Wi-Fi.
  async function update(btn, silent) {
    const label = btn && btn.textContent;
    const busy = t => { if (btn) { btn.disabled = true; btn.textContent = t; } };
    const reset = () => { if (btn) { btn.disabled = false; btn.textContent = label; } };
    busy("Buscando…");
    let info;
    try { const r = await fetch("version.json?t=" + Date.now(), { cache: "no-store" }); if (!r.ok) throw 0; info = await r.json(); }
    catch (e) { if (!silent) toast("Sin conexión. Probá cuando estés en Wi-Fi"); reset(); return; }
    if (String(info.version) === APP_VERSION) { if (!silent) toast("Ya tenés la última versión"); reset(); return; }
    busy("Descargando…");
    try {
      const c = await caches.open(CACHE);
      const got = [];
      for (const f of info.files) {
        const res = await fetch(f + "?upd=" + Date.now(), { cache: "reload" });
        if (!res.ok) throw new Error(f);
        got.push([f === "./" ? "index.html" : f, res]);
      }
      for (const [k, res] of got) await c.put(k, res);
      if (silent) { toast("Se descargó una versión nueva: se aplica la próxima vez que abras la app", 3500); reset(); }
      else { toast("Actualizada"); setTimeout(() => location.reload(), 600); }
    } catch (e) { if (!silent) toast("No se pudo actualizar. Probá de nuevo con Wi-Fi"); reset(); }
  }
  function autoUpdateOnWifi() {
    // iPhone no informa el tipo de conexión; en ese caso no hace nada y queda el botón.
    const c = navigator.connection;
    if (c && c.type === "wifi" && navigator.onLine) update(null, true);
  }

  function start() {
    $("#back").addEventListener("click", () => go(""));
    window.addEventListener("hashchange", render);
    render();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {});
    }
    setTimeout(autoUpdateOnWifi, 1500);
    const c = navigator.connection;
    if (c && c.addEventListener) c.addEventListener("change", autoUpdateOnWifi);
  }

  return { register, start, el, $, store, toast, fmtTime, shuffle, rnd, dayNum, timer, record, getRec, played, modal, go, levelBtn, winLevel, unlockText, NEED };
})();
