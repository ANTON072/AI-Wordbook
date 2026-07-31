# ngrok を使ったローカルデバッグ手順

デプロイなしに Claude Desktop との動作確認・バグ修正ループを回すための手順。

## 前提

- `lib/db.ts` は `DYNAMODB_LOCAL_ENDPOINT` 環境変数があれば DynamoDB Local に接続する（`.env.local` で切替可能）
- Cognito MCP クライアントの PKCE コールバック（`http://127.0.0.1`）は Block 1 で登録済み → ngrok を通しても認証フローが通る

## セットアップ

```sh
# 1. DynamoDB Local を起動
docker run -d -p 8000:8000 amazon/dynamodb-local

# 2. .env.local に以下を設定
DYNAMODB_LOCAL_ENDPOINT=http://localhost:8000

# 3. アプリを起動
pnpm dev

# 4. 別ターミナルで ngrok を起動
ngrok http 3000
# → https://xxxx.ngrok-free.app のような URL が表示される

# 5. .env.local の APP_BASE_URL を ngrok URL に更新
APP_BASE_URL=https://xxxx.ngrok-free.app
```

## Claude Desktop の設定を更新

`~/Library/Application Support/Claude/claude_desktop_config.json` の `url` を ngrok URL に変更する。

```json
{
  "mcpServers": {
    "ai-wordbook": {
      "url": "https://xxxx.ngrok-free.app/api/mcp"
    }
  }
}
```

Claude Desktop を再起動して接続を確認する。

## デバッグループ

```
バグ発見 → コード修正 → pnpm dev が自動リロード → Claude Desktop で再試行
```

デプロイ（sst deploy）は不要。

## 注意点

| 注意点 | 対処 |
|---|---|
| ngrok 無料プランは起動のたびに URL が変わる | 毎回 `.env.local` の `APP_BASE_URL` と Claude Desktop 設定を更新する |
| DynamoDB Local にはテストデータが何もない | 動作確認前に Claude Desktop で手動登録しておく |
| `.env.local` の `APP_BASE_URL` を ngrok URL に変えると個別ページ URL も ngrok を指す | ローカル確認の用途では問題ない |

## 本番に戻すとき

`.env.local` を元に戻す。

```sh
# DYNAMODB_LOCAL_ENDPOINT をコメントアウトまたは削除
# APP_BASE_URL を本番ドメインに戻す
APP_BASE_URL=https://ai-wordbook.com
```
