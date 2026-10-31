"use strict";

const root = document.documentElement;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---- theme: circular reveal from the toggle (View Transitions API), cross-fade elsewhere

const themeToggle = document.querySelector("[data-theme-toggle]");

function labelToggle() {
  if (themeToggle) themeToggle.setAttribute("aria-label", root.dataset.theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
}

function setTheme(theme, origin) {
  const apply = () => {
    root.dataset.theme = theme;
    try { localStorage.setItem("theme", theme); } catch (e) {}
    labelToggle();
  };
  if (reducedMotion) return apply();
  if (!document.startViewTransition) {
    root.classList.add("theme-fading");
    apply();
    setTimeout(() => root.classList.remove("theme-fading"), 650);
    return;
  }
  const x = origin ? origin.x : innerWidth / 2;
  const y = origin ? origin.y : 0;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  document.startViewTransition(apply).ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 750, easing: "cubic-bezier(0.4, 0, 0.2, 1)", pseudoElement: "::view-transition-new(root)" }
    );
  });
}

if (themeToggle) {
  labelToggle();
  themeToggle.addEventListener("click", (event) => {
    const box = themeToggle.getBoundingClientRect();
    setTheme(root.dataset.theme === "dark" ? "light" : "dark", { x: box.left + box.width / 2, y: box.top + box.height / 2 });
  });
}

// follow the system setting until the visitor chooses
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
  let saved = null;
  try { saved = localStorage.getItem("theme"); } catch (e) {}
  if (!saved) setTheme(event.matches ? "dark" : "light");
});

// ---- mobile menu

const menuButton = document.querySelector("[data-menu]");
const navLinks = document.querySelector("[data-nav-links]");
if (menuButton && navLinks) {
  menuButton.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(open));
  });
  navLinks.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      navLinks.classList.remove("open");
      menuButton.setAttribute("aria-expanded", "false");
    }
  });
}

// ---- scroll reveal and number count-up

function countUp(element) {
  const target = Number(element.dataset.count);
  const suffix = element.dataset.suffix || "";
  const started = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - started) / 1400);
    const eased = 1 - Math.pow(1 - t, 3);
    element.textContent = Math.round(target * eased) + suffix;
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const animated = document.querySelectorAll(".reveal, .scale-in");
if (reducedMotion || !("IntersectionObserver" in window)) {
  animated.forEach((el) => el.classList.add("in"));
} else {
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("in");
      entry.target.querySelectorAll("[data-count]").forEach(countUp);
      io.unobserve(entry.target);
    }
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
  animated.forEach((el) => io.observe(el));
}

// ---- career paths: segmented control and the six-step thread select the same role

const segmented = document.querySelector("[data-segmented]");
const glider = segmented && segmented.querySelector(".glider");
const panels = document.querySelectorAll("[data-panel]");
const threadSteps = document.querySelectorAll("[data-thread] [data-role]");

function moveGlider(button) {
  if (!glider || !button) return;
  glider.style.left = button.offsetLeft + "px";
  glider.style.width = button.offsetWidth + "px";
}

function selectRole(role, scroll) {
  if (!segmented) return;
  segmented.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.role === role)));
  threadSteps.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.role === role)));
  panels.forEach((p) => p.classList.toggle("active", p.dataset.panel === role));
  const current = segmented.querySelector(`[data-role="${role}"]`);
  moveGlider(current);
  current.scrollIntoView({ block: "nearest", inline: "center", behavior: reducedMotion ? "auto" : "smooth" });
  if (scroll) segmented.scrollIntoView({ block: "start", behavior: reducedMotion ? "auto" : "smooth" });
}

if (segmented) {
  segmented.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-role]");
    if (button) selectRole(button.dataset.role);
  });
  // arrow keys move between roles, as in a native segmented control
  segmented.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    const buttons = [...segmented.querySelectorAll("button[data-role]")];
    const index = buttons.findIndex((b) => b.getAttribute("aria-selected") === "true");
    const next = buttons[(index + (event.key === "ArrowRight" ? 1 : buttons.length - 1)) % buttons.length];
    selectRole(next.dataset.role);
    next.focus();
  });
  threadSteps.forEach((step) => step.addEventListener("click", () => selectRole(step.dataset.role, true)));
  addEventListener("resize", () => moveGlider(segmented.querySelector('[aria-selected="true"]')));
  requestAnimationFrame(() => moveGlider(segmented.querySelector('[aria-selected="true"]')));
  document.fonts && document.fonts.ready.then(() => moveGlider(segmented.querySelector('[aria-selected="true"]')));
}

