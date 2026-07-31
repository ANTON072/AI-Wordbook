import { z } from "zod";

// 002: /^[a-z][a-z' -]*$/ — 先頭は英小文字、以降は英小文字・スペース・ハイフン・アポストロフィ
const wordPattern = /^[a-z][a-z' -]*$/;
const wordPatternMessage =
  "使用可能文字: 半角英小文字・スペース・ハイフン・アポストロフィ（先頭は英字）";

export const wordInputSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(wordPattern, wordPatternMessage);

export const partOfSpeechSchema = z.enum([
  "noun",
  "verb",
  "adjective",
  "adverb",
  "preposition",
  "conjunction",
  "pronoun",
  "interjection",
]);

export const exampleSchema = z.object({
  en: z.string().min(1),
  ja: z.string().min(1),
});

export const entrySchema = z.object({
  partOfSpeech: partOfSpeechSchema,
  translation: z.string().min(1).max(200),
  examples: z.array(exampleSchema).min(1).max(3),
});

export const entriesSchema = z.array(entrySchema).min(1);

// 002: prefix は word と同じ文字制約・先頭制約、正規化後に1文字以上
export const prefixSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(wordPattern, wordPatternMessage);
