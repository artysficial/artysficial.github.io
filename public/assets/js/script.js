'use strict';



// element toggle function
const elementToggleFunc = function (elem) { elem.classList.toggle("active"); }



// sidebar variables
const sidebar = document.querySelector("[data-sidebar]");
const sidebarBtn = document.querySelector("[data-sidebar-btn]");

// sidebar toggle functionality for mobile
sidebarBtn.addEventListener("click", function () { elementToggleFunc(sidebar); });



// project modal variables
const projectBtns = document.querySelectorAll("[data-project-btn]");
const modalContainer = document.querySelector("[data-modal-container]");
const modalCloseBtn = document.querySelector("[data-modal-close-btn]");
const overlay = document.querySelector("[data-overlay]");
const modalTitle = document.querySelector("[data-modal-title]");
const modalText = document.querySelector("[data-modal-text]");

// modal open / close functions
const openModal = function () {
  modalContainer.classList.add("active");
  overlay.classList.add("active");
  modalCloseBtn.focus();
}

const closeModal = function () {
  modalContainer.classList.remove("active");
  overlay.classList.remove("active");
}

// fill the modal from the project's hidden details and open it
for (let i = 0; i < projectBtns.length; i++) {

  projectBtns[i].addEventListener("click", function () {

    const item = this.closest("[data-filter-item]");
    modalTitle.textContent = item.querySelector(".project-title").textContent;
    modalText.innerHTML = item.querySelector(".project-details").innerHTML;

    openModal();

  });

}

modalCloseBtn.addEventListener("click", closeModal);
overlay.addEventListener("click", closeModal);
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") closeModal();
});



// custom select variables
const select = document.querySelector("[data-select]");
const selectItems = document.querySelectorAll("[data-select-item]");
const selectValue = document.querySelector("[data-select-value]");
const filterBtn = document.querySelectorAll("[data-filter-btn]");

select.addEventListener("click", function () { elementToggleFunc(this); });

// add event in all select items
for (let i = 0; i < selectItems.length; i++) {
  selectItems[i].addEventListener("click", function () {

    let selectedValue = this.innerText.toLowerCase();
    selectValue.innerText = this.innerText;
    elementToggleFunc(select);
    filterFunc(selectedValue);

  });
}

// filter variables
const filterItems = document.querySelectorAll("[data-filter-item]");

const filterFunc = function (selectedValue) {

  for (let i = 0; i < filterItems.length; i++) {

    if (selectedValue === "all") {
      filterItems[i].classList.add("active");
    } else if (selectedValue === filterItems[i].dataset.category) {
      filterItems[i].classList.add("active");
    } else {
      filterItems[i].classList.remove("active");
    }

  }

}

// add event in all filter button items for large screen
let lastClickedBtn = filterBtn[0];

for (let i = 0; i < filterBtn.length; i++) {

  filterBtn[i].addEventListener("click", function () {

    let selectedValue = this.innerText.toLowerCase();
    selectValue.innerText = this.innerText;
    filterFunc(selectedValue);

    lastClickedBtn.classList.remove("active");
    this.classList.add("active");
    lastClickedBtn = this;

  });

}



// copy citation
const copyCitationBtn = document.querySelector("[data-copy-citation]");
const copyLabel = document.querySelector("[data-copy-label]");
const citation = document.querySelector("[data-citation]");

copyCitationBtn.addEventListener("click", async function () {

  const text = citation.textContent.replace(/\s+/g, " ").trim();

  try {
    await navigator.clipboard.writeText(text);
    copyLabel.textContent = "Copied";
  } catch (error) {
    // clipboard can be blocked (e.g. file:// or old browsers): select the text instead
    const range = document.createRange();
    range.selectNodeContents(citation);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    copyLabel.textContent = "Selected, press Ctrl+C";
  }

  setTimeout(function () { copyLabel.textContent = "Copy citation"; }, 2500);

});



// contact form variables
const form = document.querySelector("[data-form]");
const formInputs = document.querySelectorAll("[data-form-input]");
const formBtn = document.querySelector("[data-form-btn]");
const formBtnLabel = document.querySelector("[data-form-btn-label]");
const formStatus = document.querySelector("[data-form-status]");

const updateFormBtn = function () { formBtn.disabled = !form.checkValidity(); }

const showFormStatus = function (kind, message) {
  formStatus.className = "form-status " + kind;
  formStatus.textContent = message;
}

// the button stays usable without JavaScript; with it, enable only once the form is valid
updateFormBtn();

for (let i = 0; i < formInputs.length; i++) {
  formInputs[i].addEventListener("input", function () {
    this.classList.remove("invalid");
    updateFormBtn();
  });
}

// send the message to the server, which emails it on
form.addEventListener("submit", async function (event) {

  event.preventDefault();

  formBtn.disabled = true;
  formBtnLabel.textContent = "Sending…";
  showFormStatus("", "");

  try {
    const response = await fetch(form.action, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(form)))
    });
    const result = await response.json();

    if (result.ok) {
      // reset() leaves hidden inputs alone, so the server's start time is kept
      form.reset();
      showFormStatus("sent", result.message);
    } else {
      for (const name in result.errors || {}) {
        const input = form.elements[name];
        if (input) input.classList.add("invalid");
      }
      const details = Object.values(result.errors || {}).join(" ");
      showFormStatus(result.errors ? "invalid" : "error", (result.message + " " + details).trim());
    }
  } catch (error) {
    showFormStatus("error", "Sorry, the message could not be sent. Please email me directly at artysficial@gmail.com.");
  }

  formBtnLabel.textContent = "Send Message";
  updateFormBtn();

});



// page navigation variables
const navigationLinks = document.querySelectorAll("[data-nav-link]");
const pages = document.querySelectorAll("[data-page]");

// show one page and highlight its nav link
const showPage = function (pageName) {

  let found = false;

  for (let i = 0; i < pages.length; i++) {
    const isActive = pages[i].dataset.page === pageName;
    pages[i].classList.toggle("active", isActive);
    if (isActive) found = true;
  }

  if (!found) return showPage("about");

  for (let i = 0; i < navigationLinks.length; i++) {
    navigationLinks[i].classList.toggle("active", navigationLinks[i].dataset.navLink === pageName);
  }

}

// add event to all nav link
for (let i = 0; i < navigationLinks.length; i++) {
  navigationLinks[i].addEventListener("click", function () {

    history.replaceState(null, "", "#" + this.dataset.navLink);
    showPage(this.dataset.navLink);
    window.scrollTo(0, 0);

  });
}

// open the page named in the URL hash, e.g. /#insights
showPage(location.hash.slice(1) || "about");
window.addEventListener("hashchange", function () { showPage(location.hash.slice(1)); });



// theme toggle (the initial theme is applied by an inline script in <head>)
const themeBtn = document.querySelector("[data-theme-btn]");
const systemLight = window.matchMedia("(prefers-color-scheme: light)");

const setTheme = function (theme) { document.documentElement.setAttribute("data-theme", theme); }

themeBtn.addEventListener("click", function () {

  const theme = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
  setTheme(theme);
  try { localStorage.setItem("theme", theme); } catch (error) { }

});

// follow the system setting until the visitor picks a theme
systemLight.addEventListener("change", function (event) {

  let saved = null;
  try { saved = localStorage.getItem("theme"); } catch (error) { }
  if (!saved) setTheme(event.matches ? "light" : "dark");

});



