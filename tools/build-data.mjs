import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.join(__dirname, "..", "js", "kana-data.js");

const ROWS = [
  { id: "a", label: "あ / ア", hira: "あいうえお", kata: "アイウエオ", romaji: ["a", "i", "u", "e", "o"] },
  { id: "ka", label: "か / カ", hira: "かきくけこ", kata: "カキクケコ", romaji: ["ka", "ki", "ku", "ke", "ko"] },
  { id: "sa", label: "さ / サ", hira: "さしすせそ", kata: "サシスセソ", romaji: ["sa", "shi", "su", "se", "so"] },
  { id: "ta", label: "た / タ", hira: "たちつてと", kata: "タチツテト", romaji: ["ta", "chi", "tsu", "te", "to"] },
  { id: "na", label: "な / ナ", hira: "なにぬねの", kata: "ナニヌネノ", romaji: ["na", "ni", "nu", "ne", "no"] },
  { id: "ha", label: "は / ハ", hira: "はひふへほ", kata: "ハヒフヘホ", romaji: ["ha", "hi", "fu", "he", "ho"] },
  { id: "ma", label: "ま / マ", hira: "まみむめも", kata: "マミムメモ", romaji: ["ma", "mi", "mu", "me", "mo"] },
  { id: "ya", label: "や / ヤ", hira: "やゆよ", kata: "ヤユヨ", romaji: ["ya", "yu", "yo"] },
  { id: "ra", label: "ら / ラ", hira: "らりるれろ", kata: "ラリルレロ", romaji: ["ra", "ri", "ru", "re", "ro"] },
  { id: "wa", label: "わ / ワ", hira: "わをん", kata: "ワヲン", romaji: ["wa", "wo", "n"] },
];

function kvgName(ch) {
  return ch.charCodeAt(0).toString(16).padStart(5, "0");
}

function extractPaths(svg) {
  const paths = [];
  const re = /<path\b[^>]*\sid="[^"]*-s\d+"[^>]*\sd="([^"]+)"/g;
  let m;
  while ((m = re.exec(svg))) paths.push(m[1]);
  if (paths.length === 0) {
    const fallback = /<path\b[^>]*\sd="([^"]+)"/g;
    while ((m = fallback.exec(svg))) {
      if (!m[0].includes("StrokeNumbers")) paths.push(m[1]);
    }
  }
  return paths;
}

async function fetchSvg(ch) {
  const name = kvgName(ch);
  const url = `https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@master/kanji/${name}.svg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${ch} ${name}: HTTP ${res.status}`);
  return extractPaths(await res.text());
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return out;
}

const chars = [];
for (const row of ROWS) {
  for (let i = 0; i < row.hira.length; i++) {
    chars.push({
      char: row.hira[i],
      romaji: row.romaji[i],
      script: "hiragana",
      row: row.id,
    });
    chars.push({
      char: row.kata[i],
      romaji: row.romaji[i],
      script: "katakana",
      row: row.id,
    });
  }
}

const unique = [...new Map(chars.map((c) => [c.char, c])).values()];
console.log(`Fetching ${unique.length} KanjiVG glyphs...`);

await mapPool(unique, 6, async (entry) => {
  entry.strokes = await fetchSvg(entry.char);
  if (!entry.strokes.length) throw new Error(`No strokes for ${entry.char}`);
  console.log(`  ${entry.char} ${entry.strokes.length} strokes`);
  return entry;
});

const byChar = Object.fromEntries(unique.map((c) => [c.char, c]));
const KANJI = [
  { char: "一", romaji: "ichi", meaning: "one" },
  { char: "二", romaji: "ni", meaning: "two" },
  { char: "三", romaji: "san", meaning: "three" },
  { char: "人", romaji: "hito", meaning: "person" },
  { char: "力", romaji: "chikara", meaning: "power" },
  { char: "口", romaji: "kuchi", meaning: "mouth" },
  { char: "山", romaji: "yama", meaning: "mountain" },
  { char: "川", romaji: "kawa", meaning: "river" },
  { char: "土", romaji: "tsuchi", meaning: "earth" },
  { char: "大", romaji: "dai", meaning: "big" },
  { char: "小", romaji: "shou", meaning: "small" },
  { char: "中", romaji: "naka", meaning: "middle" },
  { char: "日", romaji: "hi", meaning: "sun" },
  { char: "月", romaji: "tsuki", meaning: "moon" },
  { char: "木", romaji: "ki", meaning: "tree" },
  { char: "田", romaji: "ta", meaning: "field" },
  { char: "水", romaji: "mizu", meaning: "water" },
  { char: "火", romaji: "hi", meaning: "fire" },
  { char: "金", romaji: "kin", meaning: "gold" },
  { char: "雨", romaji: "ame", meaning: "rain" },
];

const kanjiEntries = KANJI.map((k) => ({ ...k, script: "kanji", row: "kanji" }));
console.log(`Fetching ${kanjiEntries.length} kanji...`);
await mapPool(kanjiEntries, 6, async (entry) => {
  entry.strokes = await fetchSvg(entry.char);
  if (!entry.strokes.length)
    throw new Error(`No strokes for ${entry.char}`);
  console.log(`  ${entry.char} ${entry.strokes.length} strokes`);
  return entry;
});

const data = {
  viewBox: 109,
  attribution: "Stroke paths from KanjiVG (http://kanjivg.tagaini.net), CC BY-SA 3.0",
  rows: ROWS.map((r) => ({ id: r.id, label: r.label })),
  kana: chars.map((c) => ({
    char: c.char,
    romaji: c.romaji,
    script: c.script,
    row: c.row,
    strokes: byChar[c.char].strokes,
  })),
  kanji: kanjiEntries.map((k) => ({
    char: k.char,
    romaji: k.romaji,
    meaning: k.meaning,
    script: "kanji",
    row: "kanji",
    strokes: k.strokes,
  })),
};

const js = `/* Stroke paths from KanjiVG (http://kanjivg.tagaini.net), CC BY-SA 3.0 */\nexport const KANA_DATA = ${JSON.stringify(data, null, 2)};\n`;
fs.writeFileSync(outFile, js, "utf8");
console.log(`Wrote ${outFile}`);
