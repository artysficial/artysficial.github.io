"use strict";

// Tic-Tac-Toe in a macOS-style window. "Unbeatable" is full minimax with alpha-beta pruning.
(function () {
  const app = document.querySelector("[data-ttt]");
  if (!app) return;

  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const boardEl = app.querySelector("[data-ttt-board]");
  const statusEl = app.querySelector("[data-ttt-status]");
  const lineEl = app.querySelector("[data-win-line]");
  const modeSeg = app.querySelector("[data-ttt-mode]");
  const levelSeg = app.querySelector("[data-ttt-level]");
  const scoreEls = { X: app.querySelector("[data-score-x]"), O: app.querySelector("[data-score-o]"), draw: app.querySelector("[data-score-draw]") };
  const labelO = app.querySelector("[data-label-o]");
  const labelX = app.querySelector("[data-label-x]");

  const storage = {
    get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (e) { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} },
  };

  let board, turn, over, thinking;
  let firstPlayer = "X";
  let mode = storage.get("ttt-mode", "ai");
  let level = storage.get("ttt-level", "normal");
  let scores = storage.get("ttt-scores", { X: 0, O: 0, draw: 0 });

  const MARKS = {
    X: '<svg viewBox="0 0 100 100" class="mark-x" aria-hidden="true"><path d="M22 22 L78 78"/><path d="M78 22 L22 78"/></svg>',
    O: '<svg viewBox="0 0 100 100" class="mark-o" aria-hidden="true"><circle cx="50" cy="50" r="30"/></svg>',
  };

  // ---- rules

  function winnerOf(b) {
    for (const line of LINES) {
      const [a, c, d] = line;
      if (b[a] && b[a] === b[c] && b[a] === b[d]) return { player: b[a], line };
    }
    return b.every(Boolean) ? { player: "draw" } : null;
  }

  // minimax with alpha-beta; prefers quicker wins and slower losses
  function minimax(b, player, depth, alpha, beta) {
    const result = winnerOf(b);
    if (result) return { score: result.player === "O" ? 10 - depth : result.player === "X" ? depth - 10 : 0 };
    let best = { score: player === "O" ? -Infinity : Infinity, move: -1 };
    for (let i = 0; i < 9; i++) {
      if (b[i]) continue;
      b[i] = player;
      const { score } = minimax(b, player === "O" ? "X" : "O", depth + 1, alpha, beta);
      b[i] = null;
      if (player === "O" ? score > best.score : score < best.score) best = { score, move: i };
      if (player === "O") alpha = Math.max(alpha, score); else beta = Math.min(beta, score);
      if (beta <= alpha) break;
    }
    return best;
  }

  function aiMove() {
    const empty = board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    const random = () => empty[Math.floor(Math.random() * empty.length)];
    // easy plays randomly most of the time; normal is perfect two moves in three
    const chance = { easy: 0.2, normal: 0.65, unbeatable: 1 }[level];
    return Math.random() < chance ? minimax(board.slice(), "O", 0, -Infinity, Infinity).move : random();
  }

  // ---- view

  function cellLabel(i) {
    const row = Math.floor(i / 3) + 1, col = (i % 3) + 1;
    return `Row ${row}, column ${col}, ${board[i] ? board[i] : "empty"}`;
  }

  function render() {
    boardEl.querySelectorAll(".ttt-cell").forEach((cell, i) => {
      if (board[i] && !cell.dataset.mark) {
        cell.innerHTML = MARKS[board[i]];
        cell.dataset.mark = board[i];
      }
      cell.disabled = Boolean(board[i]) || over || thinking;
      cell.setAttribute("aria-label", cellLabel(i));
    });
    scoreEls.X.textContent = scores.X;
    scoreEls.O.textContent = scores.O;
    scoreEls.draw.textContent = scores.draw;
    labelX.textContent = mode === "ai" ? "You" : "Player ×";
    labelO.textContent = mode === "ai" ? "Mac" : "Player ○";
    levelSeg.querySelectorAll("button").forEach((b) => (b.disabled = mode !== "ai"));
  }

  function status(text) { statusEl.textContent = text; }

  function drawWinLine(line) {
    const centre = (i) => [50 + (i % 3) * 100, 50 + Math.floor(i / 3) * 100];
    const [x1, y1] = centre(line[0]);
    const [x2, y2] = centre(line[2]);
    const dx = (x2 - x1) * 0.12, dy = (y2 - y1) * 0.12;
    lineEl.setAttribute("x1", x1 - dx); lineEl.setAttribute("y1", y1 - dy);
    lineEl.setAttribute("x2", x2 + dx); lineEl.setAttribute("y2", y2 + dy);
    lineEl.classList.remove("show");
    void lineEl.getBoundingClientRect();
    lineEl.classList.add("show");
    line.forEach((i) => boardEl.children[i].classList.add("win"));
  }

  function finish(result) {
    over = true;
    scores[result.player] += 1;
    storage.set("ttt-scores", scores);
    if (result.player === "draw") status("It's a draw.");
    else if (mode === "ai") status(result.player === "X" ? "You win! 🎉" : level === "unbeatable" ? "Mac wins. It always does on Unbeatable." : "Mac wins.");
    else status(`Player ${result.player === "X" ? "×" : "○"} wins!`);
    if (result.line) drawWinLine(result.line);
    render();
  }

  function play(i) {
    if (over || thinking || board[i]) return;
    board[i] = turn;
    const result = winnerOf(board);
    if (result) return finish(result);
    turn = turn === "X" ? "O" : "X";
    if (mode === "ai" && turn === "O") {
      thinking = true;
      status("Mac is thinking…");
      render();
      setTimeout(() => {
        thinking = false;
        play(aiMove());
      }, 420);
      return;
    }
    status(mode === "ai" ? "Your move" : `Player ${turn === "X" ? "×" : "○"} to move`);
    render();
  }

  function newGame() {
    board = Array(9).fill(null);
    over = false;
    thinking = false;
    turn = firstPlayer;
    firstPlayer = firstPlayer === "X" ? "O" : "X"; // alternate who starts
    boardEl.innerHTML = "";
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "ttt-cell";
      cell.setAttribute("role", "gridcell");
      cell.addEventListener("click", () => play(i));
      boardEl.appendChild(cell);
    }
    lineEl.classList.remove("show");
    render();
    if (mode === "ai" && turn === "O") {
      status("Mac starts this round…");
      thinking = true;
      render();
      setTimeout(() => { thinking = false; play(aiMove()); }, 500);
    } else {
      status(mode === "ai" ? "Your move" : `Player ${turn === "X" ? "×" : "○"} to move`);
    }
  }

  function bindSegment(seg, value, onChange) {
    const sync = (v) => seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.value === v)));
    sync(value);
    seg.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-value]");
      if (!button || button.disabled) return;
      sync(button.dataset.value);
      onChange(button.dataset.value);
    });
  }

  bindSegment(modeSeg, mode, (v) => { mode = v; storage.set("ttt-mode", v); firstPlayer = "X"; newGame(); });
  bindSegment(levelSeg, level, (v) => { level = v; storage.set("ttt-level", v); firstPlayer = "X"; newGame(); });
  app.querySelector("[data-ttt-new]").addEventListener("click", newGame);
  app.querySelector("[data-ttt-reset]").addEventListener("click", () => { scores = { X: 0, O: 0, draw: 0 }; storage.set("ttt-scores", scores); render(); });

  // keys 1-9 map to the squares like a phone keypad read left to right, top to bottom
  document.addEventListener("keydown", (event) => {
    if (event.target.closest("input, textarea, [data-sudoku]") || event.metaKey || event.ctrlKey) return;
    const rect = app.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > innerHeight) return;
    if (/^[1-9]$/.test(event.key)) play(Number(event.key) - 1);
    if (event.key.toLowerCase() === "n") newGame();
  });

  newGame();
})();
