const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CATS = fs
  .readdirSync(ROOT)
  .filter((d) => /^\d\d-/.test(d) && fs.statSync(path.join(ROOT, d)).isDirectory())
  .sort((a, b) => a.localeCompare(b, "zh"));

function kind(s) {
  if (/^核查说明|^说明\*\*：|已核对|已对照|已按现行条文核对/.test(s)) return "说明性文字";
  if (/各校|本校|学校|校内|院系|辅导员|教务/.test(s)) return "学校规定";
  if (/各地|各市|各省|当地|地方|城市|统筹地区|参保地/.test(s)) return "地区差异";
  if (/条款|条文|序号|原文|文号|未能|未取得|以现行|版本/.test(s)) return "待取原文";
  if (/金额|比例|标准|年限|名额|数值/.test(s)) return "数值标准";
  if (/本文不写|刻意|未写入|一律未|不给具体/.test(s)) return "刻意留白";
  return "其他";
}

const rows = [];
for (const cat of CATS) {
  const dir = path.join(ROOT, cat);
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".md") && x !== "README.md").sort()) {
    const t = fs.readFileSync(path.join(dir, f), "utf8");
    const title = ((t.match(/^#\s+(.+)$/m) || [])[1] || f).trim();
    t.split("\n").forEach((L, i) => {
      if (!L.includes("【待核实】")) return;
      const ctx = L.replace(/【待核实】/g, "").replace(/^\s*[>|*-]+\s*/, "").trim();
      rows.push({ id: f.slice(0, 5), file: cat + "/" + f, title, line: i + 1, kind: kind(ctx), ctx: ctx.slice(0, 110) });
    });
  }
}

const real = rows.filter((r) => r.kind !== "说明性文字");
const byKind = {};
for (const r of real) byKind[r.kind] = (byKind[r.kind] || 0) + 1;

const byFile = {};
for (const r of real) {
  byFile[r.file] = byFile[r.file] || { id: r.id, title: r.title, n: 0, kinds: new Set() };
  byFile[r.file].n++;
  byFile[r.file].kinds.add(r.kind);
}

const ORDER = ["待取原文", "数值标准", "地区差异", "学校规定", "其他", "刻意留白"];
const LABEL = {
  待取原文: "待取原文（能查，优先处理）",
  数值标准: "数值标准（部分可查）",
  地区差异: "地区差异（本地读者最清楚）",
  学校规定: "学校规定（本校读者最清楚）",
  其他: "其他",
  刻意留白: "刻意留白（不是缺口，无需处理）",
};

const L = [];
L.push("# 待核实清单");
L.push("");
L.push(`> 自动生成于 ${new Date().toISOString().slice(0, 10)}。共 **${real.length}** 处待处理。`);
L.push(`> 另有 ${rows.length - real.length} 处【待核实】出现在「核查说明」里，属于叙述文字（如「已核对」），不计入。`);
L.push("");
L.push("## 这份清单是什么");
L.push("");
L.push("文章里标了【待核实】的地方，不都是「没查到的空缺」。按性质分几类：");
L.push("");
L.push("| 类型 | 数量 | 含义 | 谁最该处理 |");
L.push("| --- | --- | --- | --- |");
L.push(`| **待取原文** | ${byKind["待取原文"] || 0} | 条款序号、文号、版本待确认 | 我们能查，优先处理 |`);
L.push(`| **数值标准** | ${byKind["数值标准"] || 0} | 具体金额、比例、年限 | 部分能查，部分按年度变 |`);
L.push(`| **地区差异** | ${byKind["地区差异"] || 0} | 各省市规定不同 | 各地读者 |`);
L.push(`| **学校规定** | ${byKind["学校规定"] || 0} | 各校自行规定 | 本校读者 |`);
L.push(`| 其他 | ${byKind["其他"] || 0} | 需具体判断 | — |`);
L.push(`| 刻意留白 | ${byKind["刻意留白"] || 0} | 有意不写出具体数值 | 无需处理 |`);
L.push("");
L.push(
  (byKind["待取原文"] || 0) === 0
    ? "**第一类已清零**：条款序号、文号、版本这类「我们能查」的条目已逐一核对原文。剩下的是「各地各校自己才清楚」的部分——这部分我们查不到，需要本地读者补。"
    : "**先看第一类**：「待取原文」可以查实，处理完这部分，全库的确定性会明显提升。"
);
L.push("");
L.push("## 按类型分组");
L.push("");

for (const k of ORDER) {
  const list = real.filter((r) => r.kind === k);
  if (!list.length) continue;
  L.push(`### ${LABEL[k]} — ${list.length} 处`);
  L.push("");
  if (k === "刻意留白") {
    L.push("这些是正文里明确说明「有意不给出具体数值」的地方，属于设计选择，**不需要处理**。");
    L.push("");
  }
  L.push("| 篇目 | 行 | 内容 |");
  L.push("| --- | --- | --- |");
  for (const r of list) {
    L.push(`| ${r.id} ${r.title.slice(0, 16)} | ${r.line} | ${r.ctx.replace(/\|/g, "｜").slice(0, 68)} |`);
  }
  L.push("");
}

L.push("## 按篇目看");
L.push("");
L.push("| 篇目 | 待处理 | 类型 |");
L.push("| --- | --- | --- |");
for (const [, v] of Object.entries(byFile).sort((a, b) => b[1].n - a[1].n)) {
  L.push(`| ${v.id} ${v.title.slice(0, 20)} | ${v.n} | ${[...v.kinds].join("、")} |`);
}
L.push("");
L.push("## 怎么参与");
L.push("");
L.push("- **如果你在某个省市**：帮我们确认「地区差异」类的条目，注明城市与政策年份");
L.push("- **如果你在某个学校**：帮我们确认「学校规定」类的条目，注明学校（可模糊到「某 211 高校」这种粒度）");
L.push("- **发现错误**：直接开 issue，附上官方来源");
L.push("");
L.push("> 所有补充都会在正文里标为【官方】或【经验】，并注明提供者与核实时间。");
L.push("");
L.push("## 自动生成");
L.push("");
L.push("本文档由 `tools/gen-pending.js` 生成，正文改动后重新运行即可更新。不要手工编辑。");
L.push("");

fs.writeFileSync(path.join(ROOT, "docs", "待核实清单.md"), L.join("\n"), "utf8");
console.log("总数", real.length, "| 说明性文字", rows.length - real.length);
ORDER.forEach((k) => byKind[k] && console.log(`  ${k}: ${byKind[k]}`));
