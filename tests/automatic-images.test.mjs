import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import ts from "typescript";
import sharp from "sharp";

// Load server modules with the same TS compiler as the app; replace only external
// side effects. This avoids a test-only dependency or real paid provider requests.
const require = createRequire(import.meta.url);
function load(path, mocks = {}, cache = new Map()) {
  const file = resolve(path);
  if (cache.has(file)) return cache.get(file).exports;
  const loadedModule = { exports: {} };
  cache.set(file, loadedModule);
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function("require", "module", "exports", code)((name) => {
    if (name === "server-only") return {};
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`, mocks, cache);
    if (name.startsWith(".")) return load(resolve(dirname(file), `${name}.ts`), mocks, cache);
    return require(name);
  }, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

const { canReuseImage, DEFAULT_IMAGE_SETTINGS, imageSettingsSchema } = load("src/lib/slides/image-policy.ts");
const { prepareSocialImage, validateSocialImage } = load("src/lib/engine/social-images.ts");
const now = Date.UTC(2026, 9, 9);

test("reuse limits: lifetime cap, cooldown boundary, unused images and disabled cooldown", () => {
  assert.equal(canReuseImage({ uses: 0, lastUsed: 0 }, DEFAULT_IMAGE_SETTINGS, now), true);
  assert.equal(canReuseImage({ uses: 3, lastUsed: 0 }, DEFAULT_IMAGE_SETTINGS, now), false);
  assert.equal(canReuseImage({ uses: 2, lastUsed: now - 7 * 86400000 }, DEFAULT_IMAGE_SETTINGS, now), true);
  assert.equal(canReuseImage({ uses: 2, lastUsed: now - 7 * 86400000 + 1 }, DEFAULT_IMAGE_SETTINGS, now), false);
  assert.equal(canReuseImage({ uses: 1, lastUsed: now }, { ...DEFAULT_IMAGE_SETTINGS, image_cooldown_days: 0 }, now), true);
  for (const patch of [{ image_max_uses: 0 }, { image_max_uses: 2.5 }, { image_cooldown_days: -1 }, { image_mode: "anything" }]) {
    assert.equal(imageSettingsSchema.safeParse({ ...DEFAULT_IMAGE_SETTINGS, ...patch }).success, false);
  }
});

test("portrait, landscape and square inputs produce correctly sized JPEGs and thumbnails", async () => {
  for (const [width, height] of [[1152, 2048], [1600, 900], [800, 800]]) {
    const source = await sharp({ create: { width, height, channels: 3, background: "#e5a355" } }).png().toBuffer();
    for (const crop of [null, { zoom: 2, x: 0.5, y: -0.5 }]) {
      const result = await prepareSocialImage(source, crop);
      await validateSocialImage(result.image);
      const thumbnail = await sharp(result.thumbnail).metadata();
      assert.equal(thumbnail.width, 360);
      assert.equal(thumbnail.height, 640);
      assert.equal(thumbnail.format, "jpeg");
    }
  }
  await assert.rejects(validateSocialImage(Buffer.alloc(20_000_001)), /20 MB/);
  const square = await sharp({ create: { width: 100, height: 100, channels: 3, background: "red" } }).jpeg().toBuffer();
  await assert.rejects(validateSocialImage(square), /1080/);
  await assert.rejects(prepareSocialImage(Buffer.from("not an image")));
});

test("image API uses the server key, portrait size, JPEG and surfaces quota errors", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  try {
    delete process.env.OPENAI_API_KEY;
    const api = load("src/lib/ai/images.ts");
    assert.throws(api.requireImageGenerationKey, /OPENAI_API_KEY/);
    process.env.OPENAI_API_KEY = "test-key";
    let request;
    globalThis.fetch = async (url, options) => {
      request = { url, ...options };
      return Response.json({ data: [{ b64_json: Buffer.alloc(200, 1).toString("base64") }] });
    };
    assert.equal((await api.generateImage("a concrete scene")).length, 200);
    const body = JSON.parse(request.body);
    assert.equal(body.size, "1152x2048");
    assert.equal(body.output_format, "jpeg");
    assert.equal(body.n, 1);
    assert.equal(request.headers.Authorization, "Bearer test-key");
    globalThis.fetch = async () => Response.json({ error: { message: "secret provider details" } }, { status: 429 });
    await assert.rejects(api.generateImage("scene"), /quota or rate limit/);
    globalThis.fetch = async () => Response.json({ data: [] });
    await assert.rejects(api.generateImage("scene"));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});

function fixture({ assets = [], history = [], fits = true, claimed = true, completed = false, choose } = {}) {
  const slide = { id: "s1", post_id: "p1", position: 0, kind: "content", text: "Dad sees the wedding dress", asset_id: completed ? "existing" : null,
    visual_prompt: "Father reacting to daughter in wedding dress", image_library_id: null, image_attempts: 0, image_rejected_assets: [] };
  const post = { id: "p1", workspace_id: "ws", campaign_id: "campaign", status: "generating",
    image_generation: { ...DEFAULT_IMAGE_SETTINGS, targetStatus: "preview" }, error: null, post_slides: [slide] };
  const state = { generated: 0, reviews: 0, rendered: 0, released: 0, uploads: [], chosenPools: [] };
  const rows = { posts: [post], post_slides: [slide], assets: [...assets], campaigns: [{ id: "campaign", workspace_id: "ws", name: "Wedding" }], libraries: [] };
  function query(table) {
    let op = "read", payload, single = false, filters = [], range = null;
    const q = {
      select() { return q; }, eq(key, value) { filters.push((r) => r[key] === value); return q; },
      or() { return q; }, order() { return q; }, range(start, end) { range = [start, end]; return q; },
      single() { single = true; return q; },
      update(value) { op = "update"; payload = value; return q; },
      insert(value) { op = "insert"; payload = value; return q; },
      upsert(value) { op = "upsert"; payload = value; return q; },
      delete() { op = "delete"; return q; },
      then(accept, reject) {
        return Promise.resolve().then(() => {
          if (table === "image_generation_leases") { state.released++; return { error: null }; }
          const data = rows[table] ?? [];
          let selected = data.filter((row) => filters.every((fn) => fn(row)));
          if (op === "update") selected.forEach((row) => Object.assign(row, payload));
          if (["insert", "upsert"].includes(op)) {
            const row = { id: "generated-library", ...payload };
            data.push(row); selected = [row]; rows[table] = data;
          }
          if (range) selected = selected.slice(range[0], range[1] + 1);
          return { data: structuredClone(single ? selected[0] : selected), error: null };
        }).then(accept, reject);
      },
    };
    return q;
  }
  const db = { from: query, rpc: async (name) => ({ data: name === "claim_image_generation" ? claimed : history, error: null }),
    storage: { from: () => ({
      upload: async (path) => { state.uploads.push(path); return { error: null }; },
      remove: async () => ({ error: null }),
      download: async () => ({ data: new Blob([Buffer.from("image")]), error: null }),
    }) } };
  const worker = load("src/lib/engine/automatic-images.ts", {
    "@/lib/ai/generate": {
      chooseRelevantImage: async ({ candidates }) => { state.chosenPools.push(candidates.map((c) => c.id)); return choose ? choose(candidates) : candidates[0]?.id ?? null; },
      reviewSlideImage: async () => { state.reviews++; return { fits, description: "Father sees daughter", reason: fits ? "" : "Wrong subject" }; },
    },
    "@/lib/ai/images": { IMAGE_MODEL: "test", generateImage: async () => { state.generated++; return Buffer.from("image"); } },
    "./social-images": { prepareSocialImage: async () => ({ image: Buffer.from("photo"), thumbnail: Buffer.from("thumbnail") }) },
    "./describe-assets": { describeAssets: async () => 0 },
    "./render-post": { renderPost: async () => { state.rendered++; } },
  });
  const advance = () => worker.advanceAutomaticImages(db, { workspaceId: "ws", postId: "p1", baseUrl: "http://localhost" });
  return { state, post, slide, rows, advance };
}

const asset = { id: "a1", workspace_id: "ws", locked: false, description: "Father seeing wedding dress", favorite: false, storage_path: "ws/a1.jpg", crop: null };

test("a fitting eligible library image is reused without a generation call", async () => {
  const f = fixture({ assets: [asset] });
  assert.deepEqual(await f.advance(), { done: false, completed: 1, total: 1 });
  assert.equal(f.slide.asset_id, "a1");
  assert.equal(f.state.generated, 0);
  assert.equal(f.state.reviews, 1);
  assert.equal(f.slide.image_attempts, 0);
});

test("overused and recent images are excluded and a new image is saved automatically", async () => {
  for (const history of [
    [{ asset_id: "a1", uses: 3, last_used: "2020-01-01" }],
    [{ asset_id: "a1", uses: 1, last_used: new Date().toISOString() }],
  ]) {
    const f = fixture({ assets: [asset], history });
    await f.advance();
    assert.equal(f.state.generated, 1);
    assert.notEqual(f.slide.asset_id, "a1");
    assert.equal(f.state.uploads.length, 2);
    const generated = f.rows.assets.find((a) => a.id === f.slide.asset_id);
    assert.equal(generated.source, "generated");
    assert.equal(generated.width, 1080);
    assert.equal(generated.height, 1920);
    assert.equal(f.rows.library_assets[0].asset_id, f.slide.asset_id);
    assert.equal(f.state.released, 1);
  }
});

test("visual mismatch rejects reuse; rejected generated images never reach storage or a post", async () => {
  const f = fixture({ assets: [asset], fits: false });
  await f.advance();
  assert.deepEqual(f.slide.image_rejected_assets, ["a1"]);
  assert.equal(f.state.generated, 0);
  await f.advance();
  assert.equal(f.post.status, "generating");
  await assert.rejects(f.advance(), /does not fit/);
  assert.equal(f.post.status, "failed");
  assert.equal(f.state.generated, 2);
  assert.equal(f.state.uploads.length, 0);
  assert.equal(f.slide.asset_id, null);
  assert.equal(f.state.released, 3);
});

test("a resumed complete post only renders; another worker's lease prevents duplicate calls", async () => {
  const complete = fixture({ completed: true });
  assert.equal((await complete.advance()).done, true);
  assert.equal(complete.state.rendered, 1);
  assert.equal(complete.state.generated, 0);
  assert.equal(complete.post.status, "preview");
  const locked = fixture({ claimed: false });
  assert.equal((await locked.advance()).done, false);
  assert.equal(locked.state.generated, 0);
  assert.equal(locked.state.released, 0);
});

test("an image already used on this post cannot be selected again", async () => {
  const f = fixture({ assets: [asset] });
  f.post.post_slides.push({ ...f.slide, id: "s2", position: 1, asset_id: "a1" });
  await f.advance();
  assert.equal(f.state.generated, 1);
  assert.notEqual(f.slide.asset_id, "a1");
});

test("catalogue search resumes through batches before generating, including a match beyond the first page", async () => {
  const assets = Array.from({ length: 121 }, (_, i) => ({ ...asset, id: `a${i}`, description: i === 120 ? "exact fit" : "unrelated" }));
  const f = fixture({ assets, choose: (pool) => pool.find((a) => a.description === "exact fit")?.id ?? null });
  await f.advance();
  await f.advance();
  assert.equal(f.slide.asset_id, null);
  await f.advance();
  assert.equal(f.slide.asset_id, "a120");
  assert.equal(f.state.generated, 0);
  assert.equal(f.state.chosenPools.length, 3);
});

// ─── Hook choice ─────────────────────────────────────────────────────────────

function campaignFixture(hooks) {
  const seen = { contentHooks: [], imagePlans: [] };
  const inserted = { posts: [], post_slides: [] };
  const tables = {
    campaigns: [{ id: "campaign", workspace_id: "ws", image_mode: "auto", layout: null, cta_enabled: false, language: "en",
      content_prompt: "", content_slide_count: 2, web_research: false, tiktok_account_id: null, product: null }],
    campaign_hooks: hooks.map((h) => ({ campaign_id: "campaign", ...h })), campaign_ctas: [], posts: [],
  };
  const from = (table) => {
    let rows = tables[table] ?? [], single = false, payload = null;
    const q = {
      select() { return q; }, order() { return q; }, limit() { return q; },
      eq(key, value) { rows = rows.filter((r) => r[key] === value); return q; },
      single() { single = true; return q; },
      insert(value) { payload = value; return q; },
      then(accept, reject) {
        if (payload) {
          rows = [].concat(payload).map((row, i) => ({ id: `${table}-${inserted[table].length + i + 1}`, ...row }));
          inserted[table].push(...rows);
        }
        return Promise.resolve({ data: single ? rows[0] : rows, error: null }).then(accept, reject);
      },
    };
    return q;
  };
  const { buildPost } = load("src/lib/engine/build-post.ts", {
    "@/lib/ai/generate": {
      generateContentSlides: async ({ hook }) => { seen.contentHooks.push(hook); return { slides: ["1. First", "2. Second"], caption: "" }; },
      planSlideImages: async ({ slides }) => { seen.imagePlans.push(slides); return slides.map((s) => `Scene for: ${s.text}`); },
    },
    "@/lib/ai/images": { requireImageGenerationKey: () => "test-key" },
  });
  const build = (hookId) => buildPost({ from }, { workspaceId: "ws", campaignId: "campaign", hookId });
  return { seen, inserted, build };
}

test("a chosen hook is the verbatim base of content and images, even when switched off", async () => {
  const f = campaignFixture([
    { id: "active", text: "5 shots from your party nobody thinks to take", enabled: true },
    { id: "suggestion", text: "POV: the reception ends and you have 4 photos of yourself", enabled: false },
  ]);
  await f.build("suggestion");
  assert.equal(f.inserted.posts[0].hook_id, "suggestion");
  assert.equal(f.inserted.post_slides[0].kind, "hook");
  assert.equal(f.inserted.post_slides[0].text, "POV: the reception ends and you have 4 photos of yourself");
  assert.deepEqual(f.seen.contentHooks, ["POV: the reception ends and you have 4 photos of yourself"]);
  assert.equal(f.seen.imagePlans[0][0].text, "POV: the reception ends and you have 4 photos of yourself");
  assert.equal(f.inserted.post_slides[0].visual_prompt, "Scene for: POV: the reception ends and you have 4 photos of yourself");
});

test("without a choice only active hooks rotate; a missing choice or no active hook stops the post", async () => {
  const hooks = [
    { id: "active", text: "5 shots from your party nobody thinks to take", enabled: true },
    { id: "suggestion", text: "An unapproved AI suggestion", enabled: false },
  ];
  const rotating = campaignFixture(hooks);
  for (let i = 0; i < 8; i++) await rotating.build();
  assert.deepEqual([...new Set(rotating.inserted.posts.map((p) => p.hook_id))], ["active"]);

  const deleted = campaignFixture(hooks);
  await assert.rejects(deleted.build("deleted-hook"), /no longer exists/);
  assert.equal(deleted.inserted.posts.length, 0);

  const allOff = campaignFixture([hooks[1]]);
  await assert.rejects(allOff.build(), /active hook/);
  assert.equal(allOff.seen.contentHooks.length, 0);
});
