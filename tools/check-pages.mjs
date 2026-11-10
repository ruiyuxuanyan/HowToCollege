import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const A = path.join(ROOT, "site", "a");

const files = fs.readdirSync(A).filter((f) => f.endsWith(".html"));
let bad = 0;
const issues = [];

for (const f of files) {
  const h = fs.readFileSync(path.join(A, f), "utf8");

  // 必备的头部标签
  const need = [
    ["og:title", /<meta property="og:title" content="[^"]+"/],
    ["og:image", /<meta property="og:image" content="[^"]+og\.png"/],
    ["og:description", /<meta property="og:description" content="[^"]{10,}"/],
    ["canonical", /<link rel="canonical" href="https:\/\/[^"]+"/],
    ["twitter:card", /<meta name="twitter:card" content="summary_large_image"/],
    ["ld+json", /<script type="application\/ld\+json">\{.*"@type":"Article"/],
  ];
  for (const [name, re] of need) {
    if (!re.test(h)) {
      issues.push(`${f}: 缺 ${name}`);
      bad++;
    }
  }

  // 脚本必须同时含 esc 与 mdToHtml，否则白屏
  const sm = h.match(/<script>\n([\s\S]*?)<\/script>\s*<\/body>/);
  if (!sm) {
    issues.push(`${f}: 找不到内联脚本`);
    bad++;
    continue;
  }
  const code = sm[1];
  if (!/const esc =/.test(code)) {
    issues.push(`${f}: 脚本缺 esc 定义（会白屏）`);
    bad++;
  }
  if (!/function mdToHtml/.test(code)) {
    issues.push(`${f}: 脚本缺 mdToHtml`);
    bad++;
  }
  if (!/getElementById\("c"\)\.innerHTML/.test(code)) {
    issues.push(`${f}: 没有写入正文的调用`);
    bad++;
  }
  // 语法
  try {
    new Function("document", code);
  } catch (e) {
    issues.push(`${f}: 脚本语法错误 ${e.message}`);
    bad++;
  }
  // 正文非空
  const bodyM = code.match(/mdToHtml\(("(?:[^"\\]|\\.)*")\)\s*$/);
  if (bodyM) {
    try {
      const s = JSON.parse(bodyM[1]);
      if (s.length < 500) {
        issues.push(`${f}: 正文过短 ${s.length} 字符`);
        bad++;
      }
    } catch (e) {
      issues.push(`${f}: 正文 JSON 解析失败`);
      bad++;
    }
  }
}

console.log(`检查 ${files.length} 个文章页`);
if (issues.length) {
  console.log(`\n发现 ${issues.length} 个问题：`);
  issues.slice(0, 30).forEach((i) => console.log("  " + i));
  process.exit(1);
}
console.log("✓ 全部通过（og/canonical/JSON-LD + 脚本完整 + 正文非空）");
