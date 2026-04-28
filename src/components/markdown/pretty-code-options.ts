import type { Options as PrettyCodeOptions } from "rehype-pretty-code";

export const PRETTY_CODE_OPTIONS: PrettyCodeOptions = {
  theme: { light: "github-light", dark: "github-dark" },
  defaultLang: "plaintext",
  keepBackground: false, // background 는 .code-card-body 룰로 처리
  bypassInlineCode: true, // plan011 의 .prose :not(pre) > code 룰 보존
};
