// The baby is drawn with digits. Each stage has a different body shape.
// Growth points (xp) decide the stage. In stage 4 the baby earns xp by learning from you.
export const STAGES = [
  { label: "newborn", min: 0,    hw: 4, hh: 6, bw: 0, bh: 0,  al: 0, ll: 0 },
  { label: "baby",    min: 50,   hw: 6, hh: 8, bw: 3, bh: 2,  al: 0, ll: 0 },
  { label: "toddler", min: 200,  hw: 6, hh: 8, bw: 4, bh: 4,  al: 2, ll: 3 },
  { label: "child",   min: 500,  hw: 6, hh: 8, bw: 4, bh: 6,  al: 4, ll: 5 },
  { label: "teen",    min: 1000, hw: 5, hh: 7, bw: 5, bh: 8,  al: 6, ll: 7 },
  { label: "adult",   min: 2000, hw: 5, hh: 7, bw: 6, bh: 10, al: 8, ll: 9 }
];

export function stageFor(xp = 0) {
  let s = STAGES[0];
  for (const t of STAGES) if (xp >= t.min) s = t;
  return s;
}

const EYES = { calm: "o", happy: "^", sad: ".", angry: "*" };
const MOUTHS = { calm: "---", happy: "\\_/", sad: "/-\\", angry: "~~~" };
const W = 21, CX = 10;
const SWAY = [0, 1, 2, 1];

// Returns one text frame. Call it again with a higher tick to animate.
export function renderBaby(s, mood, tick) {
  const grid = [];
  const put = (x, y, c) => { (grid[y] = grid[y] || Array(W).fill(" "))[x] = c; };

  // head (an oval)
  for (let y = 0; y < s.hh; y++) {
    const t = ((y + 0.5) / s.hh) * 2 - 1;
    const hw = Math.max(1, Math.round(s.hw * Math.sqrt(1 - t * t)));
    for (let x = CX - hw; x <= CX + hw; x++) put(x, y, "#");
  }
  // eyes and mouth markers
  const ey = Math.floor(s.hh * 0.4), ex = Math.max(2, Math.round(s.hw / 2));
  put(CX - ex, ey, "E"); put(CX + ex, ey, "E");
  const my = Math.floor(s.hh * 0.72);
  put(CX - 1, my, "a"); put(CX, my, "b"); put(CX + 1, my, "c");
  // body, arms, legs
  for (let y = 0; y < s.bh; y++)
    for (let x = CX - s.bw; x <= CX + s.bw; x++) put(x, s.hh + y, "#");
  for (let i = 0; i < s.al; i++) { put(CX - s.bw - 1, s.hh + 1 + i, "#"); put(CX + s.bw + 1, s.hh + 1 + i, "#"); }
  for (let i = 0; i < s.ll; i++) {
    const y = s.hh + s.bh + i;
    put(CX - s.bw, y, "#"); put(CX - s.bw + 1, y, "#");
    put(CX + s.bw - 1, y, "#"); put(CX + s.bw, y, "#");
  }

  const blink = tick % 16 >= 14;
  const eye = blink ? "-" : (EYES[mood] || "o");
  const mouth = MOUTHS[mood] || MOUTHS.calm;
  const pad = " ".repeat(SWAY[Math.floor(tick / 6) % 4]);

  const lines = [];
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y] || Array(W).fill(" ");
    let out = "";
    for (let x = 0; x < W; x++) {
      const c = row[x];
      if (c === "#") out += String((x * 3 + y * 5 + tick) % 10);
      else if (c === "E") out += eye;
      else if (c === "a") out += mouth[0];
      else if (c === "b") out += mouth[1];
      else if (c === "c") out += mouth[2];
      else out += " ";
    }
    lines.push(pad + out.trimEnd());
  }
  return lines.join("\n");
}
