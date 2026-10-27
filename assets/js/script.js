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

// add event to all form input field
for (let i = 0; i < formInputs.length; i++) {
  formInputs[i].addEventListener("input", function () {

    // check form validation
    if (form.checkValidity()) {
      formBtn.removeAttribute("disabled");
    } else {
      formBtn.setAttribute("disabled", "");
    }

  });
}

// compose the message in the visitor's email app (static hosting has no backend)
form.addEventListener("submit", function (event) {

  event.preventDefault();

  const data = new FormData(form);
  const subject = data.get("subject").trim() || "Portfolio enquiry from " + data.get("fullname").trim();
  const body = data.get("message").trim() + "\n\n" + data.get("fullname").trim() + "\n" + data.get("email").trim();

  window.location.href = "mailto:artysficial@gmail.com"
    + "?subject=" + encodeURIComponent(subject)
    + "&body=" + encodeURIComponent(body);

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

// open the page named in the URL hash, e.g. index.html#insights
showPage(location.hash.slice(1) || "about");
window.addEventListener("hashchange", function () { showPage(location.hash.slice(1)); });



// footer year
document.querySelector("[data-year]").textContent = new Date().getFullYear();
