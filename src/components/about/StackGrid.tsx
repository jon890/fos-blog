const STACK = [
  { label: "Next.js 16",         hue: 0,   key: "framework" },
  { label: "TypeScript",         hue: 220, key: "language" },
  { label: "Tailwind v4",        hue: 195, key: "styling" },
  { label: "Drizzle ORM",        hue: 90,  key: "data" },
  { label: "MySQL 8",            hue: 55,  key: "db" },
  { label: "Docker",             hue: 230, key: "infra" },
  { label: "Octokit",            hue: 145, key: "github" },
  { label: "rehype-pretty-code", hue: 250, key: "syntax" },
  { label: "mermaid",            hue: 175, key: "diagram" },
  { label: "Vitest",             hue: 120, key: "test" },
  { label: "pino",               hue: 35,  key: "log" },
  { label: "shadcn/ui",          hue: 280, key: "ui" },
] as const;

export { STACK };

export function StackGrid() {
  return (
    <div className="ab-chip-grid">
      {STACK.map((s) => (
        <span
          key={s.key}
          className="ab-chip"
          style={{ "--cat-color": `oklch(0.74 0.09 ${s.hue})` } as React.CSSProperties}
        >
          <span className="dot" />
          <span className="ab-chip-label">{s.label}</span>
          <span className="key">{s.key}</span>
        </span>
      ))}
    </div>
  );
}
