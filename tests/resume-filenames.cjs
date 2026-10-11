const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    const filename = "example-candidate-platform-engineer-production-infrastructure-resume.docx";
    await page.setContent(`<style>
      main { width: 850px; max-width: 100%; }
      .jobs-resume-card__container { position: relative; width:342px; max-width:342px; border:1px solid; }
      .jobs-resume-card__attachment { box-sizing:border-box; width:342px; max-width:100%; padding:12px 8px 12px 52px; }
      .jobs-resume-card__filedata { width:191px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .jobs-resume-card__options-button-container { position:absolute; right:0; top:0; width:91px; }
      #unrelated { width:120px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      body { margin:8px; }
    </style><main><div class="jobs-resume-card__container">
      <div class="jobs-resume-card__attachment"><h3 class="ui-attachment__filename jobs-resume-card__filedata">${filename}</h3>
      <p class="ui-attachment__filesize jobs-resume-card__filedata">Last used today</p></div>
      <div class="jobs-resume-card__options-button-container"><button id="menu">Options</button></div>
    </div><p id="unrelated">Unrelated truncated page text</p></main>`);
    await page.addStyleTag({ path: path.resolve(__dirname, "../src/resume-filenames.css") });
    const measure = () => page.evaluate(() => {
      const name = document.querySelector(".ui-attachment__filename");
      const card = name.closest(".jobs-resume-card__container");
      const rect = name.getBoundingClientRect();
      const menu = document.querySelector("#menu").getBoundingClientRect();
      return { text:name.textContent, width:card.getBoundingClientRect().width,
        textWidth:name.clientWidth, scrollWidth:name.scrollWidth,
        overlap:rect.right > menu.left, pageOverflow:document.documentElement.scrollWidth > innerWidth,
        unrelated:getComputedStyle(document.querySelector("#unrelated")).textOverflow };
    });
    let result = await measure();
    assert.equal(result.text, filename);
    assert.ok(result.width > 342, "card should grow with the filename");
    assert.ok(result.scrollWidth <= result.textWidth + 1, "filename must not be clipped");
    assert.equal(result.overlap, false, "filename must leave room for the menu");
    assert.equal(result.unrelated, "ellipsis");
    await page.setViewportSize({ width: 360, height:800 });
    result = await measure();
    assert.equal(result.pageOverflow, false, "small screen must not overflow horizontally");
    assert.ok(result.scrollWidth <= result.textWidth + 1, "long name wraps on small screens");
    assert.equal(result.overlap, false);
    console.log("PASS full filename, wider card, accessible menu, narrow-screen wrapping, unrelated text unchanged");
    await page.setViewportSize({ width:1100, height:800 });
    await page.route("**/*", (route) => route.fulfill({ contentType:"text/html", body:"<main></main>" }));
    await page.goto("https://www.linkedin.com/jobs/view/123/");
    await page.setContent(`<style>
      .modal { width:850px; max-width:100%; }
      .card { display:flex; align-items:center; gap:12px; border:1px solid; padding:12px; width:336px; box-sizing:border-box; }
      .filedata { width:210px; min-width:210px; }
      .filename { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .card button { flex-shrink:0; }
    </style><div class="modal" role="dialog"><h2>Apply to Example</h2><h3>Resume</h3><div id="files"></div>
      <p id="outside-file">${filename}</p><button id="next">Next</button></div>
      <div class="card" id="outside-dialog"><span class="filename">${filename}</span><button>More</button></div>`);
    await page.addStyleTag({ path:path.resolve(__dirname, "../src/resume-filenames.css") });
    await page.addScriptTag({ path:path.resolve(__dirname, "../src/resume-filenames.js") });
    await page.evaluate((filename) => {
      window.clicked = 0;
      document.addEventListener("click", () => window.clicked++);
      document.querySelector("#files").innerHTML = `<div class="card"><span>DOC</span><div class="filedata"><span class="filename">${filename}</span><p>Today</p></div><button id="download">Download</button><input type="radio" checked></div>`;
    }, filename);
    await page.waitForTimeout(350);
    const modernMeasure = () => page.evaluate(() => {
      const card = document.querySelector("#files .card"), name = card.querySelector(".filename");
      const control = card.querySelector("button").getBoundingClientRect();
      return {width:card.getBoundingClientRect().width, nameRight:name.getBoundingClientRect().right,
        controlLeft:control.left, clipped:name.scrollWidth > name.clientWidth+1,
        overflow:document.documentElement.scrollWidth > innerWidth,
        selected:card.querySelector("input").checked,clicked:window.clicked,
        outside:document.querySelector("#outside-dialog").classList.contains("li-auto-expand-resume-card")};
    });
    let modern = await modernMeasure();
    assert.ok(modern.width > 336);
    assert.equal(modern.clipped,false);
    assert.ok(modern.nameRight <= modern.controlLeft);
    assert.equal(modern.selected,true);
    assert.equal(modern.clicked,0);
    assert.equal(modern.outside,false);
    await page.setViewportSize({width:360,height:800});
    modern = await modernMeasure();
    assert.equal(modern.overflow,false);
    assert.equal(modern.clipped,false);
    assert.ok(modern.nameRight <= modern.controlLeft);
    console.log("PASS dynamic Easy Apply cards, wrapping, controls and selection preserved, outside-dialog content unchanged");
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
