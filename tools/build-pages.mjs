// 生成每篇文章的独立静态页 + 全站 sitemap + 社交卡片元数据
// 目标：hash 路由（#/08-04）改成可分享的独立 URL（/a/08-04.html）
// 用法：node tools/build-pages.mjs（在 build-site.mjs 之后跑）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "site");
const SITE_URL = "https://ruiyuxuanyan.github.io/HowToCollege";

const index = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "index.json"), "utf8"));

// 读取现有 index.html 的样式与渲染逻辑，复用，避免两套逻辑漂移
const shell = fs.readFileSync(path.join(OUT_DIR, "index.html"), "utf8");
const styleBlock = shell.match(/<style>[\s\S]*?<\/style>/)[0];

// mdToHtml 依赖外部的 esc()，必须一起带上，否则运行时报 ReferenceError 且页面静默白屏。
function extractFn(src, signature) {
  const start = src.indexOf(signature);
  if (start < 0) throw new Error(`index.html 里找不到 ${signature}`);
  let depth = 0;
  let i = src.indexOf("{", start);
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`${signature} 大括号没有闭合`);
}

const escSrc = shell
  .split("\n")
  .find((l) => l.startsWith("const esc ="))
  .trim();
if (!escSrc) throw new Error("index.html 里找不到 esc 定义");
const mdFnSrc = extractFn(shell, "function mdToHtml(src){");

// 正文数据
const bodies = {};
for (const c of index.categories) {
  const p = path.join(OUT_DIR, "body", `${c.id}.json`);
  if (fs.existsSync(p)) bodies[c.id] = JSON.parse(fs.readFileSync(p, "utf8"));
}

const esc = (s) =>
  String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// 从正文里取一段干净的描述
function descOf(article, body) {
  if (article.summary) return article.summary.replace(/\s+/g, " ").slice(0, 110);
  const plain = (body || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#*>`|]/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return plain.slice(0, 110);
}

const OUT_A = path.join(OUT_DIR, "a");
fs.mkdirSync(OUT_A, { recursive: true });

const today = new Date().toISOString().slice(0, 10);
const urls = [];

for (const a of index.articles) {
  const body = (bodies[a.cat] || {})[a.id] || "";
  const url = `${SITE_URL}/a/${a.id}.html`;
  const desc = descOf(a, body);
  const catName = a.catName.split("-")[1] || a.catName;

  // 结构化的 Article 数据，帮搜索引擎理解
  const ld = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: desc,
    url,
    inLanguage: "zh-CN",
    dateModified: today,
    author: { "@type": "Organization", name: "大学生活指南" },
    publisher: { "@type": "Organization", name: "大学生活指南" },
    isPartOf: { "@type": "WebSite", name: "大学生活指南", url: `${SITE_URL}/` },
    articleSection: catName,
  };

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(a.title)} · 大学生活指南</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="大学生活指南">
<meta property="og:title" content="${esc(a.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE_URL}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="zh_CN">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(a.title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${SITE_URL}/og.png">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
${styleBlock}
<style>
body{background:var(--bg)}
.pg{max-width:820px;margin:0 auto;padding:34px 22px 90px}
.pg .top{font-size:13.5px;color:var(--muted);margin-bottom:20px}
.pg h1{font-size:27px;line-height:1.45;margin:0 0 14px;font-weight:700}
.pg .lead2{color:var(--muted);font-size:15px;border-left:3px solid var(--accent);padding-left:14px;margin:0 0 28px;line-height:1.8}
.pg .meta{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 26px}
.pg .foot{margin-top:44px;padding-top:20px;border-top:1px solid var(--line);font-size:13px;color:var(--muted);line-height:1.9}
</style>
</head>
<body>
<div class="pg">
<div class="top"><a href="../">← 大学生活指南</a> · ${esc(catName)}</div>
<h1>${esc(a.title)}</h1>
<p class="lead2">${esc(a.summary || "")}</p>
<div class="meta">
${a.sources.law ? `<span class="badge b-law">法规 ${a.sources.law}</span>` : ""}
${a.sources.official ? `<span class="badge b-off">官方 ${a.sources.official}</span>` : ""}
${a.sources.experience ? `<span class="badge b-exp">经验 ${a.sources.experience}</span>` : ""}
${a.sources.pending ? `<span class="badge b-pend">待核实 ${a.sources.pending}</span>` : ""}
</div>
<div class="md" id="c"></div>
<div class="foot">
来源标注：法规 ${a.sources.law} · 官方 ${a.sources.official} · 经验 ${a.sources.experience} · 待核实 ${a.sources.pending}<br>
本文地址：<code>${url}</code>　·　最后核查日期见文末<br>
<a href="../">在完整目录里看其他 ${index.total} 篇</a>
</div>
</div>
<script>
${escSrc}
${mdFnSrc}
document.getElementById("c").innerHTML = mdToHtml(${JSON.stringify(body)});
</script>
</body>
</html>
`;
  fs.writeFileSync(path.join(OUT_A, `${a.id}.html`), html, "utf8");
  urls.push({ loc: url, priority: "0.8" });
}

// 首页也进 sitemap
urls.unshift({ loc: `${SITE_URL}/`, priority: "1.0" });

fs.writeFileSync(
  path.join(OUT_DIR, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`,
  "utf8"
);

console.log(`生成独立文章页 ${index.articles.length} 个 · sitemap ${urls.length} 条`);
