// Spec: spec/sprite.md "Normalization". Every port must match this exactly.

export const MAX_CODE_POINTS = 128;

/** U+0009-000D, U+0020, U+00A0, U+2000-200A, U+2028, U+2029, U+202F, U+205F, U+3000 */
function isSpace(c: number): boolean {
  return (
    (c >= 0x09 && c <= 0x0d) ||
    c === 0x20 ||
    c === 0xa0 ||
    (c >= 0x2000 && c <= 0x200a) ||
    c === 0x2028 ||
    c === 0x2029 ||
    c === 0x202f ||
    c === 0x205f ||
    c === 0x3000
  );
}

/**
 * NFC, ASCII-only lowercase (so every language agrees), whitespace runs become one space,
 * trimmed, capped at MAX_CODE_POINTS code points.
 */
export function normalize(text: string): string {
  const out: string[] = [];
  let pendingSpace = false;
  for (const ch of text.normalize("NFC")) {
    let c = ch.codePointAt(0)!;
    if (isSpace(c)) {
      pendingSpace = out.length > 0;
      continue;
    }
    if (pendingSpace) {
      out.push(" ");
      pendingSpace = false;
    }
    if (c >= 65 && c <= 90) c += 32;
    out.push(String.fromCodePoint(c));
  }
  const capped = out.slice(0, MAX_CODE_POINTS);
  if (capped[capped.length - 1] === " ") capped.pop();
  return capped.join("");
}
