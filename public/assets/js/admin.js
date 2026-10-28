'use strict';



// one shared tooltip for the daily chart (screen readers get the table under it instead)
const tip = document.querySelector("[data-chart-tip]");
const cols = document.querySelectorAll("[data-tip]");

const showTip = function () {
  const box = this.getBoundingClientRect();
  tip.textContent = this.dataset.tip;
  tip.style.left = box.left + box.width / 2 + "px";
  tip.style.top = box.top + "px";
  tip.hidden = false;
}

const hideTip = function () { tip.hidden = true; }

for (let i = 0; i < cols.length; i++) {
  cols[i].addEventListener("mouseenter", showTip);
  cols[i].addEventListener("mouseleave", hideTip);
}

window.addEventListener("scroll", hideTip, { passive: true });
