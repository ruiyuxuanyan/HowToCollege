const fs = require("fs");
const path = require("path");

// 仓库根目录 = 本脚本所在目录的上一级
const ROOT = path.resolve(__dirname, "..");

// 某些站点会拒绝自动化请求（返回 403/412/429/521），不是真失效。
// 这些域名报错时只提示、不算失败，避免误报。
const ANTIBOT = [/gsxt\.gov\.cn/, /qingdao\.chinatax\.gov\.cn/, /mayoclinic\.org/, /fda\.gov/];

function collectUrls() {
  const cats = fs
    .readdirSync(ROOT)
    .filter((d) => /^\d\d-/.test(d) && fs.statSync(path.join(ROOT, d)).isDirectory());
  const urls = new Map(); // url -> 出现该链接的文件列表
  for (const c of cats) {
    for (const f of fs.readdirSync(path.join(ROOT, c))) {
      if (!f.endsWith(".md") || f === "README.md") continue;
      const p = path.join(c, f);
      const t = fs.readFileSync(path.join(ROOT, c, f), "utf8");
      for (const m of t.matchAll(/https?:\/\/[^\s)\]>"'`，。；、]+/g)) {
        const u = m[0].replace(/[.,;:)\]]+$/, "");
        if (!urls.has(u)) urls.set(u, []);
        if (!urls.get(u).includes(p)) urls.get(u).push(p);
      }
    }
  }
  return urls;
}

async function probe(u) {
  const once = async (method) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 12000);
    try {
      const r = await fetch(u, {
        method,
        redirect: "follow",
        signal: ctl.signal,
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        },
      });
      return { code: r.status, final: r.url };
    } catch (e) {
      return { code: 0, err: e.name };
    } finally {
      clearTimeout(timer);
    }
  };
  // 很多站点对 HEAD 的响应不可靠（返回 404/403 而 GET 正常），
  // 所以只要 HEAD 不是 200，一律用 GET 复核一次，取更好的结果。
  let r = await once("HEAD");
  if (r.code !== 200) {
    const g = await once("GET");
    if (g.code !== 0) r = g;
  }
  return r;
}

(async () => {
  const urls = collectUrls();
  console.log(`扫描到 ${urls.size} 个去重外链，开始探测…\n`);

  const dead = [];
  const blocked = [];

  for (const [u, files] of urls) {
    const r = await probe(u);
    const bad = r.code === 0 || r.code >= 400;
    if (!bad) continue;
    if (ANTIBOT.some((re) => re.test(u))) {
      blocked.push({ u, code: r.code, files });
      console.log(`⚠  ${r.code}\t${u}  （反爬，可用浏览器打开）`);
    } else {
      dead.push({ u, code: r.code, files });
      console.log(`✗  ${r.code}\t${u}\t出现在 ${files.length} 篇`);
    }
  }

  console.log(`\n=== 汇总 ===`);
  console.log(`失联（疑似真死链）: ${dead.length}`);
  dead.forEach((d) => d.files.forEach((f) => console.log(`   ${d.code}  ${d.u}  ← ${f}`)));
  console.log(`被反爬拦截（不算失败）: ${blocked.length}`);
  blocked.forEach((d) => console.log(`   ${d.code}  ${d.u}`));

  // 只有真死链才返回非 0，反爬不阻断 CI
  if (dead.length) process.exit(1);
  console.log("\n✓ 没有真死链");
})();
