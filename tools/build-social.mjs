// 生成站点的两张社交图：cover.png（首页大图）与 og.png（分享卡片）
// 用本机 Chrome headless 渲染 HTML，保证图中的数字取自 index.json 的真实统计，
// 不会出现「图里写着 133 篇、实际 139 篇」这种漂移。
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "site");
const index = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "index.json"), "utf8"));

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].find((p) => fs.existsSync(p));

if (!CHROME) {
  // CI 的 Linux runner 一般没有浏览器。og.png / cover.png 已提交在仓库里，
  // 这里只确认它们在，避免出现「部署完没图」而没人发现。
  const need = ["og.png", "cover.png"];
  const missing = need.filter((f) => !fs.existsSync(path.join(OUT_DIR, f)));
  if (missing.length) {
    console.error(`✗ 没有浏览器，且仓库里缺少 ${missing.join("、")}`);
    process.exit(1);
  }
  console.log("（无浏览器，沿用仓库里的 og.png / cover.png）");
  process.exit(0);
}

const S = index.stats;
const N = index.total;

const shell = (w, h, css, body) => `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${w}px;height:${h}px;overflow:hidden}
body{background:#fbfaf8;color:#1c1b19;
  font:15px/1.75 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
  -webkit-font-smoothing:antialiased;position:relative}
${css}
</style></head><body>${body}</body></html>`;

// ── og.png：1200×630 ──────────────────────────────────────────
const ogCss = `
.bar{position:absolute;left:0;top:0;bottom:0;width:14px;background:#2f6f4f}
.inner{position:absolute;left:88px;top:70px;right:88px;bottom:60px;display:flex;flex-direction:column}
.kicker{align-self:flex-start;background:#eaf2ed;color:#2f6f4f;font-size:19px;font-weight:600;
  letter-spacing:.05em;padding:7px 18px;border-radius:7px;margin-bottom:32px}
h1{font-size:74px;line-height:1.14;font-weight:800;margin-bottom:20px}
.sub{font-size:28px;color:#6b6862;line-height:1.5;margin-bottom:auto}
.rule{height:2px;background:#e6e2db;margin:30px 0 24px}
.chips{display:flex;gap:11px;flex-wrap:wrap;margin-bottom:20px}
.chip{font-size:18px;padding:7px 15px;border-radius:999px;background:#fff;border:1px solid #e6e2db}
.chip b{color:#2f6f4f;font-weight:700}
.foot{font-size:17px;color:#6b6862}
.foot code{font-family:ui-monospace,Menlo,monospace;color:#2f6f4f}`;

const ogBody = `
<div class="bar"></div>
<div class="inner">
  <span class="kicker">开源 · Markdown · 每条标核查日期</span>
  <h1>大学生活指南</h1>
  <p class="sub">大学里没人系统教、却迟早用得上的事<br>遇到事查一条就够了</p>
  <div class="rule"></div>
  <div class="chips">
    <span class="chip"><b>${N}</b> 篇</span>
    <span class="chip"><b>${index.categories.length}</b> 个分类</span>
    <span class="chip">来源 <b>法规·官方·经验</b></span>
    <span class="chip">逐条标 <b>核查日期</b></span>
  </div>
  <p class="foot">github.com/ruiyuxuanyan/HowToCollege</p>
</div>`;

// ── cover.png：1400×620 ──────────────────────────────────────
const coverCss = `
.bar{position:absolute;left:0;top:0;bottom:0;width:16px;background:#2f6f4f}
.inner{position:absolute;left:96px;top:62px;right:96px;bottom:52px;display:flex;flex-direction:column}
.top{display:flex;align-items:baseline;gap:16px;margin-bottom:24px}
.en{font-size:22px;letter-spacing:.14em;color:#2f6f4f;font-weight:700}
.cn{font-size:22px;color:#6b6862;letter-spacing:.05em}
h1{font-size:62px;line-height:1.18;font-weight:800;margin-bottom:16px}
.sub{font-size:26px;color:#6b6862;line-height:1.55;margin-bottom:auto}
.rule{height:2px;background:#e6e2db;margin:24px 0 20px}
.row{display:flex;gap:13px;flex-wrap:wrap;margin-bottom:16px}
.cell{background:#fff;border:1px solid #e6e2db;border-radius:10px;padding:10px 19px;
  display:flex;align-items:baseline;gap:9px}
.cell b{font-size:28px;color:#2f6f4f;font-weight:800;font-variant-numeric:tabular-nums}
.cell span{font-size:16px;color:#6b6862}
.foot{display:flex;justify-content:space-between;align-items:baseline;font-size:16px;color:#6b6862}
.foot code{font-family:ui-monospace,Menlo,monospace;color:#2f6f4f}`;

const coverBody = `
<div class="bar"></div>
<div class="inner">
  <div class="top"><span class="en">HowToCollege</span><span class="cn">面向中国大陆大学生</span></div>
  <h1>大学生生活指南</h1>
  <p class="sub">那些大学里没人教，但你应该知道的事<br>遇到事查一条就够了</p>
  <div class="rule"></div>
  <div class="row">
    <div class="cell"><b>${N}</b><span>篇指南</span></div>
    <div class="cell"><b>${index.categories.length}</b><span>个分类</span></div>
    <div class="cell"><b>${S.law}</b><span>处法规依据</span></div>
    <div class="cell"><b>${S.official}</b><span>处官方文件</span></div>
    <div class="cell"><b>${S.pending}</b><span>处待核实标注</span></div>
  </div>
  <div class="foot">
    <span>每条标注来源等级与核查日期 · 区分国家规定与各校做法</span>
    <code>ruiyuxuanyan.github.io/HowToCollege</code>
  </div>
</div>`;

const tmp = path.join(ROOT, ".og-tmp");
fs.mkdirSync(tmp, { recursive: true });

function render(name, w, h, css, body, outName) {
  const htmlPath = path.join(tmp, `${name}.html`);
  fs.writeFileSync(htmlPath, shell(w, h, css, body), "utf8");
  const outPath = path.join(OUT_DIR, outName);
  execFileSync(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-sandbox",
      `--user-data-dir=${path.join(tmp, "profile")}`,
      `--screenshot=${outPath}`,
      `--window-size=${w},${h}`,
      "--force-device-scale-factor=1",
      "--default-background-color=fffbfaf8",
      `file:///${htmlPath.replace(/\\/g, "/")}`,
    ],
    { stdio: "ignore", timeout: 60000 }
  );
  const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`${outName} ${w}×${h} ${kb} KB`);
}

render("og", 1200, 630, ogCss, ogBody, "og.png");
render("cover", 1400, 620, coverCss, coverBody, "cover.png");

fs.rmSync(tmp, { recursive: true, force: true });
