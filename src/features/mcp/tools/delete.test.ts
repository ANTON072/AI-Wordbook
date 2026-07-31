import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createTestTable, deleteAllItems } from "@/test/dynamo";
import { deleteWord } from "./delete";
import { registerWord } from "./register";

const USER_ID = "test-user-delete";

const VALID_ENTRIES = [
  {
    partOfSpeech: "adjective" as const,
    translation: "信頼できる",
    examples: [{ en: "She is reliable.", ja: "彼女は信頼できる。" }],
  },
];

beforeAll(async () => {
  process.env.APP_BASE_URL = "https://example.com";
  await createTestTable();
});

afterEach(async () => {
  await deleteAllItems();
});

describe("deleteWord", () => {
  it("存在する単語を削除すると完了する（例外なし）", async () => {
    // Arrange
    await registerWord(USER_ID, "reliable", VALID_ENTRIES);
    // Act & Assert: 例外が投げられないことを確認
    await expect(deleteWord(USER_ID, "reliable")).resolves.toBeUndefined();
  });

  it("存在しない単語の削除でエラーメッセージを含む例外が投げられる", async () => {
    // Act & Assert
    await expect(deleteWord(USER_ID, "nonexistent")).rejects.toThrow(
      "「nonexistent」は単語帳に登録されていません",
    );
  });
});
