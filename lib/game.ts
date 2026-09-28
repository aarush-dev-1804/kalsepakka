export type Dir = { r: number; c: number };

export const UP: Dir = { r: -1, c: 0 };
export const DOWN: Dir = { r: 1, c: 0 };
export const LEFT: Dir = { r: 0, c: -1 };
export const RIGHT: Dir = { r: 0, c: 1 };
export const NONE: Dir = { r: 0, c: 0 };

const DIRS = [UP, LEFT, DOWN, RIGHT];

const MAZE = [
  "###################",
  "#o.......#.......o#",
  "#.##.###.#.###.##.#",
  "#.................#",
  "#.##.#.#####.#.##.#",
  "#....#...#...#....#",
  "####.### # ###.####",
  "####.#       #.####",
  "####.# ##-## #.####",
  "    .  #EEE#  .    ",
  "####.# ##### #.####",
  "####.#       #.####",
  "####.# ##### #.####",
  "#........#........#",
  "#.##.###.#.###.##.#",
  "#o.#.....P.....#.o#",
  "##.#.#.#####.#.#.##",
  "#....#...#...#....#",
  "#.######.#.######.#",
  "#.................#",
  "###################",
];

export const ROWS = MAZE.length;
export const COLS = MAZE[0].length;

const RELEASE_TILE = { r: 7, c: 9 };

const EXAM_TYPES = [
  { label: "CAT1", color: "#ff4d6d", randomness: 0.05, corner: { r: 1, c: 17 }, delay: 0, homeIndex: 1 },
  { label: "CAT2", color: "#ff9f1c", randomness: 0.2, corner: { r: 1, c: 1 }, delay: 2, homeIndex: 0 },
  { label: "FAT", color: "#b388ff", randomness: 0.35, corner: { r: 19, c: 17 }, delay: 5, homeIndex: 1 },
  { label: "DA", color: "#3de8ff", randomness: 0.5, corner: { r: 19, c: 1 }, delay: 8, homeIndex: 2 },
];

type Tile = { r: number; c: number };
type Mover = { r: number; c: number; dir: Dir; progress: number };

export type Exam = Mover & {
  label: string;
  color: string;
  randomness: number;
  corner: Tile;
  home: Tile;
  delay: number;
  releaseAt: number;
  active: boolean;
  frightened: boolean;
};

export type GameStatus = "ready" | "playing" | "dying" | "levelup" | "over";

export type Game = {
  grid: string[][];
  dotsLeft: number;
  player: Mover & { want: Dir; start: Tile };
  exams: Exam[];
  score: number;
  lives: number;
  level: number;
  status: GameStatus;
  time: number;
  levelStart: number;
  frightUntil: number;
  combo: number;
  pauseUntil: number;
  caughtBy: string;
};

function opposite(d: Dir): Dir {
  if (d === UP) return DOWN;
  if (d === DOWN) return UP;
  if (d === LEFT) return RIGHT;
  if (d === RIGHT) return LEFT;
  return NONE;
}

function wrapC(c: number) {
  return (c + COLS) % COLS;
}

function canMove(g: Game, r: number, c: number, d: Dir) {
  const nr = r + d.r;
  if (nr < 0 || nr >= ROWS) return false;
  const ch = g.grid[nr][wrapC(c + d.c)];
  return ch !== "#" && ch !== "-" && ch !== "E";
}

function position(m: Mover) {
  return { x: m.c + m.dir.c * m.progress, y: m.r + m.dir.r * m.progress };
}

function reverse(g: Game, m: Mover) {
  if (m.dir === NONE) return;
  if (m.progress > 0) {
    m.r += m.dir.r;
    m.c = wrapC(m.c + m.dir.c);
    m.progress = 1 - m.progress;
    m.dir = opposite(m.dir);
  } else if (canMove(g, m.r, m.c, opposite(m.dir))) {
    m.dir = opposite(m.dir);
  }
}

