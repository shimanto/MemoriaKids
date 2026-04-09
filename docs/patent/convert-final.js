// 最終版のWord/PDF生成スクリプト
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, convertInchesToTwip,
} = require("docx");
const PDFDocument = require("pdfkit");

const FINAL_DIR = path.join(__dirname, "final");
const OUT_DIR = path.join(__dirname, "word", "final");
const FIG_DIR = path.join(__dirname, "word", "final");

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ── DOCX生成 ─────────────────────────────────────────

function p(text, opts = {}) {
  const runs = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, font: "游明朝", size: 22 }));
    } else {
      runs.push(new TextRun({ text: part, font: "游明朝", size: 22, ...opts }));
    }
  }
  return new Paragraph({ children: runs, spacing: { after: 120, line: 360 } });
}

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 240, after: 120 },
  });
}

function emptyLine() {
  return new Paragraph({ text: "", spacing: { after: 120 } });
}

function mdToParagraphs(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const paragraphs = [];

  for (const line of lines) {
    const trimmed = line.trimEnd();

    if (trimmed === "---") continue;
    if (trimmed.startsWith("```")) continue;

    if (trimmed.startsWith("# ")) {
      paragraphs.push(heading(trimmed.replace(/^#+\s*/, ""), HeadingLevel.HEADING_1));
    } else if (trimmed.startsWith("## ")) {
      paragraphs.push(heading(trimmed.replace(/^#+\s*/, ""), HeadingLevel.HEADING_2));
    } else if (trimmed.startsWith("### ")) {
      paragraphs.push(heading(trimmed.replace(/^#+\s*/, ""), HeadingLevel.HEADING_3));
    } else if (trimmed === "") {
      paragraphs.push(emptyLine());
    } else if (trimmed.startsWith("| ") && trimmed.includes("---")) {
      continue;
    } else if (trimmed.startsWith("| ")) {
      const cells = trimmed.split("|").filter(c => c.trim()).map(c => c.trim());
      paragraphs.push(p("　" + cells.join("　｜　")));
    } else {
      let text = trimmed;
      if (text.startsWith("- ")) text = "・" + text.slice(2);
      if (/^\d+\.\s/.test(text)) text = text.replace(/^(\d+)\.\s/, "$1．");
      paragraphs.push(p(text));
    }
  }

  return paragraphs;
}

async function buildDocx(srcFile, outFile) {
  const children = mdToParagraphs(srcFile);
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "游明朝", size: 22 },
          paragraph: { spacing: { line: 360 } },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1.18),
            bottom: convertInchesToTwip(1.18),
            left: convertInchesToTwip(1.18),
            right: convertInchesToTwip(1.18),
          },
        },
      },
      children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outFile, buffer);
}

// ── PDF結合 ─────────────────────────────────────────

async function buildCombinedPdf() {
  const FONT_NOTO = "C:/Windows/Fonts/NotoSansJP-VF.ttf";
  const outPath = path.join(OUT_DIR, "特許出願書類一式_最終版_MK-PAT-2026-001.pdf");

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 85, bottom: 85, left: 85, right: 85 },
    info: {
      Title: "特許出願書類一式（最終版）MK-PAT-2026-001",
      Author: "宮田 浩伸",
      Subject: "発達マイルストーン推定及び情報開示制御を行う音声解析型保育支援システム",
    },
  });

  doc.registerFont("Mincho", FONT_NOTO);
  doc.registerFont("Gothic", FONT_NOTO);
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  function ensureSpace(needed) {
    if (doc.y + needed > doc.page.height - doc.page.margins.bottom) doc.addPage();
  }
  function title(text, size = 16) {
    ensureSpace(40);
    doc.font("Gothic").fontSize(size).text(text, { lineGap: 6 });
    doc.moveDown(0.5);
  }
  function heading2(text) {
    ensureSpace(30);
    doc.moveDown(0.3);
    doc.font("Gothic").fontSize(13).text(text, { lineGap: 4 });
    doc.moveDown(0.3);
  }
  function heading3(text) {
    ensureSpace(25);
    doc.moveDown(0.2);
    doc.font("Gothic").fontSize(11).text(text, { lineGap: 4 });
    doc.moveDown(0.2);
  }
  function body(text) {
    ensureSpace(20);
    doc.font("Mincho").fontSize(10.5).text(text, { lineGap: 5 });
  }
  function bodyBold(text) {
    ensureSpace(20);
    doc.font("Gothic").fontSize(10.5).text(text, { lineGap: 5 });
  }
  function gap() { doc.moveDown(0.3); }
  function pageBreak() { doc.addPage(); }
  function separator() {
    doc.moveDown(0.3);
    const x = doc.page.margins.left;
    const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    doc.moveTo(x, doc.y).lineTo(x + w, doc.y).stroke("#cccccc");
    doc.moveDown(0.5);
  }

  function renderMd(filePath) {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    for (const line of lines) {
      const trimmed = line.trimEnd();
      if (trimmed === "---") { separator(); continue; }
      if (trimmed.startsWith("```")) continue;

      if (trimmed.startsWith("# ")) {
        title(trimmed.replace(/^#+\s*/, ""));
      } else if (trimmed.startsWith("## ")) {
        heading2(trimmed.replace(/^#+\s*/, ""));
      } else if (trimmed.startsWith("### ")) {
        heading3(trimmed.replace(/^#+\s*/, ""));
      } else if (trimmed === "") {
        gap();
      } else if (trimmed.startsWith("| ") && trimmed.includes("---")) {
        continue;
      } else if (trimmed.startsWith("| ")) {
        const cells = trimmed.split("|").filter(c => c.trim()).map(c => c.trim());
        body("  " + cells.join("　|　"));
      } else {
        let text = trimmed;
        text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
        if (text.startsWith("- ")) text = "・" + text.slice(2);
        if (line.startsWith("**")) bodyBold(text);
        else body(text);
      }
    }
  }

  // ── 表紙 ─────────────────────────────────────
  doc.moveDown(6);
  doc.font("Gothic").fontSize(22).text("特許出願書類一式", { align: "center" });
  doc.moveDown(0.5);
  doc.font("Gothic").fontSize(16).text("（社内レビュー反映 最終版）", { align: "center" });
  doc.moveDown(1);
  doc.font("Gothic").fontSize(14).text("整理番号: MK-PAT-2026-001", { align: "center" });
  doc.moveDown(2);
  doc.font("Gothic").fontSize(15).text(
    "発達マイルストーン推定及び\n情報開示制御を行う\n音声解析型保育支援システム",
    { align: "center", lineGap: 8 }
  );
  doc.moveDown(3);
  doc.font("Mincho").fontSize(12).text("出願人: 宮田 浩伸", { align: "center" });
  doc.moveDown(0.5);
  doc.font("Mincho").fontSize(12).text("令和8年4月", { align: "center" });
  doc.moveDown(2);
  doc.font("Mincho").fontSize(10).text("目次:", { align: "left" });
  doc.moveDown(0.3);
  ["  1. 特許願", "  2. 明細書", "  3. 特許請求の範囲", "  4. 要約書", "  5. 図面（図１〜図３）"].forEach(t =>
    doc.font("Mincho").fontSize(10).text(t, { align: "left" })
  );

  // ── 本文 ─────────────────────────────────────
  for (const file of ["01_特許願.md", "02_明細書.md", "03_特許請求の範囲.md", "04_要約書.md"]) {
    pageBreak();
    renderMd(path.join(FINAL_DIR, file));
  }

  // ── 図面 ─────────────────────────────────────
  const figures = [
    { file: "図1_システム全体構成図.png", title: "【図１】 システム全体構成図" },
    { file: "図2_処理フロー図.png", title: "【図２】 処理フロー図" },
    { file: "図3_データ構造図.png", title: "【図３】 データ構造図" },
  ];

  for (const fig of figures) {
    pageBreak();
    const imgPath = path.join(FIG_DIR, fig.file);
    if (fs.existsSync(imgPath)) {
      title(fig.title, 14);
      gap();
      const maxW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const maxH = doc.page.height - doc.y - doc.page.margins.bottom - 20;
      doc.image(imgPath, { fit: [maxW, maxH], align: "center" });
    }
  }

  doc.end();
  await new Promise(resolve => stream.on("finish", resolve));
  const stats = fs.statSync(outPath);
  console.log(`✓ PDF: ${path.basename(outPath)} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
}

// ── Main ─────────────────────────────────────────────

async function main() {
  const docFiles = [
    { src: "01_特許願.md", out: "01_特許願.docx" },
    { src: "02_明細書.md", out: "02_明細書.docx" },
    { src: "03_特許請求の範囲.md", out: "03_特許請求の範囲.docx" },
    { src: "04_要約書.md", out: "04_要約書.docx" },
  ];

  for (const f of docFiles) {
    await buildDocx(path.join(FINAL_DIR, f.src), path.join(OUT_DIR, f.out));
    console.log(`✓ DOCX: ${f.out}`);
  }

  await buildCombinedPdf();
  console.log(`\n出力先: ${OUT_DIR}`);
}

main().catch(console.error);
