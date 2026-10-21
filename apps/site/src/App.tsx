import { useRef, useState, type ReactNode } from "react";
import { generate, type AttentionMode, type Mood } from "@pixie/core";
import { Mascot, type MascotHandle } from "@pixie/react";
import { Playground } from "./Playground";
import { PLATFORMS, snippet, type Platform } from "./snippets";
import { CopyButton, Meter, Section } from "./ui";

const GALLERY: Array<[string, string]> = [
  ["soft", "bubbanbbebb"], ["soft", "mumu"], ["soft", "moon"], ["soft", "noodle"], ["soft", "woolly"], ["soft", "boom"],
  ["sharp", "jsakkkwaakiyy"], ["sharp", "zzkt"], ["sharp", "kick"], ["sharp", "quartz"], ["sharp", "jinx"], ["sharp", "kixtz"],
  ["names", "sagar"], ["names", "claude"], ["names", "alice"], ["names", "groot"], ["names", "tyler"], ["names", "muse"],
  ["phrases", "sleepy cloud"], ["phrases", "angry wasp"], ["phrases", "soft pillow"], ["phrases", "thunderbolt"], ["phrases", "hello world"], ["phrases", "123"],
];

function GalleryCard({ group, word }: { group: string; word: string }): ReactNode {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      className="gcard"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      onClick={() => {
        const url = new URL(location.href);
        url.searchParams.set("t", word);
        location.href = `${url.pathname}?${url.searchParams}#try`;
      }}
      title={`Try "${word}"`}
    >
      <Mascot text={word} size={88} animated={false} mood={hover ? "happy" : "neutral"} />
      <span className="gword">{word}</span>
      <span className="gtag">{group}</span>
    </button>
  );
}

function Compare(): ReactNode {
  const pair = ["bubbanbbebb", "jsakkkwaakiyy"].map((w) => ({ w, s: generate(w) }));
  return (
    <div className="compare">
      {pair.map(({ w, s }) => (
        <div key={w} className="panel compare-card" data-mascot-ignore>
          <Mascot text={w} size={168} />
          <h3>{w}</h3>
          <p className="caption">{s.template === "blob" ? "Round" : s.template === "box" ? "Boxy" : s.template === "wedge" ? "Wedge" : "Crystal"} body, {s.eyeStyle === "big" ? "big eyes" : "tiny eyes"}</p>
          <Meter label="round" value={s.traits.roundness} />
          <Meter label="energy" value={s.traits.energy} />
        </div>
      ))}
    </div>
  );
}

