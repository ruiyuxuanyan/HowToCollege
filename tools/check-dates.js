const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

// 核查日期一致性检查
// 规则：某篇的 git 最后修改日期，不得晚于该篇声明的「最后核查日期」。
// 理由：正文只要动过（哪怕只是补一条官方原文链接），那篇的核查日期就必须同步推进，
// 否则「核查日期」就成了摆设——它对读者唯一的用处就是「这份内容最近确认过」。
const ROOT = path.resolve(__dirname, "..");

function git(args) {
  return execFileSync("git", ["-C", ROOT, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

try {
  git(["rev-parse", "--is-inside-work-tree"]);
} catch (e) {
  console.log("（跳过核查日期检查：当前目录不是 git 仓库）");
  process.exit(0);
}

// 一次拿到「文件 → 最后提交日期」，避免逐篇调用 git
let dateMap = new Map();
try {
  const raw = git([
    "-c",
    "core.quotepath=false",
    "log",
    "--name-only",
    "--date=short",
    "--pretty=format:@@%ad",
  ]);
  let curDate = "";
  for (const line of raw.split("\n")) {
    if (line.startsWith("@@")) {
      // 提交按时间倒序输出，第一次遇到的日期即该文件的最后修改日期
      curDate = line.slice(2).trim();
      continue;
    }
    const f = line.trim();
    if (!f || !/\.md$/.test(f)) continue;
    if (!dateMap.has(f)) dateMap.set(f, curDate); // 只记录最新一次
  }
} catch (e) {
  console.log("（跳过核查日期检查：读不到 git 历史，可能是浅克隆）");
  process.exit(0);
}

const CATS = fs
  .readdirSync(ROOT)
  .filter((d) => /^\d\d-/.test(d) && fs.statSync(path.join(ROOT, d)).isDirectory())
  .sort();

const today = new Date().toISOString().slice(0, 10);
const problems = [];
let n = 0;
let checked = 0;
let noHistory = 0;

for (const c of CATS) {
  for (const f of fs.readdirSync(path.join(ROOT, c))) {
    if (!f.endsWith(".md") || f === "README.md") continue;
    n++;
    const rel = `${c}/${f}`;
    const text = fs.readFileSync(path.join(ROOT, c, f), "utf8");

    const m = text.match(/\*\*最后核查日期\*\*：(\d{4}-\d{2}-\d{2})/);
    if (!m) continue; // 缺字段由 check-structure.js 负责报

    // 未来日期
    if (m[1] > today) {
      problems.push(`${rel}: 声明 ${m[1]}，是未来日期`);
    }

    const gitDate = dateMap.get(rel);
    if (!gitDate) {
      noHistory++;
      continue;
    }
    checked++;
    if (gitDate > m[1]) {
      problems.push(`${rel}: 声明 ${m[1]}，但 ${gitDate} 还改过`);
    }
  }
}

console.log(
  `核查日期检查：${checked} 篇有历史可比` +
    (noHistory ? `，${noHistory} 篇无历史记录` : "") +
    `（共 ${n} 篇）`
);

if (problems.length) {
  console.error(`\n发现 ${problems.length} 处日期不一致：\n`);
  problems.forEach((p) => console.error("  " + p));
  console.error(
    `\n规则：正文有任何改动（含补参考资料链接、调整章节结构），都要把该篇的「最后核查日期」改成改动当天。`
  );
  console.error(`当前应为：${today} 或你实际改动的日期。`);
  process.exit(1);
}

console.log("✓ 所有篇目的核查日期都不早于最后一次修改");
