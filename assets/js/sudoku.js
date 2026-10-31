"use strict";

// Sudoku in a macOS-style window. Every puzzle is generated in the browser from a random solved grid,
// removing clues in symmetric pairs only while the puzzle keeps exactly one solution.
(function () {
  const app = document.querySelector("[data-sudoku]");
  if (!app) return;

  const boardEl = app.querySelector("[data-sdk-board]");
  const padEl = app.querySelector("[data-sdk-pad]");
  const timeEl = app.querySelector("[data-sdk-time]");
  const mistakesEl = app.querySelector("[data-sdk-mistakes]");
  const bestEl = app.querySelector("[data-sdk-best]");
  const statusEl = app.querySelector("[data-sdk-status]");
  const notesBtn = app.querySelector("[data-sdk-notes]");
  const levelSeg = app.querySelector("[data-sdk-level]");
  const sheet = app.querySelector("[data-sdk-sheet]");

  const storage = {
    get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (e) { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} },
  };

  // givens left on the board; difficulty comes from how few the solver has to work with
  const CLUES = { easy: 40, medium: 32, hard: 25 };
  const NAMES = { easy: "Easy", medium: "Medium", hard: "Hard" };
  const ROW = [], COL = [], BOX = [], PEERS = [];
  for (let i = 0; i < 81; i++) {
    ROW[i] = Math.floor(i / 9); COL[i] = i % 9; BOX[i] = Math.floor(ROW[i] / 3) * 3 + Math.floor(COL[i] / 3);
  }
  for (let i = 0; i < 81; i++) {
    PEERS[i] = [];
    for (let j = 0; j < 81; j++) if (j !== i && (ROW[j] === ROW[i] || COL[j] === COL[i] || BOX[j] === BOX[i])) PEERS[i].push(j);
  }

  // ---- generator

  const shuffle = (list) => {
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    return list;
  };

  // backtracking with bitmasks, always branching on the cell with the fewest candidates;
  // stops once `limit` solutions are found and returns the first one
  function solve(grid, limit, random) {
    const g = grid.slice(), rows = Array(9).fill(0), cols = Array(9).fill(0), boxes = Array(9).fill(0);
    for (let i = 0; i < 81; i++) {
      if (!g[i]) continue;
      const bit = 1 << g[i];
      if ((rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]) & bit) return { count: 0, first: null };
      rows[ROW[i]] |= bit; cols[COL[i]] |= bit; boxes[BOX[i]] |= bit;
    }
    let count = 0, first = null;
    (function search() {
      let best = -1, bestMask = 0, bestSize = 10;
      for (let i = 0; i < 81 && bestSize > 1; i++) {
        if (g[i]) continue;
        const mask = ~(rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]) & 0x3fe;
        let size = 0;
        for (let m = mask; m; m &= m - 1) size++;
        if (size < bestSize) { best = i; bestMask = mask; bestSize = size; }
      }
      if (best < 0) { count++; if (!first) first = g.slice(); return; }
      if (!bestSize) return;
      const digits = [];
      for (let d = 1; d <= 9; d++) if (bestMask & (1 << d)) digits.push(d);
      for (const d of random ? shuffle(digits) : digits) {
        const bit = 1 << d;
        g[best] = d; rows[ROW[best]] |= bit; cols[COL[best]] |= bit; boxes[BOX[best]] |= bit;
        search();
        g[best] = 0; rows[ROW[best]] &= ~bit; cols[COL[best]] &= ~bit; boxes[BOX[best]] &= ~bit;
        if (count >= limit) return;
      }
    })();
    return { count, first };
  }

  // some grids stop yielding removable pairs early, so harder levels try a few and keep the sparsest
  function generate(level) {
    let best = null;
    for (let attempt = 0; attempt < { easy: 1, medium: 3, hard: 8 }[level]; attempt++) {
      const candidate = carve(level);
      if (!best || candidate.clues < best.clues) best = candidate;
      if (best.clues <= CLUES[level]) break;
    }
    return best;
  }

  function carve(level) {
    const solution = solve(Array(81).fill(0), 1, true).first;
    const puzzle = solution.slice();
    let clues = 81;
    for (const i of shuffle([...Array(41).keys()])) {
      if (clues <= CLUES[level]) break;
      const pair = i === 40 ? [40] : [i, 80 - i];
      const kept = pair.map((p) => puzzle[p]);
      pair.forEach((p) => (puzzle[p] = 0));
      if (solve(puzzle, 2, false).count === 1) clues -= pair.length;
      else pair.forEach((p, k) => (puzzle[p] = kept[k]));
    }
    return { puzzle, solution, clues };
  }

  // ---- state

  let game, selected = -1, notesMode = false, history = [], timer = null;
  let level = storage.get("sudoku-level", "easy");
  let best = storage.get("sudoku-best", {});

  const save = () => storage.set("sudoku-game", game);
  const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const status = (text) => (statusEl.textContent = text || "");

  // ---- view

  const cells = [];
  for (let i = 0; i < 81; i++) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "sdk-cell" + (COL[i] === 2 || COL[i] === 5 ? " box-r" : "") + (ROW[i] === 2 || ROW[i] === 5 ? " box-b" : "")
      + (COL[i] === 8 ? " last-c" : "") + (ROW[i] === 8 ? " last-r" : "");
    cell.tabIndex = -1;
    cell.style.setProperty("--d", ROW[i] + COL[i]);
    cell.addEventListener("click", () => select(i));
    boardEl.appendChild(cell);
    cells.push(cell);
  }
  const padButtons = [];
  for (let d = 1; d <= 9; d++) {
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = `${d}<small></small>`;
    b.addEventListener("click", () => enter(d));
    padEl.appendChild(b);
    padButtons.push(b);
  }

  function render() {
    const { puzzle, values, notes, solution } = game;
    const focus = selected >= 0 ? values[selected] : 0;
    cells.forEach((cell, i) => {
      const v = values[i];
      const peer = selected >= 0 && i !== selected && PEERS[selected].includes(i);
      cell.classList.toggle("given", Boolean(puzzle[i]));
      cell.classList.toggle("user", !puzzle[i] && Boolean(v));
      cell.classList.toggle("wrong", !puzzle[i] && v && v !== solution[i]);
      cell.classList.toggle("hinted", game.hinted.includes(i));
      cell.classList.toggle("selected", i === selected);
      cell.classList.toggle("peer", peer);
      cell.classList.toggle("same", i !== selected && focus && v === focus);
      cell.tabIndex = i === (selected >= 0 ? selected : 0) ? 0 : -1;
      if (v) cell.textContent = v;
      else if (notes[i]) cell.innerHTML = '<span class="sdk-notes">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<span>${notes[i] & (1 << d) ? d : ""}</span>`).join("") + "</span>";
      else cell.textContent = "";
      const what = v ? `${v}${puzzle[i] ? ", given" : v !== solution[i] ? ", incorrect" : ""}` : notes[i] ? "empty, notes " + [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => notes[i] & (1 << d)).join(" ") : "empty";
      cell.setAttribute("aria-label", `Row ${ROW[i] + 1}, column ${COL[i] + 1}, ${what}`);
    });
    padButtons.forEach((b, k) => {
      const placed = values.filter((v, i) => v === k + 1 && v === solution[i]).length;
      b.querySelector("small").textContent = 9 - placed || "";
      b.disabled = placed === 9 || game.done;
      b.setAttribute("aria-label", `${k + 1}${placed === 9 ? ", all placed" : `, ${9 - placed} left`}`);
    });
    timeEl.textContent = clock(game.seconds);
    mistakesEl.textContent = game.mistakes;
    bestEl.textContent = best[game.level] != null ? clock(best[game.level]) : "–";
    notesBtn.setAttribute("aria-pressed", String(notesMode));
    notesBtn.querySelector("i").textContent = notesMode ? "On" : "Off";
  }

  function pop(i) {
    cells[i].classList.remove("pop");
    void cells[i].offsetWidth;
    cells[i].classList.add("pop");
  }

  // ---- play

  function select(i) {
    selected = i;
    render();
    cells[i].focus({ preventScroll: true });
  }

  function remember(i) { history.push({ i, value: game.values[i], notes: game.notes.slice(), mistakes: game.mistakes }); }

  function enter(d) {
    if (game.done) return;
    if (selected < 0) return status("Select a square first.");
    const i = selected;
    if (game.puzzle[i]) return status("That number is part of the puzzle.");
    if (notesMode) {
      if (game.values[i]) return;
      remember(i);
      game.notes[i] ^= 1 << d;
    } else {
      if (game.values[i] === d) return;
      remember(i);
      game.values[i] = d;
      game.notes[i] = 0;
      if (d !== game.solution[i]) {
        game.mistakes++;
        status(`${d} doesn't belong there.`);
      } else {
        status("");
        PEERS[i].forEach((p) => (game.notes[p] &= ~(1 << d)));
        pop(i);
      }
    }
    save();
    render();
    if (game.values.every((v, k) => v === game.solution[k])) finish();
  }

  function erase() {
    if (game.done || selected < 0 || game.puzzle[selected]) return;
    if (!game.values[selected] && !game.notes[selected]) return;
    remember(selected);
    game.values[selected] = 0;
    game.notes[selected] = 0;
    save();
    render();
  }

  function undo() {
    const step = history.pop();
    if (!step || game.done) return status(step ? "" : "Nothing to undo.");
    game.values[step.i] = step.value;
    game.notes = step.notes;
    game.mistakes = step.mistakes;
    game.hinted = game.hinted.filter((k) => game.values[k] === game.solution[k]);
    selected = step.i;
    status("");
    save();
    render();
    cells[step.i].focus({ preventScroll: true });
  }

  function hint() {
    if (game.done) return;
    const open = (i) => !game.puzzle[i] && game.values[i] !== game.solution[i];
    const target = selected >= 0 && open(selected) ? selected : shuffle([...Array(81).keys()].filter(open))[0];
    if (target == null) return;
    remember(target);
    game.values[target] = game.solution[target];
    game.notes[target] = 0;
    game.hinted.push(target);
    PEERS[target].forEach((p) => (game.notes[p] &= ~(1 << game.solution[target])));
    selected = target;
    status(`Hint: row ${ROW[target] + 1}, column ${COL[target] + 1} is ${game.solution[target]}.`);
    save();
    render();
    pop(target);
    if (game.values.every((v, k) => v === game.solution[k])) finish();
  }

  function finish() {
    game.done = true;
    clearInterval(timer);
    const record = best[game.level] == null || game.seconds < best[game.level];
    if (record && !game.hinted.length) { best[game.level] = game.seconds; storage.set("sudoku-best", best); }
    save();
    render();
    boardEl.classList.add("solved");
    const details = [`${NAMES[game.level]} in ${clock(game.seconds)}`, `${game.mistakes} mistake${game.mistakes === 1 ? "" : "s"}`];
    if (game.hinted.length) details.push(`${game.hinted.length} hint${game.hinted.length === 1 ? "" : "s"}`);
    sheet.querySelector("[data-sdk-sheet-text]").textContent = details.join(" · ") + (record && !game.hinted.length ? " · New best!" : "");
    setTimeout(() => sheet.classList.remove("hidden"), 700);
    status("Solved!");
  }

  function startClock() {
    clearInterval(timer);
    timer = setInterval(() => {
      if (game.done || document.hidden) return;
      game.seconds++;
      timeEl.textContent = clock(game.seconds);
      if (game.seconds % 5 === 0) save();
    }, 1000);
  }

  function newGame() {
    sheet.classList.add("hidden");
    boardEl.classList.remove("solved");
    status("Generating a puzzle…");
    app.classList.add("busy");
    // let the status paint before the (brief) generation work
    setTimeout(() => {
      const { puzzle, solution } = generate(level);
      game = { level, puzzle, solution, values: puzzle.slice(), notes: Array(81).fill(0), mistakes: 0, seconds: 0, hinted: [], done: false };
      history = [];
      selected = -1;
      app.classList.remove("busy");
      status(`${NAMES[level]} · ${puzzle.filter(Boolean).length} givens. Good luck.`);
      save();
      render();
      startClock();
    }, 30);
  }

  // ---- controls

  const sync = (v) => levelSeg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.value === v)));
  levelSeg.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-value]");
    if (!button) return;
    level = button.dataset.value;
    storage.set("sudoku-level", level);
    sync(level);
    newGame();
  });
  notesBtn.addEventListener("click", () => { notesMode = !notesMode; render(); });
  app.querySelector("[data-sdk-erase]").addEventListener("click", erase);
  app.querySelector("[data-sdk-undo]").addEventListener("click", undo);
  app.querySelector("[data-sdk-hint]").addEventListener("click", hint);
  app.querySelector("[data-sdk-new]").addEventListener("click", newGame);
  app.querySelector("[data-sdk-again]").addEventListener("click", newGame);

  // keys work while focus is inside the game, so they never fight the other games on the page
  app.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || !game) return;
    const key = event.key;
    const moves = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
    if (moves[key] && event.target.closest("[data-sdk-board]")) {
      event.preventDefault();
      const from = selected < 0 ? 40 : selected;
      const r = (ROW[from] + (moves[key] === 9) - (moves[key] === -9) + 9) % 9;
      const c = (COL[from] + (moves[key] === 1) - (moves[key] === -1) + 9) % 9;
      return select(r * 9 + c);
    }
    if (/^[1-9]$/.test(key)) { event.preventDefault(); enter(Number(key)); }
    else if (key === "Backspace" || key === "Delete" || key === "0") { event.preventDefault(); erase(); }
    else if (key.toLowerCase() === "n") { notesMode = !notesMode; render(); }
    else if (key.toLowerCase() === "u") undo();
    else if (key.toLowerCase() === "h") hint();
  });

  // resume an unfinished game after a reload
  const saved = storage.get("sudoku-game", null);
  sync(level);
  if (saved && !saved.done && Array.isArray(saved.values) && saved.values.length === 81) {
    game = saved;
    level = saved.level;
    sync(level);
    status(`Welcome back: your ${NAMES[level].toLowerCase()} puzzle is where you left it.`);
    render();
    startClock();
  } else {
    newGame();
  }
})();
