# 実装ロードマップ

PRD の「MCP 経由の CRUD が一通り動くことを優先」に従い、依存関係順に5ブロックで実装する。

## ブロック構成と依存関係

```
Block 1: インフラ基盤
    ↓
Block 2: 共有ライブラリ（Block 1 と並行可）
    ↓
Block 3: MCP サーバー ← 最優先・このプロジェクトの核心
    ↓          ↓
Block 4: Web 認証   Block 5: Web 閲覧
```

---

## Block 1 — インフラ基盤（最初に固める）

Cognito の Client ID・DynamoDB のテーブル名が確定しないと環境変数が埋まらず、何もテストできない。
一度やれば終わりのセットアップ作業。

| タスク | 内容 |
|--------|------|
| SST スタック定義 | `NextjsSite` + `Secret` の宣言、Lambda メモリ 512MB・タイムアウト 10秒 |
| Cognito 設定 | ユーザープール作成、MCPクライアント（PKCE）・Webクライアント（シークレット有）の2クライアント |
| DynamoDB テーブル | `PK=userId, SK=word`、オンデマンド、PITR 無効 |
| ドメイン / ACM | Route53 ホストゾーン、ACM 証明書（`us-east-1`）、CloudFront バインド |

**依頼例：** `/write-steering SST + Cognito + DynamoDB のインフラセットアップ`

---

## Block 2 — 共有ライブラリ（インフラ不要・ユニットテスト可能）

MCP・Web 双方から使うコアロジック。環境変数なしでユニットテストできるため、Block 1 と並行して進められる。

| モジュール | 内容 |
|------------|------|
| `lib/normalize` | 全角→半角・小文字化・空白正規化 |
| `lib/auth/verify-jwt` | MCP/Web 共用 JWT 検証（`client_id` を引数で切替） |
| `lib/db/repository` | DynamoDB CRUD + `begins_with` 前方一致検索 |
| zod スキーマ | `WordInput` / `Entry` / `prefix` のバリデーション定義 |

**依頼例：** `/write-steering 共有ライブラリ（normalize / JWT検証 / DynamoDBリポジトリ）の実装`

---

## Block 3 — MCP サーバー（最優先）

このプロジェクトの学習目的の核心。Block 1・2 が揃ったら最優先で着手する。

| タスク | 内容 |
|--------|------|
| OAuth ディスカバリ | `/.well-known/oauth-protected-resource`（RFC 9728 形式、SDK ヘルパー or 自前） |
| `/api/mcp` — 4ツール | `register_word` / `delete_word` / `update_word` / `search_words` + JWT 検証 |

**依頼例：** `/write-steering MCPサーバー（OAuthディスカバリ + 4ツール）の実装`

---

## Block 4 — Web 認証

Block 3 完了後に着手。Block 5 と順不同。

| タスク | 内容 |
|--------|------|
| `/login` | state 生成 → HTTP-only Cookie → Cognito Hosted UI へリダイレクト |
| `/api/auth/callback` | 認可コード受取 → トークン交換 → JWT を `auth_token` Cookie に保存 |
| `/api/auth/logout` | Cookie 削除 |

**依頼例：** `/write-steering Web認証フロー（Cognito OAuth → HTTP-only Cookie）の実装`

---

## Block 5 — Web 閲覧

Block 3 完了後に着手。Block 4 と順不同（認証ミドルウェアを先に作るなら Block 4 が先）。

| タスク | 内容 |
|--------|------|
| `/wordbook` | Cookie 内 JWT を検証 → `sub` で DynamoDB Query → 一覧表示 |
| `/wordbook/[word]` | 個別ページ（MCP が返す URL の着地点） |

**依頼例：** `/write-steering Web閲覧ページ（一覧・個別ページ）の実装`

---

## 各ブロックの `/write-steering` 実行タイミング

- Block ごとに1回 `/write-steering` を実行し、`plan.md` と `tasklist.md` を確認してから実装を依頼する
- Block 2 は Block 1 の SST 設定が終わる前に依頼しても問題ない（ユニットテストで完結するため）
- Block 4 と Block 5 は Block 3 完了後、どちらを先に依頼しても構わない
