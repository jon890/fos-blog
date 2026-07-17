import { z } from "zod";

const nonEmptyText = z.string().trim().min(1);
const expressionSchema = z.string().trim().min(2).max(255);

const referenceSchema = z
  .object({
    label: nonEmptyText,
    url: z.url().refine((url) => new URL(url).protocol === "https:", {
      message: "참고 자료 URL은 https만 허용됩니다.",
    }),
  })
  .strict();

export const glossaryTermSchema = z
  .object({
    id: z
      .string()
      .max(128)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message: "id는 소문자 kebab-case여야 합니다.",
      }),
    term: expressionSchema,
    fullName: z.string().trim().min(1).max(500).optional(),
    aliases: z.array(expressionSchema).default([]),
    summary: nonEmptyText,
    description: nonEmptyText,
    caseSensitive: z.boolean().default(false),
    references: z.array(referenceSchema).default([]),
  })
  .strict();

export const glossaryFileSchema = z
  .object({
    version: z.literal(1),
    terms: z.array(glossaryTermSchema),
  })
  .strict()
  .superRefine((file, ctx) => {
    const ids = new Map<string, number>();
    const expressions = new Map<string, { termIndex: number; value: string }>();

    file.terms.forEach((term, termIndex) => {
      const existingIdIndex = ids.get(term.id);
      if (existingIdIndex !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["terms", termIndex, "id"],
          message: `id '${term.id}'가 terms[${existingIdIndex}]와 중복됩니다.`,
        });
      } else {
        ids.set(term.id, termIndex);
      }

      [term.term, ...term.aliases].forEach((value, expressionIndex) => {
        const folded = value.toLocaleLowerCase("en-US");
        const existing = expressions.get(folded);
        const path = expressionIndex === 0
          ? ["terms", termIndex, "term"]
          : ["terms", termIndex, "aliases", expressionIndex - 1];

        if (existing) {
          ctx.addIssue({
            code: "custom",
            path,
            message: `표현 '${value}'이 terms[${existing.termIndex}]의 '${existing.value}'와 충돌합니다.`,
          });
        } else {
          expressions.set(folded, { termIndex, value });
        }
      });
    });
  });

export type GlossaryFile = z.infer<typeof glossaryFileSchema>;
export type GlossaryTermInput = z.infer<typeof glossaryTermSchema>;

export function parseGlossaryFile(input: unknown): GlossaryFile {
  return glossaryFileSchema.parse(input);
}
