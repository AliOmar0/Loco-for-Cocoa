import fs from "node:fs/promises";
import path from "node:path";

const debugPort = process.env.EDGE_DEBUG_PORT || "9230";
const baseUrl = (process.env.APP_URL || "http://127.0.0.1:4173").replace(
  /\/+$/,
  "",
);
const homeUrl = `${baseUrl}/`;
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
const browserErrors = [];
let nextId = 1;

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown") {
    browserErrors.push(
      message.params?.exceptionDetails?.exception?.description ||
        message.params?.exceptionDetails?.text ||
        "Unknown runtime exception",
    );
  }
  if (
    message.method === "Runtime.consoleAPICalled" &&
    message.params?.type === "error"
  ) {
    browserErrors.push(
      message.params.args
        .map((argument) => argument.value || argument.description)
        .join(" "),
    );
  }
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
    throw new Error(
      result.exceptionDetails.exception?.description ||
        result.exceptionDetails.text ||
        "Browser evaluation failed.",
    );
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
  const pageState = await evaluate(`({
    url: location.href,
    title: document.title,
    body: document.body?.innerText?.slice(0, 500),
    root: document.querySelector("#root")?.innerHTML?.slice(0, 500)
  })`).catch(() => null);
  throw new Error(
    `Timed out waiting for: ${expression}\nPage state: ${JSON.stringify(pageState)}\nBrowser errors: ${browserErrors.join("\n")}`,
  );
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
await send("Page.navigate", { url: homeUrl });
await waitFor(`Boolean(window.localStorage)`);
await evaluate(`(() => {
  localStorage.removeItem("loco-for-cocoa-experience-v1");
  localStorage.removeItem("loco-studio-draft-new");
  localStorage.removeItem("loco-studio-workspace-v1");
  sessionStorage.removeItem("loco-studio-session");
})()`);
await send("Page.navigate", { url: homeUrl });
await waitFor(`document.querySelectorAll(".recipe-card").length >= 6`);
await waitFor(`Boolean(document.querySelector(".shader-shell canvas"))`, 20000);

const desktopSummary = await evaluate(`({
  title: document.title,
  recipes: document.querySelectorAll(".recipe-card").length,
  canvas: Boolean(document.querySelector(".shader-shell canvas")),
  shaderRenderer: document.querySelector(".shader-shell canvas")?.dataset.renderer,
  heroSlides: document.querySelectorAll(".hero-slider-controls > div button").length,
  heroImageLayers: document.querySelectorAll(".hero-art-media img").length,
  collections: document.querySelectorAll(".collection-card").length,
  pantryResults: document.querySelectorAll(".pantry-results > button").length,
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
})`);

if (!desktopSummary.title.includes("Loco for Cocoa")) {
  throw new Error(`Unexpected title: ${desktopSummary.title}`);
}
if (!desktopSummary.canvas || desktopSummary.shaderRenderer !== "native-webgl") {
  throw new Error("The native WebGL shader canvas did not mount.");
}
if (desktopSummary.heroSlides < 4) {
  throw new Error("The hero recipe carousel did not initialize.");
}
if (desktopSummary.heroImageLayers !== desktopSummary.heroSlides) {
  throw new Error("The hero image layers were not pre-mounted.");
}
if (desktopSummary.collections !== 4 || desktopSummary.pantryResults !== 3) {
  throw new Error("The curated collections or pantry matcher did not initialize.");
}
if (desktopSummary.overflow) throw new Error("Desktop page has horizontal overflow.");

