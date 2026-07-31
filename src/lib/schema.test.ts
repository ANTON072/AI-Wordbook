import { describe, expect, it } from "vitest";
import {
  entriesSchema,
  entrySchema,
  prefixSchema,
  wordInputSchema,
} from "./schema";

describe("wordInputSchema", () => {
  describe("正常系", () => {
    it.each(["reliable", "pick up", "it's", "well-known"])(
      '"%s" を受け入れる',
      (word) => {
        expect(wordInputSchema.safeParse(word).success).toBe(true);
      },
    );

    it("1文字を受け入れる", () => {
      expect(wordInputSchema.safeParse("a").success).toBe(true);
    });

    it("64文字を受け入れる", () => {
      // Arrange
      const input = "a".repeat(64);
      // Act & Assert
      expect(wordInputSchema.safeParse(input).success).toBe(true);
    });
  });

  describe("異常系", () => {
    it("空文字を拒否する", () => {
      expect(wordInputSchema.safeParse("").success).toBe(false);
    });

    it("65文字超を拒否する", () => {
      // Arrange
      const input = "a".repeat(65);
      // Act & Assert
      expect(wordInputSchema.safeParse(input).success).toBe(false);
    });

    it("数字始まりを拒否する", () => {
      expect(wordInputSchema.safeParse("1word").success).toBe(false);
    });

    it("大文字始まりを拒否する（正規化後を想定）", () => {
      expect(wordInputSchema.safeParse("Word").success).toBe(false);
    });

    it("使用禁止文字（数字）を含む場合を拒否する", () => {
      expect(wordInputSchema.safeParse("word1").success).toBe(false);
    });

    it("使用禁止文字（記号）を含む場合を拒否する", () => {
      expect(wordInputSchema.safeParse("word!").success).toBe(false);
    });
  });
});

describe("entrySchema", () => {
  const validEntry = {
    partOfSpeech: "noun" as const,
    translation: "本",
    examples: [{ en: "I read a book.", ja: "私は本を読む。" }],
  };

  describe("正常系", () => {
    it("全品詞値を受け入れる", () => {
      const parts = [
        "noun",
        "verb",
        "adjective",
        "adverb",
        "preposition",
        "conjunction",
        "pronoun",
        "interjection",
      ] as const;
      for (const pos of parts) {
        const entry = { ...validEntry, partOfSpeech: pos };
        expect(entrySchema.safeParse(entry).success).toBe(true);
      }
    });

    it("examples 1件を受け入れる", () => {
      expect(entrySchema.safeParse(validEntry).success).toBe(true);
    });

    it("examples 3件を受け入れる", () => {
      // Arrange
      const entry = {
        ...validEntry,
        examples: [
          { en: "ex1 en", ja: "ex1 ja" },
          { en: "ex2 en", ja: "ex2 ja" },
          { en: "ex3 en", ja: "ex3 ja" },
        ],
      };
      // Act & Assert
      expect(entrySchema.safeParse(entry).success).toBe(true);
    });

    it("translation 200文字を受け入れる", () => {
      const entry = { ...validEntry, translation: "あ".repeat(200) };
      expect(entrySchema.safeParse(entry).success).toBe(true);
    });
  });

  describe("異常系", () => {
    it("translation 201文字超を拒否する", () => {
      const entry = { ...validEntry, translation: "あ".repeat(201) };
      expect(entrySchema.safeParse(entry).success).toBe(false);
    });

    it("examples 4件以上を拒否する", () => {
      const entry = {
        ...validEntry,
        examples: [
          { en: "ex1 en", ja: "ex1 ja" },
          { en: "ex2 en", ja: "ex2 ja" },
          { en: "ex3 en", ja: "ex3 ja" },
          { en: "ex4 en", ja: "ex4 ja" },
        ],
      };
      expect(entrySchema.safeParse(entry).success).toBe(false);
    });

    it("無効な partOfSpeech を拒否する", () => {
      const entry = { ...validEntry, partOfSpeech: "article" };
      expect(entrySchema.safeParse(entry).success).toBe(false);
    });
  });
});

describe("entriesSchema", () => {
  const validEntry = {
    partOfSpeech: "verb" as const,
    translation: "予約する",
    examples: [{ en: "I booked a hotel.", ja: "ホテルを予約した。" }],
  };

  it("entries 0件を拒否する", () => {
    expect(entriesSchema.safeParse([]).success).toBe(false);
  });

  it("entries 1件を受け入れる", () => {
    expect(entriesSchema.safeParse([validEntry]).success).toBe(true);
  });
});

describe("prefixSchema", () => {
  describe("正常系", () => {
    it('"rel" を受け入れる', () => {
      expect(prefixSchema.safeParse("rel").success).toBe(true);
    });

    it("1文字を受け入れる", () => {
      expect(prefixSchema.safeParse("r").success).toBe(true);
    });
  });

  describe("異常系", () => {
    it("空文字を拒否する", () => {
      expect(prefixSchema.safeParse("").success).toBe(false);
    });

    it("使用禁止文字を含む場合を拒否する", () => {
      expect(prefixSchema.safeParse("rel1").success).toBe(false);
    });

    it("数字始まりを拒否する", () => {
      expect(prefixSchema.safeParse("1rel").success).toBe(false);
    });
  });
});
