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



// footer year
document.querySelector("[data-year]").textContent = new Date().getFullYear();
