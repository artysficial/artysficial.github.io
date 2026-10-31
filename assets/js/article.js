'use strict';



// share on LinkedIn with the current page URL
const linkedinShare = document.querySelector("[data-share-linkedin]");

linkedinShare.href = "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(location.href);



// copy the page link
const copyLinkBtn = document.querySelector("[data-copy-link]");
const copyLinkLabel = copyLinkBtn.querySelector("span");

copyLinkBtn.addEventListener("click", async function () {

  try {
    await navigator.clipboard.writeText(location.href);
    copyLinkLabel.textContent = "Link copied";
  } catch (error) {
    window.prompt("Copy this link:", location.href);
  }

  setTimeout(function () { copyLinkLabel.textContent = "Copy link"; }, 2500);

});



// theme toggle (the initial theme is applied by an inline script in <head>): the new theme
// spreads from the button as a circle, like the home page; a cross-fade where unsupported
const themeBtn = document.querySelector("[data-theme-btn]");

themeBtn.addEventListener("click", function () {

  const root = document.documentElement;
  const theme = root.getAttribute("data-theme") === "light" ? "dark" : "light";
  const apply = function () {
    root.setAttribute("data-theme", theme);
    try { localStorage.setItem("theme", theme); } catch (error) { }
  };

  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return apply();
  if (!document.startViewTransition) {
    root.classList.add("theme-fading");
    apply();
    setTimeout(function () { root.classList.remove("theme-fading"); }, 650);
    return;
  }
  const box = themeBtn.getBoundingClientRect();
  const x = box.left + box.width / 2, y = box.top + box.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  document.startViewTransition(apply).ready.then(function () {
    root.animate({ clipPath: ["circle(0px at " + x + "px " + y + "px)", "circle(" + radius + "px at " + x + "px " + y + "px)"] },
      { duration: 750, easing: "cubic-bezier(0.4, 0, 0.2, 1)", pseudoElement: "::view-transition-new(root)" });
  });

});



// footer year
document.querySelector("[data-year]").textContent = new Date().getFullYear();
