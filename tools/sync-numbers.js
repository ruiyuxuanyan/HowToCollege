const fs = require("fs");
const path = require("path");
// 仓库根目录 = 本脚本所在目录的上一级；不写死绝对路径
const ROOT = path.resolve(__dirname, "..");

// 统计真实数字
const CATS = fs
  .readdirSync(ROOT)
  .filter((d) => /^\d\d-/.test(d) && fs.statSync(path.join(ROOT, d)).isDirectory());

// 「叙述性」的【待核实】：出现在核查说明里、只是描述核查过程，不是真待办。
// 与 tools/gen-pending.js 的 kind() 判定保持一致，两处数字不能打架。
function isNarrative(s) {
  return /^核查说明|^说明\*\*：|已核对|已对照|已按现行条文核对/.test(s);
}

let n = 0;
let law = 0;
let off = 0;
let exp = 0;
let pend = 0; // 全库【待核实】原始出现次数（同一段多次出现会重复计）
let pendLines = 0; // 含【待核实】的行数
let pendNarr = 0; // 其中位于「核查说明」段落、属描述核查过程的
for (const c of CATS) {
  for (const f of fs.readdirSync(path.join(ROOT, c))) {
    if (!f.endsWith(".md") || f === "README.md") continue;
    const t = fs.readFileSync(path.join(ROOT, c, f), "utf8");
    n++;
    law += (t.match(/【法规】/g) || []).length;
    off += (t.match(/【官方】/g) || []).length;
    exp += (t.match(/【经验】/g) || []).length;
    pend += (t.match(/【待核实】/g) || []).length;
    for (const L of t.split("\n")) {
      if (!L.includes("【待核实】")) continue;
      pendLines++;
      const ctx = L.replace(/【待核实】/g, "").replace(/^\s*[>|*-]+\s*/, "").trim();
      if (isNarrative(ctx)) pendNarr++;
    }
  }
}
// 真实待办 = 含待核实的行 - 叙述性行；与 tools/gen-pending.js 的统计一致
const pendTodo = pendLines - pendNarr;

// 重写徽章行（用 encodeURIComponent 保证 URL 正确）
const badge = (label, value, color) =>
  `[![${label}](https://img.shields.io/badge/${encodeURIComponent(label)}-${encodeURIComponent(value)}-${color}?style=flat-square)]`;

// 徽章用「真实待办」数，避免和 docs/待核实清单.md 的统计口径打架
const lines = [
  badge("篇目", `${n} 篇`, "18794e") + "(#内容分类)",
  badge("来源标注", `法规 ${law} · 官方 ${off} · 经验 ${exp}`, "3451b2") + "(#三个核心设计)",
  badge("待核实", `${pendTodo} 处待办`, "915930") + "(#三个核心设计)",
  `[![许可](https://img.shields.io/badge/${encodeURIComponent("正文")}-CC%20BY%204.0-565a5f?style=flat-square)](LICENSE)`,
];

const p = path.join(ROOT, "README.md");
let t = fs.readFileSync(p, "utf8");
const arr = t.split("\n");

// 徽章位于连续的 4 行
let start = arr.findIndex((L) => L.startsWith("[![篇目]"));
if (start === -1) {
  console.error("未找到徽章起始行");
  process.exit(1);
}

arr.splice(start, 4, ...lines);
t = arr.join("\n");

// 同步「来源标注」表格里的数字（表格单元格只有数字，没有「法规 N 处」这样的前缀，
// 所以按行首标记定位，而不是靠正则里带「法规」二字）
const cellOf = (marker, val) => {
  const re = new RegExp(`^(\\| 【${marker}】 \\|.*\\| )\\d+( 处 \\|)$`, "m");
  if (!re.test(t)) {
    console.error(`⚠ README 里找不到【${marker}】那一行的数量单元格`);
    process.exit(1);
  }
  t = t.replace(re, (_, a, b) => a + val + b);
};
cellOf("法规", law);
cellOf("官方", off);
cellOf("经验", exp);
cellOf("待核实", pendTodo);

// 正文里的数字
t = t.replace(/法规 \d+ 处/g, `法规 ${law} 处`);
t = t.replace(/官方 \d+ 处/g, `官方 ${off} 处`);
t = t.replace(/经验 \d+ 处/g, `经验 ${exp} 处`);
t = t.replace(/\d+ 处【待核实】/g, `${pendTodo} 处【待核实】`);
t = t.replace(/剩余 \d+ 处/g, `剩余 ${pendTodo} 处`);
t = t.replace(/的 \d+ 处内容/g, `的 ${pendTodo} 处内容`);
t = t.replace(/\d+ 处待办/g, `${pendTodo} 处待办`);

// 口径说明：始终写清「标注次数」与「真实待办」的关系，数字由脚本算，不手写
const noteRe = /<!-- pend-scope -->[\s\S]*?<!-- \/pend-scope -->/;
const note = `<!-- pend-scope -->**统计口径**：全库共标注【待核实】${pend} 次，落在 ${pendLines} 行里；其中 ${pendNarr} 行在「核查说明」段落里，属于描述核查过程、不是真待办。**真实待办 ${pendTodo} 处**，与 [\`docs/待核实清单.md\`](docs/待核实清单.md) 的统计一致。<!-- /pend-scope -->`;
if (noteRe.test(t)) t = t.replace(noteRe, note);
else console.error("⚠ README 里没有 <!-- pend-scope --> 占位，口径说明未写入");

fs.writeFileSync(p, t, "utf8");

console.log(`篇目 ${n} | 法规 ${law} | 官方 ${off} | 经验 ${exp} | 待核实标注 ${pend} 次 · 真实待办 ${pendTodo} 处`);
console.log("徽章已重写：");
lines.forEach((l) => {
  // 直接打印原始行；不要 slice 后再 decodeURIComponent——切在 %XX 中间会抛 URIError
  try {
    console.log("  " + decodeURIComponent(l));
  } catch {
    console.log("  " + l);
  }
});
