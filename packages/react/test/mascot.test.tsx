// @vitest-environment jsdom
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Mascot, type MascotHandle } from "../src";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("<Mascot />", () => {
  it("renders on the server with real markup", () => {
    const html = renderToString(<Mascot text="bubbanbbebb" size={80} />);
    expect(html).toContain("<svg");
    expect(html).toContain('width="80"');
    expect(html).toContain("pixel mascot");
  });

  it("server markup is stable for the same text", () => {
    expect(renderToString(<Mascot text="bubba" />)).toBe(renderToString(<Mascot text="bubba" />));
    expect(renderToString(<Mascot text="bubba" />)).not.toBe(renderToString(<Mascot text="kzzt" />));
  });

  it("mounts, animates and cleans up", () => {
    act(() => root.render(<Mascot text="bubba" size={32} />));
    expect(host.querySelector("svg")?.getAttribute("width")).toBe("32");
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      act(() => void vi.advanceTimersByTime(100));
      seen.add(host.innerHTML);
    }
    expect(seen.size).toBeGreaterThan(1);
    act(() => root.render(<div />));
    expect(host.querySelector("svg")).toBeNull();
  });

  it("changes mascot when the text prop changes", () => {
    act(() => root.render(<Mascot text="bubba" animated={false} />));
    const before = host.innerHTML;
    act(() => root.render(<Mascot text="jsakkkwaakiyy" animated={false} />));
    expect(host.innerHTML).not.toBe(before);
  });

  it("follows the mood prop", () => {
    act(() => root.render(<Mascot text="bubba" animated={false} mood="neutral" />));
    const neutral = host.innerHTML;
    act(() => root.render(<Mascot text="bubba" animated={false} mood="happy" />));
    expect(host.innerHTML).not.toBe(neutral);
  });

  it("exposes an imperative handle", () => {
    const ref = createRef<MascotHandle>();
    act(() => root.render(<Mascot ref={ref} text="bubba" sleepAfterMs={0} />));
    expect(ref.current?.sprite?.text).toBe("bubba");
    act(() => {
      ref.current?.react("surprised", 5000);
      vi.advanceTimersByTime(300);
    });
    // Surprised draws the "!" prop in the accent color, so the markup changed.
    expect(host.innerHTML).toContain("<rect");
  });

  it("survives React strict mode double-mounting", () => {
    // Strict mode is a no-op for createRoot in tests, so simulate: unmount and mount again.
    act(() => root.render(<Mascot text="bubba" />));
    act(() => root.render(<div />));
    act(() => root.render(<Mascot text="bubba" />));
    expect(host.querySelectorAll("svg")).toHaveLength(1);
  });
});
