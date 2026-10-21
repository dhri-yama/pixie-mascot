// Spec: spec/sprite.md "Output". Integer coordinates and hex colors only, so output is stable.

import { fnv1a } from "./hash";
import { SIZE, type Grid } from "./types";

export interface Run {
  x: number;
  y: number;
  w: number;
  /** Palette index, never 0. */
  idx: number;
}

/** Horizontal runs of equal, non-clear cells. Fewer rects than one per pixel. */
export function runs(grid: Grid): Run[] {
  const out: Run[] = [];
  for (let y = 0; y < SIZE; y++) {
    let x = 0;
    while (x < SIZE) {
      const idx = grid[y * SIZE + x] ?? 0;
      if (idx === 0) {
        x++;
        continue;
      }
      let w = 1;
      while (x + w < SIZE && grid[y * SIZE + x + w] === idx) w++;
      out.push({ x, y, w, idx });
      x += w;
    }
  }
  return out;
}

export interface SvgOptions {
  /** CSS pixel size of the square. Omit to let CSS size it. */
  size?: number;
  /** Accessible name. Pass "" to mark the image decorative. */
  label?: string;
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function toSVG(grid: Grid, colors: readonly string[], options: SvgOptions = {}): string {
  const dim = options.size === undefined ? "" : ` width="${options.size}" height="${options.size}"`;
  const a11y =
    options.label === undefined || options.label === ""
      ? ' aria-hidden="true"'
      : ` role="img" aria-label="${esc(options.label)}"`;
  const rects = runs(grid)
    .map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${colors[r.idx] ?? "#000"}"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}"${dim} shape-rendering="crispEdges"${a11y}>${rects}</svg>`;
}

/** Stable text form of a grid, one row per line. Useful for tests and debugging. */
export function gridToString(grid: Grid): string {
  const rows: string[] = [];
  for (let y = 0; y < SIZE; y++) {
    let row = "";
    for (let x = 0; x < SIZE; x++) row += ".#oslaiw"[grid[y * SIZE + x] ?? 0] ?? "?";
    rows.push(row);
  }
  return rows.join("\n");
}

// ---------------------------------------------------------------------------------------------
// Smooth style. Same sprite, drawn as rounded vector shapes instead of square pixels.
// Not part of the golden file (it uses floating point); the grid underneath is identical.
// ---------------------------------------------------------------------------------------------

type Pt = [number, number];

/** Boundary loops of the set cells, clockwise, one per outline. Diagonal neighbors stay separate. */
function boundaryLoops(mask: Uint8Array): Pt[][] {
  const N = SIZE + 1;
  const out = new Uint8Array(N * N); // bit d set: an edge leaves this vertex heading d (0 right, 1 down, 2 left, 3 up)
  const set = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < SIZE && y < SIZE && mask[y * SIZE + x] === 1;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!set(x, y)) continue;
      if (!set(x, y - 1)) out[y * N + x]! |= 1;
      if (!set(x + 1, y)) out[y * N + x + 1]! |= 2;
      if (!set(x, y + 1)) out[(y + 1) * N + x + 1]! |= 4;
      if (!set(x - 1, y)) out[(y + 1) * N + x]! |= 8;
    }
  }
  const DX = [1, 0, -1, 0];
  const DY = [0, 1, 0, -1];
  const loops: Pt[][] = [];
  for (let v = 0; v < N * N; v++) {
    while (out[v]! !== 0) {
      const sx = v % N, sy = Math.floor(v / N);
      let d = 0;
      while (((out[v]! >> d) & 1) === 0) d++;
      let cx = sx, cy = sy;
      const pts: Pt[] = [];
      for (;;) {
        out[cy * N + cx]! &= ~(1 << d);
        pts.push([cx, cy]);
        cx += DX[d]!;
        cy += DY[d]!;
        if (cx === sx && cy === sy) break;
        const m = out[cy * N + cx]!;
        // Turn right if possible, which keeps diagonal pixels as separate shapes.
        const next = [(d + 1) % 4, d, (d + 3) % 4].find((o) => (m >> o) & 1);
        if (next === undefined) break;
        d = next;
      }
      loops.push(pts);
    }
  }
  return loops;
}

/** Drop vertices that lie on a straight line. */
function simplify(p: Pt[]): Pt[] {
  const n = p.length;
  return p.filter((b, i) => {
    const a = p[(i + n - 1) % n]!;
    const c = p[(i + 1) % n]!;
    return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) !== 0;
  });
}

/** Chaikin corner cutting: each pass rounds every corner a little more. */
function chaikin(p: Pt[], passes: number): Pt[] {
  let cur = p;
  for (let k = 0; k < passes; k++) {
    const next: Pt[] = [];
    for (let i = 0; i < cur.length; i++) {
      const a = cur[i]!;
      const b = cur[(i + 1) % cur.length]!;
      next.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
      next.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    cur = next;
  }
  return cur;
}

const num = (n: number): string => String(Math.round(n * 100) / 100);

function pathFor(mask: Uint8Array, passes: number): string {
  let d = "";
  for (const loop of boundaryLoops(mask)) {
    const pts = chaikin(simplify(loop), passes);
    if (pts.length < 3) continue;
    d += `M${num(pts[0]![0])} ${num(pts[0]![1])}` + pts.slice(1).map((p) => `L${num(p[0])} ${num(p[1])}`).join("") + "Z";
  }
  return d;
}

/** Cells in connected groups that touch no body pixel: floating props such as the sleepy Z. */
function floatingCells(grid: Grid): Uint8Array {
  const seen = new Uint8Array(SIZE * SIZE);
  const floating = new Uint8Array(SIZE * SIZE);
  for (let start = 0; start < SIZE * SIZE; start++) {
    if (grid[start] === 0 || seen[start]) continue;
    const comp: number[] = [];
    const stack = [start];
    seen[start] = 1;
    let hasBody = false;
    while (stack.length > 0) {
      const i = stack.pop()!;
      comp.push(i);
      const v = grid[i]!;
      if (v === 1 || v === 3 || v === 4) hasBody = true;
      const x = i % SIZE, y = Math.floor(i / SIZE);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
        const j = ny * SIZE + nx;
        if (grid[j] !== 0 && !seen[j]) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    if (!hasBody) for (const i of comp) floating[i] = 1;
  }
  return floating;
}

export interface SmoothOptions extends SvgOptions {
  /** How many times corners are rounded. 0 is the pixel look, 2 is the default, 3 is very round. */
  smoothness?: number;
}

/**
 * The same sprite as `toSVG`, drawn as smooth shapes. The outline is the union of everything, then the body
 * color, then shade, shine, accents, eye whites and ink on top, so no gaps show between regions.
 */
export function toSmoothSVG(grid: Grid, colors: readonly string[], options: SmoothOptions = {}): string {
  const passes = options.smoothness ?? 2;
  const dim = options.size === undefined ? "" : ` width="${options.size}" height="${options.size}"`;
  const a11y =
    options.label === undefined || options.label === ""
      ? ' aria-hidden="true"'
      : ` role="img" aria-label="${esc(options.label)}"`;
  const floating = floatingCells(grid);
  const mask = (pred: (v: number, floats: boolean) => boolean): Uint8Array => {
    const m = new Uint8Array(SIZE * SIZE);
    for (let i = 0; i < m.length; i++) if (pred(grid[i]!, floating[i] === 1)) m[i] = 1;
    return m;
  };
  // Shade touches the body's edge, and rounding would pull its ends away from it. So grow the shade shape
  // outward past the body and clip it to the (rounded) body, which makes it reach every edge cleanly.
  const shade = mask((v, f) => v === 3 && !f);
  const grown = shade.slice();
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (shade[y * SIZE + x] !== 1) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
          const v = grid[ny * SIZE + nx]!;
          if (v === 0 || v === 2) grown[ny * SIZE + nx] = 1;
        }
      }
    }
  }
  const bodyPath = pathFor(mask((v, f) => v !== 0 && v !== 2 && !f), passes);
  const clipId = `pixie-${fnv1a(Array.from(grid)).toString(16)}`;
  const fills: Array<[string, string, string]> = [
    [pathFor(mask((v, f) => v !== 0 && !f), passes), colors[2] ?? "#000", ""],
    [bodyPath, colors[1] ?? "#000", ""],
    [pathFor(grown, passes), colors[3] ?? "#000", ` clip-path="url(#${clipId})"`],
  ];
  for (const idx of [4, 5, 7, 6]) fills.push([pathFor(mask((v, f) => v === idx && !f), passes), colors[idx] ?? "#000", ""]);
  for (const idx of [5, 6]) fills.push([pathFor(mask((v, f) => v === idx && f), passes), colors[idx] ?? "#000", ""]);
  const defs = bodyPath === "" ? "" : `<defs><clipPath id="${clipId}"><path d="${bodyPath}"/></clipPath></defs>`;
  const paths = defs + fills
    .filter(([d]) => d !== "")
    .map(([d, fill, extra]) => `<path d="${d}" fill="${fill}" fill-rule="evenodd"${extra}/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}"${dim} shape-rendering="geometricPrecision"${a11y}>${paths}</svg>`;
}
