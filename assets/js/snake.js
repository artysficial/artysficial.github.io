"use strict";

// Snake, from the Nokia classic to a modern Mac-style take. The game ticks on a fixed grid,
// while the modern style interpolates between ticks so movement looks smooth at 60 fps.
(function () {
  const app = document.querySelector("[data-snake]");
  if (!app) return;

  const GRID = 20;
  const canvas = app.querySelector("[data-snake-canvas]");
  const ctx = canvas.getContext("2d");
  const sheet = app.querySelector("[data-snake-sheet]");
  const sheetTitle = app.querySelector("[data-sheet-title]");
  const sheetText = app.querySelector("[data-sheet-text]");
  const startButton = app.querySelector("[data-snake-start]");
  const scoreEl = app.querySelector("[data-snake-score]");
  const bestEl = app.querySelector("[data-snake-best]");
  const speedEl = app.querySelector("[data-snake-speed]");
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  const storage = {
    get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (e) { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} },
  };

  let style = storage.get("snake-style", "modern");
  let walls = storage.get("snake-walls", "wrap");
  let best = storage.get("snake-best", 0);
  let snake, previous, dir, queue, food, score, interval, state, lastTick, frame, size;

  // ---- setup

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    size = canvas.clientWidth;
    canvas.width = Math.round(size * ratio);
    canvas.height = Math.round(size * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw(1);
  }

  function reset() {
    const mid = Math.floor(GRID / 2);
    snake = [[mid, mid], [mid - 1, mid], [mid - 2, mid]];
    previous = snake.map((p) => p.slice());
    dir = "right";
    queue = [];
    score = 0;
    interval = 140;
    placeFood();
    updateHud();
  }

  function placeFood() {
    const free = [];
    for (let x = 0; x < GRID; x++) for (let y = 0; y < GRID; y++) if (!snake.some(([sx, sy]) => sx === x && sy === y)) free.push([x, y]);
    food = free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  function updateHud() {
    scoreEl.textContent = score;
    bestEl.textContent = best;
    speedEl.textContent = Math.round((140 - interval) / 7) + 1;
  }

  // ---- input: a short queue so quick double-presses (e.g. up then left) both count

  function turn(name) {
    if (state !== "playing") return;
    const last = queue.length ? queue[queue.length - 1] : dir;
    const [lx, ly] = DIRS[last];
    const [nx, ny] = DIRS[name];
    if (lx + nx === 0 && ly + ny === 0) return; // no reversing into yourself
    if (name === last || queue.length >= 2) return;
    queue.push(name);
  }

  // ---- game loop

  function tick() {
    if (queue.length) dir = queue.shift();
    const [dx, dy] = DIRS[dir];
    let [hx, hy] = snake[0];
    hx += dx; hy += dy;
    if (walls === "wrap") {
      hx = (hx + GRID) % GRID; hy = (hy + GRID) % GRID;
    } else if (hx < 0 || hy < 0 || hx >= GRID || hy >= GRID) {
      return gameOver("You hit the wall.");
    }
    const eating = food && hx === food[0] && hy === food[1];
    const body = eating ? snake : snake.slice(0, -1); // the tail moves away unless we grow
    if (body.some(([x, y]) => x === hx && y === hy)) return gameOver("You bit yourself.");

    previous = snake.map((p) => p.slice());
    snake.unshift([hx, hy]);
    if (eating) {
      score += 1;
      interval = Math.max(65, interval - 3);
      previous.push(previous[previous.length - 1].slice());
      if (score > best) { best = score; storage.set("snake-best", best); }
      placeFood();
      if (!food) return gameOver("You filled the board. Perfect game!");
      updateHud();
    } else {
      snake.pop();
    }
  }

  function loop(now) {
    if (state !== "playing") return;
    while (now - lastTick >= interval) {
      lastTick += interval;
      tick();
      if (state !== "playing") return draw(1);
    }
    draw(style === "modern" ? (now - lastTick) / interval : 1);
    frame = requestAnimationFrame(loop);
  }

  // ---- drawing

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function draw(t) {
    if (!snake || !size) return;
    const cell = size / GRID;
    const classic = style === "classic";
    ctx.clearRect(0, 0, size, size);

    if (classic) {
      ctx.fillStyle = "#9bbc0f";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(15, 56, 15, 0.06)";
      for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) ctx.fillRect(i * cell + 1, j * cell + 1, cell - 2, cell - 2);
    } else {
      ctx.fillStyle = css("--line");
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
        ctx.beginPath(); ctx.arc(i * cell + cell / 2, j * cell + cell / 2, 1.1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    if (food) {
      const [fx, fy] = food;
      if (classic) {
        ctx.fillStyle = "#0f380f";
        ctx.fillRect(fx * cell + cell * 0.25, fy * cell + cell * 0.25, cell * 0.5, cell * 0.5);
      } else {
        const pulse = 1 + Math.sin(performance.now() / 220) * 0.08;
        ctx.save();
        ctx.shadowColor = "#ff375f"; ctx.shadowBlur = 16;
        ctx.fillStyle = "#ff375f";
        ctx.beginPath(); ctx.arc(fx * cell + cell / 2, fy * cell + cell / 2, cell * 0.32 * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }

    // segment positions, interpolated between ticks except when wrapping across an edge
    const n = snake.length;
    const points = snake.map(([x, y], i) => {
      const p = previous[i] || snake[i];
      if (Math.abs(p[0] - x) <= 1 && Math.abs(p[1] - y) <= 1) return [p[0] + (x - p[0]) * t, p[1] + (y - p[1]) * t];
      return [x, y];
    });

    if (classic) {
      ctx.fillStyle = "#0f380f";
      for (const [x, y] of points) ctx.fillRect(Math.round(x) * cell + 1, Math.round(y) * cell + 1, cell - 2, cell - 2);
      return;
    }

    // one continuous body: thick round-capped strokes between neighbouring segments,
    // shading from green at the head to blue at the tail
    const light = document.documentElement.dataset.theme === "dark" ? 55 : 46;
    const colour = (i) => `hsl(${140 + (n > 1 ? i / (n - 1) : 0) * 70}, 72%, ${light}%)`;
    const centre = ([x, y]) => [x * cell + cell / 2, y * cell + cell / 2];
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = cell * 0.72;
    for (let i = n - 1; i > 0; i--) {
      const a = points[i], b = points[i - 1];
      if (Math.abs(a[0] - b[0]) > 1.5 || Math.abs(a[1] - b[1]) > 1.5) continue; // the body wraps here
      const [ax, ay] = centre(a), [bx, by] = centre(b);
      ctx.strokeStyle = colour(i);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    const [hx, hy] = centre(points[0]);
    ctx.fillStyle = colour(0);
    ctx.beginPath(); ctx.arc(hx, hy, cell * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff";
    const [dx, dy] = DIRS[dir];
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(hx + dx * cell * 0.14 + dy * side * cell * 0.17, hy + dy * cell * 0.14 + dx * side * cell * 0.17, cell * 0.085, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- states

  function showSheet(title, text, label) {
    sheetTitle.textContent = title;
    sheetText.innerHTML = text;
    startButton.textContent = label;
    sheet.classList.remove("hidden");
  }

  function start() {
    if (state === "over" || state === "ready") reset();
    state = "playing";
    sheet.classList.add("hidden");
    lastTick = performance.now();
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(loop);
  }

  function pause() {
    if (state === "playing") {
      state = "paused";
      cancelAnimationFrame(frame);
      showSheet("Paused", "Take a breath.", "Resume");
    } else if (state === "paused") {
      start();
    }
  }

  function gameOver(reason) {
    state = "over";
    cancelAnimationFrame(frame);
    updateHud();
    showSheet("Game over", `${reason}<br>Score ${score}${score && score === best ? " · new best!" : ""}`, "Play again");
  }

  // ---- controls

  const KEYS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right" };
  document.addEventListener("keydown", (event) => {
    if (event.target.closest("input, textarea, button.mac-seg, [data-sudoku]")) return;
    const visible = (() => { const r = app.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; })();
    if (!visible) return;
    if (KEYS[event.key] && state === "playing") { event.preventDefault(); turn(KEYS[event.key]); }
    else if (event.key === " " && (state === "playing" || state === "paused")) { event.preventDefault(); pause(); }
    // Enter only starts the game in the middle of the screen, so it never starts two games at once
    else if (event.key === "Enter" && state !== "playing" && document.activeElement === document.body
      && (() => { const r = app.getBoundingClientRect(); return r.top < innerHeight / 2 && r.bottom > innerHeight / 2; })()) { event.preventDefault(); start(); }
  });

  let touchStart = null;
  const stage = app.querySelector(".snake-stage");
  stage.addEventListener("touchstart", (event) => { touchStart = [event.touches[0].clientX, event.touches[0].clientY]; }, { passive: true });
  stage.addEventListener("touchend", (event) => {
    if (!touchStart) return;
    const dx = event.changedTouches[0].clientX - touchStart[0];
    const dy = event.changedTouches[0].clientY - touchStart[1];
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
  }, { passive: true });

  app.querySelectorAll("[data-dir]").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.dir === "pause") return state === "playing" || state === "paused" ? pause() : start();
    if (state !== "playing") start();
    turn(button.dataset.dir);
  }));

  startButton.addEventListener("click", start);

  function bindSegment(selector, value, onChange) {
    const seg = app.querySelector(selector);
    const sync = (v) => seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.value === v)));
    sync(value);
    seg.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-value]");
      if (!button) return;
      sync(button.dataset.value);
      onChange(button.dataset.value);
    });
  }

  bindSegment("[data-snake-style]", style, (v) => { style = v; storage.set("snake-style", v); app.classList.toggle("classic", v === "classic"); draw(1); });
  bindSegment("[data-snake-walls]", walls, (v) => {
    walls = v; storage.set("snake-walls", v);
    if (state === "playing") pause();
    state = "ready"; reset(); draw(1);
    showSheet("Snake", v === "walls" ? "Solid walls: the edge is fatal." : "Wrap around: leave one side, appear on the other.", "Play");
  });

  // redraw in the new colours when the theme changes
  new MutationObserver(() => draw(1)).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  addEventListener("resize", resize);

  app.classList.toggle("classic", style === "classic");
  state = "ready";
  reset();
  resize();
  // keep the food pulsing on the start screen
  (function idle() { if (state !== "playing") draw(1); requestAnimationFrame(idle); })();
})();
