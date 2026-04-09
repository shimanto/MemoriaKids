const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const dir = __dirname;
const outPath = path.join(dir, "word", "特許出願書類一式_MK-PAT-2026-001.pdf");

// Font path - NotoSansJP (TTF, variable font)
const FONT_NOTO = "C:/Windows/Fonts/NotoSansJP-VF.ttf";
const gothicFont = fs.existsSync(FONT_NOTO) ? FONT_NOTO : undefined;
const minchoFont = gothicFont; // Use same font for both

const doc = new PDFDocument({
  size: "A4",
  margins: { top: 85, bottom: 85, left: 85, right: 85 }, // ~30mm
  info: {
    Title: "特許出願書類一式 MK-PAT-2026-001",
    Author: "宮田 浩伸",
    Subject: "児童保育支援システムにおける音声解析及び発達マイルストーン自動フィルタリング装置",
  },
});

const stream = fs.createWriteStream(outPath);
doc.pipe(stream);

// Register fonts
if (gothicFont) doc.registerFont("Gothic", gothicFont);
if (minchoFont) doc.registerFont("Mincho", minchoFont);

const titleFont = gothicFont ? "Gothic" : "Helvetica-Bold";
const bodyFont = minchoFont ? "Mincho" : "Helvetica";

// ── Helpers ──────────────────────────────────────────

let currentY = doc.y;

function ensureSpace(needed) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

function title(text, size = 16) {
  ensureSpace(40);
  doc.font(titleFont).fontSize(size).text(text, { lineGap: 6 });
  doc.moveDown(0.5);
}

function heading2(text) {
  ensureSpace(30);
  doc.moveDown(0.3);
  doc.font(titleFont).fontSize(13).text(text, { lineGap: 4 });
  doc.moveDown(0.3);
}

function heading3(text) {
  ensureSpace(25);
  doc.moveDown(0.2);
  doc.font(titleFont).fontSize(11).text(text, { lineGap: 4 });
  doc.moveDown(0.2);
}

function body(text) {
  ensureSpace(20);
  doc.font(bodyFont).fontSize(10.5).text(text, { lineGap: 5 });
}

function bodyBold(text) {
  ensureSpace(20);
  doc.font(titleFont).fontSize(10.5).text(text, { lineGap: 5 });
}

function gap() {
  doc.moveDown(0.3);
}

function pageBreak() {
  doc.addPage();
}

function separator() {
  doc.moveDown(0.3);
  const x = doc.page.margins.left;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.moveTo(x, doc.y).lineTo(x + w, doc.y).stroke("#cccccc");
  doc.moveDown(0.5);
}

// ── Parse markdown and render ────────────────────────

function renderMarkdown(filePath, opts = {}) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();

    // Skip internal strategy memos
    if (line.startsWith("## 【出願戦略メモ】")) break;
    if (line.startsWith("> **【出願戦略")) continue;
    if (line.startsWith("> ※")) continue;

    // Skip markdown artifacts
    if (line === "---") { separator(); continue; }
    if (line.startsWith("```")) continue;

    // Headings
    if (line.startsWith("# ")) {
      title(line.replace(/^#+\s*/, ""));
    } else if (line.startsWith("## ")) {
      heading2(line.replace(/^#+\s*/, ""));
    } else if (line.startsWith("### ")) {
      heading3(line.replace(/^#+\s*/, ""));
    } else if (line === "") {
      gap();
    } else if (line.startsWith("| ") && line.includes("---")) {
      // Skip table separator
      continue;
    } else if (line.startsWith("| ")) {
      // Table row
      const cells = line.split("|").filter(c => c.trim()).map(c => c.trim());
      body("  " + cells.join("　|　"));
    } else {
      // Regular text - strip markdown bold markers for PDF
      let text = line;
      text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
      if (text.startsWith("- ")) text = "・" + text.slice(2);

      // Check if line starts with bold pattern (was bold in markdown)
      if (line.startsWith("**")) {
        bodyBold(text);
      } else {
        body(text);
      }
    }
  }
}

// ── Cover Page ───────────────────────────────────────

doc.moveDown(6);
doc.font(titleFont).fontSize(22).text("特許出願書類一式", { align: "center" });
doc.moveDown(1);
doc.font(titleFont).fontSize(14).text("整理番号: MK-PAT-2026-001", { align: "center" });
doc.moveDown(2);
doc.font(titleFont).fontSize(16).text(
  "児童保育支援システムにおける\n音声解析及び発達マイルストーン\n自動フィルタリング装置",
  { align: "center", lineGap: 8 }
);
doc.moveDown(3);
doc.font(bodyFont).fontSize(12).text("出願人: 宮田 浩伸", { align: "center" });
doc.moveDown(0.5);
doc.font(bodyFont).fontSize(12).text("令和8年4月", { align: "center" });
doc.moveDown(2);

doc.font(bodyFont).fontSize(10).text("目次:", { align: "left" });
doc.moveDown(0.3);
doc.font(bodyFont).fontSize(10).text("  1. 特許願", { align: "left" });
doc.font(bodyFont).fontSize(10).text("  2. 明細書", { align: "left" });
doc.font(bodyFont).fontSize(10).text("  3. 特許請求の範囲", { align: "left" });
doc.font(bodyFont).fontSize(10).text("  4. 要約書", { align: "left" });
doc.font(bodyFont).fontSize(10).text("  5. 図面（図１〜図３）", { align: "left" });

// ── 1. 特許願 ────────────────────────────────────────
pageBreak();
renderMarkdown(path.join(dir, "01_特許願.md"));

// ── 2. 明細書 ────────────────────────────────────────
pageBreak();
renderMarkdown(path.join(dir, "02_明細書.md"));

// ── 3. 特許請求の範囲 ────────────────────────────────
pageBreak();
renderMarkdown(path.join(dir, "03_特許請求の範囲.md"));

// ── 4. 要約書 ────────────────────────────────────────
pageBreak();
renderMarkdown(path.join(dir, "04_要約書.md"));

// ── 5. 図面 ──────────────────────────────────────────
const figures = [
  { file: "図1_システム全体構成図.png", title: "【図１】 システム全体構成図" },
  { file: "図2_処理フロー図.png", title: "【図２】 処理フロー図" },
  { file: "図3_データ構造図.png", title: "【図３】 データ構造図" },
];

for (const fig of figures) {
  pageBreak();
  const imgPath = path.join(dir, "word", fig.file);
  if (fs.existsSync(imgPath)) {
    title(fig.title, 14);
    gap();
    const maxW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const maxH = doc.page.height - doc.y - doc.page.margins.bottom - 20;
    doc.image(imgPath, {
      fit: [maxW, maxH],
      align: "center",
    });
  } else {
    title(fig.title, 14);
    body("（図面ファイルが見つかりません: " + fig.file + "）");
  }
}

// ── Finalize ─────────────────────────────────────────
doc.end();

stream.on("finish", () => {
  const stats = fs.statSync(outPath);
  console.log(`✓ PDF生成完了: ${outPath}`);
  console.log(`  サイズ: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
});
