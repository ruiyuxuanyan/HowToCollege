const fs = require("fs");
const path = require("path");
const ROOT = "D:/dsh-workspace/college-student-guide";

// 统计真实数字
const CATS = fs
  .readdirSync(ROOT)
  .filter((d) => /^\d\d-/.test(d) && fs.statSync(path.join(ROOT, d)).isDirectory());

let n = 0, law = 0, off = 0, exp = 0, pend = 0;
for (const c of CATS) {
  for (const f of fs.readdirSync(path.join(ROOT, c))) {
    if (!f.endsWith(".md") || f === "README.md") continue;
    const t = fs.readFileSync(path.join(ROOT, c, f), "utf8");
    n++;
    law += (t.match(/【法规】/g) || []).length;
    off += (t.match(/【官方】/g) || []).length;
    exp += (t.match(/【经验】/g) || []).length;
    pend += (t.match(/【待核实】/g) || []).length;
  }
}

// 重写徽章行（用 encodeURIComponent 保证 URL 正确）
const badge = (label, value, color) =>
  `[![${label}](https://img.shields.io/badge/${encodeURIComponent(label)}-${encodeURIComponent(value)}-${color}?style=flat-square)]`;

const lines = [
  badge("篇目", `${n} 篇`, "18794e") + "(#内容分类)",
  badge("来源标注", `法规 ${law} · 官方 ${off}`, "3451b2") + "(#三个核心设计)",
  badge("待核实", `${pend} 处`, "915930") + "(#三个核心设计)",
  `[![许可](https://img.shields.io/badge/${encodeURIComponent("正文")}-CC%20BY%204.0-565a5f?style=flat-square)](LICENSE)`,
];

const p = path.join(ROOT, "README.md");
let t = fs.readFileSync(p, "utf8");
const arr = t.split("\n");

// 徽章位于连续的 4 行
let start = arr.findIndex((L) => L.startsWith("[![篇目]"));
if (start === -1) { console.error("未找到徽章起始行"); process.exit(1); }

arr.splice(start, 4, ...lines);
t = arr.join("\n");

// 同步正文里的数字
t = t.replace(/法规 \d+ 处/g, `法规 ${law} 处`);
t = t.replace(/官方 \d+ 处/g, `官方 ${off} 处`);
t = t.replace(/待核实 \d+ 处/g, `待核实 ${pend} 处`);
t = t.replace(/\d+ 处【待核实】/g, `${pend} 处【待核实】`);
t = t.replace(/剩余 \d+ 处/g, `剩余 ${pend} 处`);
t = t.replace(/的 \d+ 处内容/g, `的 ${pend} 处内容`);

fs.writeFileSync(p, t, "utf8");

console.log(`篇目 ${n} | 法规 ${law} | 官方 ${off} | 经验 ${exp} | 待核实 ${pend}`);
console.log("徽章已重写：");
lines.forEach((l) => console.log("  " + decodeURIComponent(l.slice(0, 120))));
