const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CATS = fs
  .readdirSync(ROOT)
  .filter((d) => /^\d\d-/.test(d) && fs.statSync(path.join(ROOT, d)).isDirectory())
  .sort();

const problems = [];
let n = 0;

for (const c of CATS) {
  for (const f of fs.readdirSync(path.join(ROOT, c))) {
    if (!f.endsWith(".md") || f === "README.md") continue;
    n++;
    const p = path.join(c, f);
    const t = fs.readFileSync(path.join(ROOT, c, f), "utf8");
    const L = t.split("\n");

    const fail = (msg) => problems.push(`${p}: ${msg}`);

    // H1
    if (!/^# /.test(L[0])) fail("第一行不是 H1");

    // 一句话概括
    if (!/^> 一句话概括：/m.test(t)) fail("缺「一句话概括」");

    // 适用人群
    if (!/\*\*适用人群\*\*/.test(t)) fail("缺「适用人群」");

    // 常见误区
    if (!/## .*常见误区/.test(t)) fail("缺「常见误区」章节");

    // 可执行清单：要么有勾选项，要么是可直接抄的模板（含填空位 ____）
    if (!/## .*可执行清单/.test(t)) fail("缺「可执行清单」章节");
    else if (!/- \[ \]/.test(t) && !/_{3,}/.test(t)) fail("可执行清单既没有 - [ ] 勾选项，也不是填空模板");

    // 一句话记住
    if (!/## .*一句话记住/.test(t)) fail("缺「一句话记住」章节");

    // 参考资料
    if (!/## 参考资料/.test(t)) fail("缺「参考资料」章节");
    if (!/【法规】|【官方】|【经验】/.test(t)) fail("参考资料没有任何来源标记");

    // 相关篇目
    if (!/\*\*相关篇目\*\*/.test(t)) fail("缺「相关篇目」");

    // 最后核查日期
    if (!/\*\*最后核查日期\*\*：\d{4}-\d{2}-\d{2}/.test(t)) fail("缺「最后核查日期」或格式不对");

    // 核查说明
    if (!/\*\*核查说明\*\*/.test(t)) fail("缺「核查说明」");

    // 表格分隔行完整（| --- |）
    for (const line of L) {
      if (/^\|/.test(line) && /-{3,}/.test(line) && !/^\|[\s:|-]+\|$/.test(line.trim())) {
        fail(`表格分隔行格式异常: ${line.slice(0, 40)}`);
        break;
      }
    }

    // 不能有半角空表格
    if (/\|\s*\|\s*\|/.test(t) && !/\|\s*---/.test(t)) fail("疑似空表格");

    // 字数
    if (t.length < 2000) fail(`仅 ${t.length} 字，低于 2000`);
  }
}

console.log(`检查 ${n} 篇 · ${CATS.length} 个分类`);
if (problems.length) {
  console.error(`发现 ${problems.length} 个问题：`);
  problems.forEach((p) => console.error("  " + p));
  process.exit(1);
}
console.log("✓ 全部通过（9 项必备结构 + 来源标记 + 字数）");
