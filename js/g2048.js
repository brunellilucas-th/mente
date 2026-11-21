(() => {
  const { el, store, record, getRec, played, modal } = App;
  const COLORS = { 2: "#f1e7da", 4: "#ead8c0", 8: "#f2c49b", 16: "#eeb084", 32: "#e99f80", 64: "#e38c70", 128: "#eed38f", 256: "#e8c977", 512: "#e1bd5f", 1024: "#bcd6a9", 2048: "#a2cb97" };

  function mount(view, ctx) {
    let S = store.get("2048");
    const fresh = () => { const s = { g: new Array(16).fill(0), score: 0, over: false, won: false }; add(s); add(s); return s; };
    function add(s) {
      const e = []; s.g.forEach((v, i) => { if (!v) e.push(i); });
      if (!e.length) return -1;
      const i = e[Math.floor(Math.random() * e.length)]; s.g[i] = Math.random() < 0.9 ? 2 : 4; return i;
    }
    // dir: 0 izq, 1 der, 2 arriba, 3 abajo
    function lines(dir) {
      const L = [];
      for (let k = 0; k < 4; k++) {
        const l = [];
        for (let j = 0; j < 4; j++) l.push(dir < 2 ? k * 4 + j : j * 4 + k);
        if (dir === 1 || dir === 3) l.reverse();
        L.push(l);
      }
      return L;
    }
    function move(dir) {
      if (S.over) return;
      let moved = false, gained = 0;
      for (const l of lines(dir)) {
        const vals = l.map(i => S.g[i]).filter(Boolean), out = [];
        for (let i = 0; i < vals.length; i++) {
          if (vals[i] === vals[i + 1]) { out.push(vals[i] * 2); gained += vals[i] * 2; i++; } else out.push(vals[i]);
        }
        while (out.length < 4) out.push(0);
        l.forEach((idx, j) => { if (S.g[idx] !== out[j]) moved = true; S.g[idx] = out[j]; });
      }
      if (!moved) return;
      S.score += gained;
      const ni = add(S);
      if (!canMove()) S.over = true;
      store.set("2048", S); draw(ni);
      if (!S.won && S.g.some(v => v >= 2048)) {
        S.won = true; store.set("2048", S);
        modal({ icon: "🏆", title: "¡2048!", text: "Llegaste a la ficha 2048. Podés seguir sumando.", buttons: [{ label: "Seguir" }] });
      }
      if (S.over) end();
    }
    function canMove() {
      for (let i = 0; i < 16; i++) {
        if (!S.g[i]) return true;
        if (i % 4 < 3 && S.g[i] === S.g[i + 1]) return true;
        if (i < 12 && S.g[i] === S.g[i + 4]) return true;
      }
      return false;
    }
    function end() {
      played();
      const r = record("2048", "best", S.score, "high");
      record("2048", "tile", Math.max(...S.g), "high");
      setTimeout(() => modal({ icon: "🧱", title: "Sin movimientos", text: `Puntaje: <b>${S.score}</b>` + (r.isBest ? "<br>¡Nuevo récord!" : ""),
        buttons: [{ label: "Jugar de nuevo", do: restart }, { label: "Ver tablero", ghost: true }] }), 300);
    }
    function restart() { S = fresh(); store.set("2048", S); draw(); }

    const scoreEl = el("b", { class: "stat" }), bestEl = el("b", { class: "stat" });
    const board = el("div", { class: "b2048" });
    for (let i = 0; i < 16; i++) board.append(el("div"));
    ctx.right(el("button", { class: "btn small ghost", onclick: () => { if (S.over || confirm("¿Empezar una partida nueva?")) restart(); } }, "Nuevo"));
    view.append(
      el("div", { class: "spread", style: "margin-bottom:12px" },
        el("span", { class: "muted", style: "font-size:14px" }, "Deslizá para juntar fichas iguales"),
        el("div", { class: "scores" }, el("div", { class: "card" }, el("small", {}, "Puntos"), scoreEl), el("div", { class: "card" }, el("small", {}, "Récord"), bestEl))),
      board);

    function draw(ni = -1) {
      [...board.children].forEach((c, i) => {
        const v = S.g[i];
        c.textContent = v || "";
        c.style.background = v ? (COLORS[v] || "#cdbde2") : "";
        c.style.color = "#3d322a";
        c.style.fontSize = v >= 1024 ? "min(7vw,30px)" : v >= 128 ? "min(8vw,35px)" : "";
        c.classList.toggle("new", i === ni);
      });
      scoreEl.textContent = S.score;
      bestEl.textContent = Math.max(S.score, getRec("2048", "best") || 0);
    }

    // gestos
    let sx = 0, sy = 0, tracking = false;
    const ts = e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; tracking = true; };
    const tm = e => e.preventDefault();
    const te = e => {
      if (!tracking) return; tracking = false;
      const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 25) return;
      move(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 0 : 1) : (dy < 0 ? 2 : 3));
    };
    board.addEventListener("touchstart", ts, { passive: true });
    board.addEventListener("touchmove", tm, { passive: false });
    board.addEventListener("touchend", te);
    const key = e => { const d = { ArrowLeft: 0, ArrowRight: 1, ArrowUp: 2, ArrowDown: 3 }[e.key]; if (d != null) { e.preventDefault(); move(d); } };
    document.addEventListener("keydown", key);

    if (!S || !S.g) S = fresh();
    draw();
    return () => document.removeEventListener("keydown", key);
  }

  App.register({ id: "2048", name: "2048", icon: "🧱", desc: "Planificación", mount,
    summary: () => { const b = getRec("2048", "best"); return b ? `Récord: ${b} puntos` : ""; } });
})();
