import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db";
import type { Entries } from "@/lib/types";
import { buildWordPageUrl } from "@/lib/url";

export async function registerWord(
  userId: string,
  word: string,
  entries: Entries,
): Promise<string> {
  const tableName = process.env.DYNAMODB_TABLE_NAME;
  if (!tableName) throw new Error("DYNAMODB_TABLE_NAME が未設定です");

  const now = new Date().toISOString();

  try {
    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: { userId, word, entries, createdAt: now, updatedAt: now },
        ConditionExpression: "attribute_not_exists(#word)",
        ExpressionAttributeNames: { "#word": "word" },
      }),
    );
  } catch (error) {
    if (!(error instanceof ConditionalCheckFailedException)) throw error;
    // 002: 既存単語は上書きせず既存 URL を返す（冪等）
  }

  return buildWordPageUrl(word);
}
