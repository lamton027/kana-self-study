import { KANA_DATA } from "./kana-data.js";
import { matchStroke } from "./stroke-matcher.js";

const LESSON_HITS = 4;
const KV = KANA_DATA.viewBox;
const STORAGE_KEY = "kana-self-study-v1";

const pad = document.getElementById("pad");
const yokai = document.getElementById("yokai");
const ctx = pad.getContext("2d");
const yx = yokai.getContext("2d");
const probePath = document.getElementById("probe-path");
const rowsEl = document.getElementById("rows");
const glyphEl = document.getElementById("glyph");
const romajiEl = document.getElementById("romaji");
const strokeStat = document.getElementById("stroke-stat");
const hitStat = document.getElementById("hit-stat");
const hitLabel = document.getElementById("hit-label");
const statusEl = document.getElementById("status");
const hintEl = document.getElementById("hint");

const state = {
  script: "hiragana",
  rowId: "a",
  mode: "lesson",
  index: 0,
  hits: 0,
  stroke: 0,
  ink: [],
  done: [],
  drawing: false,
  templates: [],
  bossQueue: [],
  cleared: loadProgress(),
};

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { hiragana: [], katakana: [] };
  } catch {
    return { hiragana: [], katakana: [] };
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cleared));
}

function rowKana() {
  return KANA_DATA.kana.filter((k) => k.script === state.script && k.row === state.rowId);
}

function currentKana() {
  if (state.mode === "boss")
    return state.bossQueue[state.index];
  return rowKana()[state.index];
}

function samplePath(d, count = 48) {
  probePath.setAttribute("d", d);
  const length = probePath.getTotalLength();
  const points = [];
  for (let i = 0; i <= count; i++) {
    const p = probePath.getPointAtLength(length * (i / count));
    points.push({ x: p.x, y: p.y });
  }
  return points;
}

function loadTemplates(kana) {
  state.templates = kana.strokes.map((d) => samplePath(d));
}

function speak(text) {
  if (!window.speechSynthesis)
    return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  utterance.rate = 0.85;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

function setStatus(text, kind = "") {
  statusEl.textContent = text;
  statusEl.className = `status ${kind}`;
}

function pointerToKvg(event) {
  const rect = pad.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * KV,
    y: ((event.clientY - rect.top) / rect.height) * KV,
  };
}

function strokeStyle(color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function drawPath(points, color, width) {
  if (points.length < 2)
    return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++)
    ctx.lineTo(points[i].x, points[i].y);
  strokeStyle(color, width);
  ctx.stroke();
}

function drawSvgStroke(d, color, width) {
  const points = samplePath(d, 64);
  drawPath(points, color, width);
}

function drawPad() {
  const kana = currentKana();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, pad.width, pad.height);
  ctx.fillStyle = "#f4efe4";
  ctx.fillRect(0, 0, pad.width, pad.height);
  const scale = pad.width / KV;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  if (!kana)
    return;

  if (state.mode === "lesson") {
    kana.strokes.forEach((d, i) => {
      if (i < state.stroke)
        drawSvgStroke(d, "#9aa3b5", 3.2);
      else if (i === state.stroke)
        drawSvgStroke(d, "#c9a227", 3.6);
      else
        drawSvgStroke(d, "#d9d1c2", 2.4);
    });

    const start = state.templates[state.stroke]?.[0];
    if (start) {
      ctx.beginPath();
      ctx.arc(start.x, start.y, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = "#c45c26";
      ctx.fill();
      ctx.fillStyle = "#c45c26";
      ctx.font = "8px sans-serif";
      ctx.fillText(String(state.stroke + 1), start.x + 4, start.y - 3);
    }
  }

  for (const stroke of state.done)
    drawPath(stroke, "#2a3348", 4.2);
  drawPath(state.ink, "#2c6bed", 4.2);
}

function drawYokai() {
  const max = state.mode === "boss" ? Math.max(rowKana().length, 1) : LESSON_HITS;
  const hp = Math.max(max - state.hits, 0);
  const hurt = 1 - hp / max;
  yx.clearRect(0, 0, yokai.width, yokai.height);
  const x = 80;
  const y = 78;
  yx.fillStyle = `hsl(${95 - hurt * 85} 62% ${52 - hurt * 12}%)`;
  yx.beginPath();
  yx.ellipse(x, y, 46, 52 - hurt * 10, 0, 0, Math.PI * 2);
  yx.fill();
  yx.fillStyle = "#1a1d24";
  yx.beginPath();
  yx.arc(x - 14, y - 10, 5, 0, Math.PI * 2);
  yx.arc(x + 14, y - 10, 5, 0, Math.PI * 2);
  yx.fill();
  yx.strokeStyle = "#1a1d24";
  yx.lineWidth = 3;
  yx.beginPath();
  yx.arc(x, y + 10, 12, 0.15 * Math.PI, 0.85 * Math.PI);
  yx.stroke();
  yx.fillStyle = "#e8e4d9";
  yx.font = "12px sans-serif";
  yx.textAlign = "center";
  yx.fillText(`HP ${hp}/${max}`, x, 18);
}

