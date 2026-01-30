"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ComponentProps } from "react";

type ThemeProviderProps = ComponentProps<typeof NextThemesProvider>;

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // next-themes는 suppressHydrationWarning과 함께 사용하면
  // 하이드레이션 불일치를 자동으로 처리함
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
