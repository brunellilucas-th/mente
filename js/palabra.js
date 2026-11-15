(() => {
  const { el, store, dayNum, played, modal, toast } = App;
  // Orden fijo y mezclado de las palabras para que cada día toque una distinta.
  const ORDER = (() => {
    const a = PALABRAS.slice(); let s = 20261115;
    const r = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  })();
  const BASE = 20407; // 15/11/2025 aprox.: solo sirve de punto de partida
  const todayWord = () => ORDER[((dayNum() - BASE) % ORDER.length + ORDER.length) % ORDER.length];

  function score(guess, word) {
    const res = new Array(5).fill("x"), left = {};
    for (let i = 0; i < 5; i++) { if (guess[i] === word[i]) res[i] = "g"; else left[word[i]] = (left[word[i]] || 0) + 1; }
    for (let i = 0; i < 5; i++) if (res[i] !== "g" && left[guess[i]]) { res[i] = "y"; left[guess[i]]--; }
    return res;
  }

  function mount(view, ctx) {
    let mode = "dia", S, word, typed = "", rowsEl, kbEl, cleanupKey = () => {};
    const stats = () => store.get("palabra-stats", { played: 0, wins: 0, streak: 0, max: 0, last: null, dist: [0, 0, 0, 0, 0, 0] });

    function load(m) {
      mode = m; typed = "";
      if (m === "dia") {
        const d = dayNum(); S = store.get("palabra-dia");
        if (!S || S.day !== d) S = { day: d, guesses: [], done: false, won: false };
        word = todayWord();
      } else {
        S = store.get("palabra-libre");
        if (!S || S.done) { S = { word: PALABRAS[Math.floor(Math.random() * PALABRAS.length)], guesses: [], done: false, won: false }; store.set("palabra-libre", S); }
        word = S.word;
      }
      draw();
    }
    const save = () => store.set(mode === "dia" ? "palabra-dia" : "palabra-libre", S);

    const tabDia = el("button", { class: "chip", onclick: () => load("dia") }, "Del día");
    const tabLibre = el("button", { class: "chip", onclick: () => load("libre") }, "Práctica libre");
    ctx.right(el("button", { class: "btn small ghost", onclick: showStats }, "📊"));
    rowsEl = el("div", { class: "wgrid" });
    for (let r = 0; r < 6; r++) { const row = el("div", { class: "wrow" }); for (let c = 0; c < 5; c++) row.append(el("div")); rowsEl.append(row); }
    kbEl = el("div", { class: "kb" });
    ["qwertyuiop", "asdfghjklñ", "↵zxcvbnm⌫"].forEach(line => {
      const kr = el("div", { class: "kr" });
      for (const k of line) kr.append(el("button", { class: k === "↵" || k === "⌫" ? "wide" : "", "data-k": k, onclick: () => press(k) }, k === "↵" ? "ENVIAR" : k === "⌫" ? "⌫" : k.toUpperCase()));
      kbEl.append(kr);
    });
    const info = el("p", { class: "muted center", style: "font-size:13px;margin:0 0 8px" });
    view.append(el("div", { class: "row", style: "justify-content:center;margin-bottom:10px" }, tabDia, tabLibre), info, rowsEl, kbEl);

    function press(k) {
      if (S.done) return;
      if (k === "⌫") typed = typed.slice(0, -1);
      else if (k === "↵") return submit();
      else if (typed.length < 5) typed += k;
      draw();
    }
    function submit() {
      if (typed.length < 5) { shake(); toast("Faltan letras"); return; }
      S.guesses.push(typed); typed = "";
      if (S.guesses[S.guesses.length - 1] === word) { S.done = true; S.won = true; }
      else if (S.guesses.length >= 6) S.done = true;
      save(); draw();
      if (S.done) finish();
    }
    function finish() {
      played();
      if (mode === "dia") {
        const st = stats();
        if (st.last !== S.day) {
          st.played++;
          if (S.won) { st.wins++; st.streak = st.last === S.day - 1 ? st.streak + 1 : 1; st.max = Math.max(st.max, st.streak); st.dist[S.guesses.length - 1]++; }
          else st.streak = 0;
          st.last = S.day; store.set("palabra-stats", st);
        }
      }
      setTimeout(() => modal({ icon: S.won ? "🎯" : "📘", title: S.won ? "¡Adivinaste!" : "Era…",
        text: (S.won ? `En ${S.guesses.length} intento${S.guesses.length === 1 ? "" : "s"}. ` : "") + `La palabra era <b>${word.toUpperCase()}</b>.` + (mode === "dia" ? "<br>Mañana hay otra." : ""),
        buttons: mode === "dia" ? [{ label: "Practicar", do: () => load("libre") }, { label: "Estadísticas", ghost: true, do: showStats }] : [{ label: "Otra palabra", do: () => load("libre") }, { label: "Cerrar", ghost: true }] }), 400);
    }
    function shake() { const r = rowsEl.children[S.guesses.length]; if (!r) return; r.classList.remove("bad"); void r.offsetWidth; r.classList.add("bad"); }
    function showStats() {
      const st = stats(), mx = Math.max(1, ...st.dist);
      modal({ icon: "📊", title: "Palabra del día",
        text: `Jugadas: <b>${st.played}</b> · Ganadas: <b>${st.played ? Math.round(st.wins / st.played * 100) : 0}%</b><br>Racha: <b>${st.streak}</b> · Mejor racha: <b>${st.max}</b>` +
          `<div class="dist">${st.dist.map((n, i) => `<div>${i + 1} <i style="width:${Math.max(8, n / mx * 100)}%">${n}</i></div>`).join("")}</div>`,
        buttons: [{ label: "Cerrar" }] });
    }
    function draw() {
      tabDia.classList.toggle("on", mode === "dia"); tabLibre.classList.toggle("on", mode === "libre");
      info.textContent = mode === "dia" ? (S.done ? "Ya jugaste la de hoy. Mañana hay una nueva." : "Adiviná la palabra de 5 letras en 6 intentos.") : "Práctica: no cuenta para las estadísticas.";
      const keyState = {};
      [...rowsEl.children].forEach((row, r) => {
        const g = S.guesses[r], sc = g ? score(g, word) : null, cur = r === S.guesses.length && !S.done ? typed : "";
        [...row.children].forEach((c, i) => {
          c.className = ""; c.textContent = (g ? g[i] : cur[i]) || "";
          if (sc) c.classList.add(sc[i]); else if (cur[i]) c.classList.add("t");
        });
        if (g) for (let i = 0; i < 5; i++) { const k = g[i], v = sc[i], p = keyState[k]; if (v === "g" || (v === "y" && p !== "g") || (v === "x" && !p)) keyState[k] = v; }
      });
      kbEl.querySelectorAll("button[data-k]").forEach(b => { b.classList.remove("g", "y", "x"); const s = keyState[b.dataset.k]; if (s) b.classList.add(s); });
    }
    const key = e => {
      if (document.querySelector(".overlay")) return;
      const k = e.key.toLowerCase();
      if (k === "enter") press("↵"); else if (k === "backspace") press("⌫"); else if (/^[a-zñ]$/.test(k)) press(k);
    };
    document.addEventListener("keydown", key);
    cleanupKey = () => document.removeEventListener("keydown", key);
    load("dia");
    return () => cleanupKey();
  }

  App.register({ id: "palabra", name: "Palabra del día", icon: "🔤", desc: "Vocabulario y deducción", mount,
    summary: () => { const s = store.get("palabra-dia"); const st = store.get("palabra-stats"); if (s && s.day === dayNum() && s.done) return "Hoy: " + (s.won ? "✅ adivinada" : "❌"); return st && st.streak ? `Racha: ${st.streak}` : "Nueva palabra hoy"; } });
})();
