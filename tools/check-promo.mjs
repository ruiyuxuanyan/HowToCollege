import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 校验知乎推广稿：
// 1. 每篇的引流链接必须能对应到真实存在的文章页
// 2. 链接必须是 /a/<id>.html 形式（独立页），不能是首页或 hash 链接
// 3. 每篇给的法条条号必须在正文文章里出现过（避免推广稿编法条）
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "promo", "zhihu");
const INDEX = JSON.parse(fs.readFileSync(path.join(ROOT, "site", "index.json"), "utf8"));

const ids = new Set(INDEX.articles.map((a) => a.id));
const problems = [];
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".md") && f !== "README.md");

let n = 0;
for (const f of files) {
  n++;
  const t = fs.readFileSync(path.join(DIR, f), "utf8");

  // 引流链接
  const links = [...t.matchAll(/https:\/\/ruiyuxuanyan\.github\.io\/HowToCollege\/(\S*)/g)];
  if (links.length === 0) {
    problems.push(`${f}: 没有引流链接`);
  }
  for (const m of links) {
    // markdown 粗体等符号会被一起匹配到，去掉尾部非路径字符
    const pathPart = m[1].trim().replace(/[^A-Za-z0-9._/-].*$/,"");
    const mm = pathPart.match(/^a\/(\d\d-\d\d)\.html$/);
    if (!mm) {
      problems.push(`${f}: 链接不是独立文章页 → ${pathPart}`);
      continue;
    }
    if (!ids.has(mm[1])) {
      problems.push(`${f}: 指向不存在的文章 ${mm[1]}`);
      continue;
    }
    // 对应文章必须有正文数据
    const bodyFile = path.join(ROOT, "site", "body", `${mm[1].slice(0, 2)}.json`);
    if (!fs.existsSync(bodyFile)) {
      problems.push(`${f}: 缺少 body 数据 ${page}`);
      continue;
    }
    const map = JSON.parse(fs.readFileSync(bodyFile, "utf8"));
    if (!map[mm[1]] || map[mm[1]].length < 1000) {
      problems.push(`${f}: ${mm[1]} 的正文为空或过短`);
    }
  }

  // 推广稿里出现的法条，必须在正文里也出现（防编造）
  const lawRefs = [...t.matchAll(/《([^》]{4,40})》第([一二三四五六七八九十百千零〇\d]+)条/g)];
  for (const [, law, art] of lawRefs) {
    const artNum = art;
    // 在所有正文里搜「第X条」且相近位置有法名
    let found = false;
    for (const c of INDEX.categories) {
      const bf = path.join(ROOT, "site", "body", `${c.id}.json`);
      if (!fs.existsSync(bf)) continue;
      const map = JSON.parse(fs.readFileSync(bf, "utf8"));
      for (const body of Object.values(map)) {
        if (body.includes(law.slice(0, 6)) && body.includes(`第${artNum}条`)) {
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (!found) {
      problems.push(`${f}: 引用《${law}》第${artNum}条，但在正文里找不到`);
    }
  }
}

console.log(`检查 ${n} 篇推广稿`);
if (problems.length) {
  console.log(`\n发现 ${problems.length} 个问题：`);
  problems.forEach((p) => console.log("  " + p));
  process.exit(1);
}
console.log("✓ 链接全部指向真实文章页，引用的法条都能在正文中找到");
