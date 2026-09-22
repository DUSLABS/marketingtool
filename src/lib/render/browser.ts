import "server-only";
import type { Browser } from "playwright-core";

// On Vercel we use the serverless Chromium build; locally the browser installed by `npx playwright install`.
async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    const [{ chromium }, { default: serverless }] = await Promise.all([
      import("playwright-core"),
      import("@sparticuz/chromium"),
    ]);
    return chromium.launch({ args: serverless.args, executablePath: await serverless.executablePath(), headless: true });
  }
  const { chromium } = await import("playwright");
  return chromium.launch();
}

/** Opens the render page and screenshots each `#slide-N` element as a 1080×1920 JPEG. */
export async function screenshotSlides(url: string, count: number): Promise<Buffer[]> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
    if (!response?.ok()) throw new Error(`Render page returned ${response?.status()}`);
    await page.evaluate(() => document.fonts.ready);
    const shots: Buffer[] = [];
    for (let i = 0; i < count; i++) {
      shots.push(await page.locator(`#slide-${i}`).screenshot({ type: "jpeg", quality: 90 }));
    }
    return shots;
  } finally {
    await browser.close();
  }
}
