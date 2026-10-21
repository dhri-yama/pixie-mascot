// Spec: spec/sprite.md "Output". Integer coordinates and hex colors only, so output is stable.

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
