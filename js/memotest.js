(() => {
  const { el, fmtTime, shuffle, timer, record, getRec, played, modal, levelBtn, winLevel, unlockText } = App;
  const EMOJI = ["🍎","🍋","🍇","🍉","🍒","🥑","🌵","🌻","🐶","🐱","🦊","🐼","🐸","🦉","🐙","🦋","⚽","🎸","🚲","✈️","⏰","🎈","🔑","🌙","⭐","🔥","❄️","🍕","🧩","🎲"];
  const LEVELS = [
    { id: "4x4", name: "Fácil", cols: 4, pairs: 8, desc: "16 cartas" },
    { id: "4x5", name: "Medio", cols: 4, pairs: 10, desc: "20 cartas" },
    { id: "6x6", name: "Difícil", cols: 6, pairs: 18, desc: "36 cartas" },
  ];

  function mount(view, ctx) {
    let T = null, lock = false;
    const chooser = () => {
      if (T) { T.kill(); T = null; } ctx.right(); view.innerHTML = "";
      view.append(el("p", { class: "muted" }, "Encontrá todas las parejas con la menor cantidad de jugadas."),
        el("div", { class: "levels" }, LEVELS.map((L, i) => {
          const m = getRec("memotest", L.id);
          return levelBtn("memotest", LEVELS, i, L.desc + (m != null ? ` · récord ${m} jugadas` : ""), play);
        })));
    };
    function play(L) {
      view.innerHTML = ""; ctx.right(el("button", { class: "btn small ghost", onclick: chooser }, "Nuevo"));
      const deck = shuffle(shuffle(EMOJI.slice()).slice(0, L.pairs).flatMap(e => [e, e]));
      let open = [], moves = 0, found = 0;
      const movesEl = el("span", { class: "stat" }, "Jugadas: 0"), timeEl = el("span", { class: "stat" });
      const grid = el("div", { class: "mem", style: `grid-template-columns:repeat(${L.cols},1fr)` });
      deck.forEach((e, i) => grid.append(el("button", { onclick: ev => flip(ev.currentTarget, i) }, el("span", {}, e))));
      view.append(el("div", { class: "bar" }, el("span", {}, L.name), movesEl, timeEl), grid);
      T = timer(t => timeEl.textContent = "⏱ " + fmtTime(t));
      let started = false;
      function flip(b, i) {
        if (lock || b.classList.contains("up") || b.classList.contains("ok")) return;
        if (!started) { started = true; T.run(); }
        b.classList.add("up"); open.push([b, i]);
        if (open.length < 2) return;
        moves++; movesEl.textContent = "Jugadas: " + moves;
        const [[b1, i1], [b2, i2]] = open; open = [];
        if (deck[i1] === deck[i2]) {
          b1.classList.replace("up", "ok"); b2.classList.replace("up", "ok"); found++;
          if (found === L.pairs) win();
        } else {
          lock = true;
          setTimeout(() => { b1.classList.remove("up"); b2.classList.remove("up"); lock = false; }, 750);
        }
      }
      function win() {
        T.end(); played();
        const r = record("memotest", L.id, moves, "low");
        record("memotest", L.id + "-t", Math.round(T.get()), "low");
        const nx = winLevel("memotest", LEVELS, L.id);
        setTimeout(() => modal({ icon: "🧠", title: "¡Completo!", text: `${moves} jugadas en ${fmtTime(T.get())}` + (r.isBest ? "<br>¡Nuevo récord!" : r.prev != null ? `<br>Récord: ${r.prev} jugadas` : "") + unlockText(nx),
          buttons: [nx ? { label: "Jugar " + nx.name, do: () => play(nx) } : { label: "Otra vez", do: () => play(L) }, { label: "Niveles", ghost: true, do: chooser }] }), 350);
      }
    }
    chooser();
    return () => { if (T) T.kill(); };
  }

  App.register({ id: "memotest", name: "Memotest", icon: "🃏", desc: "Memoria visual", mount,
    summary: () => { const m = getRec("memotest", "4x4"); return m != null ? `Récord fácil: ${m} jugadas` : ""; } });
})();
