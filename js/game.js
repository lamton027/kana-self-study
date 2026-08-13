import { KANA_DATA } from "./kana-data.js";
import { matchStroke } from "./stroke-matcher.js";
import { initWorld } from "./world.js";

const LESSON_WRITES = 2;
const PLAYER_MAX = 5;
const ATTACK_MS = 340;
const KV = KANA_DATA.viewBox;

const pad = document.getElementById("pad");
const battle = document.getElementById("battle");
const ctx = pad.getContext("2d");
const bx = battle.getContext("2d");
const probePath = document.getElementById("probe-path");
const glyphEl = document.getElementById("glyph");
const romajiEl = document.getElementById("romaji");
const zoneEl = document.getElementById("zone");
const strokeStat = document.getElementById("stroke-stat");
const playerHpEl = document.getElementById("player-hp");
const enemyHpEl = document.getElementById("enemy-hp");
const statusEl = document.getElementById("status");
const hintEl = document.getElementById("hint");
const screenWorld = document.getElementById("screen-world");
const screenBattle = document.getElementById("screen-battle");

const state = {
  glyph: null,
  label: "",
  tint: "#7b3d9e",
  stroke: 0,
  ink: [],
  done: [],
  drawing: false,
  busy: false,
  templates: [],
  playerHp: PLAYER_MAX,
  enemyHp: 2,
  enemyMax: 2,
  anim: null,
  onWin: null,
  onLose: null,
};

const world = initWorld({
  canvas: document.getElementById("world"),
  onEncounter(spec) {
    beginEncounter(spec);
  },
});

document.getElementById("dpad").addEventListener("click", (event) => {
  const btn = event.target.closest("button");
  if (!btn)
    return;
  world.tryMove(Number(btn.dataset.dx), Number(btn.dataset.dy));
});

function showWorld() {
  screenWorld.hidden = false;
  screenBattle.hidden = true;
}

function showBattle() {
  screenWorld.hidden = true;
  screenBattle.hidden = false;
}

function currentKana() {
  return state.glyph;
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
  drawPath(samplePath(d, 64), color, width);
}

function lungeAmount(t) {
  if (t < 0.42)
    return t / 0.42;
  return 1 - (t - 0.42) / 0.58;
}

function hpBar(x, y, w, hp, max, color) {
  bx.fillStyle = "#2a3140";
  bx.fillRect(x, y, w, 10);
  bx.fillStyle = color;
  bx.fillRect(x, y, w * Math.max(hp / max, 0), 10);
  bx.strokeStyle = "#e8e4d9";
  bx.strokeRect(x, y, w, 10);
}

function drawPlayer(x, y, pose) {
  bx.save();
  bx.translate(x + pose.lunge * 72, y);
  if (pose.hurt)
    bx.globalAlpha = 0.45;
  bx.fillStyle = "#f0d5b0";
  bx.beginPath();
  bx.arc(0, -46, 16, 0, Math.PI * 2);
  bx.fill();
  bx.fillStyle = "#2d5fd4";
  bx.beginPath();
  bx.ellipse(2, -56, 16, 11, 0.1, Math.PI, Math.PI * 2);
  bx.fill();
  bx.fillStyle = "#4d8bff";
  bx.fillRect(-13, -28, 26, 34);
  bx.fillStyle = "#243658";
  bx.fillRect(-11, 6, 9, 24);
  bx.fillRect(2, 6, 9, 24);
  bx.fillStyle = "#dce7f7";
  bx.save();
  bx.translate(12, -10);
  bx.rotate(-0.55 + pose.slash * 1.7);
  bx.fillRect(0, -4, 46, 7);
  bx.fillStyle = "#c9a227";
  bx.fillRect(-4, -7, 10, 13);
  bx.restore();
  bx.fillStyle = "#e8e4d9";
  bx.font = "12px sans-serif";
  bx.textAlign = "center";
  bx.fillText("YOU", 0, 44);
  bx.restore();
}

