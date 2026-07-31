# 要求と設計

## ベースにする永続ドキュメント

- [002 機能設計書 § MCP エンドポイント・ツール仕様](../../spec/002_functional-design.md)：パイプライン構造・4ツールの入出力仕様・エラーハンドリング方針・OAuth ディスカバリの返却内容
- [003 技術仕様書 § MCP の OAuth ディスカバリ・2026-07-28 仕様](../../spec/003_architecture.md)：ディスカバリエンドポイントの仕様・CloudFront ビヘイビア設定・`@modelcontextprotocol/sdk` 選定根拠・JWT 検証ロジック共用範囲
- [004 リポジトリ構造定義書 § features/mcp・配置ルール](../../spec/004_repository-structure.md)：`features/mcp` の責務・`tools/` 配置・依存方向・Route Handler を薄く保つ原則
- [005 開発ガイドライン § テスト戦略・エラーハンドリング](../../spec/005_development-guidelines.md)：MCP ツールの結合テスト方針・DynamoDB Local・整形境界の配置

## 要求

### 変更・追加する機能の説明

Block 3 として MCP サーバーの全体を実装する。Block 2 で完成した共有ライブラリ（`lib/auth`・`lib/normalize`・`lib/schema`・`lib/db`・`lib/url`）を組み合わせ、以下の 2 つを新規に構築する。

- **OAuth ディスカバリエンドポイント**（`GET /.well-known/oauth-protected-resource`）：Claude Desktop が Cognito の認可経路を発見するためのメタデータを RFC 9728 形式で返す
- **MCP エンドポイント**（`POST /api/mcp`）：JWT 検証 → 正規化 → バリデーション → ツールハンドラというパイプラインで単語 CRUD を提供する

### ユーザーストーリー

[PRD(001) § ユーザーストーリー](../../spec/001_product-requirements.md) に準拠する。英語記事で出会った単語を Claude Desktop に伝えると、`register_word` が実行されて個別ページ URL が返る一往復の体験を実現する。

### 受け入れ条件

| 条件 | 検証手段 |
|---|---|
| `/.well-known/oauth-protected-resource` が RFC 9728 の JSON を返す | 結合テスト |
| `register_word` が新規単語を登録し個別ページ URL を返す | 結合テスト |
| `register_word` が既存単語に対して上書きせず既存 URL を返す（冪等） | 結合テスト |
| `delete_word` が単語を削除し完了メッセージを返す | 結合テスト |
| `delete_word` が存在しない単語に対してエラーメッセージを返す | 結合テスト |
| `update_word` が辞書情報を全置換し個別ページ URL を返す（`createdAt` 保持） | 結合テスト |
| `update_word` が存在しない単語に対してエラーメッセージを返す | 結合テスト |
| `search_words` が前方一致で最大 20 件をアルファベット順に返す | 結合テスト |
| `search_words` が 21 件以上の場合に先頭 20 件と件数メッセージを返す | 結合テスト |
| `search_words` が 0 件の場合にエラーメッセージを返す | 結合テスト |
| 無効な JWT（期限切れ・署名不正）に対して 401 を返す | 結合テスト |
| バリデーション違反に対してフィールド名を含むエラーメッセージを返す | 結合テスト |
| 別 `userId` のユーザーが他ユーザーの項目を参照・操作できない（ユーザー分離） | 結合テスト |

### 制約事項

- Block 2 の `lib/` は再実装しない（参照のみ）
- ツールハンドラ（`features/mcp/tools/`）は DynamoDB 操作に徹し、エラー整形を持たない（[005](../../spec/005_development-guidelines.md)）
- Route Handler は薄く保ち、パイプライン組み立ては `features/mcp` が担う（[004](../../spec/004_repository-structure.md)）
- 書き込み操作（PutItem / UpdateItem / DeleteItem）は `features/mcp/tools/` のみが持つ（[004](../../spec/004_repository-structure.md)）
- `userId`（DynamoDB PK）はクライアント入力から受け取らず、JWT 検証結果の `sub` を引数で渡す（[003](../../spec/003_architecture.md)・[004](../../spec/004_repository-structure.md)）

## 設計

### 実装アプローチ

1. `@modelcontextprotocol/sdk` をインストールする（[003](../../spec/003_architecture.md) § 主要ライブラリ：キャレット制約なし・最新安定版）
2. OAuth ディスカバリ（`features/mcp/discovery.ts`）を実装し、`app/.well-known/oauth-protected-resource/route.ts` に接続する
3. 4 つのツールハンドラ（`features/mcp/tools/`）を実装する
4. MCP サーバー（`features/mcp/server.ts`）を実装する：SDK 初期化・JWT 検証パイプライン・ツール登録・エラー整形
5. MCP Route Handler（`app/api/mcp/route.ts`）に接続する

