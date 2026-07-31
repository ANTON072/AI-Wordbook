import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db";
import type { Entries } from "@/lib/types";
import { buildWordPageUrl } from "@/lib/url";

export async function updateWord(
  userId: string,
  word: string,
  entries: Entries,
): Promise<string> {
  const tableName = process.env.DYNAMODB_TABLE_NAME;
  if (!tableName) throw new Error("DYNAMODB_TABLE_NAME が未設定です");

  const now = new Date().toISOString();

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { userId, word },
        // 002: entries と updatedAt のみ更新。createdAt は保持
        UpdateExpression: "SET entries = :entries, updatedAt = :updatedAt",
        ConditionExpression: "attribute_exists(#word)",
        ExpressionAttributeNames: { "#word": "word" },
        ExpressionAttributeValues: {
          ":entries": entries,
          ":updatedAt": now,
        },
      }),
    );
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      throw new Error(`「${word}」は単語帳に登録されていません`);
    }
    throw error;
  }

  return buildWordPageUrl(word);
}
