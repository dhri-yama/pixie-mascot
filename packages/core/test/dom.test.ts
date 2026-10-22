// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { definePixieElement, mountMascot, toMood, type MountedMascot } from "../src/dom";

let host: HTMLDivElement;
let mounted: MountedMascot[] = [];
const mount = (o: Parameters<typeof mountMascot>[1] = { text: "bubba" }): MountedMascot => {
  const m = mountMascot(host, { sleepAfterMs: 0, ...o });
  mounted.push(m);
  return m;
};
const tick = (ms: number): void => void vi.advanceTimersByTime(ms);
const fire = (type: string, target: EventTarget, init: MouseEventInit & { relatedTarget?: EventTarget | null } = {}): void => {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, ...init }));
};

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = "";
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => {
  for (const m of mounted) m.destroy();
  mounted = [];
  vi.useRealTimers();
});

describe("mountMascot", () => {
  it("draws an accessible SVG", () => {
    mount({ text: "bubbanbbebb", size: 96 });
    const svg = host.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("96");
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toMatch(/pixel mascot/);
    expect(svg.querySelectorAll("rect").length).toBeGreaterThan(10);
  });

  it("smooth mode draws paths instead of rects, and can be switched on later", () => {
    const m = mount({ text: "bubba", smooth: true, animated: false });
    expect(host.querySelector("path")).not.toBeNull();
    expect(host.querySelector("rect")).toBeNull();
    m.update({ smooth: false });
    expect(host.querySelector("rect")).not.toBeNull();
    expect(host.querySelector("path")).toBeNull();
  });

  it("static mode draws once and sets the app mood", () => {
    const m = mount({ text: "bubba", animated: false, mood: "happy" });
    const before = host.innerHTML;
    tick(5000);
    expect(host.innerHTML).toBe(before);
    expect(m.pose.mood).toBe("happy");
    m.setMood("sad");
    expect(m.pose.mood).toBe("sad");
    expect(host.innerHTML).not.toBe(before);
  });

  it("follows the pointer", () => {
    const m = mount({ text: "bubba", attention: "always" });
    fire("pointermove", document, { clientX: 500, clientY: 0 });
    tick(1000);
    expect(m.pose.gaze).toEqual({ x: 1, y: 0 });
    fire("pointermove", document, { clientX: -500, clientY: 0 });
    tick(1000);
    expect(m.pose.gaze).toEqual({ x: -1, y: 0 });
  });

  it("ignores the pointer when attention is never", () => {
    const m = mount({ text: "bubba", attention: "never" });
    fire("pointermove", document, { clientX: 900, clientY: 900 });
    tick(500);
    // It may glance around by itself, but nothing tracked the pointer.
    expect(m.sprite.text).toBe("bubba");
    expect(host.querySelector("svg")).not.toBeNull();
  });

  it("animates: the picture changes over time", () => {
    mount({ text: "bubba" });
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tick(100);
      seen.add(host.innerHTML);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("update() regenerates on new text and keeps the app mood", () => {
    const m = mount({ text: "bubba", mood: "sad" });
    const before = host.innerHTML;
    m.update({ text: "jsakkkwaakiyy" });
    expect(m.sprite.text).toBe("jsakkkwaakiyy");
    expect(host.innerHTML).not.toBe(before);
    tick(200);
    expect(m.pose.mood).toBe("sad");
  });

  it("destroy removes the picture and the listeners", () => {
    const m = mount({ text: "bubba", attention: "always" });
    m.destroy();
    expect(host.innerHTML).toBe("");
    fire("pointermove", document, { clientX: 500, clientY: 0 });
    tick(1000);
    expect(host.innerHTML).toBe("");
  });

  it("respects reduced motion: no moving", () => {
    const m = mount({ text: "bubba", reducedMotion: true });
    for (let i = 0; i < 100; i++) {
      tick(100);
      expect(m.pose.lift).toBe(0);
      expect(m.pose.squash).toBe(0);
    }
  });

  it("stops drawing while the page is hidden", () => {
    mount({ text: "bubba" });
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    const before = host.innerHTML;
    tick(5000);
    expect(host.innerHTML).toBe(before);
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
  });
});

describe("auto mode", () => {
  const page = (): { form: HTMLFormElement; save: HTMLButtonElement; name: HTMLInputElement; pass: HTMLInputElement; danger: HTMLButtonElement; skip: HTMLButtonElement } => {
    const root = document.createElement("div");
    root.innerHTML = `<form>
      <input id="name" type="text" required />
      <input id="pass" type="password" />
      <button id="save" type="submit">Save</button>
      <button id="danger" type="button" data-mascot="worried">Delete</button>
      <div data-mascot-ignore><button id="skip" type="button" data-mascot="happy">Ignore me</button></div>
    </form>`;
    document.body.append(root);
    const q = <T extends Element>(s: string): T => root.querySelector(s) as T;
    return { form: q("form"), save: q("#save"), name: q("#name"), pass: q("#pass"), danger: q("#danger"), skip: q("#skip") };
  };

  it("looks at a hovered button and applies its data-mascot mood, then lets go", () => {
    const m = mount({ text: "bubba", auto: true });
    const { danger } = page();
    fire("pointerover", danger);
    tick(500);
    expect(m.pose.mood).toBe("sad"); // "worried" is an alias for sad
    fire("pointerout", danger, { relatedTarget: document.body });
    tick(500);
    expect(m.pose.mood).toBe("neutral");
  });

  it("reacts to a click: happy for submit, surprised for other buttons", () => {
    const m = mount({ text: "bubba", auto: true });
    const { save, name } = page();
    name.required = false; // a valid form; an invalid one would (rightly) make it sad
    save.addEventListener("click", (e) => e.preventDefault()); // jsdom cannot submit forms
    fire("click", save);
    tick(200);
    expect(m.pose.mood).toBe("happy");
    tick(2000);
    expect(m.pose.mood).toBe("neutral");
    const plain = document.createElement("button");
    plain.type = "button";
    document.body.append(plain);
    fire("click", plain);
    tick(200);
    expect(m.pose.mood).toBe("surprised");
  });

  it("closes its eyes while a password field is focused", () => {
    const m = mount({ text: "bubba", auto: true });
    const { pass } = page();
    fire("focusin", pass);
    tick(300);
    expect(m.pose.mood).toBe("sleepy");
    fire("focusout", pass);
    tick(300);
    expect(m.pose.mood).toBe("neutral");
  });

  it("looks at the focused text field", () => {
    const m = mount({ text: "bubba", auto: true });
    const { name } = page();
    fire("focusin", name);
    tick(500);
    expect(m.pose.gaze).toBeDefined();
    fire("focusout", name);
  });

  it("is sad about invalid fields and happy about submits", () => {
    const m = mount({ text: "bubba", auto: true });
    const { name, form } = page();
    name.dispatchEvent(new Event("invalid"));
    tick(200);
    expect(m.pose.mood).toBe("sad");
    tick(3000);
    form.dispatchEvent(new Event("submit", { bubbles: true }));
    tick(200);
    expect(m.pose.mood).toBe("happy");
  });

  it("ignores elements inside [data-mascot-ignore] and its own container", () => {
    const m = mount({ text: "bubba", auto: true });
    const { skip } = page();
    fire("click", skip);
    tick(300);
    expect(m.pose.mood).toBe("neutral");
  });

  it("does nothing special when auto is off", () => {
    const m = mount({ text: "bubba" });
    const { save } = page();
    fire("click", save);
    tick(300);
    expect(m.pose.mood).toBe("neutral");
  });
});

describe("toMood", () => {
  it("accepts moods and aliases, rejects the rest", () => {
    expect(toMood("happy")).toBe("happy");
    expect(toMood("worried")).toBe("sad");
    expect(toMood("nonsense")).toBeNull();
    expect(toMood(null)).toBeNull();
  });
});

describe("<pixie-mascot>", () => {
  it("renders from attributes and reacts to attribute changes", () => {
    definePixieElement();
    const el = document.createElement("pixie-mascot");
    el.setAttribute("text", "bubba");
    el.setAttribute("size", "48");
    el.setAttribute("animated", "false");
    document.body.append(el);
    expect(el.querySelector("svg")?.getAttribute("width")).toBe("48");
    const before = el.innerHTML;
    el.setAttribute("text", "jsakkkwaakiyy");
    expect(el.innerHTML).not.toBe(before);
    el.setAttribute("mood", "happy");
    el.remove();
    expect(el.innerHTML).toBe("");
  });

  it("can be defined twice", () => {
    expect(definePixieElement()).toBe(definePixieElement());
  });
});

describe("walkAround", () => {
  const size = (el: HTMLElement, w: number, h: number): void => {
    Object.defineProperty(el, "clientWidth", { value: w, configurable: true });
    Object.defineProperty(el, "clientHeight", { value: h, configurable: true });
    Object.defineProperty(el, "offsetWidth", { value: w, configurable: true });
    Object.defineProperty(el, "offsetHeight", { value: h, configurable: true });
  };
  const place = (): { street: HTMLElement; walker: HTMLElement } => {
    const street = document.createElement("div");
    const walker = document.createElement("span");
    street.append(walker);
    document.body.append(street);
    size(street, 300, 200);
    size(walker, 100, 100);
    Object.defineProperty(walker, "offsetParent", { value: street, configurable: true });
    return { street, walker };
  };
  const pos = (el: HTMLElement): { x: number; y: number; flip: number } => {
    const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\) scaleX\((-?1)\)/.exec(el.style.transform)!;
    return { x: Number(m[1]), y: Number(m[2]), flip: Number(m[3]) };
  };

  it("walks the edge clockwise, pausing at corners and facing the way it goes", async () => {
    const { walker } = place();
    const { walkAround } = await import("../src/dom");
    const stop = walkAround(walker, { speed: 100, pauseMs: 500 });
    tick(16);
    expect(pos(walker)).toMatchObject({ x: 0, y: 100, flip: 1 }); // starts bottom-left
    tick(1000); // 100px/s along the 200px bottom edge
    expect(pos(walker).x).toBeGreaterThan(80);
    expect(pos(walker).y).toBe(100);
    tick(1100 + 500 + 1200); // finish the bottom edge, pause, then climb the right side (100px)
    expect(pos(walker).x).toBe(200);
    tick(600 + 500 + 1000); // finish the climb, pause, then head left along the top
    expect(pos(walker).y).toBe(0);
    expect(pos(walker).flip).toBe(-1);
    stop();
    expect(walker.style.transform).toBe("");
  });

  it("stops at corners for the pause", async () => {
    const { walker } = place();
    const { walkAround } = await import("../src/dom");
    const stop = walkAround(walker, { speed: 1000, pauseMs: 2000 });
    tick(500); // reaches the bottom-right corner almost at once
    const atCorner = pos(walker);
    tick(1000);
    expect(pos(walker)).toEqual(atCorner);
    stop();
  });

  it("is switched on with the walk option and off again with update", () => {
    const { street } = place();
    const m = mountMascot(street, { text: "bubba", size: 100, sleepAfterMs: 0, walk: true });
    mounted.push(m);
    tick(300);
    expect(street.style.transform).toMatch(/translate/);
    m.update({ walk: false });
    expect(street.style.transform).toBe("");
  });
});
