(() => {
  const { el, rnd, record, getRec, played, modal } = App;
  const DUR = 60;
  const LEVELS = [
    { id: "facil", name: "Fácil", desc: "Sumas y restas hasta 20" },
    { id: "medio", name: "Medio", desc: "Sumas, restas y tablas" },
    { id: "dificil", name: "Difícil", desc: "Las cuatro operaciones, números más grandes" },
  ];
  function make(lv) {
    let a, b, op;
    if (lv === "facil") { op = Math.random() < 0.5 ? "+" : "−"; a = rnd(1, 20); b = rnd(1, 20); }
    else if (lv === "medio") { op = ["+", "−", "×"][rnd(0, 2)]; if (op === "×") { a = rnd(2, 10); b = rnd(2, 10); } else { a = rnd(10, 99); b = rnd(5, 60); } }
    else {
      op = ["+", "−", "×", "÷"][rnd(0, 3)];
      if (op === "×") { a = rnd(3, 19); b = rnd(3, 12); }
      else if (op === "÷") { b = rnd(2, 12); a = b * rnd(2, 15); }
      else { a = rnd(40, 499); b = rnd(20, 299); }
    }
    if (op === "−" && b > a) [a, b] = [b, a];
    const ans = op === "+" ? a + b : op === "−" ? a - b : op === "×" ? a * b : a / b;
    return { text: `${a} ${op} ${b}`, ans: String(ans) };
  }

  function mount(view, ctx) {
    let iv = null, stopKey = () => {};
    const stop = () => { clearInterval(iv); iv = null; };
    function chooser() {
      stop(); stopKey(); ctx.right(); view.innerHTML = "";
      view.append(el("p", { class: "muted" }, `Resolvé todas las cuentas que puedas en ${DUR} segundos. La respuesta correcta pasa sola a la siguiente.`),
        el("div", { class: "levels" }, LEVELS.map(L => {
          const b = getRec("calculo", L.id);
          return el("button", { onclick: () => play(L) }, el("b", {}, L.name), el("small", {}, L.desc + (b != null ? ` · récord ${b}` : "")));
        })));
    }
    function play(L) {
      stop(); stopKey(); view.innerHTML = "";
      ctx.right(el("button", { class: "btn small ghost", onclick: chooser }, "Salir"));
      let q = make(L.id), typed = "", ok = 0, bad = 0, endAt = Date.now() + DUR * 1000, done = false;
      const bar = el("i", { style: "width:100%" });
      const okEl = el("span", { class: "stat" }, "✅ 0"), badEl = el("span", { class: "stat" }, "❌ 0"), tEl = el("span", { class: "stat" }, DUR + " s");
      const qEl = el("div", { class: "q" }, q.text + " ="), aEl = el("div", { class: "a" }, "");
      const keys = el("div", { class: "keys" });
      ["7", "8", "9", "4", "5", "6", "1", "2", "3", "⌫", "0", "OK"].forEach(k => keys.append(el("button", { onclick: () => press(k), style: k === "OK" ? "background:var(--accent);color:#fff" : "" }, k)));
      view.append(el("div", { class: "bar" }, okEl, tEl, badEl), el("div", { class: "timebar" }, bar), el("div", { class: "calc" }, qEl, aEl), keys);
      function next() { q = make(L.id); typed = ""; qEl.textContent = q.text + " ="; aEl.textContent = ""; }
      function press(k) {
        if (done) return;
        if (k === "⌫") typed = typed.slice(0, -1);
        else if (k === "OK") {
          if (!typed) return;
          if (typed === q.ans) { ok++; next(); } else { bad++; aEl.classList.remove("bad"); void aEl.offsetWidth; aEl.classList.add("bad"); typed = ""; }
        } else if (typed.length < 5) typed += k;
        aEl.textContent = typed;
        if (typed && typed === q.ans) { ok++; done = true; setTimeout(() => { done = false; next(); }, 120); }
        okEl.textContent = "✅ " + ok; badEl.textContent = "❌ " + bad;
      }
      const key = e => { if (/^[0-9]$/.test(e.key)) press(e.key); else if (e.key === "Backspace") press("⌫"); else if (e.key === "Enter") press("OK"); };
      document.addEventListener("keydown", key);
      iv = setInterval(() => {
        const left = Math.max(0, (endAt - Date.now()) / 1000);
        bar.style.width = (left / DUR * 100) + "%"; tEl.textContent = Math.ceil(left) + " s";
        if (left <= 0 && !done) {
          done = true; stop(); document.removeEventListener("keydown", key); played();
          const r = record("calculo", L.id, ok, "high");
          modal({ icon: "⚡", title: "¡Tiempo!", text: `<b>${ok}</b> correctas · ${bad} incorrectas` + (r.isBest && ok ? "<br>¡Nuevo récord!" : r.prev != null ? `<br>Récord: ${r.prev}` : ""),
            buttons: [{ label: "Otra vez", do: () => play(L) }, { label: "Niveles", ghost: true, do: chooser }] });
        }
      }, 100);
      stopKey = () => document.removeEventListener("keydown", key);
    }
    chooser();
    return () => { stop(); stopKey(); };
  }

  App.register({ id: "calculo", name: "Cálculo mental", icon: "⚡", desc: "Agilidad con números", mount,
    summary: () => { const b = getRec("calculo", "medio") ?? getRec("calculo", "facil"); return b != null ? `Récord: ${b} cuentas` : ""; } });
})();
