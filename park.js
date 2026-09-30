// Draws the park as text. Older babies are taller. Each baby drifts slowly around its own spot.
const W = 46, H = 16;
const FACE = { calm: "(o.o)", happy: "(^.^)", sad: "(;.;)", angry: "(>.<)" };
const HEIGHT = { newborn: 0, baby: 1, toddler: 2, child: 3, teen: 4, adult: 5 };
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function hash(str) {
  let h = 0;
  for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function sprite(stage, mood) {
  const h = HEIGHT[stage] ?? 2;
  const lines = [FACE[mood] || FACE.calm];
  if (h === 1) lines.push(" /#\\ ");
  if (h >= 2) {
    lines.push("/|#|\\");
    for (let i = 0; i < h - 2; i++) lines.push(" |#| ");
    lines.push(" / \\ ");
  }
  return lines;
}

// list: [{ uid, babyName, stage, mood }], me: the viewer's uid (marked with a star)
export function drawScene(list, tick, me) {
  const g = Array.from({ length: H }, () => Array(W).fill(" "));
  const put = (x, y, s) => {
    if (y < 0 || y >= H) return;
    for (let i = 0; i < s.length; i++) {
      const cx = x + i;
      if (cx >= 0 && cx < W && s[i] !== " ") g[y][cx] = s[i];
    }
  };
  for (let x = 0; x < W; x++) g[H - 1][x] = (x * 7) % 5 === 0 ? '"' : "'";
  put(W - 8, 0, "\\ | /");
  put(W - 8, 1, "-- O --");
  put(W - 8, 2, "/ | \\");

  // Up to 8 babies: two staggered rows of 4 so they do not stand on each other.
  const sorted = [...list].sort((a, b) => (a.uid < b.uid ? -1 : 1)).slice(0, 8);
  sorted.forEach((p, i) => {
    const row = i >= 4 ? 1 : 0, col = i % 4;
    const feetY = row ? 6 : 13;
    const phase = hash(p.uid) % 7;
    const x = clamp(1 + col * 10 + (row ? 5 : 0) + Math.round(Math.sin(tick / 10 + phase)), 0, W - 6);
    const lines = sprite(p.stage, p.mood);
    lines.forEach((ln, k) => put(x, feetY - lines.length + 1 + k, ln));
    put(x, feetY + 1, (p.uid === me ? "*" : "") + String(p.babyName || "?").slice(0, 8));
  });
  return g.map(r => r.join("").trimEnd()).join("\n");
}
