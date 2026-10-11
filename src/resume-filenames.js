(() => {
  "use strict";
  const filename = /^.{1,500}\.(?:docx?|pdf)$/i;
  const dialogs = '[role="dialog"], .jobs-easy-apply-modal';
  let timer = null;

  function scan() {
    timer = null;
    if (!location.pathname.startsWith("/jobs/")) return;
    for (const dialog of document.querySelectorAll(dialogs)) {
      // Keep layout changes within the resume step of an application dialog.
      if (!Array.from(dialog.querySelectorAll('h2, h3, h4, legend')).some(
        (heading) => /^resume$/i.test(heading.textContent.trim()))) continue;
      for (const name of dialog.querySelectorAll("h3, p, span, strong")) {
        // Full filenames are in DOM text even when CSS paints an ellipsis.
        // Do not replace text, read uploads, or change selection controls.
        if (name.children.length || !filename.test(name.textContent.trim()) ||
            name.closest('button, a, [aria-hidden="true"], [hidden]')) continue;
        let card = name.parentElement;
        for (let depth = 0; card && card !== dialog && depth < 6; depth++, card = card.parentElement) {
          const style = getComputedStyle(card);
          const bordered = ["Top", "Right", "Bottom", "Left"].some(
            (side) => parseFloat(style[`border${side}Width`]) > 0 &&
              style[`border${side}Style`] !== "none");
          if (!bordered) continue;
          // A resume card contains a single file and its selection/download UI.
          if (!card.querySelector('button, input[type="radio"], [role="radio"]')) break;
          const names = Array.from(card.querySelectorAll("h3, p, span, strong")).filter(
            (element) => !element.children.length && filename.test(element.textContent.trim()));
          if (names.length !== 1 || names[0] !== name) break;
          card.classList.add("li-auto-expand-resume-card");
          for (let text = name; text && text !== card; text = text.parentElement) {
            text.classList.add("li-auto-expand-resume-text");
          }
          break;
        }
      }
    }
  }

  function schedule() {
    if (timer === null) timer = setTimeout(scan, 120);
  }
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  window.addEventListener("pageshow", schedule);
  window.addEventListener("popstate", schedule);
  schedule();
})();
