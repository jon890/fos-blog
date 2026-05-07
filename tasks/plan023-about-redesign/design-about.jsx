/* global React */

const STACK = [
  { label: "Next.js 16",     hue: 0,   key: "framework" },
  { label: "TypeScript",     hue: 220, key: "language" },
  { label: "Tailwind v4",    hue: 195, key: "styling" },
  { label: "Drizzle ORM",    hue: 90,  key: "data" },
  { label: "MySQL 8",        hue: 55,  key: "db" },
  { label: "Redis",          hue: 25,  key: "cache" },
  { label: "Docker",         hue: 230, key: "infra" },
  { label: "GitHub Actions", hue: 145, key: "ci/cd" },
  { label: "Vercel",         hue: 280, key: "hosting" },
  { label: "MDX",            hue: 180, key: "content" },
  { label: "shiki",          hue: 250, key: "syntax" },
  { label: "Geist · Pretendard", hue: 195, key: "type" },
];

const LINKS = [
  { ttl: "GitHub",     sub: "@jon890",                ico: "github" },
  { ttl: "Source",     sub: "jon890/fos-study",       ico: "code" },
  { ttl: "RSS",        sub: "/rss.xml",               ico: "rss" },
  { ttl: "Email",      sub: "hi@fos-blog.dev",        ico: "mail" },
  { ttl: "Newsletter", sub: "weekly · 1 post",        ico: "send" },
  { ttl: "X / Twitter",sub: "@jon890_dev",            ico: "x" },
];

const ICO = {
  github: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>,
  code:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
  rss:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>,
  mail:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
  send:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg>,
  x:      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4l11.733 16h4.267l-11.733 -16z"/><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"/></svg>,
};
const catC = (h) => `oklch(0.74 0.09 ${h})`;

function About({ theme = "dark", mobile = false }) {
  const cls = "ab-shell" + (theme === "light" ? " light" : "") + (mobile ? " mobile" : "");

  return (
    <div className={cls}>

      {/* Sub-hero */}
      <header className="ab-subhero">
        <div className="ab-container">
          <span className="ab-eyebrow">ABOUT</span>
          <h1 className="ab-title">FOS Study</h1>
          <p className="ab-meta">
            한 명의 백엔드 엔지니어가 매일 쌓는 학습 노트.
            공부하면서 기록하고, 기록하면서 다시 배웁니다.
          </p>
        </div>
      </header>

      <main className="ab-container">

        {/* ProfileCard */}
        <section className="ab-section" style={{ marginTop: mobile ? 32 : 48 }}>
          <div className="ab-section-head">
            <span className="h2"><span className="idx">01</span><span>profile</span></span>
          </div>
          <article className="ab-card ab-profile">
            <div className="ab-avatar">J</div>
            <div className="ab-profile-body">
              <h2 className="ab-profile-name">
                Jon Choi
                <span className="handle">@jon890</span>
              </h2>
              <p className="ab-profile-bio">
                Backend engineer · Seoul. Java/Spring 위에서 결제·쿠폰·재고를 다룹니다.
                밤에는 Postgres, RAG, 한국어 검색 같은 곁가지 주제를 만지면서 노트를 정리합니다.
                무조건 빠른 코드보다는 다섯 명이 함께 읽기 편한 코드를 좋아합니다.
              </p>
              <div className="ab-profile-stats">
                <span className="stat"><span className="num">42</span><span className="lbl">repos</span></span>
                <span className="stat"><span className="num">328</span><span className="lbl">followers</span></span>
                <span className="stat"><span className="num">7y</span><span className="lbl">writing</span></span>
              </div>
              <a className="ab-profile-cta">
                <span>github.com/jon890</span>
                <span className="arr">↗</span>
              </a>
            </div>
          </article>
        </section>

        {/* SiteStats */}
        <section className="ab-section">
          <div className="ab-section-head">
            <span className="h2"><span className="idx">02</span><span>site stats</span></span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)", letterSpacing: 0 }}>
              snapshot · 2026.05.07
            </span>
          </div>
          <div className="ab-stats">
            <div className="ab-card ab-stat">
              <div className="ab-stat-eyebrow"><span>POSTS</span><span className="right">total</span></div>
              <div className="ab-stat-num">200<span className="unit">.mdx</span></div>
              <div className="ab-stat-sub">9 categories · 12 series</div>
            </div>
            <div className="ab-card ab-stat">
              <div className="ab-stat-eyebrow"><span>CATEGORIES</span><span className="right">active</span></div>
              <div className="ab-stat-num">9<span className="unit">/ 12</span></div>
              <div className="ab-stat-sub">3 are draft-only</div>
            </div>
            <div className="ab-card ab-stat">
              <div className="ab-stat-eyebrow"><span>LAST SYNC</span><span className="right">git</span></div>
              <div className="ab-stat-num">2<span className="unit">시간 전</span></div>
              <div className="ab-stat-sub">
                <span className="pulse" />
                <span>main · #a3f9c1</span>
              </div>
            </div>
          </div>
        </section>

        {/* StackGrid */}
        <section className="ab-section">
          <div className="ab-section-head">
            <span className="h2"><span className="idx">03</span><span>stack</span></span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)", letterSpacing: 0 }}>
              {STACK.length} packages
            </span>
          </div>
          <div className={"ab-chip-grid" + (mobile ? "" : "")}>
            {STACK.map((s, i) => (
              <span key={i} className="ab-chip" style={{ "--cat-color": catC(s.hue) }}>
                <span className="dot" />
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
                <span className="key">{s.key}</span>
              </span>
            ))}
          </div>
        </section>

        {/* LinksGrid */}
        <section className="ab-section">
          <div className="ab-section-head">
            <span className="h2"><span className="idx">04</span><span>links</span></span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)", letterSpacing: 0 }}>
              external
            </span>
          </div>
          <div className={"ab-chip-grid col3"}>
            {LINKS.map((l, i) => (
              <a key={i} className="ab-chip link">
                <span className="ico">{ICO[l.ico]}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="ttl">{l.ttl}</span>
                  <span className="sub">{l.sub}</span>
                </span>
                <span className="key">↗</span>
              </a>
            ))}
          </div>
        </section>

        <div className="ab-end">
          <span>fos-blog · /about · last build 2026.05.07 · v0.1</span>
          <span>© 2026 FOS Study · MIT</span>
        </div>
      </main>
    </div>
  );
}

Object.assign(window, { About });