const initialHeroTitle = await evaluate(
  `document.querySelector(".art-chip-top strong").textContent`,
);
await evaluate(`document.querySelector(".hero-slider-controls > button:last-child").click()`);
const transitionFrame = await evaluate(`(() => {
  const images = [...document.querySelectorAll(".hero-art-media img")];
  return {
    count: images.length,
    active: images.filter((image) => image.classList.contains("is-active")).length,
    allClipped: images.every((image) => {
      const style = getComputedStyle(image);
      return style.clipPath !== "none" && style.borderRadius !== "0px";
    }),
    clipContainer: getComputedStyle(document.querySelector(".hero-art-clip")).clipPath
  };
})()`);
if (
  transitionFrame.count !== desktopSummary.heroSlides ||
  transitionFrame.active !== 1 ||
  !transitionFrame.allClipped ||
  transitionFrame.clipContainer === "none"
) {
  throw new Error(
    `Hero transition layers are not continuously clipped: ${JSON.stringify(transitionFrame)}`,
  );
}
await capture("react-hero-transition-frame.png");
await waitFor(
  `document.querySelector(".art-chip-top strong").textContent !== ${JSON.stringify(initialHeroTitle)}`,
);
const heroClipSummary = await evaluate(`(() => {
  const clip = document.querySelector(".hero-art-clip");
  const style = getComputedStyle(clip);
  return {
    radius: style.borderRadius,
    overflow: style.overflow,
    width: clip.getBoundingClientRect().width
  };
})()`);
if (heroClipSummary.radius === "0px" || heroClipSummary.overflow !== "hidden") {
  throw new Error("The hero image transition lost its rounded clipping layer.");
}
await capture("react-home-desktop.png");

await evaluate(`document.querySelector(".card-hit-area").click()`);
await waitFor(`Boolean(document.querySelector(".recipe-detail"))`);
await waitFor(`location.pathname.startsWith("/recipes/")`);
const sharedTransition = await evaluate(
  `getComputedStyle(document.querySelector(".detail-hero img")).viewTransitionName`,
);
if (!sharedTransition.includes("recipe-image-")) {
  throw new Error("The recipe image did not receive a shared view-transition name.");
}
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
await new Promise((resolve) => setTimeout(resolve, 120));
await evaluate(`document.querySelector(".ingredient-list button").click()`);
await waitFor(`document.querySelector(".ingredient-list li").classList.contains("is-checked")`);
const recipePageTools = await evaluate(`({
  substitutions: document.querySelectorAll(".substitution-roulette").length,
  unitConverters: document.querySelectorAll(".unit-chaos-button").length,
  portionToggle: Boolean(document.querySelector(".portion-personality")),
  extrasPanel: Boolean(document.querySelector(".recipe-extras-panel")),
  nutrition: Boolean(document.querySelector(".recipe-nutrition")),
  messMeter: document.querySelectorAll(".mess-meter i").length
})`);
if (
  recipePageTools.substitutions !== 0 ||
  recipePageTools.unitConverters !== 0 ||
  recipePageTools.portionToggle ||
  recipePageTools.extrasPanel ||
  !recipePageTools.nutrition ||
  recipePageTools.messMeter !== 5
) {
  throw new Error(`Recipe page simplification failed: ${JSON.stringify(recipePageTools)}`);
}
await send("Emulation.setEmulatedMedia", { media: "print" });
const printState = await evaluate(`(() => {
  const detail = document.querySelector(".recipe-detail");
  const printSheet = document.querySelector(".recipe-print-sheet");
  return {
    sheetDisplay: getComputedStyle(printSheet).display,
    sheetPosition: getComputedStyle(printSheet).position,
    visibleSiblings: [...detail.children]
      .filter((child) => !child.classList.contains("recipe-print-sheet"))
      .filter((child) => getComputedStyle(child).display !== "none").length
  };
})()`);
await send("Emulation.setEmulatedMedia", { media: "screen" });
if (
  printState.sheetDisplay === "none" ||
  printState.sheetPosition !== "static" ||
  printState.visibleSiblings !== 0
) {
  throw new Error(`Recipe print sheet is not isolated: ${JSON.stringify(printState)}`);
}
await evaluate(`document.querySelector(".detail-rail button").click()`);
await waitFor(`!document.querySelector(".recipe-detail")`);

await evaluate(`document.querySelector(".search-control").click()`);
await waitFor(`Boolean(document.querySelector(".command-palette"))`);
await evaluate(`document.querySelector(".command-palette > label button").click()`);

