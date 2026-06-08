import fs from "node:fs/promises";
import path from "node:path";

const debugPort = process.env.EDGE_DEBUG_PORT || "9230";
const baseUrl = process.env.APP_URL || "http://127.0.0.1:4173";
const screenshotDir = process.env.SMOKE_SCREENSHOT_DIR;

const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((response) =>
  response.json(),
);
const target =
  targets.find((item) => item.type === "page" && item.url.startsWith(baseUrl)) ||
  targets.find((item) => item.type === "page");

if (!target?.webSocketDebuggerUrl) {
  throw new Error("No debuggable browser page was found.");
}

const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 1;

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

function send(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Browser evaluation failed.");
  }
  return result.result?.value;
}

async function waitFor(expression, timeout = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      if (await evaluate(expression)) return;
    } catch {
      // The execution context briefly disappears during client navigation.
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function capture(name) {
  if (!screenshotDir) return;
  await fs.mkdir(screenshotDir, { recursive: true });
  const screenshot = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await fs.writeFile(path.join(screenshotDir, name), Buffer.from(screenshot.data, "base64"));
}

await send("Runtime.enable");
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await waitFor(`document.querySelectorAll(".recipe-card").length >= 6`);

const desktopSummary = await evaluate(`({
  title: document.title,
  recipes: document.querySelectorAll(".recipe-card").length,
  canvas: Boolean(document.querySelector(".shader-shell canvas")),
  heroSlides: document.querySelectorAll(".hero-slider-controls > div button").length,
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
})`);

if (!desktopSummary.title.includes("Loco for Cocoa")) {
  throw new Error(`Unexpected title: ${desktopSummary.title}`);
}
if (!desktopSummary.canvas) throw new Error("The Three.js shader canvas did not mount.");
if (desktopSummary.heroSlides < 4) {
  throw new Error("The hero recipe carousel did not initialize.");
}
if (desktopSummary.overflow) throw new Error("Desktop page has horizontal overflow.");

const initialHeroTitle = await evaluate(
  `document.querySelector(".art-chip-top strong").textContent`,
);
await evaluate(`document.querySelector(".hero-slider-controls > button:last-child").click()`);
await waitFor(
  `document.querySelector(".art-chip-top strong").textContent !== ${JSON.stringify(initialHeroTitle)}`,
);
await capture("react-home-desktop.png");

await evaluate(`document.querySelector(".card-hit-area").click()`);
await waitFor(`Boolean(document.querySelector(".recipe-detail"))`);
const initialServing = await evaluate(
  `Number(document.querySelector(".serving-control > div:last-child > span").textContent)`,
);
await evaluate(`document.querySelector(".serving-control button:last-child").click()`);
const updatedServing = await evaluate(
  `Number(document.querySelector(".serving-control > div:last-child > span").textContent)`,
);
if (updatedServing !== initialServing + 1) {
  throw new Error("Serving controls did not update recipe quantities.");
}
await evaluate(`document.querySelector(".step-check").click()`);
await waitFor(`document.querySelector(".method-list li").classList.contains("is-complete")`);
await evaluate(`document.querySelector(".detail-rail button:last-child").click()`);
await waitFor(`!document.querySelector(".recipe-detail")`);

await evaluate(`document.querySelector(".search-control").click()`);
await waitFor(`Boolean(document.querySelector(".command-palette"))`);
await evaluate(`document.querySelector(".command-palette > label button").click()`);

await evaluate(`document.querySelector("#recipes").scrollIntoView()`);
await new Promise((resolve) => setTimeout(resolve, 500));
await capture("react-archive-desktop.png");
await evaluate(`document.querySelector("#flavor-lab").scrollIntoView()`);
await new Promise((resolve) => setTimeout(resolve, 500));
await capture("react-flavor-lab-desktop.png");
await evaluate(`document.querySelector("#field-notes").scrollIntoView()`);
await new Promise((resolve) => setTimeout(resolve, 350));
const initialNote = await evaluate(`document.querySelector(".note-reveal h3").textContent`);
await evaluate(`document.querySelectorAll(".field-note-list > button")[1].click()`);
await waitFor(
  `document.querySelector(".note-reveal h3").textContent !== ${JSON.stringify(initialNote)}`,
);
await capture("react-field-notes-desktop.png");
await evaluate(`document.documentElement.style.scrollBehavior = "auto"; window.scrollTo(0, 0)`);
await new Promise((resolve) => setTimeout(resolve, 250));

await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await send("Page.navigate", { url: baseUrl });
await waitFor(`document.querySelectorAll(".recipe-card").length >= 6`);
await waitFor(`getComputedStyle(document.querySelector(".mobile-section-dock")).display !== "none"`);
await new Promise((resolve) => setTimeout(resolve, 500));
const mobileSummary = await evaluate(`({
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  dockLinks: document.querySelectorAll(".mobile-section-dock a").length,
  dockVisible: getComputedStyle(document.querySelector(".mobile-section-dock")).display !== "none",
  canvas: Boolean(document.querySelector(".shader-shell canvas"))
})`);
if (mobileSummary.overflow) throw new Error("Mobile page has horizontal overflow.");
if (mobileSummary.dockLinks !== 3 || !mobileSummary.dockVisible) {
  throw new Error("The mobile section dock is not available.");
}
if (mobileSummary.canvas) {
  throw new Error("The expensive hero shader should not be mounted on mobile.");
}
await capture("react-home-mobile.png");

await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await evaluate(`location.href = "${baseUrl}/studio"`);
await waitFor(`Boolean(document.querySelector(".studio-login"))`);
await evaluate(`(() => {
  const input = document.querySelector('.studio-login input');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, '0420');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('.studio-login form').requestSubmit();
  return true;
})()`);
await waitFor(`Boolean(document.querySelector(".studio-page"))`);

const studioSummary = await evaluate(`({
  stats: document.querySelectorAll(".studio-stats article").length,
  recipes: document.querySelectorAll(".manager-list > button").length,
  editor: Boolean(document.querySelector(".studio-editor")),
  sidebarPosition: getComputedStyle(document.querySelector(".studio-sidebar")).position,
  sidebarHeight: document.querySelector(".studio-sidebar").getBoundingClientRect().height
})`);
if (studioSummary.stats !== 4 || studioSummary.recipes < 6 || !studioSummary.editor) {
  throw new Error("Studio dashboard did not initialize correctly.");
}
if (studioSummary.sidebarPosition !== "fixed" || studioSummary.sidebarHeight < 990) {
  throw new Error("The desktop Studio sidebar is not fixed to the viewport.");
}

await evaluate(`document.querySelectorAll(".studio-sidebar nav button")[1].click()`);
await waitFor(`Boolean(document.querySelector(".performance-view"))`);
await capture("react-studio-performance.png");
await evaluate(`document.querySelectorAll(".studio-sidebar nav button")[2].click()`);
await waitFor(`Boolean(document.querySelector(".community-view"))`);
await capture("react-studio-community.png");
await evaluate(`document.querySelectorAll(".studio-sidebar nav button")[0].click()`);
await waitFor(`Boolean(document.querySelector(".studio-editor"))`);
await evaluate(`document.querySelector(".studio-header .studio-primary").click()`);
await waitFor(
  `document.querySelector(".editor-topbar h2").textContent.includes("Untitled")`,
);
await evaluate(`document.querySelectorAll(".editor-tabs button")[1].click()`);
await waitFor(`Boolean(document.querySelector(".field-array"))`);
await capture("react-studio-desktop.png");

socket.close();
console.log(
  JSON.stringify(
    {
      status: "ok",
      desktopSummary,
      servingControl: { initialServing, updatedServing },
      mobileSummary,
      studioSummary,
    },
    null,
    2,
  ),
);