function drawEnemy(x, y, pose) {
  bx.save();
  bx.translate(x - pose.lunge * 72, y);
  bx.fillStyle = pose.hurt ? "#ffb4b4" : state.tint;
  bx.beginPath();
  bx.ellipse(0, -8, 30, 36, 0, 0, Math.PI * 2);
  bx.fill();
  bx.fillStyle = "#1a1420";
  bx.beginPath();
  bx.moveTo(-16, -32);
  bx.lineTo(-24, -58);
  bx.lineTo(-4, -36);
  bx.fill();
  bx.beginPath();
  bx.moveTo(16, -32);
  bx.lineTo(24, -58);
  bx.lineTo(4, -36);
  bx.fill();
  bx.fillStyle = "#ffd24a";
  bx.beginPath();
  bx.arc(-10, -12, 5, 0, Math.PI * 2);
  bx.arc(10, -12, 5, 0, Math.PI * 2);
  bx.fill();
  bx.fillStyle = "#1a1d24";
  bx.beginPath();
  bx.arc(-10, -12, 2.2, 0, Math.PI * 2);
  bx.arc(10, -12, 2.2, 0, Math.PI * 2);
  bx.fill();
  bx.strokeStyle = "#1a1d24";
  bx.lineWidth = 3;
  bx.beginPath();
  bx.arc(0, 2, 10, 0.15 * Math.PI, 0.85 * Math.PI, true);
  bx.stroke();
  const claw = pose.slash * 18;
  bx.strokeStyle = "#e8c4ff";
  bx.lineWidth = 3;
  bx.beginPath();
  bx.moveTo(-34, -4);
  bx.lineTo(-48 - claw, 8);
  bx.moveTo(-32, 8);
  bx.lineTo(-50 - claw, 16);
  bx.stroke();
  bx.fillStyle = "#e8e4d9";
  bx.font = "12px sans-serif";
  bx.textAlign = "center";
  bx.fillText("ENEMY", 0, 44);
  bx.restore();
}

function drawBattle() {
  const w = battle.width;
  const h = battle.height;
  bx.setTransform(1, 0, 0, 1, 0, 0);
  bx.clearRect(0, 0, w, h);
  const ground = bx.createLinearGradient(0, 0, 0, h);
  ground.addColorStop(0, "#1a2030");
  ground.addColorStop(1, "#0c0e14");
  bx.fillStyle = ground;
  bx.fillRect(0, 0, w, h);
  bx.fillStyle = "#2a3140";
  bx.fillRect(0, h - 36, w, 36);

  const t = state.anim?.t ?? 0;
  const who = state.anim?.who;
  const peak = t > 0.32 && t < 0.62;
  const playerPose = {
    lunge: who === "player" ? lungeAmount(t) : 0,
    slash: who === "player" ? lungeAmount(t) : 0,
    hurt: who === "enemy" && peak,
  };
  const enemyPose = {
    lunge: who === "enemy" ? lungeAmount(t) : 0,
    slash: who === "enemy" ? lungeAmount(t) : 0,
    hurt: who === "player" && peak,
  };

  drawPlayer(150, h - 58, playerPose);
  drawEnemy(w - 150, h - 58, enemyPose);
  hpBar(70, 16, 140, state.playerHp, PLAYER_MAX, "#4d8bff");
  hpBar(w - 210, 16, 140, state.enemyHp, state.enemyMax, "#ff6f7d");
  bx.fillStyle = "#8b91a1";
  bx.font = "11px sans-serif";
  bx.textAlign = "left";
  bx.fillText(`HP ${state.playerHp}/${PLAYER_MAX}`, 70, 42);
  bx.textAlign = "right";
  bx.fillText(`HP ${state.enemyHp}/${state.enemyMax}`, w - 70, 42);
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
    ctx.font = "8px sans-serif";
    ctx.fillText(String(state.stroke + 1), start.x + 4, start.y - 3);
  }

  for (const stroke of state.done)
    drawPath(stroke, "#2a3348", 4.2);
  drawPath(state.ink, "#2c6bed", 4.2);
}

