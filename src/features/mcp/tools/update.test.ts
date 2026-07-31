import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createTestTable, deleteAllItems, fetchItem } from "@/test/dynamo";
import { registerWord } from "./register";
import { updateWord } from "./update";

const USER_ID = "test-user-update";
const BASE_URL = "https://example.com";

const ORIGINAL_ENTRIES = [
  {
    partOfSpeech: "adjective" as const,
    translation: "信頼できる",
    examples: [{ en: "She is reliable.", ja: "彼女は信頼できる。" }],
  },
];

const UPDATED_ENTRIES = [
  {
    partOfSpeech: "adjective" as const,
    translation: "信頼できる・頼りになる",
    examples: [
      { en: "She is reliable.", ja: "彼女は信頼できる。" },
      { en: "He is a reliable friend.", ja: "彼は頼りになる友人だ。" },
    ],
  },
];

beforeAll(async () => {
  process.env.APP_BASE_URL = BASE_URL;
  await createTestTable();
});

afterEach(async () => {
  await deleteAllItems();
});

describe("updateWord", () => {
  it("存在する単語を更新すると個別ページ URL が返る", async () => {
    // Arrange
    await registerWord(USER_ID, "reliable", ORIGINAL_ENTRIES);
    // Act
    const url = await updateWord(USER_ID, "reliable", UPDATED_ENTRIES);
    // Assert
    expect(url).toBe(`${BASE_URL}/wordbook/reliable`);
  });

  it("更新後に entries と updatedAt が変わり createdAt が保持される", async () => {
    // Arrange
    await registerWord(USER_ID, "reliable", ORIGINAL_ENTRIES);
    const before = await fetchItem(USER_ID, "reliable");
    const createdAtBefore = before?.createdAt as string;

    // Act
    await updateWord(USER_ID, "reliable", UPDATED_ENTRIES);
    const after = await fetchItem(USER_ID, "reliable");

    // Assert
    expect(after?.createdAt).toBe(createdAtBefore); // createdAt 保持
    expect(after?.updatedAt).not.toBe(before?.updatedAt); // updatedAt 更新
    expect(after?.entries).toEqual(UPDATED_ENTRIES); // entries 更新
  });

  it("存在しない単語の更新でエラーメッセージを含む例外が投げられる", async () => {
    // Act & Assert
    await expect(
      updateWord(USER_ID, "nonexistent", UPDATED_ENTRIES),
    ).rejects.toThrow("「nonexistent」は単語帳に登録されていません");
  });
});
