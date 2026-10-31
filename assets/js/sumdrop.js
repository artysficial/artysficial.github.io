"use strict";

// Sum Drop: an original falling-tile puzzle. Number tiles fall one at a time; whenever an unbroken
// horizontal or vertical run of tiles adds up to exactly 10, it clears and the tiles above fall into
// the gap, which can set off chains worth more points.
(function () {
  const app = document.querySelector("[data-sumdrop]");
  if (!app) return;

  const COLS = 6, ROWS = 11, TARGET = 10;
  // Apple's system colours, one per digit
  const COLORS = [null, "#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#00c7be", "#32ade6", "#007aff", "#5856d6", "#af52de"];
  // small numbers come up more often, so runs of three or four tiles stay possible
  const WEIGHTS = [0, 14, 14, 13, 13, 12, 10, 9, 8, 7];
  const SPEED = { relaxed: 1.45, normal: 1, fast: 0.65 };

  const canvas = app.querySelector("[data-sd-canvas]");
  const ctx = canvas.getContext("2d");
  const sheet = app.querySelector("[data-sd-sheet]");
  const sheetTitle = app.querySelector("[data-sd-title]");
  const sheetText = app.querySelector("[data-sd-text]");
  const startButton = app.querySelector("[data-sd-start]");
  const scoreEl = app.querySelector("[data-sd-score]");
  const bestEl = app.querySelector("[data-sd-best]");
  const levelEl = app.querySelector("[data-sd-level]");
  const nextEl = app.querySelector("[data-sd-next]");
  const liveEl = app.querySelector("[data-sd-live]");
  const speedSeg = app.querySelector("[data-sd-speed]");

  const storage = {
    get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (e) { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} },
  };

  let speed = storage.get("sumdrop-speed", "normal");
  let best = storage.get("sumdrop-best", 0);
  let grid, piece, nextN, score, level, cleared, swapUsed, busy, state = "ready", lastFall, lastFrame, popups, width, height, cell;

  const randomDigit = () => {
    let roll = Math.random() * WEIGHTS.reduce((a, b) => a + b, 0);
    for (let n = 1; n <= 9; n++) { roll -= WEIGHTS[n]; if (roll < 0) return n; }
    return 1;
  };
  const fallInterval = () => Math.max(90, 720 * Math.pow(0.88, level - 1) * SPEED[speed]);
  const free = (c, r) => c >= 0 && c < COLS && r < ROWS && (r < 0 || !grid[r][c]);
  const landingRow = () => { let r = piece.r; while (free(piece.c, r + 1)) r++; return r; };
  const say = (text) => (liveEl.textContent = text);

  // ---- setup

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    cell = width / COLS;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }

  function updateHud() {
    scoreEl.textContent = score.toLocaleString();
    bestEl.textContent = best.toLocaleString();
    levelEl.textContent = level;
    nextEl.textContent = nextN;
    nextEl.style.background = COLORS[nextN];
    nextEl.style.color = nextN === 3 ? "#1d1d1f" : "#fff";
    nextEl.setAttribute("aria-label", `Next tile ${nextN}`);
  }

  function reset() {
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    score = 0; level = 1; cleared = 0; popups = []; busy = false;
    nextN = randomDigit();
    spawn();
  }

  function spawn() {
    piece = { n: nextN, c: Math.floor((COLS - 1) / 2), r: 0, y: -1 };
    nextN = randomDigit();
    swapUsed = false;
    updateHud();
    if (grid[0][piece.c]) gameOver();
  }

  // ---- moves

  function move(dx) {
    if (state !== "playing" || busy || !free(piece.c + dx, piece.r)) return;
    piece.c += dx;
  }

  function softDrop() {
    if (state !== "playing" || busy) return;
    if (free(piece.c, piece.r + 1)) { piece.r++; lastFall = performance.now(); } else land();
  }

  function hardDrop() {
    if (state !== "playing" || busy) return;
    const target = landingRow();
    score += (target - piece.r) * 2;
    piece.r = target;
    land();
  }

  function swap() {
    if (state !== "playing" || busy || swapUsed) return;
    [piece.n, nextN] = [nextN, piece.n];
    swapUsed = true;
    updateHud();
    say(`Swapped: now dropping ${piece.n}, next is ${nextN}.`);
  }

  function land() {
    grid[piece.r][piece.c] = { n: piece.n, y: piece.y, scale: 1, clearing: false };
    piece = null;
    busy = true;
    resolve(1);
  }

  // every unbroken run of two or more tiles summing to exactly 10, in rows and columns
  function findRuns() {
    const hits = new Set(), runs = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          let sum = 0;
          const run = [];
          for (let rr = r, cc = c; rr < ROWS && cc < COLS && grid[rr][cc]; rr += dr, cc += dc) {
            sum += grid[rr][cc].n;
            run.push([rr, cc]);
            if (sum > TARGET) break;
            if (sum === TARGET && run.length > 1) { runs.push(run.slice()); run.forEach(([a, b]) => hits.add(a * COLS + b)); break; }
          }
        }
      }
    }
    return { hits, runs };
  }

  function resolve(chain) {
    const { hits, runs } = findRuns();
    if (!hits.size) {
      busy = false;
      if (state === "playing") spawn();
      return;
    }
    const longest = Math.max(...runs.map((run) => run.length));
    const points = hits.size * 10 * chain + (longest > 2 ? (longest - 2) * 25 : 0);
    score += points;
    cleared += hits.size;
    level = 1 + Math.floor(cleared / 18);
    if (score > best) { best = score; storage.set("sumdrop-best", best); }
    const [pr, pc] = runs[0][0];
    popups.push({ text: `+${points}${chain > 1 ? `  chain ×${chain}` : ""}`, x: (pc + 0.5) * cell, y: (pr + 0.5) * cell, life: 1 });
    say(runs.map((run) => run.map(([a, b]) => grid[a][b].n).join(" + ")).join(", ") + ` = 10. Plus ${points}.`);
    hits.forEach((k) => (grid[Math.floor(k / COLS)][k % COLS].clearing = true));
    updateHud();
    setTimeout(() => {
      hits.forEach((k) => (grid[Math.floor(k / COLS)][k % COLS] = null));
      // gravity: each column settles; tiles keep their drawn position and glide to the new row
      for (let c = 0; c < COLS; c++) {
        const stack = [];
        for (let r = ROWS - 1; r >= 0; r--) if (grid[r][c]) stack.push(grid[r][c]);
        for (let r = ROWS - 1, i = 0; r >= 0; r--, i++) grid[r][c] = stack[i] || null;
      }
      setTimeout(() => resolve(chain + 1), 190);
    }, 260);
  }

  // ---- loop

  function loop(now) {
    const dt = Math.min(0.05, (now - (lastFrame || now)) / 1000);
    lastFrame = now;
    if (state === "playing" && piece && !busy && now - lastFall >= fallInterval()) {
      lastFall = now;
      if (free(piece.c, piece.r + 1)) piece.r++; else land();
    }
    const ease = Math.min(1, dt * 16);
    if (piece) piece.y += (piece.r - piece.y) * ease;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = grid[r][c];
      if (!t) continue;
      t.y += (r - t.y) * Math.min(1, dt * 14);
      if (t.clearing) t.scale = Math.max(0, t.scale - dt * 4.2);
    }
    popups.forEach((p) => { p.life -= dt * 0.9; p.y -= dt * 40; });
    popups = popups.filter((p) => p.life > 0);
    draw();
    if (state === "playing" || popups.length || busy) requestAnimationFrame(loop);
  }

  // ---- drawing

  function tile(x, y, n, scale, ghost) {
    const pad = cell * 0.07, s = (cell - pad * 2) * scale, r = s * 0.24;
    const left = x + (cell - s) / 2, top = y + (cell - s) / 2;
    ctx.beginPath();
    ctx.roundRect(left, top, s, s, r);
    if (ghost) {
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = COLORS[n] + "99";
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }
    ctx.fillStyle = COLORS[n];
    ctx.fill();
    // a soft top highlight, like an iOS app icon
    const shine = ctx.createLinearGradient(0, top, 0, top + s);
    shine.addColorStop(0, "rgba(255,255,255,0.28)");
    shine.addColorStop(0.55, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    ctx.fill();
    ctx.fillStyle = n === 3 ? "#1d1d1f" : "#fff";
    ctx.font = `700 ${s * 0.52}px Inter, -apple-system, "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(n, left + s / 2, top + s / 2 + s * 0.03);
  }

  function draw() {
    if (!width || !grid) return;
    const css = getComputedStyle(app);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = css.getPropertyValue("--line").trim() || "#d2d2d7";
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc((c + 0.5) * cell, (r + 0.5) * cell, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (state === "playing" && grid[1].some(Boolean)) {
      ctx.fillStyle = "rgba(255,59,48,0.10)";
      ctx.fillRect(0, 0, width, cell);
    }
    if (piece && state === "playing" && !busy) tile(piece.c * cell, landingRow() * cell, piece.n, 1, true);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = grid[r][c];
      if (t) tile(c * cell, t.y * cell, t.n, t.clearing ? t.scale : 1);
    }
    if (piece) tile(piece.c * cell, piece.y * cell, piece.n, 1);
    ctx.textAlign = "center";
    ctx.font = `700 ${cell * 0.34}px Inter, -apple-system, "Segoe UI", sans-serif`;
    popups.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = css.getPropertyValue("--text").trim() || "#1d1d1f";
      ctx.fillText(p.text, Math.min(width - cell * 1.4, Math.max(cell * 1.4, p.x)), p.y);
    });
    ctx.globalAlpha = 1;
  }

  // ---- states

  function showSheet(title, text, button) {
    sheetTitle.textContent = title;
    sheetText.innerHTML = text;
    startButton.textContent = button;
    sheet.classList.remove("hidden");
  }

  function start() {
    if (state === "paused") return pause();
    reset();
    state = "playing";
    sheet.classList.add("hidden");
    lastFall = lastFrame = performance.now();
    say("Game started.");
    requestAnimationFrame(loop);
  }

  function pause() {
    if (state === "playing") {
      state = "paused";
      showSheet("Paused", "Take your time.", "Resume");
    } else if (state === "paused") {
      state = "playing";
      sheet.classList.add("hidden");
      lastFall = lastFrame = performance.now();
      requestAnimationFrame(loop);
    }
  }

  function gameOver() {
    state = "over";
    piece = null;
    // drop points land outside a clear, so settle the best score here too
    const record = score > 0 && score >= best;
    if (score > best) { best = score; storage.set("sumdrop-best", best); }
    updateHud();
    draw();
    showSheet("Game over", `${score.toLocaleString()} points · level ${level}${record ? "<br>New best!" : `<br>Best ${best.toLocaleString()}`}`, "Play again");
    say(`Game over with ${score} points.`);
  }

  // ---- input

  const sync = (v) => speedSeg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.value === v)));
  sync(speed);
  speedSeg.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-value]");
    if (!button) return;
    speed = button.dataset.value;
    storage.set("sumdrop-speed", speed);
    sync(speed);
  });
  startButton.addEventListener("click", start);
  const actions = { left: () => move(-1), right: () => move(1), down: softDrop, drop: hardDrop, swap, pause };
  app.querySelectorAll("[data-sd-action]").forEach((b) => b.addEventListener("click", () => actions[b.dataset.sdAction]()));

  const centred = () => { const r = app.getBoundingClientRect(); return r.top < innerHeight / 2 && r.bottom > innerHeight / 2; };
  document.addEventListener("keydown", (event) => {
    if (event.target.closest("input, textarea, [data-sudoku]") || event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key;
    if (state === "playing") {
      const map = { ArrowLeft: actions.left, ArrowRight: actions.right, ArrowDown: softDrop, " ": hardDrop, ArrowUp: swap, s: swap, S: swap, p: pause, P: pause, Escape: pause };
      if (map[key]) { event.preventDefault(); map[key](); }
    } else if (state === "paused" && (key === "p" || key === "P" || key === "Escape")) {
      pause();
    } else if (key === "Enter" && state !== "playing" && centred() && document.activeElement === document.body) {
      event.preventDefault();
      start();
    }
  });

  // swipe left/right to move, down to drop, tap to swap
  const stage = app.querySelector(".sumdrop-stage");
  let touch = null;
  stage.addEventListener("touchstart", (event) => { touch = { x: event.touches[0].clientX, y: event.touches[0].clientY, moved: 0 }; }, { passive: true });
  stage.addEventListener("touchmove", (event) => {
    if (!touch || state !== "playing") return;
    const dx = event.touches[0].clientX - touch.x;
    const steps = Math.trunc(dx / (cell * 0.8));
    if (steps !== touch.moved) { move(Math.sign(steps - touch.moved)); touch.moved += Math.sign(steps - touch.moved); }
  }, { passive: true });
  stage.addEventListener("touchend", (event) => {
    if (!touch || state !== "playing") return (touch = null);
    const dx = event.changedTouches[0].clientX - touch.x, dy = event.changedTouches[0].clientY - touch.y;
    if (dy > 60 && Math.abs(dy) > Math.abs(dx)) hardDrop();
    else if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && !touch.moved) swap();
    touch = null;
  });

  document.addEventListener("visibilitychange", () => { if (document.hidden && state === "playing") pause(); });
  // redraw in the new colours when the theme changes
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  addEventListener("resize", resize);

  grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  nextN = randomDigit();
  score = 0; level = 1; popups = [];
  bestEl.textContent = best.toLocaleString();
  updateHud();
  resize();
})();
