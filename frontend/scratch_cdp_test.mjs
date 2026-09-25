import fs from "fs";
import path from "path";

const ARTIFACTS_DIR = "C:\\Users\\itspr\\.gemini\\antigravity-ide\\brain\\94424545-db15-4fef-a1c7-f40db28450a2";

async function run() {
  const targetsRes = await fetch("http://127.0.0.1:9222/json");
  const targets = await targetsRes.json();
  const pageTarget = targets.find(t => t.type === "page" && t.url.includes("localhost:3000")) || targets.find(t => t.type === "page");

  if (!pageTarget) {
    console.error("No suitable page target found");
    return;
  }

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let idCounter = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  await new Promise((resolve) => (ws.onopen = resolve));

  const send = (method, params = {}) => {
    return new Promise((resolve, reject) => {
      const id = idCounter++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  // 1. Reload page to ensure fresh state
  await send("Page.navigate", { url: "http://localhost:3000/" });
  await new Promise((r) => setTimeout(r, 2000));

  // 2. Set Desktop 1440x900 viewport
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Screenshot 1: Desktop Top Fold
  await send("Runtime.evaluate", { expression: "window.scrollTo(0, 0)" });
  await new Promise((r) => setTimeout(r, 500));
  let snap = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, "audit2_desktop_hero_top.png"), Buffer.from(snap.data, "base64"));

  // Screenshot 2: Deals & Flash Sale + MidPageBanners
  await send("Runtime.evaluate", { expression: "window.scrollTo(0, 750)" });
  await new Promise((r) => setTimeout(r, 500));
  snap = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, "audit2_desktop_deals_mid.png"), Buffer.from(snap.data, "base64"));

  // Screenshot 3: Featured Products & New Arrivals
  await send("Runtime.evaluate", { expression: "window.scrollTo(0, 1500)" });
  await new Promise((r) => setTimeout(r, 500));
  snap = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, "audit2_desktop_products.png"), Buffer.from(snap.data, "base64"));

  // Screenshot 4: Category Banners & Brands & Best Sellers
  await send("Runtime.evaluate", { expression: "window.scrollTo(0, 2300)" });
  await new Promise((r) => setTimeout(r, 500));
  snap = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, "audit2_desktop_brands_bestsellers.png"), Buffer.from(snap.data, "base64"));

  // Screenshot 5: Bottom Promos, Recently Viewed & Footer
  await send("Runtime.evaluate", { expression: "window.scrollTo(0, 3100)" });
  await new Promise((r) => setTimeout(r, 500));
  snap = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, "audit2_desktop_bottom_footer.png"), Buffer.from(snap.data, "base64"));

  // 3. Tablet Emulation (768x1024)
  await send("Emulation.setDeviceMetricsOverride", {
    width: 768,
    height: 1024,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await send("Runtime.evaluate", { expression: "window.scrollTo(0, 0)" });
  await new Promise((r) => setTimeout(r, 800));
  snap = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, "audit2_tablet_768x1024.png"), Buffer.from(snap.data, "base64"));

  // 4. Mobile Emulation (390x844)
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await send("Runtime.evaluate", { expression: "window.scrollTo(0, 0)" });
  await new Promise((r) => setTimeout(r, 800));
  snap = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, "audit2_mobile_390x844.png"), Buffer.from(snap.data, "base64"));

  // Restore Desktop Viewport
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Runtime.evaluate", { expression: "window.scrollTo(0, 0)" });

  ws.close();
  console.log("All audit2 screenshots captured successfully!");
}

run().catch(console.error);
