// 最終版のWord/PDF生成スクリプト
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, convertInchesToTwip,
} = require("docx");
const PDFDocument = require("pdfkit");

const FINAL_DIR = path.join(__dirname, "final");
const OUT_DIR = path.join(__dirname, "word", "final");
const FIG_DIR = path.join(__dirname, "word", "a4portrait_v3_mono");

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Markdownブロック解析 ─────────────────────────────

function isTableSeparator(line) {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

function isTableRow(line) {
  return line.trim().startsWith("|");
}

function parseTableCells(line) {
  return line.trim().split("|").slice(1, -1).map(c => c.trim());
}

/**
 * Markdownを「ブロック」配列に変換する。
 * ブロック種別: heading1, heading2, heading3, table, paragraph, hr, empty
 */
function parseBlocks(content) {
  const lines = content.split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimEnd();

    if (trimmed === "---") {
      blocks.push({ type: "hr" });
      i++;
    } else if (trimmed.startsWith("```")) {
      // skip code fence
      i++;
      while (i < lines.length && !lines[i].trimEnd().startsWith("```")) i++;
      i++;
    } else if (trimmed.startsWith("# ")) {
      blocks.push({ type: "heading1", text: trimmed.replace(/^#+\s*/, "") });
      i++;
    } else if (trimmed.startsWith("## ")) {
      blocks.push({ type: "heading2", text: trimmed.replace(/^#+\s*/, "") });
      i++;
    } else if (trimmed.startsWith("### ")) {
      blocks.push({ type: "heading3", text: trimmed.replace(/^#+\s*/, "") });
      i++;
    } else if (trimmed === "") {
      blocks.push({ type: "empty" });
      i++;
    } else if (isTableRow(trimmed)) {
      // テーブルブロック検出
      const headerCells = parseTableCells(trimmed);
      i++;
      // 次が区切り行ならテーブル、そうでなければ単一行として扱う
      if (i < lines.length && isTableSeparator(lines[i])) {
        i++; // skip separator
        const rows = [];
        while (i < lines.length && isTableRow(lines[i].trimEnd())) {
          if (!isTableSeparator(lines[i])) {
            rows.push(parseTableCells(lines[i].trimEnd()));
          }
          i++;
        }
        blocks.push({ type: "table", header: headerCells, rows });
      } else {
        // 区切り行がない単独の行 → テーブルとして扱わず段落に
        blocks.push({ type: "paragraph", text: trimmed });
      }
    } else {
      blocks.push({ type: "paragraph", text: trimmed });
      i++;
    }
  }

  return blocks;
}

// ── DOCX ─────────────────────────────────────────────

function makeTextRuns(text) {
  const runs = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, font: "游明朝", size: 22 }));
    } else if (part) {
      runs.push(new TextRun({ text: part, font: "游明朝", size: 22 }));
    }
  }
  return runs;
}

function makeParagraph(text) {
  return new Paragraph({ children: makeTextRuns(text), spacing: { after: 120, line: 360 } });
}

function makeHeading(text, level) {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 240, after: 120 },
  });
}

function makeEmptyParagraph() {
  return new Paragraph({ text: "", spacing: { after: 120 } });
}

function makeDocxTable(header, rows) {
  const borderStyle = {
    top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
    left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
    right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  };

  const headerRow = new TableRow({
    tableHeader: true,
    children: header.map(text => new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text, bold: true, font: "游明朝", size: 22 })],
      })],
      shading: { fill: "EEEEEE" },
      borders: borderStyle,
    })),
  });

  const dataRows = rows.map(cells => new TableRow({
    children: cells.map(text => new TableCell({
      children: [new Paragraph({ children: makeTextRuns(text) })],
      borders: borderStyle,
    })),
  }));

  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