function renderHud() {
  const kana = currentKana();
  if (!kana)
    return;
  zoneEl.textContent = state.label;
  glyphEl.textContent = kana.char;
  romajiEl.textContent = kana.meaning ? `${kana.romaji} · ${kana.meaning}` : kana.romaji;
  strokeStat.textContent = `${Math.min(state.stroke + 1, kana.strokes.length)} / ${kana.strokes.length}`;
  playerHpEl.textContent = `${Math.max(state.playerHp, 0)} / ${PLAYER_MAX}`;
  enemyHpEl.textContent = `${Math.max(state.enemyHp, 0)} / ${state.enemyMax}`;
  hintEl.textContent = "Tô đúng thì bạn tấn công. Sai 1 nét là vẽ lại cả chữ từ đầu.";
}

function render() {
  drawPad();
  drawBattle();
  renderHud();
}

function resetWriting() {
  state.stroke = 0;
  state.ink = [];
  state.done = [];
  state.drawing = false;
}

function armEnemy(kana) {
  state.enemyMax = kana.strokes.length * LESSON_WRITES;
  state.enemyHp = state.enemyMax;
  state.playerHp = PLAYER_MAX;
}

function beginEncounter(spec) {
  showBattle();
  state.glyph = spec.glyph;
  state.label = spec.label;
  state.tint = spec.tint;
  state.onWin = () => {
    showWorld();
    spec.onDone();
  };
  state.onLose = () => {
    world.respawn();
    showWorld();
  };
  resetWriting();
  loadTemplates(spec.glyph);
  armEnemy(spec.glyph);
  setStatus(`Gặp ${spec.label}! Tô nét để đánh.`);
  speak(spec.glyph.char);
  render();
}

function playAttack(who, after) {
  state.busy = true;
  const start = performance.now();
  state.anim = { who, t: 0 };

  function tick(now) {
    const t = Math.min((now - start) / ATTACK_MS, 1);
    state.anim = { who, t };
    drawBattle();
    if (t < 1) {
      requestAnimationFrame(tick);
      return;
    }
    state.anim = null;
    state.busy = false;
    after();
  }

  requestAnimationFrame(tick);
}

function finishStroke() {
  const kana = currentKana();
  if (!kana || state.ink.length < 3)
    return;
  const result = matchStroke(state.ink, state.templates[state.stroke]);
  if (!result.ok) {
    const refund = state.done.length;
    state.ink = [];
    drawPad();
    playAttack("enemy", () => {
      state.enemyHp = Math.min(state.enemyMax, state.enemyHp + refund);
      state.playerHp -= 1;
      resetWriting();
      if (state.playerHp <= 0) {
        setStatus("Hết máu — về điểm spawn.", "bad");
        state.onLose?.();
        return;
      }
      setStatus("Sai nét — vẽ lại cả chữ từ đầu!", "bad");
      render();
    });
    return;
  }

  state.done.push(state.ink);
  state.ink = [];
  state.stroke += 1;
  const writingDone = state.stroke >= kana.strokes.length;
  drawPad();
  playAttack("player", () => {
    state.enemyHp -= 1;
    if (state.enemyHp <= 0) {
      setStatus("Thắng! Quay lại map.", "good");
      state.onWin?.();
      return;
    }
    if (writingDone)
      resetWriting();
    setStatus(writingDone ? "Đúng! Viết lần nữa." : "Đúng — bạn tấn công!", "good");
    render();
  });
}

pad.addEventListener("pointerdown", (event) => {
  if (!currentKana() || screenBattle.hidden || state.busy)
    return;
  event.preventDefault();
  pad.setPointerCapture(event.pointerId);
  state.drawing = true;
  state.ink = [pointerToKvg(event)];
  drawPad();
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
  drawPad();
});

document.getElementById("btn-listen").addEventListener("click", () => {
  const kana = currentKana();
  if (kana)
    speak(kana.char);
});

showWorld();