await evaluate(`document.querySelector("#recipes").scrollIntoView()`);
await new Promise((resolve) => setTimeout(resolve, 500));
const archiveLayout = await evaluate(`(() => {
  const grid = document.querySelector(".recipe-grid");
  const cards = [...document.querySelectorAll(".recipe-card")].map((card) => {
    const surface = card.querySelector(".recipe-card-surface");
    return {
      top: card.offsetTop,
      left: card.offsetLeft,
      right: card.offsetLeft + card.offsetWidth,
      radius: getComputedStyle(surface).borderRadius,
      overflow: getComputedStyle(surface).overflow
    };
  });
  const rows = Object.values(cards.reduce((result, card) => {
    const key = String(card.top);
    (result[key] ||= []).push(card);
    return result;
  }, {}));
  return {
    rows: rows.map((row) => ({
      leftGap: Math.round(Math.min(...row.map((card) => card.left))),
      rightGap: Math.round(grid.clientWidth - Math.max(...row.map((card) => card.right))),
      count: row.length
    })),
    cornersStable: cards.every((card) => card.radius !== "0px" && card.overflow === "hidden")
  };
})()`);
if (
  !archiveLayout.cornersStable ||
  archiveLayout.rows.some((row) => row.leftGap > 2 || row.rightGap > 2)
) {
  throw new Error(`Archive cards have unstable corners or incomplete rows: ${JSON.stringify(archiveLayout)}`);
}
await evaluate(`document.querySelector(".recipe-card").dispatchEvent(new PointerEvent("pointermove", {
  bubbles: true,
  clientX: 400,
  clientY: 500
}))`);
await new Promise((resolve) => setTimeout(resolve, 180));
const hoveredRadius = await evaluate(
  `getComputedStyle(document.querySelector(".recipe-card-surface")).borderRadius`,
);
if (hoveredRadius === "0px") throw new Error("Recipe card corners disappeared on hover.");
await capture("react-archive-desktop.png");
await evaluate(`document.querySelector(".curated-shelves").scrollIntoView()`);
await new Promise((resolve) => setTimeout(resolve, 350));
await capture("react-collections-desktop.png");
await evaluate(`document.querySelector(".pantry-matcher").scrollIntoView()`);
await new Promise((resolve) => setTimeout(resolve, 350));
await capture("react-pantry-desktop.png");
await evaluate(`document.querySelector("#flavor-lab").scrollIntoView()`);
await new Promise((resolve) => setTimeout(resolve, 500));
await capture("react-flavor-lab-desktop.png");
await evaluate(`document.querySelector("#field-notes").scrollIntoView()`);
await new Promise((resolve) => setTimeout(resolve, 350));
await evaluate(`(
  document.querySelector('[data-note-id="brown-butter"]') ||
  document.querySelectorAll(".field-note-list > button")[1]
).click()`);
await waitFor(`(() => {
  const active = document.querySelector(".field-note-list > button.is-active");
  return active?.textContent?.includes("Brown butter") &&
    Boolean(document.querySelector(".note-reveal"));
})()`);
await capture("react-field-notes-desktop.png");
await evaluate(`document.querySelector(".site-footer").scrollIntoView()`);
await new Promise((resolve) => setTimeout(resolve, 400));
const displayTypeSummary = await evaluate(`({
  heroOverflow: getComputedStyle(document.querySelector(".hero h1 > span")).overflow,
  footerOverflow: getComputedStyle(document.querySelector(".footer-wordmark")).overflow,
  footerLineHeight: getComputedStyle(document.querySelector(".footer-wordmark")).lineHeight
})`);
if (
  displayTypeSummary.heroOverflow !== "visible" ||
  displayTypeSummary.footerOverflow !== "visible"
) {
  throw new Error("Display typography is still clipped by an overflow container.");
}
await capture("react-footer-desktop.png");
await evaluate(`document.documentElement.style.scrollBehavior = "auto"; window.scrollTo(0, 0)`);
await new Promise((resolve) => setTimeout(resolve, 250));

await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await send("Page.navigate", { url: homeUrl });
await waitFor(`document.querySelectorAll(".recipe-card").length >= 6`);
await waitFor(`getComputedStyle(document.querySelector(".mobile-section-dock")).display !== "none"`);
await new Promise((resolve) => setTimeout(resolve, 500));
const mobileSummary = await evaluate(`({
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  dockLinks: document.querySelectorAll(".mobile-section-dock a").length,
  dockVisible: getComputedStyle(document.querySelector(".mobile-section-dock")).display !== "none",
  canvas: Boolean(document.querySelector(".shader-shell canvas")),
  footerColumns: getComputedStyle(document.querySelector(".footer-wordmark")).gridTemplateColumns
})`);
if (mobileSummary.overflow) throw new Error("Mobile page has horizontal overflow.");
if (mobileSummary.dockLinks !== 4 || !mobileSummary.dockVisible) {
  throw new Error("The mobile section dock is not available.");
}
if (mobileSummary.canvas) {
  throw new Error("The expensive hero shader should not be mounted on mobile.");
}
await capture("react-home-mobile.png");

