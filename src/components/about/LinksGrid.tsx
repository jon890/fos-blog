import { Github, Code } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const LINKS: Array<{
  ttl: string;
  sub: string;
  href: string;
  ico: LucideIcon;
}> = [
  { ttl: "GitHub",  sub: "@jon890",          href: "https://github.com/jon890",           ico: Github },
  { ttl: "Source",  sub: "jon890/fos-blog",  href: "https://github.com/jon890/fos-blog",  ico: Code },
  { ttl: "Content", sub: "jon890/fos-study", href: "https://github.com/jon890/fos-study", ico: Code },
] as const;

export function LinksGrid() {
  return (
    <div className="ab-chip-grid col3">
      {LINKS.map((l) => (
        <a
          key={l.ttl}
          className="ab-chip link"
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="ico">
            <l.ico size={16} />
          </span>
          <span className="ab-chip-link-body">
            <span className="ttl">{l.ttl}</span>
            <span className="sub">{l.sub}</span>
          </span>
          <span className="key">↗</span>
        </a>
      ))}
    </div>
  );
}