export function createGame(): Game {
  const g: Game = {
    grid: [],
    dotsLeft: 0,
    player: { r: 0, c: 0, dir: NONE, want: NONE, progress: 0, start: { r: 0, c: 0 } },
    exams: [],
    score: 0,
    lives: 3,
    level: 1,
    status: "ready",
    time: 0,
    levelStart: 0,
    frightUntil: 0,
    combo: 0,
    pauseUntil: 0,
    caughtBy: "",
  };
  loadLevel(g);
  return g;
}

function loadLevel(g: Game) {
  g.grid = MAZE.map((row) => row.split(""));
  g.dotsLeft = 0;
  const homes: Tile[] = [];
  let start: Tile = { r: 0, c: 0 };
  g.grid.forEach((row, r) =>
    row.forEach((ch, c) => {
      if (ch === "." || ch === "o") g.dotsLeft += 1;
      if (ch === "P") {
        start = { r, c };
        row[c] = " ";
      }
      if (ch === "E") homes.push({ r, c });
    })
  );
  g.player = { r: start.r, c: start.c, dir: NONE, want: NONE, progress: 0, start };
  g.exams = EXAM_TYPES.map((t) => ({
    label: t.label,
    color: t.color,
    randomness: t.randomness,
    corner: t.corner,
    delay: t.delay,
    home: homes[t.homeIndex],
    r: 0,
    c: 0,
    dir: NONE,
    progress: 0,
    releaseAt: 0,
    active: false,
    frightened: false,
  }));
  resetPositions(g);
}

function resetPositions(g: Game) {
  const p = g.player;
  p.r = p.start.r;
  p.c = p.start.c;
  p.dir = NONE;
  p.want = NONE;
  p.progress = 0;
  const speedUp = Math.min(g.level - 1, 4) * 0.4;
  g.exams.forEach((e) => {
    e.r = e.home.r;
    e.c = e.home.c;
    e.dir = NONE;
    e.progress = 0;
    e.active = false;
    e.frightened = false;
    e.releaseAt = g.time + Math.max(0, e.delay - speedUp);
  });
  g.frightUntil = 0;
  g.combo = 0;
  g.levelStart = g.time;
}

export function update(g: Game, dt: number) {
  if (g.status === "ready" || g.status === "over") return;
  g.time += dt;

  if (g.status === "dying") {
    if (g.time >= g.pauseUntil) {
      if (g.lives <= 0) {
        g.status = "over";
      } else {
        resetPositions(g);
        g.status = "playing";
      }
    }
    return;
  }

  if (g.status === "levelup") {
    if (g.time >= g.pauseUntil) {
      g.level += 1;
      loadLevel(g);
      g.status = "playing";
    }
    return;
  }

  if (g.frightUntil > 0 && g.time >= g.frightUntil) {
    g.frightUntil = 0;
    g.exams.forEach((e) => {
      e.frightened = false;
    });
  }

  stepPlayer(g, dt);
  if (g.status !== "playing") return;
  g.exams.forEach((e) => stepExam(g, e, dt));
  checkCollisions(g);
}

function stepPlayer(g: Game, dt: number) {
  const p = g.player;
  const speed = 6 + Math.min(g.level - 1, 5) * 0.25;

  if (p.progress > 0 && p.want !== NONE && p.want === opposite(p.dir)) reverse(g, p);

  if (p.progress === 0) {
    if (p.want !== NONE && canMove(g, p.r, p.c, p.want)) p.dir = p.want;
    else if (p.dir !== NONE && !canMove(g, p.r, p.c, p.dir)) p.dir = NONE;
  }
  if (p.dir === NONE) return;

  p.progress += speed * dt;
  while (p.progress >= 1) {
    p.r += p.dir.r;
    p.c = wrapC(p.c + p.dir.c);
    p.progress -= 1;
    eat(g, p.r, p.c);
    if (g.status !== "playing") return;
    if (p.want !== NONE && canMove(g, p.r, p.c, p.want)) {
      p.dir = p.want;
    } else if (!canMove(g, p.r, p.c, p.dir)) {
      p.dir = NONE;
      p.progress = 0;
      return;
    }
  }
}

