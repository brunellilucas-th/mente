(() => {
  const { el, store, fmtTime, shuffle, timer, record, getRec, played, modal, toast, levelBtn, winLevel, unlockText } = App;
  const LEVELS = [
    { id: "facil", name: "Fácil", clues: 40, desc: "Para entrar en calor" },
    { id: "medio", name: "Medio", clues: 32, desc: "Hay que pensar un poco" },
    { id: "dificil", name: "Difícil", clues: 26, desc: "Requiere deducción fina" },
  ];
  const BOX = i => (Math.floor(i / 27) * 3) + Math.floor((i % 9) / 3);
  const PEERS = Array.from({ length: 81 }, (_, i) => {
    const s = new Set(), r = Math.floor(i / 9), c = i % 9, b = BOX(i);
    for (let j = 0; j < 81; j++) if (j !== i && (Math.floor(j / 9) === r || j % 9 === c || BOX(j) === b)) s.add(j);
    return [...s];
  });
  const bits = m => { let n = 0; while (m) { m &= m - 1; n++; } return n; };

  // Cuenta soluciones (hasta "limit"). Si fill=true deja la grilla resuelta con dígitos al azar.
  function solve(g, limit, fill) {
    const R = new Array(9).fill(0), C = new Array(9).fill(0), B = new Array(9).fill(0);
    for (let i = 0; i < 81; i++) if (g[i]) { const m = 1 << g[i]; R[Math.floor(i / 9)] |= m; C[i % 9] |= m; B[BOX(i)] |= m; }
    let count = 0;
    const rec = () => {
      let best = -1, bm = 0, bn = 10;
      for (let i = 0; i < 81; i++) if (!g[i]) {
        const m = ~(R[Math.floor(i / 9)] | C[i % 9] | B[BOX(i)]) & 0x3fe, n = bits(m);
        if (n < bn) { bn = n; best = i; bm = m; if (!n) return false; }
      }
      if (best < 0) { count++; return fill || count >= limit; }
      const r = Math.floor(best / 9), c = best % 9, b = BOX(best);
      let ds = []; for (let v = 1; v <= 9; v++) if (bm & (1 << v)) ds.push(v);
      if (fill) shuffle(ds);
      for (const v of ds) {
        const m = 1 << v; g[best] = v; R[r] |= m; C[c] |= m; B[b] |= m;
        if (rec()) return true;
        g[best] = 0; R[r] &= ~m; C[c] &= ~m; B[b] &= ~m;
      }
      return false;
    };
    rec();
    return count;
  }
  function generate(clues) {
    const sol = new Array(81).fill(0); solve(sol, 1, true);
    const p = sol.slice(); let left = 81;
    for (const i of shuffle([...Array(81).keys()])) {
      if (left <= clues) break;
      const v = p[i]; p[i] = 0;
      if (solve(p.slice(), 2, false) !== 1) p[i] = v; else left--;
    }
    return { puzzle: p, sol };
  }

  function mount(view, ctx) {
    let S = store.get("sudoku"), T = null, sel = -1, notes = false, undo = [];
    const newBtn = el("button", { class: "btn small ghost", onclick: () => chooser() }, "Nuevo");

    function chooser() {
      if (T) { T.kill(); T = null; }
      ctx.right(); view.innerHTML = "";
      view.append(el("p", { class: "muted" }, "Elegí la dificultad. Cada nivel se desbloquea ganando 3 partidas del anterior sin usar pistas."),
        el("div", { class: "levels" }, LEVELS.map((L, i) => {
          const b = getRec("sudoku", L.id);
          return levelBtn("sudoku", LEVELS, i, L.desc + (b != null ? " · récord " + fmtTime(b) : ""), start);
        })));
      if (S && !S.done) view.append(el("button", { class: "btn ghost", style: "margin-top:14px;width:100%", onclick: () => play() }, "Seguir con la partida guardada"));
    }
    function start(L) {
      view.innerHTML = ""; view.append(el("p", { class: "center muted" }, "Armando el tablero…"));
      setTimeout(() => {
        const { puzzle, sol } = generate(L.clues);
        S = { level: L.id, puzzle, sol, cur: puzzle.slice(), notes: new Array(81).fill(0), time: 0, errors: 0, hints: 0, done: false };
        undo = []; sel = -1; save(); play();
      }, 30);
    }
    const save = () => { if (S) { if (T) S.time = T.get(); store.set("sudoku", S); } };

    let boardEl, padEl, timeEl, errEl, notesBtn;
    function play() {
      view.innerHTML = ""; ctx.right(newBtn);
      const L = LEVELS.find(l => l.id === S.level);
      timeEl = el("span", { class: "stat" }); errEl = el("span", { class: "stat" });
      boardEl = el("div", { class: "sdk" });
      for (let i = 0; i < 81; i++) {
        const c = el("div", { onclick: () => { sel = i; draw(); } });
        if (i % 9 === 2 || i % 9 === 5) c.classList.add("c3");
        if (Math.floor(i / 9) === 2 || Math.floor(i / 9) === 5) c.classList.add("r3");
        boardEl.append(c);
      }
      padEl = el("div", { class: "pad" });
      for (let v = 1; v <= 9; v++) padEl.append(el("button", { onclick: () => input(v) }, String(v), el("small")));
      notesBtn = el("button", { onclick: () => { notes = !notes; draw(); } }, el("i", {}, "✏️"), "Lápiz");
      view.append(
        el("div", { class: "bar" }, el("span", {}, L.name), errEl, timeEl),
        boardEl, padEl,
        el("div", { class: "tools" },
          el("button", { onclick: doUndo }, el("i", {}, "↩️"), "Deshacer"),
          el("button", { onclick: () => input(0) }, el("i", {}, "⌫"), "Borrar"),
          notesBtn,
          el("button", { onclick: hint }, el("i", {}, "💡"), "Pista")));
      T = timer(t => { timeEl.textContent = "⏱ " + fmtTime(t); }, S.time);
      if (!S.done) T.run(); else T.end();
      draw();
    }
    function input(v) {
      if (S.done || sel < 0 || S.puzzle[sel]) return;
      const i = sel;
      if (notes && v) {
        if (S.cur[i]) return;
        undo.push([i, S.cur[i], S.notes[i]]); S.notes[i] ^= 1 << v;
      } else {
        if (S.cur[i] === v && v) return;
        undo.push([i, S.cur[i], S.notes[i]]);
        S.cur[i] = v; S.notes[i] = 0;
        if (v && v !== S.sol[i]) { S.errors++; navigator.vibrate && navigator.vibrate(60); }
        if (v && v === S.sol[i]) for (const p of PEERS[i]) S.notes[p] &= ~(1 << v);
      }
      save(); draw(); check();
    }
    function doUndo() {
      if (S.done || !undo.length) return;
      const [i, v, n] = undo.pop(); S.cur[i] = v; S.notes[i] = n; sel = i; save(); draw();
    }
    function hint() {
      if (S.done) return;
      let i = sel;
      if (i < 0 || S.cur[i] === S.sol[i]) {
        const opts = []; for (let j = 0; j < 81; j++) if (S.cur[j] !== S.sol[j]) opts.push(j);
        if (!opts.length) return; i = opts[Math.floor(Math.random() * opts.length)];
      }
      undo.push([i, S.cur[i], S.notes[i]]);
      S.cur[i] = S.sol[i]; S.notes[i] = 0; S.hints++; sel = i;
      for (const p of PEERS[i]) S.notes[p] &= ~(1 << S.sol[i]);
      save(); draw(); check();
    }
    function check() {
      for (let i = 0; i < 81; i++) if (S.cur[i] !== S.sol[i]) return;
      T.end(); S.time = T.get(); S.done = true; store.set("sudoku", S); played();
      const L = LEVELS.find(l => l.id === S.level);
      const r = S.hints ? { isBest: false } : record("sudoku", S.level, Math.round(S.time), "low");
      const nx = S.hints ? null : winLevel("sudoku", LEVELS, S.level);
      modal({ icon: "🧩", title: "¡Resuelto!", text: `${L.name} en <b>${fmtTime(S.time)}</b> · ${S.errors} error${S.errors === 1 ? "" : "es"}` +
        (S.hints ? `<br>Usaste ${S.hints} pista${S.hints === 1 ? "" : "s"} (no cuenta como récord ni para desbloquear niveles)` : r.isBest ? "<br>¡Nuevo récord!" : "") + unlockText(nx),
        buttons: nx ? [{ label: "Jugar " + nx.name, do: () => start(nx) }, { label: "Ver tablero", ghost: true }] : [{ label: "Otro", do: chooser }, { label: "Ver tablero", ghost: true }] });
      draw();
    }
    function draw() {
      const sv = sel >= 0 ? S.cur[sel] : 0;
      const peers = sel >= 0 ? new Set(PEERS[sel]) : new Set();
      const count = new Array(10).fill(0);
      for (let i = 0; i < 81; i++) if (S.cur[i] && S.cur[i] === S.sol[i]) count[S.cur[i]]++;
      [...boardEl.children].forEach((c, i) => {
        const v = S.cur[i];
        c.classList.toggle("g", !!S.puzzle[i]);
        c.classList.toggle("sel", i === sel);
        c.classList.toggle("hl", peers.has(i));
        c.classList.toggle("same", !!sv && v === sv && i !== sel);
        c.classList.toggle("err", !!v && v !== S.sol[i]);
        if (v) c.textContent = v;
        else if (S.notes[i]) { c.innerHTML = ""; const n = el("div", { class: "nt" }); for (let d = 1; d <= 9; d++) n.append(el("span", {}, S.notes[i] & (1 << d) ? String(d) : "")); c.append(n); }
        else c.textContent = "";
      });
      [...padEl.children].forEach((b, k) => { b.classList.toggle("done", count[k + 1] >= 9); b.lastChild.textContent = 9 - count[k + 1] || ""; });
      notesBtn.classList.toggle("on", notes);
      errEl.textContent = "❌ " + S.errors;
    }

    if (S && !S.done) play(); else chooser();
    return () => { save(); if (T) T.kill(); };
  }

  App.register({ id: "sudoku", name: "Sudoku", icon: "🔢", desc: "Lógica y concentración", mount,
    summary: () => { const r = ["facil", "medio", "dificil"].map(k => getRec("sudoku", k)); const i = r.findLastIndex(x => x != null); return i < 0 ? "" : `Récord ${LEVELS[i].name.toLowerCase()}: ${fmtTime(r[i])}`; } });
})();
