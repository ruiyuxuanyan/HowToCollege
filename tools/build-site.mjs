// 生成静态站点：site/index.html（单文件，内联样式与脚本）
// 数据来自 site/index.json 与 site/body/NN.json
// 用法：node tools/build-site.mjs

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "site");

const CATS = fs
  .readdirSync(ROOT)
  .filter((d) => /^\d\d-/.test(d) && fs.statSync(path.join(ROOT, d)).isDirectory())
  .sort((a, b) => a.localeCompare(b, "zh"));

const CAT_DESC = {
  "01": "报到、学费、户口档案、困难认定、防骗",
  "02": "选课、绩点、奖学金、转专业、学术规范",
  "03": "助学贷款、医保、校园贷、帮信罪、资金安全",
  "04": "兼职法律身份、欠薪维权、实习协议、常见骗局",
  "05": "宿舍关系、社团、校外租房、校园安全",
  "06": "欺凌、性骚扰、师生边界、网暴、恋爱财务",
  "07": "医保、就医、心理危机、急症、性健康、用药",
  "08": "法律红线、帮信罪、言论边界、处分申诉、维权",
  "09": "三方协议、应届生身份、校招骗局、试用期",
  "10": "档案户口、劳动合同、五险一金、租房、个税",
  "11": "账号安全、信息泄露、AI 使用边界、二手交易",
};

// 受众标签推断
function audienceTags(id, cat) {
  const t = [];
  if (cat === "01") t.push("新生");
  if (cat === "09" || cat === "10") t.push("毕业");
  if (["02", "03", "04", "05", "06", "07", "08", "11"].includes(cat)) t.push("在校");
  if (["03", "04"].includes(cat)) t.push("缺钱");
  return [...new Set(t)];
}

const meta = [];
const categories = [];
const bodies = {};
const stats = { law: 0, official: 0, experience: 0, pending: 0 };

for (const cat of CATS) {
  const catNum = cat.slice(0, 2);
  const dir = path.join(ROOT, cat);
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .sort();

  bodies[catNum] = {};

  for (const f of files) {
    const raw = fs.readFileSync(path.join(dir, f), "utf8");
    const num = f.slice(0, 5);
    const title = ((raw.match(/^#\s+(.+)$/m) || [])[1] || f.replace(/\.md$/, "")).trim();
    const summary = ((raw.match(/^>\s*一句话概?括[：:]\s*(.+)$/m) || [])[1] || "").trim();

    // 正文去掉 H1 和「一句话概括」那行（站点自己渲染，避免重复显示）
    let body = raw.replace(/^#\s+.+\n/, "");
    body = body.replace(/^\s*>\s*一句话概?括[：:].*(?:\n|$)/, "");
    body = body.trim();

    const c = (re) => (raw.match(re) || []).length;
    const s = {
      law: c(/【法规】/g),
      official: c(/【官方】/g),
      experience: c(/【经验】/g),
      pending: c(/【待核实】/g),
    };
    stats.law += s.law;
    stats.official += s.official;
    stats.experience += s.experience;
    stats.pending += s.pending;

    meta.push({
      id: num,
      cat: catNum,
      catName: cat,
      title,
      summary,
      audience: ((raw.match(/\*\*适用人群\*\*[：:]\s*(.+)$/m) || [])[1] || "").trim(),
      tags: audienceTags(num, catNum),
      chars: raw.length,
      sources: s,
    });
    bodies[catNum][num] = body;
  }

  categories.push({ id: catNum, name: cat, desc: CAT_DESC[catNum] || "", count: files.length });
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, "body"), { recursive: true });

const indexData = { generatedAt: new Date().toISOString(), total: meta.length, stats, categories, articles: meta };
fs.writeFileSync(path.join(OUT_DIR, "index.json"), JSON.stringify(indexData), "utf8");

for (const [catNum, map] of Object.entries(bodies)) {
  fs.writeFileSync(path.join(OUT_DIR, "body", catNum + ".json"), JSON.stringify(map), "utf8");
}

const kb = (n) => (n / 1024).toFixed(1) + " KB";
console.log(`分类 ${categories.length} · 文章 ${meta.length}`);
console.log(`index.json ${kb(fs.statSync(path.join(OUT_DIR, "index.json")).size)}`);
console.log(`来源 法规 ${stats.law} · 官方 ${stats.official} · 经验 ${stats.experience} · 待核实 ${stats.pending}`);
const bad = meta.filter((a) => !a.title || !a.summary);
console.log(bad.length ? `⚠ ${bad.length} 篇缺标题或概括` : "✓ 数据完整");
