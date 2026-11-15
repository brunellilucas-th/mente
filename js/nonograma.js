(() => {
  const { el, store, fmtTime, timer, record, getRec, played, modal } = App;
  const LEVELS = [
    { id: "5", name: "Fácil", n: 5, desc: "5×5" },
    { id: "8", name: "Medio", n: 8, desc: "8×8" },
    { id: "10", name: "Difícil", n: 10, desc: "10×10" },
  ];
  const runs = a => { const r = []; let c = 0; for (const v of a) { if (v) c++; else if (c) { r.push(c); c = 0; } } if (c) r.push(c); return r; };
  const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

  function mount(view, ctx) {
    let S = store.get("nono"), T = null, cleanupExtra = null;
    function chooser() {
      if (T) { T.kill(); T = null; } ctx.right(); view.innerHTML = "";
      view.append(el("p", { class: "muted" }, "Pintá las casillas según los números: cada número es un bloque seguido de casillas pintadas, en ese orden, con al menos un espacio entre bloques."),
        el("div", { class: "levels" }, LEVELS.map(L => {
          const b = getRec("nonograma", L.id);
          return el("button", { onclick: () => start(L) }, el("b", {}, L.name), el("small", {}, L.desc + (b != null ? ` · récord ${fmtTime(b)}` : "")));
        })));
      if (S && !S.done) view.append(el("button", { class: "btn ghost", style: "margin-top:14px;width:100%", onclick: play }, "Seguir con la partida guardada"));
    }
    function start(L) {
      if (T) { T.kill(); T = null; }
      const n = L.n, sol = [];
      for (let i = 0; i < n * n; i++) sol.push(Math.random() < 0.58 ? 1 : 0);
      S = { level: L.id, n, sol, cur: new Array(n * n).fill(0), time: 0, done: false };
      save(); play();
    }
    const save = () => { if (S) { if (T) S.time = T.get(); store.set("nono", S); } };

    function play() {
      if (cleanupExtra) cleanupExtra();
      if (T) T.kill();
      view.innerHTML = "";
      const n = S.n, L = LEVELS.find(l => l.id === S.level);
      const rowC = [], colC = [];
      for (let r = 0; r < n; r++) rowC.push(runs(S.sol.slice(r * n, r * n + n)));
      for (let c = 0; c < n; c++) colC.push(runs(S.sol.filter((_, i) => i % n === c)));
      const maxR = Math.max(...rowC.map(x => x.length || 1)), maxC = Math.max(...colC.map(x => x.length || 1));
      const avail = Math.min(document.documentElement.clientWidth - 28, 532);
      const clueW = Math.max(28, maxR * 14 + 8);
      const cs = Math.floor((avail - clueW) / n);
      const board = el("div", { class: "nono", style: `grid-template-columns:${clueW}px repeat(${n},${cs}px);grid-template-rows:${maxC * 14 + 8}px repeat(${n},${cs}px)` });
      board.append(el("div"));
      const colEls = colC.map(c => el("div", { class: "cl col" }, (c.length ? c : [0]).map(v => el("span", {}, String(v)))));
      board.append(...colEls);
      const rowEls = [], cells = [];
      for (let r = 0; r < n; r++) {
        const re = el("div", { class: "cl rw" }, (rowC[r].length ? rowC[r] : [0]).map(v => el("span", {}, String(v))));
        rowEls.push(re); board.append(re);
        for (let c = 0; c < n; c++) {
          const i = r * n + c;
          const ce = el("div", { class: "c", "data-i": i });
          if (c === 0) ce.classList.add("l0"); if (r === 0) ce.classList.add("t0");
          if (c % 5 === 4 || c === n - 1) ce.classList.add("b5"); if (r % 5 === 4 || r === n - 1) ce.classList.add("d5");
          cells.push(ce); board.append(ce);
        }
      }
      let mode = 1; // 1 pintar, 2 marcar X
      const timeEl = el("span", { class: "stat" });
      const bPaint = el("button", { class: "chip on", onclick: () => setMode(1) }, "■ Pintar");
      const bX = el("button", { class: "chip", onclick: () => setMode(2) }, "✕ Marcar vacía");
      const setMode = m => { mode = m; bPaint.classList.toggle("on", m === 1); bX.classList.toggle("on", m === 2); };
      ctx.right(el("button", { class: "btn small ghost", onclick: chooser }, "Nuevo"));
      view.append(el("div", { class: "bar" }, el("span", {}, `${L.name} ${n}×${n}`), timeEl),
        el("div", { class: "row", style: "justify-content:center;margin-bottom:12px" }, bPaint, bX),
        board,
        el("p", { class: "muted center", style: "font-size:13px" }, "Podés arrastrar el dedo para pintar varias casillas de una."));
      T = timer(t => timeEl.textContent = "⏱ " + fmtTime(t), S.time);
      if (S.done) T.end(); else T.run();

      // pintar arrastrando
      let target = null, touched = new Set();
      const apply = i => {
        if (S.done || touched.has(i)) return; touched.add(i);
        S.cur[i] = target; drawCell(i);
      };
      board.addEventListener("pointerdown", e => {
        const c = e.target.closest(".c"); if (!c || S.done) return;
        e.preventDefault();
        const i = +c.dataset.i; target = S.cur[i] === mode ? 0 : mode; touched = new Set(); apply(i);
      });
      board.addEventListener("pointermove", e => {
        if (target == null) return;
        const c = document.elementFromPoint(e.clientX, e.clientY); const cc = c && c.closest && c.closest(".c");
        if (cc && board.contains(cc)) apply(+cc.dataset.i);
      });
      const up = () => { if (target == null) return; target = null; save(); clues(); };
      window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
      cleanupExtra = () => { window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };

      function drawCell(i) { const v = S.cur[i]; cells[i].classList.toggle("f", v === 1); cells[i].textContent = v === 2 ? "✕" : ""; }
      function clues() {
        let all = true;
        for (let r = 0; r < n; r++) { const ok = same(runs(S.cur.slice(r * n, r * n + n).map(v => v === 1)), rowC[r]); rowEls[r].classList.toggle("ok", ok); all = all && ok; }
        for (let c = 0; c < n; c++) { const ok = same(runs(S.cur.filter((_, i) => i % n === c).map(v => v === 1)), colC[c]); colEls[c].classList.toggle("ok", ok); all = all && ok; }
        if (all && !S.done) {
          S.done = true; T.end(); S.time = T.get(); store.set("nono", S); played();
          for (let i = 0; i < n * n; i++) if (S.cur[i] !== 1) { S.cur[i] = 2; drawCell(i); }
          const r = record("nonograma", S.level, Math.round(S.time), "low");
          setTimeout(() => modal({ icon: "🖼️", title: "¡Resuelto!", text: `${n}×${n} en <b>${fmtTime(S.time)}</b>` + (r.isBest ? "<br>¡Nuevo récord!" : ""),
            buttons: [{ label: "Otro", do: () => start(L) }, { label: "Niveles", ghost: true, do: chooser }] }), 250);
        }
      }
      cells.forEach((_, i) => drawCell(i)); clues();
    }
    if (S && !S.done) play(); else chooser();
    return () => { save(); if (T) T.kill(); if (cleanupExtra) cleanupExtra(); };
  }

  App.register({ id: "nonograma", name: "Nonograma", icon: "🖼️", desc: "Lógica con imágenes", mount,
    summary: () => { const b = getRec("nonograma", "5"); return b != null ? `Récord 5×5: ${fmtTime(b)}` : ""; } });
})();