await evaluate(`document.documentElement.style.scrollBehavior = "auto"; document.querySelector(".site-footer").scrollIntoView()`);
await new Promise((resolve) => setTimeout(resolve, 120));
await capture("react-footer-mobile.png");
await evaluate(`document.querySelector("#recipes").scrollIntoView()`);
await new Promise((resolve) => setTimeout(resolve, 450));
const editorialMobile = await evaluate(`(() => {
  const surface = document.querySelector(".recipe-card-surface");
  const image = document.querySelector(".recipe-image");
  return {
    display: getComputedStyle(surface).display,
    cardWidth: surface.getBoundingClientRect().width,
    imageWidth: image.getBoundingClientRect().width
  };
})()`);
await capture("react-archive-mobile-editorial.png");
await evaluate(`document.querySelector('.layout-switch button[aria-label="Compact grid"]').click()`);
await waitFor(`document.querySelector(".recipe-grid").classList.contains("is-compact")`);
await new Promise((resolve) => setTimeout(resolve, 300));
const compactMobile = await evaluate(`(() => {
  const surface = document.querySelector(".recipe-card-surface");
  const image = document.querySelector(".recipe-image");
  return {
    display: getComputedStyle(surface).display,
    columns: getComputedStyle(surface).gridTemplateColumns,
    cardWidth: surface.getBoundingClientRect().width,
    imageWidth: image.getBoundingClientRect().width
  };
})()`);
if (
  editorialMobile.display === compactMobile.display ||
  compactMobile.display !== "grid" ||
  compactMobile.imageWidth >= compactMobile.cardWidth * 0.6
) {
  throw new Error("Mobile archive view controls do not produce distinct layouts.");
}
await capture("react-archive-mobile-compact.png");

await evaluate(`document.querySelector(".card-hit-area").click()`);
await waitFor(`Boolean(document.querySelector(".recipe-detail"))`);
await waitFor(`location.pathname.startsWith("/recipes/")`);
const bakeBar = await evaluate(
  `getComputedStyle(document.querySelector(".bake-mode-bar")).display`,
);
if (bakeBar === "none") throw new Error("The mobile bake-mode bar is not visible.");
await evaluate(`document.querySelector(".bake-mode-start").click()`);
await waitFor(`document.querySelector(".recipe-detail").classList.contains("is-bake-mode")`);
await new Promise((resolve) => setTimeout(resolve, 850));
await capture("react-bake-mode-mobile.png");
await evaluate(`document.querySelector(".bake-mode-bar button[aria-label='Next step']").click()`);
await waitFor(
  `document.querySelector(".method-list li[data-method-step='1']").classList.contains("is-active-step")`,
);
await evaluate(`document.querySelector(".detail-rail button").click()`);
await waitFor(`!document.querySelector(".recipe-detail")`);

