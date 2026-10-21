import { useState, type ReactNode } from "react";

export function Meter({ label, value }: { label: string; value: number }): ReactNode {
  const on = Math.round(value / 10);
  return (
    <div className="meter" title={`${label} ${value}`}>
      <span className="meter-label">{label}</span>
      <span className="meter-cells" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} className={i < on ? "on" : ""} />
        ))}
      </span>
      <span className="meter-num">{value}</span>
    </div>
  );
}

export function CopyButton({ text }: { text: string }): ReactNode {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn small"
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          /* clipboard blocked: nothing to do */
        }
      }}
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}

export function Section({ id, title, kicker, children }: { id: string; title: string; kicker?: string; children: ReactNode }): ReactNode {
  return (
    <section id={id} className="section" data-mascot-ignore>
      <header className="section-head">
        {kicker && <p className="kicker">{kicker}</p>}
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}