function eat(g: Game, r: number, c: number) {
  const ch = g.grid[r][c];
  if (ch === ".") {
    g.grid[r][c] = " ";
    g.score += 10;
    g.dotsLeft -= 1;
  } else if (ch === "o") {
    g.grid[r][c] = " ";
    g.score += 50;
    g.dotsLeft -= 1;
    g.frightUntil = g.time + Math.max(3, 7 - (g.level - 1) * 0.5);
    g.combo = 0;
    g.exams.forEach((e) => {
      if (!e.active) return;
      e.frightened = true;
      reverse(g, e);
    });
  }
  if (g.dotsLeft === 0) {
    g.score += 500;
    g.status = "levelup";
    g.pauseUntil = g.time + 2;
  }
}

function stepExam(g: Game, e: Exam, dt: number) {
  if (!e.active) {
    if (g.time >= e.releaseAt) {
      e.active = true;
      e.r = RELEASE_TILE.r;
      e.c = RELEASE_TILE.c;
      e.progress = 0;
      e.dir = NONE;
      e.dir = chooseDir(g, e);
    }
    return;
  }

  if (e.dir === NONE) {
    e.dir = chooseDir(g, e);
    if (e.dir === NONE) return;
  }

  const speed = e.frightened ? 2.8 : Math.min(4.4 + (g.level - 1) * 0.4, 6.4);
  e.progress += speed * dt;
  while (e.progress >= 1) {
    e.r += e.dir.r;
    e.c = wrapC(e.c + e.dir.c);
    e.progress -= 1;
    e.dir = chooseDir(g, e);
    if (e.dir === NONE) {
      e.progress = 0;
      return;
    }
  }
}

