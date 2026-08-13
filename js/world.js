import { KANA_DATA } from "./kana-data.js";

export const TILE = {
  WALL: 0,
  PATH: 1,
  GRASS_HIRA: 2,
  GRASS_KATA: 3,
  GRASS_KANJI: 4,
};

const COLS = 40;
const ROWS = 18;
const TILE_PX = 32;
const VIEW_COLS = 20;
const VIEW_ROWS = 14;
const SPAWN = { x: 2, y: 9 };
const ENCOUNTER_RATE = 0.16;
const MOVE_MS = 110;

const COLORS = {
  [TILE.WALL]: "#2a3140",
  [TILE.PATH]: "#c4b896",
  [TILE.GRASS_HIRA]: "#4a9e5c",
  [TILE.GRASS_KATA]: "#2f8fa3",
  [TILE.GRASS_KANJI]: "#7b4aa8",
};

function buildGrid() {
  const grid = [];
  for (let y = 0; y < ROWS; y++) {
    grid[y] = [];
    for (let x = 0; x < COLS; x++) {
      if (y === 0 || y === ROWS - 1 || x === 0 || x === COLS - 1)
        grid[y][x] = TILE.WALL;
      else if (y === 9)
        grid[y][x] = TILE.PATH;
      else if (y >= 6 && y <= 12) {
        if (x < 6)
          grid[y][x] = TILE.PATH;
        else if (x < 18)
          grid[y][x] = TILE.GRASS_HIRA;
        else if (x < 29)
          grid[y][x] = TILE.GRASS_KATA;
        else
          grid[y][x] = TILE.GRASS_KANJI;
      } else {
        grid[y][x] = TILE.PATH;
      }
    }
  }
  return grid;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function lerpIndex(x, x0, x1, length) {
  const t = (x - x0) / Math.max(x1 - x0, 1);
  return Math.min(length - 1, Math.max(0, Math.floor(t * length)));
}

function pickGlyph(tile, x) {
  const rows = KANA_DATA.rows;
  if (tile === TILE.GRASS_HIRA) {
    const row = rows[lerpIndex(x, 6, 17, rows.length)];
    const pool = KANA_DATA.kana.filter((k) => k.script === "hiragana" && k.row === row.id);
    return { glyph: pick(pool), label: `Hiragana · ${row.label.split(" / ")[0]}行` };
  }
  if (tile === TILE.GRASS_KATA) {
    const row = rows[lerpIndex(x, 18, 28, rows.length)];
    const pool = KANA_DATA.kana.filter((k) => k.script === "katakana" && k.row === row.id);
    return { glyph: pick(pool), label: `Katakana · ${row.label.split(" / ")[1]}行` };
  }
  const kanji = KANA_DATA.kanji;
  const index = lerpIndex(x, 29, COLS - 2, kanji.length);
  const from = Math.max(0, index - 1);
  const slice = kanji.slice(from, index + 2);
  const glyph = pick(slice);
  return { glyph, label: `Kanji · ${glyph.meaning}` };
}

export function initWorld({ canvas, onEncounter }) {
  canvas.width = VIEW_COLS * TILE_PX;
  canvas.height = VIEW_ROWS * TILE_PX;
  const ctx = canvas.getContext("2d");
  const grid = buildGrid();
  const player = { x: SPAWN.x, y: SPAWN.y, fx: SPAWN.x, fy: SPAWN.y, dir: 2 };
  let moving = false;
  let blocked = false;
  let keys = {};

  function tileAt(x, y) {
    if (y < 0 || y >= ROWS || x < 0 || x >= COLS)
      return TILE.WALL;
    return grid[y][x];
  }

  function camera() {
    const cx = Math.max(0, Math.min(COLS - VIEW_COLS, player.fx - VIEW_COLS / 2 + 0.5));
    const cy = Math.max(0, Math.min(ROWS - VIEW_ROWS, player.fy - VIEW_ROWS / 2 + 0.5));
    return { cx, cy };
  }

  function draw() {
    const { cx, cy } = camera();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const x0 = Math.floor(cx);
    const y0 = Math.floor(cy);
    for (let y = y0; y <= y0 + VIEW_ROWS; y++) {
      for (let x = x0; x <= x0 + VIEW_COLS; x++) {
        const tile = tileAt(x, y);
        const sx = (x - cx) * TILE_PX;
        const sy = (y - cy) * TILE_PX;
        ctx.fillStyle = COLORS[tile] || "#111";
        ctx.fillRect(sx, sy, TILE_PX, TILE_PX);
        if (tile >= TILE.GRASS_HIRA) {
          ctx.fillStyle = "rgba(0,0,0,0.22)";
          ctx.fillRect(sx + 8, sy + 6, 6, 18);
          ctx.fillRect(sx + 18, sy + 4, 6, 20);
        }
      }
    }

    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    const labels = [
      { x: 12, y: 4.4, text: "HIRAGANA" },
      { x: 23.5, y: 4.4, text: "KATAKANA" },
      { x: 34, y: 4.4, text: "KANJI" },
    ];
    for (const label of labels) {
      ctx.fillText(label.text, (label.x - cx) * TILE_PX, (label.y - cy) * TILE_PX);
    }

    const px = (player.fx - cx) * TILE_PX;
    const py = (player.fy - cy) * TILE_PX;
    ctx.fillStyle = "#1a1d24";
    ctx.fillRect(px + 6, py + 22, 20, 6);
    ctx.fillStyle = "#3d6fd9";
    ctx.fillRect(px + 6, py + 4, 20, 22);
    ctx.fillStyle = "#f0d5b0";
    ctx.fillRect(px + 10, py + 6, 12, 10);
    ctx.fillStyle = "#dce7f7";
    if (player.dir === 1)
      ctx.fillRect(px + 26, py + 14, 6, 4);
    else if (player.dir === 3)
      ctx.fillRect(px, py + 14, 6, 4);
    else if (player.dir === 0)
      ctx.fillRect(px + 14, py, 4, 6);
    else
      ctx.fillRect(px + 14, py + 26, 4, 6);

    ctx.fillStyle = "rgba(12,14,20,0.72)";
    ctx.fillRect(0, 0, canvas.width, 28);
    ctx.fillStyle = "#e8e4d9";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "left";
    const here = tileAt(player.x, player.y);
    const zone = here === TILE.GRASS_KATA ? "Katakana" : here === TILE.GRASS_KANJI ? "Kanji" : here === TILE.GRASS_HIRA ? "Hiragana" : "Đường an toàn";
    ctx.fillText(`MAP  ·  ${zone}  ·  đi vào cỏ để gặp quái`, 10, 19);
  }

  function tryMove(dx, dy) {
    if (blocked || moving)
      return;
    if (dx === 1)
      player.dir = 1;
    else if (dx === -1)
      player.dir = 3;
    else if (dy === -1)
      player.dir = 0;
    else
      player.dir = 2;

    const nx = player.x + dx;
    const ny = player.y + dy;
    if (tileAt(nx, ny) === TILE.WALL)
      return;

    moving = true;
    const start = performance.now();
    const ox = player.x;
    const oy = player.y;

    function tick(now) {
      const t = Math.min((now - start) / MOVE_MS, 1);
      player.fx = ox + dx * t;
      player.fy = oy + dy * t;
      draw();
      if (t < 1) {
        requestAnimationFrame(tick);
        return;
      }
      player.x = nx;
      player.y = ny;
      player.fx = nx;
      player.fy = ny;
      moving = false;
      const tile = tileAt(nx, ny);
      if (tile >= TILE.GRASS_HIRA && Math.random() < ENCOUNTER_RATE) {
        const encounter = pickGlyph(tile, nx);
        blocked = true;
        onEncounter({
          ...encounter,
          tint: COLORS[tile],
          onDone() {
            blocked = false;
            draw();
          },
        });
      }
    }

    requestAnimationFrame(tick);
  }

  function onKey(event) {
    keys[event.key] = event.type === "keydown";
    if (event.type === "keydown") {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key))
        event.preventDefault();
    }
  }

  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);

  const dirs = {
    ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
    ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
    ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
    ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
  };

  function pump() {
    if (!blocked) {
      for (const [key, delta] of Object.entries(dirs)) {
        if (keys[key]) {
          tryMove(delta[0], delta[1]);
          break;
        }
      }
    }
    requestAnimationFrame(pump);
  }

  draw();
  requestAnimationFrame(pump);

  return {
    tryMove,
    respawn() {
      player.x = SPAWN.x;
      player.y = SPAWN.y;
      player.fx = SPAWN.x;
      player.fy = SPAWN.y;
      player.dir = 2;
      blocked = false;
      draw();
    },
    setBlocked(value) {
      blocked = value;
    },
  };
}
