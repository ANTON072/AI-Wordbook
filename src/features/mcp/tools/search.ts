import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db";
import type { Entries, SearchResultItem } from "@/lib/types";
import { buildWordPageUrl } from "@/lib/url";

type DynamoWordItem = {
  word: string;
  entries: Entries;
};

type SearchResult = {
  items: SearchResultItem[];
  message?: string;
};

export async function searchWords(
  userId: string,
  prefix: string,
): Promise<SearchResult> {
  const tableName = process.env.DYNAMODB_TABLE_NAME;
  if (!tableName) throw new Error("DYNAMODB_TABLE_NAME が未設定です");

  // 002: Query + begins_with で全一致取得し、アプリ側で 20 件スライス
  const { Items = [] } = await docClient.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression:
        "#userId = :userId AND begins_with(#word, :prefix)",
      ExpressionAttributeNames: { "#userId": "userId", "#word": "word" },
      ExpressionAttributeValues: { ":userId": userId, ":prefix": prefix },
    }),
  );

  if (Items.length === 0) {
    throw new Error(`「${prefix}」から始まる単語は見つかりませんでした`);
  }

  const total = Items.length;
  const sliced = Items.slice(0, 20) as DynamoWordItem[];

  const items: SearchResultItem[] = sliced.map((item) => ({
    word: item.word,
    translation: item.entries[0].translation,
    url: buildWordPageUrl(item.word),
  }));

  const message =
    total > 20 ? `${total} 件中 20 件を表示しています` : undefined;

  return { items, message };
}