function chooseDir(g: Game, e: Exam): Dir {
  const back = opposite(e.dir);
  let options = DIRS.filter((d) => d !== back && canMove(g, e.r, e.c, d));
  if (options.length === 0) options = DIRS.filter((d) => canMove(g, e.r, e.c, d));
  if (options.length === 0) return NONE;
  if (e.frightened || Math.random() < e.randomness) {
    return options[Math.floor(Math.random() * options.length)];
  }
  const target = examTarget(g, e);
  let best = options[0];
  let bestDist = Infinity;
  for (const d of options) {
    const dist = (e.r + d.r - target.r) ** 2 + (e.c + d.c - target.c) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  return best;
}

function examTarget(g: Game, e: Exam): Tile {
  const scatter = (g.time - g.levelStart) % 27 < 6;
  if (scatter) return e.corner;
  const p = g.player;
  if (e.label === "CAT2") return { r: p.r + p.dir.r * 4, c: p.c + p.dir.c * 4 };
  return { r: p.r, c: p.c };
}

function checkCollisions(g: Game) {
  const pp = position(g.player);
  for (const e of g.exams) {
    if (!e.active) continue;
    const ep = position(e);
    let dx = Math.abs(pp.x - ep.x);
    if (dx > COLS / 2) dx = COLS - dx;
    const dy = Math.abs(pp.y - ep.y);
    if (dx * dx + dy * dy > 0.45) continue;
    if (e.frightened) {
      g.combo += 1;
      g.score += 200 * 2 ** (g.combo - 1);
      e.active = false;
      e.frightened = false;
      e.r = e.home.r;
      e.c = e.home.c;
      e.dir = NONE;
      e.progress = 0;
      e.releaseAt = g.time + 3;
    } else {
      g.lives -= 1;
      g.status = "dying";
      g.pauseUntil = g.time + 1.5;
      g.caughtBy = e.label;
      return;
    }
  }
}

export function draw(ctx: CanvasRenderingContext2D, g: Game, T: number, now: number, font: string) {
  const W = COLS * T;
  const H = ROWS * T;
  ctx.fillStyle = "#0b0b1a";
  ctx.fillRect(0, 0, W, H);

  const isWall = (r: number, c: number) => r < 0 || r >= ROWS || c < 0 || c >= COLS || g.grid[r][c] === "#";

  ctx.fillStyle = "#16163a";
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (g.grid[r][c] === "#") ctx.fillRect(c * T, r * T, T, T);
    }
  }

  ctx.save();
  ctx.strokeStyle = "#7b6cff";
  ctx.lineWidth = Math.max(2, T * 0.08);
  ctx.shadowColor = "#7b6cff";
  ctx.shadowBlur = T * 0.4;
  ctx.beginPath();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (g.grid[r][c] !== "#") continue;
      const x = c * T;
      const y = r * T;
      if (!isWall(r - 1, c)) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + T, y);
      }
      if (!isWall(r + 1, c)) {
        ctx.moveTo(x, y + T);
        ctx.lineTo(x + T, y + T);
      }
      if (!isWall(r, c - 1)) {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + T);
      }
      if (!isWall(r, c + 1)) {
        ctx.moveTo(x + T, y);
        ctx.lineTo(x + T, y + T);
      }
    }
  }
  ctx.stroke();
  ctx.restore();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const dot = Math.max(2, Math.round(T * 0.18));
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = g.grid[r][c];
      if (ch === ".") {
        ctx.fillStyle = "#ffd23f";
        ctx.fillRect(c * T + (T - dot) / 2, r * T + (T - dot) / 2, dot, dot);
      } else if (ch === "o") {
        const size = T * (0.75 + 0.1 * Math.sin(now * 6));
        ctx.font = `${size}px sans-serif`;
        ctx.fillText("☕", (c + 0.5) * T, (r + 0.55) * T);
      } else if (ch === "-") {
        ctx.fillStyle = "#ff5da2";
        ctx.fillRect(c * T, r * T + T * 0.42, T, T * 0.16);
      }
    }
  }

  const flashing = g.frightUntil - g.time < 2;
  g.exams.forEach((e, i) => {
    if (e.active) {
      const pos = position(e);
      drawExam(ctx, e, pos.x, pos.y, T, now, flashing, font);
    } else {
      drawExam(ctx, e, e.c, e.r + Math.sin(now * 4 + i) * 0.12, T, now, flashing, font);
    }
  });

  if (g.status !== "dying" || Math.floor(now * 8) % 2 === 0) drawPlayer(ctx, g, T, now);

  if (g.status === "dying" || g.status === "levelup") {
    const text =
      g.status === "levelup"
        ? `SEM ${g.level} CLEARED!`
        : g.lives > 0
          ? `CAUGHT BY ${g.caughtBy}!`
          : "GAME OVER";
    ctx.fillStyle = "rgba(11, 11, 26, 0.75)";
    ctx.fillRect(0, H / 2 - T * 1.2, W, T * 2.4);
    ctx.fillStyle = g.status === "levelup" ? "#ffd23f" : "#ff5da2";
    ctx.font = `${Math.floor(T * 0.7)}px ${font}`;
    ctx.fillText(text, W / 2, H / 2, W - T * 2);
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, g: Game, T: number, now: number) {
  const p = g.player;
  const pos = position(p);
  const moving = p.dir !== NONE && g.status === "playing";
  const cx = (pos.x + 0.5) * T;
  const cy = (pos.y + 0.5) * T + (moving ? Math.sin(now * 18) * T * 0.04 : 0);
  const s = T * 0.72;

  ctx.fillStyle = "#5cffb0";
  ctx.beginPath();
  ctx.roundRect(cx - s / 2, cy - s * 0.36, s, s * 0.86, T * 0.16);
  ctx.fill();

  ctx.fillStyle = "#15152e";
  ctx.strokeStyle = "#ececff";
  ctx.lineWidth = Math.max(1, T * 0.04);
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.78);
  ctx.lineTo(cx + s * 0.62, cy - s * 0.52);
  ctx.lineTo(cx, cy - s * 0.28);
  ctx.lineTo(cx - s * 0.62, cy - s * 0.52);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "#ffd23f";
  ctx.lineWidth = Math.max(1, T * 0.06);
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.52);
  ctx.lineTo(cx + s * 0.5, cy - s * 0.44);
  ctx.lineTo(cx + s * 0.5, cy - s * 0.1);
  ctx.stroke();

  const look = p.dir === NONE ? DOWN : p.dir;
  for (const side of [-1, 1]) {
    const ex = cx + side * s * 0.2;
    const ey = cy + s * 0.08;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ex, ey, T * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0b0b1a";
    ctx.beginPath();
    ctx.arc(ex + look.c * T * 0.04, ey + look.r * T * 0.04, T * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawExam(
  ctx: CanvasRenderingContext2D,
  e: Exam,
  x: number,
  y: number,
  T: number,
  now: number,
  flashing: boolean,
  font: string
) {
  const cx = (x + 0.5) * T;
  const cy = (y + 0.5) * T;
  const w = T * 0.78;
  const h = T * 0.9;
  const f = T * 0.2;
  const left = cx - w / 2;
  const top = cy - h / 2;
  const scared = e.frightened;
  const blink = scared && flashing && Math.floor(now * 8) % 2 === 0;

  ctx.fillStyle = scared ? (blink ? "#ffffff" : "#3d5afe") : "#f4f1ff";
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left + w - f, top);
  ctx.lineTo(left + w, top + f);
  ctx.lineTo(left + w, top + h);
  ctx.lineTo(left, top + h);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = scared ? "#8c9eff" : "#c9c3e6";
  ctx.beginPath();
  ctx.moveTo(left + w - f, top);
  ctx.lineTo(left + w - f, top + f);
  ctx.lineTo(left + w, top + f);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = scared ? "#1a237e" : e.color;
  ctx.fillRect(left, top + h * 0.08, w - f, h * 0.26);

  ctx.fillStyle = scared ? "#ffffff" : "#0b0b1a";
  ctx.font = `${Math.max(6, Math.floor(T * 0.2))}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(scared ? "??" : e.label, left + (w - f) / 2, top + h * 0.22, w - f - 2);

  const eyeY = top + h * 0.56;
  for (const side of [-1, 1]) {
    const ex = cx + side * w * 0.2;
    if (scared) {
      ctx.fillStyle = blink ? "#3d5afe" : "#ffffff";
      ctx.beginPath();
      ctx.arc(ex, eyeY, T * 0.05, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#0b0b1a";
      ctx.beginPath();
      ctx.arc(ex + e.dir.c * T * 0.03, eyeY + e.dir.r * T * 0.03, T * 0.065, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#0b0b1a";
      ctx.lineWidth = Math.max(1, T * 0.05);
      ctx.beginPath();
      ctx.moveTo(ex - T * 0.08, eyeY - T * (side < 0 ? 0.15 : 0.09));
      ctx.lineTo(ex + T * 0.08, eyeY - T * (side < 0 ? 0.09 : 0.15));
      ctx.stroke();
    }
  }

  ctx.strokeStyle = scared ? (blink ? "#3d5afe" : "#ffffff") : "#9e98c4";
  ctx.lineWidth = Math.max(1, T * 0.04);
  ctx.beginPath();
  if (scared) {
    const y0 = top + h * 0.8;
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const px = left + w * 0.18 + (w * 0.64 * i) / steps;
      const py = y0 + (i % 2 === 0 ? -T * 0.04 : T * 0.04);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  } else {
    ctx.moveTo(left + w * 0.18, top + h * 0.8);
    ctx.lineTo(left + w * 0.82, top + h * 0.8);
  }
  ctx.stroke();
}
