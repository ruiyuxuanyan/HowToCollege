"""生成 README / 站点封面横幅
用法：python tools/make-cover.py
数字从 site/index.json 读取，与正文自动保持一致。
"""
from PIL import Image, ImageDraw, ImageFont
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SITE = os.path.join(ROOT, "site")
INDEX = os.path.join(SITE, "index.json")
OUT = os.path.join(SITE, "cover.png")

W, H = 1400, 620
BG = (251, 250, 248)
INK = (28, 27, 25)
GREEN = (47, 111, 79)
MUTED = (107, 104, 98)
LIGHT = (150, 145, 136)
RULE = (230, 226, 219)
BODY = (61, 58, 53)


def F(size, bold=False, en=False):
    if en:
        cands = [r"C:\Windows\Fonts\georgiab.ttf" if bold else r"C:\Windows\Fonts\georgia.ttf",
                 r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf"]
    else:
        cands = [r"C:\Windows\Fonts\msyhbd.ttc" if bold else r"C:\Windows\Fonts\msyh.ttc",
                 r"C:\Windows\Fonts\simhei.ttf"]
    for p in cands:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


# 从 index.json 读统计，避免与正文不同步
total = law = official = pending = 0
if os.path.exists(INDEX):
    with open(INDEX, "r", encoding="utf-8") as f:
        d = json.load(f)
    total = d.get("total", 0)
    st = d.get("stats", {})
    law = st.get("law", 0)
    official = st.get("official", 0)
    pending = st.get("pending", 0)
else:
    print("警告：未找到 site/index.json，封面数字将为空。先运行 node tools/build-site.mjs")

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# 左上点阵
for y in range(26, 150, 26):
    for x in range(26, 236, 26):
        d.ellipse([x, y, x + 2, y + 2], fill=(233, 229, 221))

# 标题
d.rectangle([90, 148, 94, 208], fill=GREEN)
d.text((112, 90), "HowToCollege", font=F(46, True, en=True), fill=INK)
d.text((112, 154), "大学生生活指南", font=F(31, True), fill=GREEN)
d.text((90, 224), "那些大学里没人教，但你应该知道的事", font=F(21), fill=BODY)

d.line([90, 278, 1310, 278], fill=RULE, width=1)

# 四条主线
cols = [("生存", "权益 · 安全 · 政策 · 防骗"),
        ("生活", "消费 · 宿舍 · 饮食 · 社交"),
        ("成长", "学习 · 技能 · 效率 · 认知"),
        ("未来", "兼职 · 实习 · 求职 · 毕业")]
for (t, s), x in zip(cols, [90, 402, 714, 1026]):
    d.rectangle([x, 312, x + 3, 340], fill=GREEN)
    d.text((x + 15, 306), t, font=F(20, True), fill=INK)
    d.text((x, 350), s, font=F(15), fill=MUTED)

d.line([90, 406, 1310, 406], fill=RULE, width=1)

d.text((90, 432), "入学 · 学习 · 金钱 · 兼职 · 校园 · 情感 · 健康 · 法律 · 求职 · 毕业 · 数字生活",
       font=F(16), fill=MUTED)
d.text((90, 468), f"{total} 篇指南      法规依据 {law} 处      官方文件 {official} 处      明确标注待核实 {pending} 处",
       font=F(16), fill=MUTED)

d.line([90, 524, 1310, 524], fill=RULE, width=1)

d.text((90, 548), "每条标注来源等级（法规 / 官方 / 经验 / 待核实）与核查日期，区分国家规定与各校做法",
       font=F(14), fill=LIGHT)
d.text((90, 578), "在线版  ruiyuxuanyan.github.io/HowToCollege", font=F(14, True), fill=GREEN)

img.save(OUT, "PNG", optimize=True)
print(f"{OUT}  {img.size}  {os.path.getsize(OUT) / 1024:.0f} KB")
print(f"数字：{total} 篇 / 法规 {law} / 官方 {official} / 待核实 {pending}")
