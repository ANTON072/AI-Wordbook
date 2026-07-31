# 実装ロードマップ

PRD の「MCP 経由の CRUD が一通り動くことを優先」に従い、依存関係順に5ブロックで実装する。

## ブロック構成と依存関係

```
Block 1: インフラ基盤        ✅ 完了
    ↓
Block 2: 共有ライブラリ      ✅ 完了（Block 1 と並行可）
    ↓
Block 3: MCP サーバー        ⬜ 未着手（最優先・このプロジェクトの核心）
    ↓          ↓
Block 4: Web 認証            ⬜ 未着手
         Block 5: Web 閲覧   ⬜ 未着手
```

---

## Block 1 — インフラ基盤 ✅ 完了

SST / Cognito / DynamoDB / ドメインの AWS インフラ整備。詳細は [`docs/steering/20260730-setup-infra-base/`](../steering/20260730-setup-infra-base/) を参照。

**依頼例：** `/write-steering SST + Cognito + DynamoDB のインフラセットアップ --context docs/note/implementation-roadmap.md`

---

## Block 2 — 共有ライブラリ ✅ 完了

MCP・Web 双方から使うコアロジック（normalize / verify-jwt / repository / zod スキーマ）。詳細は [`docs/steering/20260731-implement-shared-lib/`](../steering/20260731-implement-shared-lib/) を参照。

**依頼例：** `/write-steering 共有ライブラリ（normalize / JWT検証 / DynamoDBリポジトリ）の実装 --context docs/note/implementation-roadmap.md`

---

## Block 3 — MCP サーバー ⬜ 未着手

OAuth ディスカバリ + 4ツール（register / delete / update / search）。このプロジェクトの学習目的の核心。

**依頼例：** `/write-steering MCPサーバー（OAuthディスカバリ + 4ツール）の実装 --context docs/note/implementation-roadmap.md`

---

## Block 4 — Web 認証 ⬜ 未着手

Cognito OAuth → HTTP-only Cookie による認証フロー（/login / callback / logout）。Block 3 完了後に着手。

**依頼例：** `/write-steering Web認証フロー（Cognito OAuth → HTTP-only Cookie）の実装 --context docs/note/implementation-roadmap.md`

---

## Block 5 — Web 閲覧 ⬜ 未着手

単語一覧・個別ページ（/wordbook）。Block 3 完了後に着手。Block 4 と順不同。

**依頼例：** `/write-steering Web閲覧ページ（一覧・個別ページ）の実装 --context docs/note/implementation-roadmap.md`

---

## 各ブロックの `/write-steering` 実行タイミング

- write-steering 呼び出し時は `--context docs/note/implementation-roadmap.md` を付けて現在の実装状態を渡す
- Block ごとに1回 `/write-steering` を実行し、`plan.md` と `tasklist.md` を確認してから実装を依頼する
- Block 2 は Block 1 の SST 設定が終わる前に依頼しても問題ない（ユニットテストで完結するため）
- Block 4 と Block 5 は Block 3 完了後、どちらを先に依頼しても構わない
