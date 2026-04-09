// 図面をモノクロ2値（1bit Grayscale, Floyd-Steinberg ディザ）に変換
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SRC_DIR = path.join(__dirname, "word", "a4portrait");
const OUT_DIR = path.join(__dirname, "word", "a4portrait_mono");

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const files = fs.readdirSync(SRC_DIR).filter(f => f.endsWith(".png"));

(async () => {
  for (const f of files) {
    const src = path.join(SRC_DIR, f);
    const dst = path.join(OUT_DIR, f);

    // Sharp で:
    // 1. グレースケール化
    // 2. 閾値化（threshold）でモノクロ2値に
    // 3. PNGとして1bit保存
    await sharp(src)
      .grayscale()
      .threshold(180)
      .png({ palette: true, colours: 2, compressionLevel: 9 })
      .toFile(dst);

    // メタデータ確認
    const meta = await sharp(dst).metadata();
    const buf = fs.readFileSync(dst);
    const bitDepth = buf.readUInt8(24);
    const colorType = buf.readUInt8(25);
    const colorTypeName = {0:'Grayscale',2:'RGB',3:'Indexed',4:'GrayAlpha',6:'RGBA'}[colorType] || '?';
    console.log(`✓ ${f}: ${meta.width}x${meta.height} bitDepth=${bitDepth} colorType=${colorTypeName}`);
  }
  console.log(`\n出力先: ${OUT_DIR}`);
})();
