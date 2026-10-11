# LinkedIn Job Description Auto Expand

A small Chrome Manifest V3 extension that clicks **… more** in **About the job** when you open or change LinkedIn jobs. No build step, dependencies, background service, settings, analytics, storage, or network requests.

## Chrome Web Store

The extension is not published yet. Until the store listing is available, install it manually below.

<!-- Release task: replace this section with the Chrome Web Store install link after publication. -->

## Install manually

1. Keep this folder somewhere permanent.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select this folder—the one containing `manifest.json`.
5. Open or refresh a LinkedIn page under `https://www.linkedin.com/jobs/`.
6. Select a job. Its description should expand automatically; switch jobs to try again.

After editing the extension, click its **Reload** button in `chrome://extensions`, then refresh the LinkedIn tab. Refreshing LinkedIn alone does not reload extension code. In Arc, use `arc://extensions` and the same steps. To stop automatic expansion, disable or remove the extension there.

## How it works and limits

- Runs only in the main frame on HTTPS LinkedIn `/jobs/*` pages. No extra permissions.
- Watches dynamically rendered content and checks every 1.5 seconds for navigation and late-loaded controls. Handles selected-job URL changes, replaced job panes, and back/forward navigation.
- Restricts clicks to recognized job-description containers, with a conservative fallback for a section headed exactly **About the job**. Supports the newer generated-class layout by locating its expandable text box next to that heading. Checks that the control is visible, enabled, and an expansion control. LinkedIn's visually displayed text-expansion button may itself be marked `aria-hidden`; only that specific control is exempted. Hidden ancestor panes and unrelated **more** buttons are ignored.
- Retries an unresponsive control at most three times per job URL. Once expansion is observed, it leaves that control alone, including if you manually collapse it. LinkedIn replacing the control can cause it to expand again.
- If you enter Jobs from the feed without a full page load, refresh once. Chrome only injects this narrowly scoped extension when a matching page loads. After injection, it stops clicking when you navigate outside `/jobs/*` and resumes when you return.
- English **more** labels are supported, plus LinkedIn's explicit show-more control class for localized pages. Other localized layouts may need selector updates.
- LinkedIn can change its markup. Version 1.0.1 adds support for markup inspected in a signed-in Arc session on October 8, 2026, alongside browser regression fixtures. If it stops working, inspect the About the job section and update `src/content.js`; avoid broadening it to click all **more** buttons.

## Files

```text
manifest.json       Chrome extension definition
src/content.js      Description detection and expansion
tests/smoke.cjs      Browser regression checks (development only)
README.md           Installation and limitations
```

## Development checks (optional)

With Node.js installed, run `npm install --no-save playwright`, then `npx playwright install chromium` and `node tests/smoke.cjs`. These tools are only for testing; the extension itself has no dependencies. The checks use local HTML fixtures, with no LinkedIn login or requests.

Chrome documentation: [content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts).