await send("Emulation.setDeviceMetricsOverride", {
  width: 1160,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await send("Page.navigate", { url: homeUrl });
await waitFor(`document.querySelectorAll(".recipe-card").length >= 6`);
const tabletNav = await evaluate(`({
  nav: getComputedStyle(document.querySelector(".header-nav")).display,
  menu: getComputedStyle(document.querySelector(".menu-control")).display,
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
})`);
if (tabletNav.nav !== "none" || tabletNav.menu === "none" || tabletNav.overflow) {
  throw new Error(`The 1160px navigation breakpoint is unstable: ${JSON.stringify(tabletNav)}`);
}
await new Promise((resolve) => setTimeout(resolve, 900));
await capture("react-home-tablet-1160.png");

await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
browserErrors.length = 0;
await evaluate(`location.href = "${baseUrl}/studio"`);
await waitFor(
  `Boolean(document.querySelector(".studio-login") || document.querySelector(".studio-page"))`,
);
const studioLocked = await evaluate(`Boolean(document.querySelector(".studio-login"))`);
if (studioLocked) {
  await evaluate(`document.querySelector(".studio-login .studio-primary").click()`);
}
await waitFor(`Boolean(document.querySelector(".studio-page"))`);

const studioSummary = await evaluate(`({
  stats: document.querySelectorAll(".studio-stats article").length,
  recipes: document.querySelectorAll(".manager-list > button").length,
  editor: Boolean(document.querySelector(".studio-editor")),
  sidebarPosition: getComputedStyle(document.querySelector(".studio-sidebar")).position,
  sidebarHeight: document.querySelector(".studio-sidebar").getBoundingClientRect().height,
  qualityScore: Boolean(document.querySelector(".editor-quality-strip")),
  cropEditor: Boolean(document.querySelector(".image-crop-editor"))
})`);
if (
  studioSummary.stats !== 4 ||
  studioSummary.recipes < 6 ||
  !studioSummary.editor ||
  !studioSummary.qualityScore ||
  !studioSummary.cropEditor
) {
  throw new Error("Studio dashboard did not initialize correctly.");
}
if (studioSummary.sidebarPosition !== "fixed" || studioSummary.sidebarHeight < 990) {
  throw new Error("The desktop Studio sidebar is not fixed to the viewport.");
}

await evaluate(`document.querySelectorAll(".studio-sidebar nav button")[1].click()`);
await waitFor(`Boolean(document.querySelector(".collections-studio"))`);
const collectionSummary = await evaluate(`({
  shelves: document.querySelectorAll(".collection-index > div > button").length,
  recipes: document.querySelectorAll(".collection-recipe-picker label").length,
  save: Boolean(document.querySelector(".collection-editor .studio-primary"))
})`);
if (collectionSummary.shelves < 4 || collectionSummary.recipes < 6 || !collectionSummary.save) {
  throw new Error(`Studio collections did not initialize: ${JSON.stringify(collectionSummary)}`);
}
await capture("react-studio-collections.png");
await evaluate(`document.querySelectorAll(".studio-sidebar nav button")[2].click()`);
await waitFor(`Boolean(document.querySelector(".performance-view"))`);
await capture("react-studio-performance.png");
await evaluate(`document.querySelectorAll(".studio-sidebar nav button")[3].click()`);
await waitFor(`Boolean(document.querySelector(".community-view"))`);
await capture("react-studio-community.png");
await evaluate(`document.querySelectorAll(".studio-sidebar nav button")[0].click()`);
await waitFor(`Boolean(document.querySelector(".studio-editor"))`);
await evaluate(`document.querySelector(".studio-header .studio-primary").click()`);
await waitFor(
  `document.querySelector(".editor-topbar h2").textContent.includes("Untitled")`,
);
await evaluate(`([...document.querySelectorAll(".editor-tabs button")]
  .find((button) => button.textContent.includes("Epicure Lab")) ||
  document.querySelectorAll(".editor-tabs button")[1]
).click()`);
await waitFor(`Boolean(document.querySelector(".epicure-lab"))`);
const epicureSummary = await evaluate(`({
  panels: document.querySelectorAll(".epicure-panel").length,
  ingredientSuggestions: document.querySelectorAll(".epicure-suggestions button").length,
  directPresets: document.querySelectorAll(".epicure-preset-grid button").length,
  customChips: document.querySelectorAll(".epicure-chip-grid button").length,
  externalUrl: document.querySelector(".epicure-lab-hero a")?.href,
  ingredientSearch: Boolean(document.querySelector(".epicure-catalogue-search input")),
  providerStatuses: document.querySelectorAll(".epicure-provider-strip > span").length,
  generator: Boolean(document.querySelector(".epicure-generation-launch > button")),
  importer: Boolean(document.querySelector(".epicure-import textarea"))
})`);
if (
  epicureSummary.panels !== 4 ||
  epicureSummary.ingredientSuggestions < 8 ||
  epicureSummary.directPresets < 6 ||
  epicureSummary.customChips < 16 ||
  epicureSummary.externalUrl !== "https://epicure.kaikaku.ai/about" ||
  !epicureSummary.ingredientSearch ||
  epicureSummary.providerStatuses !== 4 ||
  !epicureSummary.generator ||
  !epicureSummary.importer
) {
  throw new Error(`Epicure Lab did not initialize: ${JSON.stringify(epicureSummary)}`);
}
await evaluate(`document.querySelectorAll(".editor-tabs button")[2].click()`);
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
      epicureSummary,
    },
    null,
    2,
  ),
);
