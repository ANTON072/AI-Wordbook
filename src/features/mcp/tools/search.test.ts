import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createTestTable, deleteAllItems } from "@/test/dynamo";
import { deleteWord } from "./delete";
import { registerWord } from "./register";
import { searchWords } from "./search";

const USER_ID = "test-user-search";
const OTHER_USER_ID = "other-user-search";

function makeEntry(translation: string) {
  return [
    {
      partOfSpeech: "adjective" as const,
      translation,
      examples: [{ en: "Example.", ja: "例。" }],
    },
  ];
}

beforeAll(async () => {
  process.env.APP_BASE_URL = "https://example.com";
  await createTestTable();
});

afterEach(async () => {
  await deleteAllItems();
});

describe("searchWords", () => {
  it("前方一致する単語がアルファベット順で返る", async () => {
    // Arrange
    await registerWord(USER_ID, "reliable", makeEntry("信頼できる"));
    await registerWord(USER_ID, "relevant", makeEntry("関連する"));
    await registerWord(USER_ID, "remote", makeEntry("リモートの"));
    // Act
    const { items, message } = await searchWords(USER_ID, "rel");
    // Assert
    // DynamoDB SK 順（アルファベット順）: relevant < reliable ('e' < 'i')
    expect(items.map((i) => i.word)).toEqual(["relevant", "reliable"]);
    expect(message).toBeUndefined();
  });

  it("各 item に word・translation・url が含まれる", async () => {
    // Arrange
    await registerWord(USER_ID, "reliable", makeEntry("信頼できる"));
    // Act
    const { items } = await searchWords(USER_ID, "rel");
    // Assert
    expect(items[0]).toMatchObject({
      word: "reliable",
      translation: "信頼できる",
      url: "https://example.com/wordbook/reliable",
    });
  });

  it("0 件の場合にエラーメッセージを含む例外が投げられる", async () => {
    // Act & Assert
    await expect(searchWords(USER_ID, "xyz")).rejects.toThrow(
      "「xyz」から始まる単語は見つかりませんでした",
    );
  });

  it("21 件以上の場合に先頭 20 件と件数メッセージが返る", async () => {
    // Arrange: 21 件登録
    const words = Array.from(
      { length: 21 },
      (_, i) => `test${String.fromCharCode(97 + i)}`,
    );
    await Promise.all(
      words.map((w) => registerWord(USER_ID, w, makeEntry(`${w} の意味`))),
    );
    // Act
    const { items, message } = await searchWords(USER_ID, "test");
    // Assert
    expect(items).toHaveLength(20);
    expect(message).toBe("21 件中 20 件を表示しています");
  });

  describe("ユーザー分離", () => {
    it("別 userId で登録した項目が search_words に現れない", async () => {
      // Arrange
      await registerWord(OTHER_USER_ID, "reliable", makeEntry("信頼できる"));
      // Act & Assert: USER_ID での検索に OTHER_USER_ID の単語が出ない
      await expect(searchWords(USER_ID, "rel")).rejects.toThrow(
        "「rel」から始まる単語は見つかりませんでした",
      );
    });

    it("別 userId で登録した項目を delete_word で削除できない", async () => {
      // Arrange
      await registerWord(OTHER_USER_ID, "reliable", makeEntry("信頼できる"));
      // Act & Assert: USER_ID で削除しようとするとエラー（別ユーザーの項目は見えない）
      await expect(deleteWord(USER_ID, "reliable")).rejects.toThrow(
        "「reliable」は単語帳に登録されていません",
      );
    });
  });
});
