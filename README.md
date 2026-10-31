# Rahmadani Tyas Ningrum · Portfolio

**Live: https://artysficial.github.io/**

Personal site of a Test Lead and Senior Automation SDET. Static HTML, CSS and JavaScript, no build step,
Apple-inspired design with light and dark mode (the theme change spreads from the toggle as a circle, using the
View Transitions API, with a cross-fade fallback).

## What is on it

- **Career paths**: one fictional case study (Arunika Bank's payment-security programme) worked through six
  roles: IT Consultant, IT Business Analyst, Project Manager, SDET, SAP Consultant and IT Auditor.
- **Projects**: eight repositories, each with tests, CI and a live dashboard. The site reads every project's
  `summary.json` at load time, so the status shown is always that of the latest CI run.

  | Role | Project |
  | --- | --- |
  | SDET | [hsm-api-security-lab](https://github.com/artysficial/hsm-api-security-lab), [youtube-test-automation](https://github.com/artysficial/youtube-test-automation), [google-test-automation](https://github.com/artysficial/google-test-automation) |
  | IT Business Analyst | [requirements-traceability](https://github.com/artysficial/requirements-traceability) |
  | Project Manager | [project-health-dashboard](https://github.com/artysficial/project-health-dashboard) |
  | IT Auditor | [itgc-audit-analytics](https://github.com/artysficial/itgc-audit-analytics) |
  | SAP Consultant | [sap-p2p-analytics](https://github.com/artysficial/sap-p2p-analytics) |
  | Senior IT Consultant | [it-maturity-assessment](https://github.com/artysficial/it-maturity-assessment) |

- **Writing**: six articles on HSM, CBDC, eUICC, BDD, Jenkins/Jira traceability and release readiness.
- **Play** (`play.html`): a macOS-style Tic-Tac-Toe with a minimax opponent, and Snake modernised from the
  Nokia classic (smooth 60 fps rendering, swipe and D-pad controls, Classic LCD mode).

## Structure

```
index.html, play.html        pages
articles/*.html              articles
assets/css/site.css          design tokens (light + dark), layout, components
assets/css/games.css         macOS window, Tic-Tac-Toe and Snake styles
assets/css/article.css       article pages
assets/js/site.js            theme transition, reveals, role switcher, live project status, contact
assets/js/tictactoe.js       game logic and minimax AI
assets/js/snake.js           game loop and canvas renderer
assets/docs/                 CV (PDF)
```

Everything respects `prefers-reduced-motion`, and every interactive element works with the keyboard.
