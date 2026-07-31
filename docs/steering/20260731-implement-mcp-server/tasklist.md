# タスクリスト

## 実装タスク

### 準備

- [ ] **[HUMAN]** `pnpm add @modelcontextprotocol/sdk@latest` を実行してください → 完了したら報告してください

### OAuth ディスカバリ実装

- [ ] `src/features/mcp/discovery.ts` を実装する（`APP_BASE_URL`・`AWS_REGION`・`COGNITO_USER_POOL_ID` 環境変数から RFC 9728 の `resource` + `authorization_servers` を組み立てる）
- [ ] `src/app/.well-known/oauth-protected-resource/route.ts` を実装する（`features/mcp/discovery.ts` を呼ぶ薄い Route Handler）

### MCP ツールハンドラ実装

- [ ] `src/features/mcp/tools/register.ts` を実装する（`PutItem`・`ConditionExpression: attribute_not_exists(SK)`・`ConditionalCheckFailedException` 時は既存 URL を返す。`createdAt`・`updatedAt` は ISO 8601 で付与）
- [ ] `src/features/mcp/tools/delete.ts` を実装する（`DeleteItem`・`ConditionExpression: attribute_exists(SK)`・`ConditionalCheckFailedException` 時は「単語が存在しない」例外を投げる）
- [ ] `src/features/mcp/tools/update.ts` を実装する（`UpdateItem`・`ConditionExpression: attribute_exists(SK)`・`entries`・`updatedAt` のみ更新・`createdAt` 保持・`ConditionalCheckFailedException` 時は「単語が存在しない」例外を投げる）
- [ ] `src/features/mcp/tools/search.ts` を実装する（`Query`・`KeyConditionExpression: PK=userId AND begins_with(SK, prefix)`・全一致を取得してアプリ側で 20 件スライス・21 件以上のとき「X 件中 20 件を表示」メッセージを付与・0 件のとき「0 件」例外を投げる）

### MCP サーバー実装

- [ ] `@modelcontextprotocol/sdk` の API（`McpServer` 相当の初期化方法・Next.js App Router との接続方法）を `node_modules/@modelcontextprotocol/sdk` の型定義と README で確認する
- [ ] `src/features/mcp/server.ts` を実装する（SDK 初期化・ツール登録・JWT 検証パイプライン（Authorization ヘッダの Bearer からアクセストークンを取り出し → `lib/auth.verifyAccessToken`）・ツールラッパー（`lib/normalize` → `lib/schema` バリデーション → ツールハンドラ呼び出し）・エラー整形）
- [ ] `src/app/api/mcp/route.ts` を実装する（`features/mcp/server.ts` へ委譲する薄い Route Handler）

## テスト

- [ ] `write-tests` スキルを読んで今回の実装に対応するテスト方針を確認する
- [ ] **[HUMAN]** DynamoDB Local を起動してください：`docker run -d -p 8000:8000 amazon/dynamodb-local` → 起動したら報告してください
- [ ] テストセットアップに DynamoDB Local のテーブル自動作成・テストデータ後片付け処理を追加する（`beforeAll` でテーブルを作成し、各テスト後に項目を削除する）
- [ ] `src/features/mcp/discovery.test.ts` を記述する（単体テスト）
  - `resource` と `authorization_servers` が環境変数から正しく組み立てられるか
- [ ] `src/features/mcp/server.test.ts` を記述する（結合テスト）
  - 期限切れのアクセストークンで 401 が返る
  - 署名不正のアクセストークンで 401 が返る
- [ ] `src/features/mcp/tools/register.test.ts` を記述する（結合テスト）
  - 新規単語の登録で個別ページ URL が返る
  - 同一単語の再登録（冪等）で既存 URL が返り DynamoDB の項目が上書きされない
  - バリデーション失敗でエラーメッセージが返る
- [ ] `src/features/mcp/tools/delete.test.ts` を記述する（結合テスト）
  - 存在する単語の削除で完了メッセージが返る
  - 存在しない単語の削除でエラーメッセージが返る
- [ ] `src/features/mcp/tools/update.test.ts` を記述する（結合テスト）
  - 存在する単語の更新で個別ページ URL が返り `entries`・`updatedAt` が更新される
  - 更新後も `createdAt` が保持される
  - 存在しない単語の更新でエラーメッセージが返る
- [ ] `src/features/mcp/tools/search.test.ts` を記述する（結合テスト）
  - 前方一致で一致する単語がアルファベット順に返る
  - 21 件以上の場合に先頭 20 件と「X 件中 20 件を表示」が返る
  - 0 件の場合にエラーメッセージが返る