**リクエストパイプライン（[002 § MCP エンドポイント](../../spec/002_functional-design.md)・[004 § features/mcp 責務](../../spec/004_repository-structure.md) に準拠）：**

```
POST /api/mcp（Route Handler）
  → Request を features/mcp/server.ts に渡す（結線のみ）

features/mcp/server.ts
  → Authorization ヘッダからアクセストークン取り出し
  → lib/auth.verifyAccessToken(token, COGNITO_MCP_CLIENT_ID) → 401 or { sub }
  → @modelcontextprotocol/sdk が JSON-RPC をパース → tool 名でディスパッチ
  → ツールラッパーが lib/normalize で正規化 → lib/schema でバリデーション → tool handler 呼び出し
  → 成功: URL or メッセージ / 失敗: エラーメッセージ（002 エラーハンドリング方針に準拠）
```

**OAuth ディスカバリ応答形式（RFC 9728 Section 2）：**

返却内容は RFC 9728 Section 2 に従い `resource` と `authorization_servers` を含む JSON とする。`authorization_servers` の値（iss URL）は [003 § 環境変数一覧](../../spec/003_architecture.md) の iss 導出に従い `COGNITO_USER_POOL_ID` から組み立てる（再掲しない）。`resource` の具体値（`APP_BASE_URL` か MCP エンドポイント URL か）は SDK ドキュメントおよび Claude Desktop の初回接続テストで確認する。

Cognito の `authorization_endpoint`・`token_endpoint` は、Claude Desktop SDK が `{authorization_servers[0]}/.well-known/openid-configuration` から取得するため、本エンドポイントには含めない（[003 § OAuth ディスカバリ](../../spec/003_architecture.md) 参照）。

**SDK 統合方針：**

- SDK の具体的な API（`McpServer` 等の初期化・Next.js App Router との接続方法）は実装時に `node_modules/@modelcontextprotocol/sdk` の型定義と README を確認する
- 2026-07-28 仕様のステートレス動作（[003 § 2026-07-28 仕様の変更点](../../spec/003_architecture.md)）に対応した SDK を使うため、セッションハンドシェイクは不要
- JWT 検証は SDK より手前で実施し、取り出した `sub` をツールハンドラに渡す

**エラー整形の責務（[005 § エラーハンドリング](../../spec/005_development-guidelines.md) に準拠）：**

- `features/mcp/tools/` の各ツールハンドラは例外を投げることに徹し、整形を持たない
- `features/mcp/server.ts` が例外を捕捉し、[002 のエラーハンドリング方針](../../spec/002_functional-design.md)（バリデーション失敗は 200・MCP エラー応答、JWT 失敗は 401）に変換する

### 変更するコンポーネント

新規作成のみ（既存 `lib/` ファイルへの変更なし）：

| ファイル | 役割 |
|---|---|
| `src/features/mcp/discovery.ts` | RFC 9728 形式のディスカバリメタデータ組み立て |
| `src/features/mcp/server.ts` | SDK 初期化・JWT 検証パイプライン・ツール登録・エラー整形 |
| `src/features/mcp/tools/register.ts` | `register_word`：PutItem（`attribute_not_exists(SK)` 条件） |
| `src/features/mcp/tools/delete.ts` | `delete_word`：DeleteItem（`attribute_exists(SK)` 条件） |
| `src/features/mcp/tools/update.ts` | `update_word`：UpdateItem（`attribute_exists(SK)` 条件・`createdAt` 保持） |
| `src/features/mcp/tools/search.ts` | `search_words`：Query（`begins_with`・全一致取得後に 20 件スライス） |
| `src/app/api/mcp/route.ts` | `POST /api/mcp` の薄い Route Handler |
| `src/app/.well-known/oauth-protected-resource/route.ts` | `GET /.well-known/...` の薄い Route Handler |

### データ構造の変更

データモデルの変更なし（[002 § データモデル](../../spec/002_functional-design.md) の構造を使用。DynamoDB テーブルは Block 1 で作成済み）。

### 影響範囲の分析

- Block 2 の `lib/` は変更なし（参照のみ）
- `src/middleware.ts` は Block 4 で作成するため本ブロックでは作成しない（`/api/mcp` は middleware の保護対象外のため未作成でも動作する。[004 § モジュール依存の方向](../../spec/004_repository-structure.md) 参照）
- Block 4（Web 認証）・Block 5（Web 閲覧）は未着手のため影響なし