function renderHud() {
  const kana = currentKana();
  const maxHits = state.mode === "boss" ? rowKana().length : LESSON_HITS;
  if (!kana) {
    glyphEl.textContent = "✓";
    romajiEl.textContent = "xong";
    return;
  }
  glyphEl.textContent = state.mode === "boss" ? "?" : kana.char;
  romajiEl.textContent = kana.romaji;
  strokeStat.textContent = `${state.stroke + 1} / ${kana.strokes.length}`;
  hitLabel.textContent = state.mode === "boss" ? "Boss" : "Hit (4 lần)";
  hitStat.textContent = `${state.hits} / ${maxHits}`;
  hintEl.textContent = state.mode === "boss"
    ? "Boss: viết từ romaji, không có nét mờ."
    : "Tô theo nét mờ, đúng thứ tự. 4 lần thì sang chữ sau.";
}

function render() {
  drawPad();
  drawYokai();
  renderHud();
  renderRows();
}

function renderRows() {
  const cleared = new Set(state.cleared[state.script] || []);
  rowsEl.innerHTML = "";
  for (const row of KANA_DATA.rows) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = row.label.split(" / ")[state.script === "hiragana" ? 0 : 1];
    btn.classList.toggle("active", row.id === state.rowId);
    btn.classList.toggle("cleared", cleared.has(row.id));
    btn.addEventListener("click", () => startRow(row.id));
    rowsEl.appendChild(btn);
  }
}

function startRow(rowId) {
  state.rowId = rowId;
  state.mode = "lesson";
  state.index = 0;
  state.hits = 0;
  resetWriting();
  loadTemplates(currentKana());
  setStatus(`Hàng ${currentKana().char} — tô 4 lần mỗi chữ.`);
  speak(currentKana().char);
  render();
}

function resetWriting() {
  state.stroke = 0;
  state.ink = [];
  state.done = [];
  state.drawing = false;
}

function startBoss() {
  const list = [...rowKana()];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  state.mode = "boss";
  state.bossQueue = list;
  state.index = 0;
  state.hits = 0;
  resetWriting();
  loadTemplates(currentKana());
  setStatus("Boss: viết lại các chữ vừa học, từ romaji.");
  speak(currentKana().char);
  render();
}

function completeRow() {
  const list = state.cleared[state.script];
  if (!list.includes(state.rowId)) {
    list.push(state.rowId);
    saveProgress();
  }
  state.mode = "done";
  const rows = KANA_DATA.rows;
  const next = rows[(rows.findIndex((r) => r.id === state.rowId) + 1) % rows.length];
  setStatus(`Xong hàng. Sang ${next.label}? Bấm hàng bên trên.`, "good");
  render();
}

function onWritingComplete() {
  state.hits += 1;
  if (state.mode === "lesson") {
    if (state.hits >= LESSON_HITS) {
      const next = state.index + 1;
      if (next >= rowKana().length) {
        startBoss();
        return;
      }
      state.index = next;
      state.hits = 0;
      resetWriting();
      loadTemplates(currentKana());
      setStatus("Đúng. Chữ tiếp theo.", "good");
      speak(currentKana().char);
      render();
      return;
    }
    resetWriting();
    setStatus(`Hit ${state.hits}/${LESSON_HITS}`, "good");
    render();
    return;
  }

  if (state.hits >= state.bossQueue.length) {
    completeRow();
    return;
  }
  state.index += 1;
  resetWriting();
  loadTemplates(currentKana());
  setStatus(`Boss ${state.hits}/${state.bossQueue.length}`, "good");
  speak(currentKana().char);
  render();
}

function finishStroke() {
  const kana = currentKana();
  if (!kana || state.ink.length < 3)
    return;
  const result = matchStroke(state.ink, state.templates[state.stroke]);
  if (!result.ok) {
    state.ink = [];
    setStatus("Sai nét — thử lại.", "bad");
    render();
    return;
  }
  state.done.push(state.ink);
  state.ink = [];
  state.stroke += 1;
  if (state.stroke >= kana.strokes.length) {
    onWritingComplete();
    return;
  }
  setStatus("Đúng nét.", "good");
  render();
}

pad.addEventListener("pointerdown", (event) => {
  if (!currentKana() || state.mode === "done")
    return;
  event.preventDefault();
  pad.setPointerCapture(event.pointerId);
  state.drawing = true;
  state.ink = [pointerToKvg(event)];
  render();
});

pad.addEventListener("pointermove", (event) => {
  if (!state.drawing)
    return;
  state.ink.push(pointerToKvg(event));
  drawPad();
});

function endStroke(event) {
  if (!state.drawing)
    return;
  state.drawing = false;
  if (event)
    state.ink.push(pointerToKvg(event));
  finishStroke();
}

pad.addEventListener("pointerup", endStroke);
pad.addEventListener("pointercancel", () => {
  state.drawing = false;
  state.ink = [];
  render();
});

document.getElementById("btn-listen").addEventListener("click", () => {
  const kana = currentKana();
  if (kana)
    speak(kana.char);
});

document.querySelectorAll("[data-script]").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.script = btn.dataset.script;
    document.querySelectorAll("[data-script]").forEach((b) => b.classList.toggle("active", b === btn));
    startRow(state.rowId);
  });
});

startRow("a");
