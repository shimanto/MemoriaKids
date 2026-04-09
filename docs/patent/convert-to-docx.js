const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, PageBreak, SectionType,
  convertInchesToTwip,
} = require("docx");

// ── Utility ─────────────────────────────────────────────

function p(text, opts = {}) {
  const runs = [];
  // Simple bold/plain parsing: **text** → bold
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
    font: "游ゴシック",
  });
}

function emptyLine() {
  return new Paragraph({ text: "", spacing: { after: 120 } });
}

// ── 1. 特許願 ───────────────────────────────────────────

function buildTokkyogan() {
  return [
    heading("【書類名】 特許願", HeadingLevel.HEADING_1),
    emptyLine(),
    p("【整理番号】 MK-PAT-2026-001"),
    p("【提出日】 令和8年4月　日"),
    p("【あて先】 特許庁長官 殿"),
    emptyLine(),

    heading("【発明者】", HeadingLevel.HEADING_2),
    p("【氏名】 宮田 浩伸（ミヤタ ヒロノブ）"),
    p("【住所又は居所】 東京都港区六本木五丁目11番20号404号室"),
    emptyLine(),

    heading("【特許出願人】", HeadingLevel.HEADING_2),
    p("【氏名又は名称】 宮田 浩伸"),
    p("【住所又は居所】 東京都港区六本木五丁目11番20号404号室"),
    p("【電話番号】 090-6549-9359"),
    emptyLine(),

    heading("【発明の名称】", HeadingLevel.HEADING_2),
    p("児童保育支援システムにおける音声解析及び発達マイルストーン自動フィルタリング装置"),
    emptyLine(),

    heading("【手数料の表示】", HeadingLevel.HEADING_2),
    p("【予納台帳番号】 （電子出願ソフトで設定）"),
    p("【納付金額】 14,000円"),
    emptyLine(),

    heading("【提出物件の目録】", HeadingLevel.HEADING_2),
    p("1. 明細書"),
    p("2. 特許請求の範囲"),
    p("3. 要約書"),
    p("4. 図面"),
  ];
}

// ── Helper: read markdown and convert to paragraphs ──────

function mdToParagraphs(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const paragraphs = [];

  for (const line of lines) {
    const trimmed = line.trimEnd();

    // Skip markdown-only artifacts
    if (trimmed === "---" || trimmed === "```" || trimmed.startsWith("```")) continue;
    if (trimmed.startsWith("> **【出願戦略")) continue;
    if (trimmed.startsWith("> ※")) continue;
    if (trimmed.startsWith("## 【出願戦略メモ】")) {
      // Stop processing — strategy memo is internal only
      break;
    }

    // Headings
    if (trimmed.startsWith("# ")) {
      paragraphs.push(heading(trimmed.replace(/^#+\s*/, ""), HeadingLevel.HEADING_1));
    } else if (trimmed.startsWith("## ")) {
      paragraphs.push(heading(trimmed.replace(/^#+\s*/, ""), HeadingLevel.HEADING_2));
    } else if (trimmed.startsWith("### ")) {
      paragraphs.push(heading(trimmed.replace(/^#+\s*/, ""), HeadingLevel.HEADING_3));
    } else if (trimmed === "") {
      paragraphs.push(emptyLine());
    } else if (trimmed.startsWith("| ") && trimmed.includes("---")) {
      // Skip table separator rows
      continue;
    } else if (trimmed.startsWith("| ")) {
      // Table row → plain text with spacing
      const cells = trimmed.split("|").filter(c => c.trim()).map(c => c.trim());
      paragraphs.push(p("　" + cells.join("　｜　")));
    } else {
      // Regular paragraph — strip leading list markers
      let text = trimmed;
      if (text.startsWith("- ")) text = "・" + text.slice(2);
      if (/^\d+\.\s/.test(text)) text = text.replace(/^(\d+)\.\s/, "$1．");
      paragraphs.push(p(text));
    }
  }

  return paragraphs;
}

// ── Main ─────────────────────────────────────────────────

async function main() {
  const dir = __dirname;
  const outDir = path.join(dir, "word");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const files = [
    { src: null, name: "01_特許願.docx", builder: buildTokkyogan },
    { src: "02_明細書.md", name: "02_明細書.docx" },
    { src: "03_特許請求の範囲.md", name: "03_特許請求の範囲.docx" },
    { src: "04_要約書.md", name: "04_要約書.docx" },
  ];

  for (const file of files) {
    let children;
    if (file.builder) {
      children = file.builder();
    } else {
      children = mdToParagraphs(path.join(dir, file.src));
    }

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
              top: convertInchesToTwip(1.18),    // 30mm
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
    const outPath = path.join(outDir, file.name);
    fs.writeFileSync(outPath, buffer);
    console.log(`✓ ${file.name}`);
  }

  console.log(`\n出力先: ${outDir}`);
}

main().catch(console.error);
