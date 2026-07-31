import {
  CreateTableCommand,
  DynamoDBClient,
  ResourceInUseException,
} from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

function buildTestClient(): {
  raw: DynamoDBClient;
  doc: DynamoDBDocumentClient;
} {
  const endpoint = process.env.DYNAMODB_LOCAL_ENDPOINT;
  if (!endpoint) throw new Error("DYNAMODB_LOCAL_ENDPOINT が未設定です");
  const raw = new DynamoDBClient({ endpoint });
  return { raw, doc: DynamoDBDocumentClient.from(raw) };
}

export function getTableName(): string {
  const tableName = process.env.DYNAMODB_TABLE_NAME;
  if (!tableName) throw new Error("DYNAMODB_TABLE_NAME が未設定です");
  return tableName;
}

export async function createTestTable(): Promise<void> {
  const { raw } = buildTestClient();
  const tableName = getTableName();

  try {
    await raw.send(
      new CreateTableCommand({
        TableName: tableName,
        KeySchema: [
          { AttributeName: "userId", KeyType: "HASH" },
          { AttributeName: "word", KeyType: "RANGE" },
        ],
        AttributeDefinitions: [
          { AttributeName: "userId", AttributeType: "S" },
          { AttributeName: "word", AttributeType: "S" },
        ],
        BillingMode: "PAY_PER_REQUEST",
      }),
    );
  } catch (error) {
    if (!(error instanceof ResourceInUseException)) throw error;
    // テーブルが既に存在する場合は続行
  }
}

export async function fetchItem(
  userId: string,
  word: string,
): Promise<Record<string, unknown> | undefined> {
  const { doc } = buildTestClient();
  const { Item } = await doc.send(
    new GetCommand({ TableName: getTableName(), Key: { userId, word } }),
  );
  return Item as Record<string, unknown> | undefined;
}

export async function deleteAllItems(): Promise<void> {
  const { doc } = buildTestClient();
  const tableName = getTableName();

  const { Items = [] } = await doc.send(
    new ScanCommand({ TableName: tableName }),
  );
  if (Items.length === 0) return;

  // DynamoDB Batch Write は 25 件制限
  for (let i = 0; i < Items.length; i += 25) {
    const batch = Items.slice(i, i + 25) as Array<{
      userId: string;
      word: string;
    }>;
    await doc.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: batch.map((item) => ({
            DeleteRequest: { Key: { userId: item.userId, word: item.word } },
          })),
        },
      }),
    );
  }
}
