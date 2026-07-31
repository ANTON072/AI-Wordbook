import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db";

export async function deleteWord(userId: string, word: string): Promise<void> {
  const tableName = process.env.DYNAMODB_TABLE_NAME;
  if (!tableName) throw new Error("DYNAMODB_TABLE_NAME が未設定です");

  try {
    await docClient.send(
      new DeleteCommand({
        TableName: tableName,
        Key: { userId, word },
        ConditionExpression: "attribute_exists(#word)",
        ExpressionAttributeNames: { "#word": "word" },
      }),
    );
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      throw new Error(`「${word}」は単語帳に登録されていません`);
    }
    throw error;
  }
}
