# ローカルデバッグ手順（Claude Desktop + pnpm dev）

デプロイなしに Claude Desktop との動作確認・バグ修正ループを回すための手順。ngrok は不要。

## 構成

```
Claude Desktop（Mac）
  → http://localhost:3000/api/mcp   ← pnpm dev
  → 認証：本物の Cognito（クラウド）※無料・常時使用可
  → データ：DynamoDB Local（Docker）
```

Claude Desktop は同じ Mac 上で動くため、`localhost:3000` に直接アクセスできる。

## 前提

- `lib/db.ts` は `DYNAMODB_LOCAL_ENDPOINT` 環境変数があれば DynamoDB Local に接続する
- Cognito MCP クライアントの PKCE コールバック（`http://127.0.0.1`）は Block 1 で登録済み

## セットアップ

```sh
# 1. DynamoDB Local を起動
docker run -d -p 8000:8000 amazon/dynamodb-local

# 2. pnpm dev を起動
pnpm dev
```

`.env.local` に以下を設定する：

```sh
DYNAMODB_LOCAL_ENDPOINT=http://localhost:8000
APP_BASE_URL=http://localhost:3000
```

## Claude Desktop の設定

`~/Library/Application Support/Claude/claude_desktop_config.json` を更新する：

```json
{
  "mcpServers": {
    "ai-wordbook": {
      "url": "http://localhost:3000/api/mcp"
    }
  }
}
```

Claude Desktop を再起動すると Cognito Hosted UI が開き、認証後にツールが使えるようになる。

## デバッグループ

```
バグ発見 → コード修正 → pnpm dev が自動リロード → Claude Desktop で再試行
```

デプロイ（sst deploy）不要。

## 本番に戻すとき

`.env.local` を元に戻し、Claude Desktop の設定を本番 URL に更新する：

```sh
# DYNAMODB_LOCAL_ENDPOINT をコメントアウトまたは削除
APP_BASE_URL=https://ai-wordbook.com
```
