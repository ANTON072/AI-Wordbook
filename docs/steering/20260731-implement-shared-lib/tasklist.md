# タスクリスト

## 実装タスク

### 準備

- [ ] **[HUMAN]** 必要なパッケージをインストールする：`pnpm add jose zod @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb` → 完了したら報告してください

### lib/ 実装

- [ ] `src/lib/schema.ts` を実装する（[001](../../spec/001_product-requirements.md) / [002](../../spec/002_functional-design.md) のバリデーション規則に基づく `wordInputSchema`・`entrySchema`・`exampleSchema`・`prefixSchema` を zod で定義）
- [ ] `src/lib/types.ts` を実装する（`schema` から `z.infer` で導出した `Entry`・`Example`・`PartOfSpeech`・`SearchResultItem` 等の共有型）
- [ ] `src/lib/normalize.ts` を実装する（[002 正規化ルール](../../spec/002_functional-design.md) の4変換：大文字→小文字・全角英数字→半角・前後空白除去・連続スペース統一）
- [ ] `src/lib/auth.ts` を実装する（`jose` による JWT 検証、`expectedClientId` 引数で MCP・Web 経路を切替、検証項目は [002](../../spec/002_functional-design.md)・[003](../../spec/003_architecture.md)）
- [ ] `src/lib/db.ts` を実装する（`DynamoDBDocumentClient` を Lambda ハンドラ外で初期化。`DYNAMODB_LOCAL_ENDPOINT` があればローカルエンドポイントを使う分岐を含む）
- [ ] `src/lib/url.ts` を実装する（[002 URL形式](../../spec/002_functional-design.md) に従い `APP_BASE_URL` 基点で個別ページ URL を組み立て）

## テスト

- [ ] `write-tests` スキルを読んで今回の実装に対応するテスト方針を確認する
- [ ] **[HUMAN]** `.env.test` に以下の変数が含まれているか確認してください。含まれていなければテスト用ダミー値を追記してください（auth テストの `iss` 導出に使用）：`COGNITO_USER_POOL_ID`・`AWS_REGION` → 完了したら報告してください
- [ ] `src/lib/normalize.test.ts` を記述する
  - 大文字→小文字（例：`Reliable` → `reliable`）
  - 全角英数字→半角（例：`ｒｅｌｉａｂｌｅ` → `reliable`）
  - 前後空白除去（例：`" reliable "` → `"reliable"`）
  - 連続スペース統一（例：`"pick  up"` → `"pick up"`）
  - 複合ケース（例：`" Ｐｉｃｋ  Ｕｐ "` → `"pick up"`）
- [ ] `src/lib/schema.test.ts` を記述する
  - `wordInputSchema`：正常系（`reliable`・`pick up`・`it's`・`well-known`）、異常系（空文字・65文字超・使用禁止文字・数字始まり）
  - `entrySchema`：正常系（全品詞値・examples 1〜3件）、異常系（entries 0件・translation 201文字超・examples 4件以上・無効な partOfSpeech）
  - `prefixSchema`：正常系（`rel`）、異常系（空文字・使用禁止文字）
- [ ] `src/lib/auth.test.ts` を記述する（`jose` の `SignJWT`/`generateKeyPair` でテスト用 RSA 鍵ペアを生成し、`vi.mock('jose')` で `createRemoteJWKSet` をモックして外部ネットワーク接続なしに検証する）
  - 正常な JWT で `sub` が返る
  - 期限切れ JWT で例外が投げられる
  - 署名不正で例外が投げられる
  - `expectedClientId` 不一致で例外が投げられる
  - `token_use !== "access"` で例外が投げられる
  - MCP 経路と Web 経路で `expectedClientId` を切り替えて検証できる

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

## 進捗状況

| フェーズ | 状況 |
|--------|------|
| 実装タスク | 未着手 |
| テスト | 未着手 |
| コードレビューループ | 未着手 |
| 品質チェック | 未着手 |