- [ ] ユーザー分離の結合テストを `src/features/mcp/tools/search.test.ts`（または `register.test.ts`）に追加する
  - 別 `userId` で登録した項目が `search_words` に現れない
  - 別 `userId` で登録した項目を `delete_word` で削除できない

## コードレビューループ

- [ ] **1周目**: `code-reviewer` エージェントを起動 → 完了通知を受け取ってから指摘一覧をユーザーに提示
  - 重大度高（セキュリティ・層境界違反）: 自動修正
  - 判断が分かれる指摘: ユーザーに確認してから対応
- [ ] **2周目以降**: 残存指摘がなくなるまで繰り返す（各周、修正内容をユーザーに提示）
- [ ] 対応困難な指摘はその理由をユーザーに報告
- [ ] 全指摘への対応完了（残存指摘ゼロ、または対応困難分をユーザーに報告済み）✅

## 品質チェック

- [ ] `pnpm check`（lint・format・test・typecheck の一括実行）を実行
  - エラーがあれば自動修正して再実行し、all green になるまで繰り返す
- [ ] `pnpm check` all green ✅

## 手動動作確認（Claude Desktop）

コードレビューと品質チェックが完了してから実施する。[PRD § MVP 完了条件](../../spec/001_product-requirements.md) のうち Block 3 が担う項目をすべて確認する。

### デプロイ

- [ ] **[HUMAN]** `sst deploy` を実行してください → 完了したら報告してください

### Claude Desktop へのサーバー登録

- [ ] **[HUMAN]** Claude Desktop の設定ファイルを開き、MCP サーバーを追加してください

設定ファイルの場所（Mac）：
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

追加する設定（`mcpServers` に追記）：
```json
{
  "mcpServers": {
    "ai-wordbook": {
      "url": "https://{デプロイ後のドメイン}/api/mcp"
    }
  }
}
```

### OAuth 認証フローの確認

- [ ] **[HUMAN]** Claude Desktop を完全に再起動し、初回接続時に Cognito Hosted UI が開くことを確認してください
  - ブラウザで Cognito のログイン画面が表示される
  - ユーザー名・パスワードを入力してログイン
  - 初回は強制パスワード変更画面が表示される場合あり → 変更して続行
  - Claude Desktop に「接続しました」等の通知が返れば認証成功
  - 完了したら報告してください

### 各ツールの動作確認

- [ ] **[HUMAN]** `register_word` の動作を確認してください

Claude Desktop のチャットに以下のように入力します：

```
「reliable」を単語帳に登録して。
品詞: adjective、和訳: 信頼できる、例文は英語と日本語で1つ添えて。
```

確認ポイント：
- Claude が `register_word` を実行する
- `https://{ドメイン}/wordbook/reliable` 形式の URL が返る
- 同じ単語をもう一度登録しようとしても上書きされず、既存 URL が返る（冪等）

- [ ] **[HUMAN]** `search_words` の動作を確認してください

```
「rel」から始まる単語を検索して
```

確認ポイント：
- 登録した `reliable` が返る
- アルファベット順で並んでいる

- [ ] **[HUMAN]** `update_word` の動作を確認してください

```
「reliable」の辞書情報を更新して。
品詞: adjective、和訳: 信頼できる・頼りになる、例文を2つに増やして。
```

確認ポイント：
- 個別ページ URL が返る
- 登録日時（createdAt）が変わっていない（更新日時 updatedAt のみ変わる）

- [ ] **[HUMAN]** `delete_word` の動作を確認してください

```
「reliable」を単語帳から削除して
```

確認ポイント：
- 削除完了メッセージが返る
- 再度 `search_words` で検索しても出てこない
- 存在しない単語を削除しようとするとエラーメッセージが返る

### MVP 完了条件の最終確認

- [ ] **[HUMAN]** 以下の MVP 完了条件（[PRD § MVP 完了条件](../../spec/001_product-requirements.md)）をすべて確認し、チェックしてください

| 確認項目 | 結果 |
|---|---|
| 4つの MCP ツールが Claude Desktop から実行できる | |
| 単語登録が 1 往復（ユーザー発話 → ツール実行 → URL 返却）で完結する | |
| Cognito 認証でユーザーログインできる | |
| リモート HTTP × OAuth 2.0 PKCE × Lambda での JWT 検証の認証フローを自分の言葉で説明できる | |

すべて確認できたら Block 3 完了です。

## 進捗状況

| フェーズ | 状況 |
| -------- | ------ |
| 実装タスク | ⬜ 未着手 |
| テスト | ⬜ 未着手 |
| コードレビューループ | ⬜ 未着手 |
| 品質チェック | ⬜ 未着手 |