function Demo(): ReactNode {
  const ref = useRef<MascotHandle>(null);
  const [attention, setAttention] = useState<AttentionMode>("sometimes");
  const [sent, setSent] = useState(false);
  const moods: Mood[] = ["happy", "sad", "surprised", "thinking", "sleepy"];
  return (
    <div className="demo">
      <div className="panel demo-card">
        <div className="demo-mascot">
          <button type="button" className="plain" onClick={() => ref.current?.poke()} aria-label="Poke the mascot" data-mascot-ignore>
            <Mascot ref={ref} text="pixie friend" size={128} auto attention={attention} sleepAfterMs={20000} />
          </button>
          <p className="caption">{sent ? "Account created!" : "Poke me. Or try the form."}</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
            setTimeout(() => setSent(false), 2500);
          }}
        >
          <label className="field"><span>Name</span><input name="name" required placeholder="Ada" autoComplete="off" /></label>
          <label className="field"><span>Email</span><input name="email" type="email" required placeholder="ada@example.com" autoComplete="off" /></label>
          <label className="field"><span>Password</span><input name="password" type="password" placeholder="shh" autoComplete="new-password" /></label>
          <div className="row">
            <button className="btn primary" type="submit">Create account</button>
            <button className="btn danger" type="button" data-mascot="worried">Delete account</button>
          </div>
        </form>
      </div>
      <div className="demo-notes">
        <h3>It listens to the whole page</h3>
        <ul className="list">
          <li>Hover a button: it looks at it.</li>
          <li>Hover <b>Delete account</b>: it worries (<code>data-mascot="worried"</code>).</li>
          <li>Focus the password field: it shuts its eyes.</li>
          <li>Type: its eyes follow the text.</li>
          <li>Submit with an empty field: sad. A valid submit: happy.</li>
          <li>Leave it alone for 20 seconds: it falls asleep.</li>
        </ul>
        <div className="row">
          <span className="label">Attention</span>
          <div className="chips">
            {(["always", "sometimes", "never"] as const).map((a) => (
              <button key={a} type="button" className={`chip ${attention === a ? "on" : ""}`} onClick={() => setAttention(a)}>{a}</button>
            ))}
          </div>
        </div>
        <div className="row">
          <span className="label">Or set a mood from code</span>
          <div className="chips">
            {moods.map((m) => (
              <button key={m} type="button" className="chip" onClick={() => ref.current?.react(m, 2500)}>{m}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Docs(): ReactNode {
  const [platform, setPlatform] = useState<Platform>("react");
  const install: Record<Platform, string> = {
    react: "pnpm add @pixie/react",
    web: "pnpm add @pixie/core",
    swift: `.package(url: "https://github.com/you/pixie", from: "0.1.0")`,
    kotlin: `implementation("dev.pixie:pixie:0.1.0")`,
    node: "pnpm add @pixie/core",
  };
  const code = `${install[platform]}\n\n${snippet(platform, "your text")}`;
  return (
    <div className="docs">
      <div className="panel">
        <div className="tabs" role="tablist">
          {PLATFORMS.map((p) => (
            <button key={p.id} role="tab" aria-selected={platform === p.id} className={`tab ${platform === p.id ? "on" : ""}`} onClick={() => setPlatform(p.id)}>{p.label}</button>
          ))}
        </div>
        <pre className="code"><code>{code}</code></pre>
        <div className="row end"><CopyButton text={code} /></div>
        <p className="note">Packages are not published yet. Use them from this repository.</p>
      </div>
      <div className="cards">
        <article className="panel">
          <h3>Same text, same mascot</h3>
          <p>The generator is a pure function of the text and an algorithm version. No randomness, no clock, no floating point. Swift and Kotlin ports are tested against the same golden file as the web package.</p>
        </article>
        <article className="panel">
          <h3>Versioned art</h3>
          <p>Pass <code>version</code> to pin the look. A shipped version never changes; improvements arrive as a new version so stored avatars stay put.</p>
        </article>
        <article className="panel">
          <h3>Tiny and accessible</h3>
          <p>Crisp SVG rects, no dependencies. Every mascot gets an accessible description, and motion stops when the user prefers reduced motion.</p>
        </article>
      </div>
    </div>
  );
}

export function App(): ReactNode {
  return (
    <>
      <nav className="nav" data-mascot-ignore>
        <a href="#top" className="brand">
          <Mascot text="pixie" size={32} animated={false} />
          <span>PIXIE</span>
        </a>
        <div className="navlinks">
          <a href="#try">Try it</a>
          <a href="#how">How it works</a>
          <a href="#gallery">Gallery</a>
          <a href="#demo">Reactions</a>
          <a href="#docs">Docs</a>
        </div>
      </nav>

      <main id="top">
        <header className="hero" data-mascot-ignore>
          <p className="kicker">pixel mascots from text</p>
          <h1>Type a word.<br />Get a creature.</h1>
          <p className="lede">
            Pixie turns any text into a retro pixel mascot. The <em>sound</em> of the words decides the shape:
            soft sounds make round creatures, sharp sounds make spiky ones. Same text, same mascot, on every platform.
          </p>
        </header>

        <div id="try"><Playground /></div>

        <Section id="how" kicker="bouba / kiki" title="The sound picks the shape">
          <p className="lede narrow">
            People hear <em>bubba</em> as round and <em>kikki</em> as pointy. Pixie uses that. Each letter carries a little
            roundness, sharpness, weight and surprise; the totals become four traits, and the traits pick the body, the parts, the face and the colors.
          </p>
          <Compare />
          <ol className="steps">
            <li><b>Normalize</b><span>Trim, fold case, hash. Equivalent text gives the same seed.</span></li>
            <li><b>Listen</b><span>Letters become roundness, heft, energy and chaos.</span></li>
            <li><b>Build</b><span>A 16x16 sprite: body, ears or horns, feet, face, palette.</span></li>
            <li><b>Live</b><span>Blinks, bobs, follows the cursor, reacts to your UI.</span></li>
          </ol>
        </Section>

        <Section id="gallery" kicker="gallery" title="Words, names, sentences">
          <div className="gallery">
            {GALLERY.map(([g, w]) => <GalleryCard key={w} group={g} word={w} />)}
          </div>
        </Section>

        <Section id="demo" kicker="awareness" title="It reacts to your UI">
          <Demo />
        </Section>

        <Section id="docs" kicker="use it" title="One line in your project">
          <Docs />
        </Section>
      </main>

      <footer className="footer" data-mascot-ignore>
        <Mascot text="pixie" size={40} animated={false} />
        <span>Pixie. MIT license. Made of squares.</span>
      </footer>
    </>
  );
}