// ---- live status: every project's CI publishes summary.json next to its dashboard

const BASE = location.hostname === "artysficial.github.io" ? "/" : "https://artysficial.github.io/";
const PROJECTS = [
  { repo: "it-maturity-assessment", role: "IT Consultant", color: "var(--consultant)" },
  { repo: "requirements-traceability", role: "Business Analyst", color: "var(--ba)" },
  { repo: "project-health-dashboard", role: "Project Manager", color: "var(--pm)" },
  { repo: "hsm-api-security-lab", role: "SDET", color: "var(--sdet)" },
  { repo: "sap-p2p-analytics", role: "SAP Consultant", color: "var(--sap)" },
  { repo: "itgc-audit-analytics", role: "IT Auditor", color: "var(--auditor)" },
];
const EXTRA = ["youtube-test-automation", "google-test-automation"];

function testsText(counts) {
  const total = Object.values(counts || {}).reduce((a, b) => a + b, 0);
  return total ? `${counts.passed || 0}/${total} tests passing` : "";
}

async function loadSummary(repo) {
  const response = await fetch(`${BASE}${repo}/summary.json`, { cache: "no-cache" });
  if (!response.ok) throw new Error(response.status);
  return response.json();
}

const board = document.querySelector("[data-status-board]");
const note = document.querySelector("[data-status-note]");
const summaries = {};

// only pages that show project status fetch it
const showsStatus = board || document.querySelector("[data-live]");
(showsStatus ? Promise.allSettled([...PROJECTS.map((p) => p.repo), ...EXTRA].map((repo) => loadSummary(repo).then((s) => (summaries[repo] = s)))) : new Promise(() => {}))
  .then(() => {
    if (board) {
      board.innerHTML = "";
      for (const project of PROJECTS) {
        const s = summaries[project.repo];
        const cell = document.createElement("a");
        cell.className = "status-cell";
        cell.href = `https://artysficial.github.io/${project.repo}/`;
        cell.innerHTML = `<div class="role" style="color:${project.color}"></div><div class="name"></div><div class="verdict"><span class="dot"></span><span></span></div>`;
        cell.querySelector(".role").textContent = project.role;
        cell.querySelector(".name").textContent = s ? s.title : project.repo.replace(/-/g, " ");
        cell.querySelector(".dot").classList.add(s ? s.tone : "neutral");
        cell.querySelector(".verdict span:last-child").textContent = s ? s.verdict : "Dashboard";
        board.appendChild(cell);
      }
    }
    const loaded = Object.keys(summaries).length;
    if (note) {
      const newest = Object.values(summaries).map((s) => s.generated).sort().pop();
      note.textContent = loaded
        ? `Live from ${loaded} CI pipelines · latest run ${new Date(newest).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
        : "Live status unavailable right now; open any dashboard for the latest results.";
    }
    document.querySelectorAll("[data-live]").forEach((card) => {
      const s = summaries[card.dataset.live];
      const slot = card.querySelector(".live");
      if (!slot || !s) return;
      slot.innerHTML = '<span class="dot"></span><span></span>';
      slot.querySelector(".dot").classList.add(s.tone);
      const tests = testsText(s.counts);
      slot.querySelector("span:last-child").textContent = s.verdict + (tests ? ` · ${tests}` : "");
    });
  });

// ---- contact: compose the email in the visitor's mail app (static site, no server)

const form = document.querySelector("[data-contact-form]");
if (form) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const subject = encodeURIComponent(`Portfolio enquiry from ${data.get("name")}`);
    const body = encodeURIComponent(`${data.get("message")}\n\n${data.get("name")}\n${data.get("email")}`);
    location.href = `mailto:artysficial@gmail.com?subject=${subject}&body=${body}`;
  });
}

document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
