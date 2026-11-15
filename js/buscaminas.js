(() => {
  const { el, fmtTime, timer, record, getRec, played, modal } = App;
  const LEVELS = [
    { id: "facil", name: "Fácil", w: 9, h: 9, m: 10 },
    { id: "medio", name: "Medio", w: 12, h: 14, m: 28 },
    { id: "dificil", name: "Difícil", w: 14, h: 18, m: 50 },
  ];

  function mount(view, ctx) {
    let T = null;
    function chooser() {
      if (T) { T.kill(); T = null; } ctx.right(); view.innerHTML = "";
      view.append(el("p", { class: "muted" }, "Tocá para abrir una casilla. Mantené apretado (o usá el modo 🚩) para marcar una mina."),
        el("div", { class: "levels" }, LEVELS.map(L => {
          const b = getRec("buscaminas", L.id);
          return el("button", { onclick: () => play(L) }, el("b", {}, L.name), el("small", {}, `${L.w}×${L.h} · ${L.m} minas` + (b != null ? ` · récord ${fmtTime(b)}` : "")));
        })));
    }
    function play(L) {
      if (T) T.kill();
      view.innerHTML = "";
      const N = L.w * L.h;
      let mine = null, num = new Array(N).fill(0), open = new Array(N).fill(false), flag = new Array(N).fill(false);
      let flagMode = false, over = false, opened = 0;
      const nb = i => { const x = i % L.w, y = Math.floor(i / L.w), r = [];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < L.w && ny < L.h) r.push(ny * L.w + nx); } return r; };
      function seed(first) {
        const safe = new Set([first, ...nb(first)]); mine = new Array(N).fill(false);
        let placed = 0;
        while (placed < L.m) { const i = Math.floor(Math.random() * N); if (!mine[i] && !safe.has(i)) { mine[i] = true; placed++; } }
        for (let i = 0; i < N; i++) num[i] = nb(i).filter(j => mine[j]).length;
      }
      const leftEl = el("span", { class: "stat" }), timeEl = el("span", { class: "stat" });
      const modeBtn = el("button", { class: "chip", onclick: () => { flagMode = !flagMode; modeBtn.classList.toggle("on", flagMode); modeBtn.textContent = flagMode ? "🚩 Marcando" : "⛏️ Abriendo"; } }, "⛏️ Abriendo");
      ctx.right(el("button", { class: "btn small ghost", onclick: () => play(L) }, "Nuevo"));
      const grid = el("div", { class: "mines", style: `grid-template-columns:repeat(${L.w},1fr)` });
      for (let i = 0; i < N; i++) grid.append(el("button", { "data-i": i }));
      view.append(el("div", { class: "bar" }, leftEl, modeBtn, timeEl), grid,
        el("p", { class: "muted center", style: "font-size:13px" }, "Tocá un número con sus minas ya marcadas para abrir las de alrededor."));
      T = timer(t => timeEl.textContent = "⏱ " + fmtTime(t));
      timeEl.textContent = "⏱ 0:00";

      function reveal(i) {
        if (open[i] || flag[i]) return;
        if (mine[i]) { lose(i); return; }
        const st = [i];
        while (st.length) {
          const k = st.pop(); if (open[k] || flag[k]) continue;
          open[k] = true; opened++;
          if (!num[k]) for (const j of nb(k)) if (!open[j] && !mine[j]) st.push(j);
        }
      }
      function act(i, asFlag) {
        if (over) return;
        if (!mine) { if (asFlag) return; seed(i); T.run(); }
        if (asFlag) { if (!open[i]) { flag[i] = !flag[i]; navigator.vibrate && navigator.vibrate(30); } }
        else if (open[i]) {
          const ns = nb(i);
          if (num[i] && ns.filter(j => flag[j]).length === num[i]) for (const j of ns) { reveal(j); if (over) break; }
        } else reveal(i);
        draw();
        if (!over && opened === N - L.m) win();
      }
      function lose(i) {
        over = true; T.end();
        grid.children[i].classList.add("boom");
        for (let k = 0; k < N; k++) if (mine[k]) open[k] = true;
        draw();
        setTimeout(() => modal({ icon: "💥", title: "¡Boom!", text: "Pisaste una mina.", buttons: [{ label: "Otra vez", do: () => play(L) }, { label: "Ver tablero", ghost: true }] }), 400);
      }
      function win() {
        over = true; T.end(); played();
        for (let k = 0; k < N; k++) if (mine[k]) flag[k] = true;
        draw();
        const r = record("buscaminas", L.id, Math.round(T.get()), "low");
        modal({ icon: "🚩", title: "¡Despejado!", text: `${L.name} en <b>${fmtTime(T.get())}</b>` + (r.isBest ? "<br>¡Nuevo récord!" : ""),
          buttons: [{ label: "Otra vez", do: () => play(L) }, { label: "Niveles", ghost: true, do: chooser }] });
      }
      function draw() {
        let f = 0;
        [...grid.children].forEach((b, i) => {
          if (flag[i]) f++;
          const o = open[i];
          b.classList.toggle("o", o);
          b.className = b.className.replace(/\bn\d\b/g, "").trim();
          if (o && mine && mine[i]) b.textContent = "💣";
          else if (o) { b.textContent = num[i] || ""; if (num[i]) b.classList.add("n" + num[i]); }
          else b.textContent = flag[i] ? "🚩" : "";
        });
        leftEl.textContent = "💣 " + (L.m - f);
      }
      // toque corto = acción del modo; toque largo = bandera
      let pt = null, fired = false;
      grid.addEventListener("pointerdown", e => {
        const b = e.target.closest("button"); if (!b) return;
        fired = false; clearTimeout(pt);
        pt = setTimeout(() => { fired = true; act(+b.dataset.i, true); }, 420);
      });
      const cancel = () => clearTimeout(pt);
      grid.addEventListener("pointerleave", cancel); grid.addEventListener("pointercancel", cancel);
      grid.addEventListener("pointerup", e => {
        clearTimeout(pt); const b = e.target.closest("button"); if (!b || fired) return;
        act(+b.dataset.i, flagMode);
      });
      grid.addEventListener("contextmenu", e => e.preventDefault());
      draw();
    }
    chooser();
    return () => { if (T) T.kill(); };
  }

  App.register({ id: "buscaminas", name: "Buscaminas", icon: "💣", desc: "Deducción", mount,
    summary: () => { const b = getRec("buscaminas", "facil"); return b != null ? `Récord fácil: ${fmtTime(b)}` : ""; } });
})();
