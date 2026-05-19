import { defaultSchema, type Options as Schema } from "rehype-sanitize";

/**
 * fos-blog 의 unified pipeline 용 sanitize schema.
 *
 * defaultSchema 를 확장해서 다음을 추가 허용:
 * - rehype-pretty-code 의 shiki span data-line / data-highlighted-line
 * - rehype-pretty-code 의 figure data-rehype-pretty-code-figure / data-language / data-theme
 * - rehype-slug 의 heading id
 * - GFM table align / footnote ref
 *
 * 차단 유지 (defaultSchema 정책):
 * - <script>, <iframe>, <object>, <embed>, <form>
 * - on* 이벤트 핸들러 (onclick, onload 등)
 * - javascript: / data: (이미지 제외) URL
 */
export const sanitizeSchema: Schema = {
  ...defaultSchema,
  // defaultSchema.clobberPrefix 기본값 "user-content-" 은 id 속성에 prefix 를 붙여 DOM clobbering 을 방지하나,
  // rehype-slug 가 생성한 heading id (TOC 앵커) 가 변질되어 in-page 이동이 깨짐.
  // fos-blog 는 사용자 생성 HTML 을 직접 노출하지 않고 신뢰된 markdown 만 처리하므로
  // 빈 문자열로 override 해 원본 slug id 를 보존한다.
  clobberPrefix: "",
  // figure/figcaption 은 defaultSchema.tagNames 에 미포함 — rehype-pretty-code 컨테이너 보존을 위해 추가.
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "figure",
    "figcaption",
  ],
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      "className",
      ["data-language"],
      ["data-theme"],
    ],
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      "className",
      // shiki 는 토큰별 색을 inline style 로 적용 (예: style="color: #abcdef") —
      // CSS injection 잠재 위험이 있으나 syntax highlighting 동작에 필수.
      // sanitize 후에도 보존되어야 하므로 의도적 allowlist.
      "style",
      ["data-line"],
      ["data-highlighted-line"],
      ["data-highlighted-chars"],
      ["data-chars-id"],
    ],
    figure: [
      ...(defaultSchema.attributes?.figure ?? []),
      ["data-rehype-pretty-code-figure"],
    ],
    figcaption: [
      ...(defaultSchema.attributes?.figcaption ?? []),
      ["data-rehype-pretty-code-title"],
    ],
    pre: [
      ...(defaultSchema.attributes?.pre ?? []),
      "className",
      // shiki/pretty-code 가 pre 컨테이너에도 inline style 을 둘 수 있음 (배경색 등) — span 과 동일 사유로 의도적 허용.
      "style",
      "tabIndex",
      ["data-language"],
      ["data-theme"],
    ],
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      "className",
      ["data-rehype-pretty-code-fragment"],
    ],
    // heading id (rehype-slug)
    h1: [...(defaultSchema.attributes?.h1 ?? []), "id"],
    h2: [...(defaultSchema.attributes?.h2 ?? []), "id"],
    h3: [...(defaultSchema.attributes?.h3 ?? []), "id"],
    h4: [...(defaultSchema.attributes?.h4 ?? []), "id"],
    h5: [...(defaultSchema.attributes?.h5 ?? []), "id"],
    h6: [...(defaultSchema.attributes?.h6 ?? []), "id"],
  },
};
