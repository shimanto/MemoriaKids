// Gemini 2.5 Flash Image (Nano Banana) で社内説明用イラストを生成
const fs = require("fs");
const path = require("path");

const API_KEY = "AIzaSyAtVgUXJQAF6b1sflGFZ9HtQL-ruVrVjn4";
const MODEL = "gemini-2.5-flash-image";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

const OUT_DIR = path.join(__dirname, "word", "nanobanana");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const figures = [
  {
    name: "図1_システム全体構成図",
    prompt: `A4縦向きの技術系図解イラスト。タイトルは「音声解析型保育支援システム 全体構成」。
シンプルでフラットなビジネスイラスト調。色は白背景に紺色（#1f3a5f）と薄いグレーのみ使用。
左上に保育士がタブレットで音声録音しているアイコン。
中央に縦に並んだ7つの機能ブロック（上から順に）：
1. 音声認識（マイクアイコン）
2. 対象者別抽出（人物グループアイコン）
3. 発達イベント検出（虫眼鏡アイコン）
4. 初回性推定（時計と矢印アイコン、★マークで強調）
5. 開示制御（信号機の青/赤/黄アイコン、★マークで強調）
6. 文書生成（書類アイコン）
7. 学習更新（循環矢印アイコン）
右側にAIサーバとデータベースのアイコン。
全体に矢印で処理の流れを示す。
日本語テキストは入れず、アイコンと英語ラベルのみ（Voice / Extract / Detect / Score / Filter / Generate / Learn）。
A4 portrait, technical infographic style, minimal flat design.`,
  },
  {
    name: "図2_処理フロー図",
    prompt: `A4縦向きの処理フローチャート風イラスト。タイトルは「Processing Pipeline」。
シンプルなフラットデザイン、紺色（#1f3a5f）と白とグレーのみ。
縦方向のフローチャート、8つのステップを丸角四角で表示：
S1: Voice Input (microphone icon)
S2: Speech-to-Text (waveform icon)
S3: Per-Child Extract (people icon)
S4: Event Detection (magnifier icon)
S5: Initiality Estimation★ (clock + arrow icon, highlighted)
S6: Disclosure Control★ (traffic light icon, highlighted)
       → Display / Hide / Hold (3-way branch)
S7: Document Generation (document icon)
S8: Learning Update★ (circular arrow icon, highlighted)
右側に学習フィードバックループの破線矢印。
矢印で各ステップを接続。
A4 portrait, clean infographic, no Japanese text, minimal flat design.`,
  },
  {
    name: "図3_データ構造図",
    prompt: `A4縦向きのデータベーススキーマ図。タイトルは「Data Schema」。
ER図風のフラットデザイン、紺色（#1f3a5f）の枠線、白背景。
6つのテーブルを2列×3段で配置：
左上: Children (id, name, nursery_id)
右上: Audio Recordings (id, file, status)
左中: Care Notes (id, child_id, category, content)
右中: Audio Transcripts (id, transcript, extracts)
右下: Past Reports (id, content, embedding★)
下段全幅: ★Contact Book Entries (中核テーブル, 太線枠)
  - initialityScore★
  - disclosureScore★
  - disclosureDecision★ (display/hide/hold)
  - excludedItems★ (JSON)
矢印で1:N、1:1のリレーションを示す。
A4 portrait, ER diagram, English labels only, flat technical illustration.`,
  },
];

async function generateImage(figure) {
  console.log(`生成中: ${figure.name}...`);
  const body = {
    contents: [{
      parts: [{ text: figure.prompt }],
    }],
    generationConfig: {
      responseModalities: ["IMAGE"],
    },
  };

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  let saved = false;
  for (const part of parts) {
    if (part.inlineData?.data) {
      const buffer = Buffer.from(part.inlineData.data, "base64");
      const outPath = path.join(OUT_DIR, `${figure.name}.png`);
      fs.writeFileSync(outPath, buffer);
      const stats = fs.statSync(outPath);
      console.log(`  ✓ ${figure.name}.png (${(stats.size / 1024).toFixed(0)} KB)`);
      saved = true;
      break;
    }
  }
  if (!saved) {
    console.log(`  ✗ 画像データなし: ${JSON.stringify(data).slice(0, 200)}`);
  }
}

async function main() {
  for (const fig of figures) {
    try {
      await generateImage(fig);
    } catch (err) {
      console.error(`エラー (${fig.name}): ${err.message}`);
    }
  }
  console.log(`\n出力先: ${OUT_DIR}`);
}

main();
