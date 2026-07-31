import type { z } from "zod";
import type {
  entriesSchema,
  entrySchema,
  exampleSchema,
  partOfSpeechSchema,
  wordInputSchema,
} from "./schema";

export type WordInput = z.infer<typeof wordInputSchema>;
export type PartOfSpeech = z.infer<typeof partOfSpeechSchema>;
export type Example = z.infer<typeof exampleSchema>;
export type Entry = z.infer<typeof entrySchema>;
export type Entries = z.infer<typeof entriesSchema>;

export type SearchResultItem = {
  word: string;
  translation: string;
  url: string;
};