function blocksToDocxChildren(blocks) {
  const children = [];
  for (const b of blocks) {
    if (b.type === "heading1") children.push(makeHeading(b.text, HeadingLevel.HEADING_1));
    else if (b.type === "heading2") children.push(makeHeading(b.text, HeadingLevel.HEADING_2));
    else if (b.type === "heading3") children.push(makeHeading(b.text, HeadingLevel.HEADING_3));
    else if (b.type === "empty") children.push(makeEmptyParagraph());
    else if (b.type === "hr") children.push(makeEmptyParagraph()); // 区切り線は空段落に
    else if (b.type === "table") {
      children.push(makeDocxTable(b.header, b.rows));
      children.push(makeEmptyParagraph());
    } else if (b.type === "paragraph") {
      let text = b.text;
      if (text.startsWith("- ")) text = "・" + text.slice(2);
      if (/^\d+\.\s/.test(text)) text = text.replace(/^(\d+)\.\s/, "$1．");
      children.push(makeParagraph(text));
    }
  }
  return children;
}

async function buildDocx(srcFile, outFile) {
  const content = fs.readFileSync(srcFile, "utf-8");
  const blocks = parseBlocks(content);
  const children = blocksToDocxChildren(blocks);

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

// ── PDF ──────────────────────────────────────────────

async function buildCombinedPdf() {
  const FONT_NOTO = "C:/Windows/Fonts/NotoSansJP-VF.ttf";
  const outPath = path.join(OUT_DIR, "特許出願書類一式_最終版_MK26001.pdf");

  // 特許庁仕様: PDFタイトルプロパティを設定しない
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 85, bottom: 85, left: 85, right: 85 },
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
    const cleanText = text.replace(/\*\*([^*]+)\*\*/g, "$1");
    doc.font("Mincho").fontSize(10.5).text(cleanText, { lineGap: 5 });
  }
  function bodyBold(text) {
    ensureSpace(20);
    const cleanText = text.replace(/\*\*([^*]+)\*\*/g, "$1");
    doc.font("Gothic").fontSize(10.5).text(cleanText, { lineGap: 5 });
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

  function drawTable(header, rows) {
    const fontSize = 10;
    const padding = 6;
    const lineHeight = 14;
    const colCount = header.length;
    const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = tableWidth / colCount;

    function drawRow(cells, isHeader) {
      doc.font(isHeader ? "Gothic" : "Mincho").fontSize(fontSize);

      // 各セルの行数を計算
      const cellLines = cells.map((text, ci) => {
        const cleanText = text.replace(/\*\*([^*]+)\*\*/g, "$1");
        const opts = { width: colWidth - 2 * padding, lineGap: 2 };
        const h = doc.heightOfString(cleanText, opts);
        return { text: cleanText, height: h };
      });
      const rowHeight = Math.max(...cellLines.map(c => c.height)) + 2 * padding;

      // 改ページが必要か
      if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
      }

      const startY = doc.y;
      const startX = doc.page.margins.left;

      // 背景（ヘッダーのみ薄グレー）
      if (isHeader) {
        doc.rect(startX, startY, tableWidth, rowHeight).fillAndStroke("#EEEEEE", "#000000");
      } else {
        doc.rect(startX, startY, tableWidth, rowHeight).stroke("#000000");
      }

      // 各セルの縦線
      for (let ci = 1; ci < colCount; ci++) {
        const x = startX + colWidth * ci;
        doc.moveTo(x, startY).lineTo(x, startY + rowHeight).stroke("#000000");
      }

      // テキスト
      doc.fillColor("#000000").font(isHeader ? "Gothic" : "Mincho").fontSize(fontSize);
      for (let ci = 0; ci < colCount; ci++) {
        const x = startX + colWidth * ci + padding;
        const y = startY + padding;
        doc.text(cellLines[ci].text, x, y, {
          width: colWidth - 2 * padding,
          lineGap: 2,
        });
      }

      doc.y = startY + rowHeight;
    }

    drawRow(header, true);
    for (const row of rows) drawRow(row, false);
    doc.moveDown(0.5);
  }

  function renderMd(filePath) {
    const content = fs.readFileSync(filePath, "utf-8");
    const blocks = parseBlocks(content);

    for (const b of blocks) {
      if (b.type === "heading1") title(b.text);
      else if (b.type === "heading2") heading2(b.text);
      else if (b.type === "heading3") heading3(b.text);
      else if (b.type === "empty") gap();
      else if (b.type === "hr") separator();
      else if (b.type === "table") drawTable(b.header, b.rows);
      else if (b.type === "paragraph") {
        let text = b.text;
        if (text.startsWith("- ")) text = "・" + text.slice(2);
        if (text.startsWith("**")) bodyBold(text);
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
