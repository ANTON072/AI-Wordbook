# 要求と設計

## ベースにする永続ドキュメント

- 正規化ルール・JWT検証項目・バリデーション規則・URL形式：[002 機能設計書](../../spec/002_functional-design.md)（正規化ルール・ミドルウェアパイプライン・ツール仕様・個別ページURL形式の各セクション）
- `jose` / `zod` / AWS SDK 選定根拠・Cognito client_id 経路別期待値・環境変数一覧：[003 技術仕様書](../../spec/003_architecture.md)（主要ライブラリ選定・検証ロジックの共用範囲の各セクション）
- `lib/` ディレクトリ責務・配置ルール・依存方向：[004 リポジトリ構造定義書](../../spec/004_repository-structure.md)
- テスト戦略（単体対象・DynamoDB Local 方針・テストしない対象）：[005 開発ガイドライン](../../spec/005_development-guidelines.md)
- 識別子の正の表記（`word` / `entries` / `userId` / `sub` 等）：[006 ユビキタス言語定義](../../spec/006_glossary.md)

## 要求

### 変更・追加する機能の説明

`src/lib/` 配下の全6モジュール（`normalize`・`auth`・`db`・`schema`・`types`・`url`）を新規実装する。これらは MCP ツールと Web 閲覧画面が共通で使うビジネス知識を持たないプリミティブであり、次フェーズの `features/` 実装（MCPツールハンドラ・Web 認証・閲覧取得）の基盤となる。

### 受け入れ条件

1. **normalize** — [002 正規化ルール](../../spec/002_functional-design.md) の4変換（大文字→小文字・全角英数字→半角・前後空白除去・連続スペース統一）を満たす。単体テストで全ケースを確認済み
2. **auth** — [002 ミドルウェアパイプライン](../../spec/002_functional-design.md) が定める検証項目（`exp` / `iss` / `client_id` / `token_use === "access"` / Cognito 公開鍵署名）を検証し、`expectedClientId` 引数で MCP 経路（`COGNITO_MCP_CLIENT_ID`）と Web 経路（`COGNITO_WEB_CLIENT_ID`）を切り替えられる。単体テストで各検証項目の正常系・異常系を確認済み
3. **db** — `DynamoDBDocumentClient` を Lambda ハンドラ外で初期化し、ウォーム実行間で TCP コネクションを再利用できる
4. **schema** — [001 バリデーション規則](../../spec/001_product-requirements.md) / [002 ミドルウェアパイプライン](../../spec/002_functional-design.md) を zod で表現し、正規化後の値に適用できる。単体テストで正常系・異常系を確認済み
5. **types** — `schema` から `z.infer` で導出した型のみを持ち、手書き型との二重定義が存在しない
6. **url** — [002 個別ページURL形式](../../spec/002_functional-design.md) に従い `${APP_BASE_URL}/wordbook/${encodeURIComponent(word)}` を組み立てられる
7. `pnpm check`（lint・format・test・typecheck）が all green

### 制約事項

- `lib/` はビジネス知識を持たない（[004](../../spec/004_repository-structure.md)）。単語帳ドメインを知らなくても再利用できる粒度に留める
- DynamoDB への書き込み操作（`PutItem`・`UpdateItem`・`DeleteItem`）は `lib/` に持たない。`features/mcp/tools/` が担う（[004 配置ルール](../../spec/004_repository-structure.md)）
- `userId`（PK）はクライアント入力から受け取らず、`lib/auth` の検証結果として得た `sub` を引数で受ける（[004](../../spec/004_repository-structure.md)）
- `lib/db` の DynamoDB Local を使った結合テストは今回のスコープ外。`features/mcp/tools/` 実装フェーズで行う（[005 テスト戦略](../../spec/005_development-guidelines.md) — 「外部 SDK の薄いラッパー」はテスト対象外）

## 設計

### 実装アプローチ

各モジュールを `src/lib/` 配下に単一ファイルとして実装し、単体テスト（`.test.ts`）を同居させる。テスト対象は `normalize`・`schema`・`auth` の3つ（`db`・`types`・`url` は薄いラッパー・自明な変換のためテスト対象外）。

実装順序は依存関係の順に従う：

1. `schema.ts` — zod スキーマ定義（他モジュールへの依存なし）
2. `types.ts` — `schema` から `z.infer` で型を導出（`schema` が先に存在することが前提）
3. `normalize.ts` — 正規化ロジック（他モジュールへの依存なし）
4. `auth.ts` — JWT 検証コア（`jose` の `jwtVerify` + `createRemoteJWKSet` 使用）
5. `db.ts` — DynamoDB DocumentClient 初期化（`DYNAMODB_LOCAL_ENDPOINT` があればローカルエンドポイントを使う分岐を含む）
6. `url.ts` — 個別ページ URL 組み立て（`APP_BASE_URL` 環境変数から）

`lib/auth` の単体テストは、実際の Cognito JWKS に依存せず、vitest 内でテスト用の RSA 鍵ペアを生成して JWT に署名する方式で行う。`jose` の `SignJWT` / `generateKeyPair` で JWT を署名し、`vi.mock('jose')` で `createRemoteJWKSet` をモックして生成した公開鍵を返すリゾルバに差し替えることで、外部ネットワーク接続なしに全検証項目を試験できる。

### 変更するコンポーネント

今回は新規ファイルの追加のみ。既存ファイルへの変更なし。

| 新規ファイル | 内容 |
|---|---|
| `src/lib/types.ts` | 共有型（`Entry`・`Example`・`PartOfSpeech`・`SearchResultItem` 等） |
| `src/lib/schema.ts` | zod スキーマ（`wordInputSchema`・`entrySchema`・`exampleSchema`・`prefixSchema`） |
| `src/lib/normalize.ts` | `normalizeWord(input: string): string` |
| `src/lib/auth.ts` | `verifyAccessToken(token: string, expectedClientId: string): Promise<{ sub: string }>` |
| `src/lib/db.ts` | `docClient`（`DynamoDBDocumentClient` の初期化済みインスタンス。`DYNAMODB_LOCAL_ENDPOINT` がある場合はローカルエンドポイントを使用） |
| `src/lib/url.ts` | `buildWordPageUrl(word: string): string` |
| `src/lib/normalize.test.ts` | normalize の単体テスト |
| `src/lib/schema.test.ts` | schema の単体テスト |
| `src/lib/auth.test.ts` | auth の単体テスト |

また、以下の依存パッケージを追加インストールする（現状 `package.json` に未記載）：

| パッケージ | バージョン | 用途 |
|---|---|---|
| `jose` | `^6` | JWT 検証（MCP・Web 共用） |
| `zod` | `^4` | バリデーション |
| `@aws-sdk/client-dynamodb` | AWS SDK v3 | DynamoDB 操作 |
| `@aws-sdk/lib-dynamodb` | AWS SDK v3 | DocumentClient |

### 影響範囲の分析

- 変更は `src/lib/` の新規ファイル追加のみ
- 既存の `src/app/`・`src/test/setup.ts` への変更なし
- `src/test/setup.ts`（`loadEnvConfig` 呼び出し）・`.env.local.example` は既に存在するため、今回は変更不要
- `.env.test` に auth テストで必要な `COGNITO_USER_POOL_ID`・`AWS_REGION` が含まれているかは要確認。含まれていなければテスト用ダミー値を追記する（tasklist 参照）
- `lib/auth.ts` が JWKS 取得のために Cognito エンドポイント（公開 HTTPS）に接続するが、単体テストではテスト用鍵ペアを使うため外部接続なし
- 次フェーズの `features/` 実装が今回の `lib/` を基盤として使う
