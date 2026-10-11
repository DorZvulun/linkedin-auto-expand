/* Browser fixtures exercise the actual content script, without LinkedIn access. */
const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  let passed = 0;
  try {
    const page = await browser.newPage();
    await page.route("**/*", (route) => route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<main>
        <button id="outside">… more</button>
        <div class="jobs-description">
          <h2>About the job</h2>
          <div class="jobs-box__html-content" id="job-details">First job description</div>
          <button id="expand" aria-expanded="false">… more</button>
          <section><h3>About the company</h3><button id="company">more</button></section>
        </div>
      </main>`,
    }));
    await page.goto("https://www.linkedin.com/jobs/view/1/");
    await page.evaluate(() => {
      window.clicks = {};
      document.addEventListener("click", (event) => {
        const button = event.target.closest("button");
        if (!button) return;
        window.clicks[button.id] = (window.clicks[button.id] || 0) + 1;
        if (!button.hasAttribute("data-unresponsive")) {
          button.setAttribute("aria-expanded", "true");
          button.textContent = "Show less";
        }
      });
    });
    await page.addScriptTag({ path: path.resolve(__dirname, "../src/content.js") });
    const count = (id) => page.evaluate((id) => window.clicks[id] || 0, id);
    const check = async (name, action) => {
      await action();
      passed++;
      console.log(`PASS ${name}`);
    };
    const settled = () => page.waitForTimeout(350);
    await check("initial expansion and unrelated buttons untouched", async () => {
      await settled();
      assert.equal(await count("expand"), 1);
      assert.equal(await count("outside"), 0);
      assert.equal(await count("company"), 0);
    });
    await check("manual collapse is respected", async () => {
      await page.evaluate(() => {
        const b = document.querySelector("#expand");
        b.textContent = "… more";
        b.setAttribute("aria-expanded", "false");
      });
      await page.waitForTimeout(1800);
      assert.equal(await count("expand"), 1);
    });
    await check("pushState with reused DOM and no mutation", async () => {
      await page.evaluate(() => history.pushState({}, "", "/jobs/view/2/"));
      await page.waitForTimeout(1800);
      assert.equal(await count("expand"), 2);
    });
    await check("same URL with a new description and reused button", async () => {
      await page.evaluate(() => {
        document.querySelector("#job-details").textContent = "A different job description";
        const b = document.querySelector("#expand");
        b.textContent = "Show more";
        b.setAttribute("aria-expanded", "false");
      });
      await settled();
      assert.equal(await count("expand"), 3);
    });
    await check("replacement job pane and selected job query", async () => {
      await page.evaluate(() => {
        history.pushState({}, "", "/jobs/search/?currentJobId=3");
        document.querySelector(".jobs-description").innerHTML = '<h2>About the job</h2><button id="replacement">... more</button>';
      });
      await settled();
      assert.equal(await count("replacement"), 1);
    });
    await check("no clicks outside jobs; resume on return", async () => {
      await page.evaluate(() => {
        history.pushState({}, "", "/feed/");
        document.querySelector(".jobs-description").innerHTML = '<button id="feed">more</button>';
      });
      await settled();
      assert.equal(await count("feed"), 0);
      await page.evaluate(() => history.pushState({}, "", "/jobs/search/?currentJobId=4"));
      await page.waitForTimeout(1800);
      assert.equal(await count("feed"), 1);
    });
    await check("heading fallback, hidden/disabled/expanded/body controls", async () => {
      await page.evaluate(() => {
        document.querySelector("main").innerHTML = `<section><h2>About the job</h2>
          <button id="hidden" style="display:none">more</button>
          <button id="disabled" disabled>more</button>
          <button id="expanded" aria-expanded="true">more</button>
          <div class="jobs-box__html-content"><button id="embedded">more</button></div>
          <button id="fallback">See more</button></section>
          <section><h2>About the company</h2><button id="wrong-section">more</button></section>`;
      });
      await settled();
      assert.equal(await count("fallback"), 1);
      for (const id of ["hidden", "disabled", "expanded", "embedded", "wrong-section"]) assert.equal(await count(id), 0);
    });
    await check("late enabled control", async () => {
      await page.evaluate(() => document.querySelector("#disabled").disabled = false);
      await settled();
      assert.equal(await count("disabled"), 1);
    });
    await check("localized directional control", async () => {
      await page.evaluate(() => {
        document.querySelector("main").innerHTML = '<section class="description"><button class="show-more-less-html__button--more" id="localized">Mehr anzeigen</button></section>';
      });
      await settled();
      assert.equal(await count("localized"), 1);
    });
    await check("bounded retries for unresponsive controls", async () => {
      await page.evaluate(() => {
        document.querySelector("main").innerHTML = '<div class="jobs-description"><button id="unresponsive" data-unresponsive>more</button></div>';
      });
      await page.waitForTimeout(8500);
      assert.equal(await count("unresponsive"), 3);
    });
    await check("new LinkedIn div layout with visible aria-hidden expander", async () => {
      await page.evaluate(() => {
        document.querySelector("main").innerHTML = `<div>
          <div><div><h2>About the job</h2></div>
            <div><span data-testid="expandable-text-box"><p>Job responsibilities</p>
              <button id="modern" aria-hidden="true" data-testid="expandable-text-button"><span>…</span><span> more</span></button>
            </span></div></div>
          <div><h2>About the company</h2><span data-testid="expandable-text-box">
            <button id="modern-company" aria-hidden="true" data-testid="expandable-text-button">… more</button>
          </span></div></div>`;
      });
      await settled();
      assert.equal(await count("modern"), 1);
      assert.equal(await count("modern-company"), 0);
    });
    await check("new layout still rejects hidden ancestors and generic aria-hidden controls", async () => {
      await page.evaluate(() => {
        document.querySelector("main").innerHTML = `<div aria-hidden="true"><div><h2>About the job</h2></div>
          <span data-testid="expandable-text-box"><button id="modern-hidden" aria-hidden="true" data-testid="expandable-text-button">more</button></span></div>
          <div><h2>About the job</h2><span data-testid="expandable-text-box">
            <button id="modern-css-hidden" style="display:none" aria-hidden="true" data-testid="expandable-text-button">more</button>
          </span></div>
          <div class="jobs-description"><button id="generic-hidden" aria-hidden="true">more</button></div>`;
      });
      await settled();
      for (const id of ["modern-hidden", "modern-css-hidden", "generic-hidden"]) assert.equal(await count(id), 0);
      await page.evaluate(() => document.querySelector("#modern-css-hidden").style.display = "inline-block");
      await settled();
      assert.equal(await count("modern-css-hidden"), 1);
    });
    await check("heading search cannot escape into a sibling company section", async () => {
      await page.evaluate(() => {
        document.querySelector("main").innerHTML = `<div><div><h2>About the job</h2><p>Already fully visible</p></div>
          <div><h2>About the company</h2><span data-testid="expandable-text-box">
            <button id="sibling-company" data-testid="expandable-text-button">more</button>
          </span></div></div>`;
      });
      await settled();
      assert.equal(await count("sibling-company"), 0);
    });
    const manifest = require("../manifest.json");
    assert.equal(manifest.manifest_version, 3);
    assert.equal(manifest.permissions, undefined);
    assert.ok(manifest.content_scripts[0].matches.every((match) => match.endsWith("/jobs/*")));
    console.log(`${passed} browser scenarios and manifest checks passed.`);
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
