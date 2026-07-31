import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// 003: Lambda ハンドラ外で初期化しウォーム実行間で TCP コネクションを再利用
const clientConfig = process.env.DYNAMODB_LOCAL_ENDPOINT
  ? { endpoint: process.env.DYNAMODB_LOCAL_ENDPOINT }
  : {};

export const docClient = DynamoDBDocumentClient.from(
  new DynamoDBClient(clientConfig),
);
