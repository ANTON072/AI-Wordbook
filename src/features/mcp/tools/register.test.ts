import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createTestTable, deleteAllItems, fetchItem } from "@/test/dynamo";
import { registerWord } from "./register";

const USER_ID = "test-user-register";
const BASE_URL = "https://example.com";

const VALID_ENTRIES = [
  {
    partOfSpeech: "adjective" as const,
    translation: "信頼できる",
    examples: [{ en: "She is reliable.", ja: "彼女は信頼できる。" }],
  },
];

beforeAll(async () => {
  process.env.APP_BASE_URL = BASE_URL;
  await createTestTable();
});

afterEach(async () => {
  await deleteAllItems();
});

describe("registerWord", () => {
  it("新規単語を登録すると個別ページ URL が返る", async () => {
    // Act
    const url = await registerWord(USER_ID, "reliable", VALID_ENTRIES);
    // Assert
    expect(url).toBe(`${BASE_URL}/wordbook/reliable`);
  });

  it("スペースを含む単語は URL エンコードされた URL が返る", async () => {
    // Act
    const url = await registerWord(USER_ID, "pick up", VALID_ENTRIES);
    // Assert
    expect(url).toBe(`${BASE_URL}/wordbook/pick%20up`);
  });

  it("同一単語を再登録すると既存 URL が返り DynamoDB 項目が上書きされない", async () => {
    // Arrange
    const firstEntries = [{ ...VALID_ENTRIES[0], translation: "最初の和訳" }];
    const secondEntries = [
      { ...VALID_ENTRIES[0], translation: "後からの和訳" },
    ];

    await registerWord(USER_ID, "reliable", firstEntries);

    // Act
    const url = await registerWord(USER_ID, "reliable", secondEntries);

    // Assert: URL は変わらない
    expect(url).toBe(`${BASE_URL}/wordbook/reliable`);

    // Assert: DynamoDB の entries が firstEntries のまま（上書きされていない）
    const item = await fetchItem(USER_ID, "reliable");
    expect(item?.entries).toEqual(firstEntries);
  });
});
