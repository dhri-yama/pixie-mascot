import { useMemo, useState, type ReactNode } from "react";
import { MOODS, compose, describe, generate, toSVG, type Mood, type PresetName } from "@pixie/core";
import { Mascot } from "@pixie/react";
import { PLATFORMS, snippet, type Platform } from "./snippets";
import { CopyButton, Meter } from "./ui";

const TRY = ["bubbanbbebb", "jsakkkwaakiyy", "sleepy cloud", "razor wire", "moon", "zzkt", "your name"];
const PALETTES: Array<PresetName | ""> = ["", "gameboy", "mono", "amber"];

const initialText = (): string => new URLSearchParams(location.search).get("t") ?? "bubbanbbebb";

export function Playground(): ReactNode {
  const [text, setText] = useState(initialText);
  const [mood, setMood] = useState<Mood | null>(null);
  const [palette, setPalette] = useState<PresetName | "">("");
  const [platform, setPlatform] = useState<Platform>("react");

  const sprite = useMemo(() => generate(text, { palette: palette || undefined }), [text, palette]);

  const change = (v: string): void => {
    setText(v);
    const url = new URL(location.href);
    url.searchParams.set("t", v);
    history.replaceState(null, "", url);
  };
  const download = (): void => {
    const svg = toSVG(compose(sprite, { mood: mood ?? "neutral" }), sprite.colors, { size: 512, label: describe(sprite) });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    a.download = `pixie-${sprite.text.replace(/[^a-z0-9]+/g, "-").slice(0, 24) || "mascot"}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const code = snippet(platform, text);

  return (
    <div className="playground panel" data-mascot-ignore>
      <div className="stage">
        <div className="stage-art">
          <Mascot text={text} size={240} mood={mood} palette={palette || undefined} label={describe(sprite)} />
        </div>
        <p className="caption">{describe(sprite)}</p>
        <div className="meters">
          <Meter label="round" value={sprite.traits.roundness} />
          <Meter label="heft" value={sprite.traits.heft} />
          <Meter label="energy" value={sprite.traits.energy} />
          <Meter label="chaos" value={sprite.traits.chaos} />
        </div>
      </div>

      <div className="controls">
        <label className="field">
          <span>Type anything</span>
          <input value={text} onChange={(e) => change(e.target.value)} spellCheck={false} autoComplete="off" maxLength={200} />
        </label>
        <div className="chips" aria-label="Try these">
          {TRY.map((w) => (
            <button key={w} type="button" className="chip" onClick={() => change(w === "your name" ? "" : w)}>
              {w}
            </button>
          ))}
        </div>

        <div className="row">
          <span className="label">Mood</span>
          <div className="chips">
            <button type="button" className={`chip ${mood === null ? "on" : ""}`} onClick={() => setMood(null)}>alive</button>
            {MOODS.map((m) => (
              <button key={m} type="button" className={`chip ${mood === m ? "on" : ""}`} onClick={() => setMood(m)}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          <span className="label">Palette</span>
          <div className="chips">
            {PALETTES.map((p) => (
              <button key={p || "curated"} type="button" className={`chip ${palette === p ? "on" : ""}`} onClick={() => setPalette(p)}>
                {p || "curated"}
              </button>
            ))}
          </div>
        </div>

        <div className="tabs" role="tablist">
          {PLATFORMS.map((p) => (
            <button key={p.id} role="tab" aria-selected={platform === p.id} className={`tab ${platform === p.id ? "on" : ""}`} onClick={() => setPlatform(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
        <pre className="code"><code>{code}</code></pre>
        <div className="row end">
          <CopyButton text={code} />
          <button type="button" className="btn small" onClick={download}>Download SVG</button>
        </div>
      </div>
    </div>
  );
}
