(() => {
  "use strict";

  const ROOTS = ".jobs-description, .jobs-description-content, section.description";
  const TEXT_BOX = '[data-testid="expandable-text-box"]';
  const TEXT_BUTTON = 'button[data-testid="expandable-text-button"]';
  const normalize = (text) => (text || "").replace(/\s+/g, " ").trim().toLowerCase();
  const moreLabel = /^(?:(?:…|\.{3})\s*)?(?:(?:see|show|read)\s+)?more(?:\s*(?:…|\.{3}))?$/;
  const lessLabel = /^(?:(?:…|\.{3})\s*)?(?:(?:see|show|read)\s+)?less$/;
  let attempts = new WeakMap();
  let currentJob = "";
  let timer = null;

  function jobKey() {
    const url = new URL(location.href);
    if (!url.pathname.startsWith("/jobs/")) return "";
    // Ignore tracking/filter parameters, which must not trigger another click.
    return url.pathname + "|" + (url.searchParams.get("currentJobId") || "");
  }

  function visible(element) {
    if (element.closest('[hidden], [inert]')) return false;
    // LinkedIn's new text expander is visually displayed but intentionally
    // omitted from the accessibility tree. Only exempt this control itself;
    // an aria-hidden ancestor still means the entire pane should be ignored.
    const ariaHidden = element.closest('[aria-hidden="true"]');
    if (ariaHidden && !(ariaHidden === element && element.matches(TEXT_BUTTON) &&
        element.closest(TEXT_BOX))) return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" &&
      element.getClientRects().length > 0;
  }

  function descriptionRoots() {
    const roots = new Set(document.querySelectorAll(ROOTS));
    // New LinkedIn layout uses generated classes and divs instead of sections.
    // Find the smallest local ancestor tying the heading to one text box;
    // stop before crossing another section heading or a page boundary.
    for (const heading of document.querySelectorAll("h2, h3")) {
      if (normalize(heading.textContent) !== "about the job") continue;
      let container = heading.parentElement;
      for (let depth = 0; container && depth < 6; depth++, container = container.parentElement) {
        if (container.matches('main, body, html, [role="main"]')) break;
        const peerHeadings = container.querySelectorAll(heading.tagName);
        if (peerHeadings.length !== 1 || peerHeadings[0] !== heading) break;
        const boxes = container.querySelectorAll(TEXT_BOX);
        if (boxes.length) {
          if (boxes.length === 1) roots.add(boxes[0]);
          break;
        }
      }
      // Keep the semantic-section fallback for older layouts.
      const section = heading.closest("section, article");
      if (section && section.querySelectorAll("h2, h3").length === 1) roots.add(section);
    }
    return roots;
  }

  function isExpansion(button) {
    if (button.getAttribute("aria-expanded") === "true") return false;
    const text = normalize(button.textContent);
    const label = normalize(button.getAttribute("aria-label"));
    if (lessLabel.test(text) || /\b(?:less|collapse)\b/.test(label)) return false;
    // Known directional control also works when LinkedIn localizes its label.
    if (button.matches(".show-more-less-html__button--more")) return true;
    return moreLabel.test(text) || moreLabel.test(label) ||
      /^(?:click to )?(?:see|show|read|expand) (?:more of |the |full )?(?:job )?description$/.test(label);
  }

  function scan() {
    timer = null;
    const key = jobKey();
    if (key !== currentJob) {
      currentJob = key;
      attempts = new WeakMap();
    }
    if (!key || document.hidden) return;

    for (const root of descriptionRoots()) {
      if (!visible(root)) continue;
      const body = root.matches(TEXT_BOX) ? root : root.querySelector(".jobs-box__html-content, .show-more-less-html__markup, #job-details");
      const bodyCopy = body?.cloneNode(true);
      bodyCopy?.querySelectorAll("button").forEach((button) => button.remove());
      const fingerprint = bodyCopy ? normalize(bodyCopy.textContent).slice(0, 500) : "";
      for (const button of root.querySelectorAll("button")) {
        const subsection = button.closest("section, article");
        if (subsection && subsection !== root && root.contains(subsection) &&
            Array.from(subsection.querySelectorAll("h2, h3")).some(
              (heading) => normalize(heading.textContent) !== "about the job")) continue;
        // Do not follow controls embedded in the employer's description body.
        // The inline-show-more button is LinkedIn's own in-body truncation UI.
        if (button.closest(".jobs-box__html-content, .show-more-less-html__markup") &&
            !button.matches(".inline-show-more-text__button")) continue;
        if (!visible(button) || button.disabled || button.getAttribute("aria-disabled") === "true") continue;

        let state = attempts.get(button);
        // Some SPA layouts reuse both the URL and the button for a new job.
        if (state && state.fingerprint !== fingerprint) {
          attempts.delete(button);
          state = undefined;
        }
        if (state && !isExpansion(button)) state.done = true;
        if (!isExpansion(button) || state?.done) continue;
        const now = Date.now();
        // Bounded retries accommodate late event handlers without click loops.
        if (state && (state.count >= 3 || now - state.lastClick < 1500)) continue;
        attempts.set(button, { count: (state?.count || 0) + 1, lastClick: now, done: false, fingerprint });
        button.click();
        // Record synchronous expansion before a user can manually collapse it.
        if (!isExpansion(button)) attempts.get(button).done = true;
        break;
      }
    }
  }

  function schedule() {
    if (timer === null) timer = setTimeout(scan, 120);
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["class", "style", "data-testid", "hidden", "aria-hidden", "aria-expanded", "aria-label", "disabled", "aria-disabled"],
  });
  // Isolated content scripts cannot reliably observe page-world pushState.
  // This also retries controls whose click handlers were attached after render.
  const poll = setInterval(schedule, 1500);
  window.addEventListener("popstate", schedule);
  window.addEventListener("hashchange", schedule);
  window.addEventListener("pageshow", schedule);
  document.addEventListener("visibilitychange", schedule);
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) return; // Keep working after back/forward cache restore.
    observer.disconnect();
    clearInterval(poll);
    clearTimeout(timer);
  });
  schedule();
})();
