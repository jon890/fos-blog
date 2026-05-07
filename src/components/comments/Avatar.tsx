"use client";

import { OG_CATEGORY_HEX } from "@/lib/og-palette";

// plan021 의 OG_CATEGORY_HEX 를 단일 소스로 재사용 — 색상 변경 시 OG/Avatar 일관성 보장.
// record → array 변환은 hash 모듈로 안정적으로 인덱스화하기 위함.
const AVATAR_PALETTE = Object.values(OG_CATEGORY_HEX);

function hashNickname(nickname: string): number {
  let h = 0;
  for (const ch of nickname) {
    h = (h * 31 + ch.charCodeAt(0)) | 0;
  }
  return Math.abs(h);
}

const SIZE_CLASS: Record<number, string> = {
  28: "h-7 w-7",
  36: "h-9 w-9",
};

export function Avatar({ nickname, size = 36 }: { nickname: string; size?: number }) {
  const initial = nickname.trim().charAt(0).toUpperCase() || "?";
  const color = AVATAR_PALETTE[hashNickname(nickname) % AVATAR_PALETTE.length];
  const sizeClass = SIZE_CLASS[size] ?? "h-9 w-9";
  return (
    <div
      role="img"
      aria-label={`${nickname} 아바타`}
      style={{ background: `${color}26`, color, borderColor: `${color}80` }}
      className={`${sizeClass} flex items-center justify-center rounded-full border font-semibold select-none`}
    >
      {initial}
    </div>
  );
}
