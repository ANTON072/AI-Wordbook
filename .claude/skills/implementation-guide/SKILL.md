---
name: implementation-guide
description: AI英単語帳アプリの実装コードを書く前に読む重点ガイド。人間が意識しないと外しやすい観点（ユーザー分離・JWT検証・Server/Client境界・zod検証・層依存など）を要点化し、詳細は docs/spec へリンクする。TypeScript・Reactのコードを書く／機能追加／バグ修正／リファクタリングを始める前、および src/ 配下のコードを編集するときに参照する。
---

# 実装ガイド（書く前の重点チェック）

`src/` 配下のコードを書く前に読む。ここに挙げるのは **biome・tsc・`pnpm check` が機械検出できない、人間が意識しないと外しやすい観点** に絞ったリマインダーである。網羅的な規約は `docs/spec/005` を参照する。詳細条文は各項目末尾の spec を単一の正とし、ここでは繰り返さない（DRY）。

## 書き始める前に

- 変更対象に応じて、`docs/spec` の該当書を読む（[CLAUDE.md](../../../CLAUDE.md) の表を参照）。コードを書く前は **002 機能設計・004 リポジトリ構造・005 開発ガイドライン**、用語は **006 用語集**。
- 整形・素の lint・型は biome / tsc / `pnpm check` に任せる。以下はそれで拾えないものだけ。

## 共通（全 TypeScript）

- 単語データ型（`WordInput`／`Entry`／`Example`）は `lib/schema` の zod から `z.infer` で導出する。手書き型で二重定義しない（005・006）。
- `any` は使わない。未知値は `unknown` で受けて絞り込む（005）。
- 非同期は `async`/`await` で統一し、生の Promise チェーンを混ぜない（005）。
- 命名・コメント・段落構成は `readable-code` スキルに従う（「なぜ」を書く／代名詞でぼかさない／スコープに応じた命名）。
- ロジックを持つファイルには `*.test.ts` を併置する（004）。

## サーバー側 — 構造

対象：`src/app/api/`・`src/features/`・`src/lib/`・`src/middleware.ts`

- 依存方向は `app → features → lib` の一方向。`features` 間で相互依存させない（機能をまたぐ結線は Route Handler か Server Component 側で行う, 004）。
- Route Handler は薄く保ち、実処理は `features` へ委譲する（004）。
- 失敗の整形は経路ごとの単一境界に集約する（MCP=`features/mcp` パイプライン、Web 認証=Route Handler）。ハンドラ本体に整形を散らさない（005・002）。
- DynamoDB 条件式：register は `attribute_not_exists`（冪等）、update／delete は `attribute_exists`（存在前提）（002）。
- 単語の正規化は `lib/normalize` の単一実装のみを使う。MCP／Web で別実装に分岐させない（002）。

## サーバー側 — セキュリティ（最重要）

単一 Lambda・単一 IAM ロールで動くため、IAM ロールは書き込み権限を必ず持つ。**「ユーザー間データ分離」も「Web からの書き込み抑止」も IAM では守れず、アプリ層（Route Handler）が唯一の防壁**（003:203, 237）。書く前に必ず満たす：

- **`userId`(PK) は検証済みトークンの `sub` のみを使う**。クライアント入力（body・query・props）から `userId` を受け取らない（003:203, 005:50）。
- **JWT 検証は全項目**（署名・`exp`・`iss`・`token_use === "access"`・`client_id`）。`decodeJwt` の直呼びで済ませず、`jose` の `jwtVerify` を使う共用モジュール（`expectedClientId` を引数で受ける）を通す。`client_id` 期待値は MCP=`COGNITO_MCP_CLIENT_ID`／Web=`COGNITO_WEB_CLIENT_ID`（003:43, 52）。
- 書き込み（`Put`／`Update`／`Delete`）は `features/mcp/tools/` にのみ置く。`features/wordbook`（Web 閲覧）は `Query`／`GetItem` のみ（003:203, 004:103,136）。
- 全外部入力（MCP ツール引数・Route Handler の body/query・OAuth コールバックの `code`／`state`）を zod で検証してからドメインへ渡す（002）。
- Web 認証は `state` を生成し HTTP-only Cookie（`oauth_state`）に格納、callback で照合して CSRF を防ぐ（003:62, 88, 95）。
- Cookie（`auth_token`・`oauth_state`）は `HttpOnly`・`Secure`・`SameSite=Lax` で発行する（003:89, 95）。
- エラー応答・ログ・URL クエリに秘匿情報（トークン・`userId`／PII・スタックトレース・DB 内部構造）を出さない。zod 失敗はフィールド名と理由の自然言語に整形する（005:43）。
- IAM は `dynamodb:*`／`Resource: "*"`／`Scan` を使わず、テーブル ARN は SST のリソース参照から注入する（003:188-197）。
- トークン・鍵・`COGNITO_WEB_CLIENT_SECRET` を平文でコミット・ハードコードしない。SST `Secret`／環境変数で注入する（003:207-209）。

## React

対象：`src/app/**/_components/`・`src/app/**/{page,layout}.tsx` などの UI

React を書くときは、まず `react-best-practices` スキル（Vercel のパフォーマンス70ルール）を参照する。加えて本プロジェクト固有（005）：

- Server Component を既定とし、`'use client'` はインタラクションを持つ葉のコンポーネントに限定する。ページ全体を安易に Client Component 化しない（005:56）。
- データ取得は Server Component で行い、props で Client Component へ渡す。クライアント側 fetch はしない（005:49）。
- クライアント状態は UI 状態（モーダル開閉・検索入力）に限る。サーバー取得データを `useState` に写し替えない。グローバル状態管理ライブラリを持ち込まない（005:57）。
- 認証トークンなど秘匿情報を Client Component に props で渡さない。
- コンポーネント分割は「重複が生じてから」行う。先回りで抽象を作らない（005:58）。
- レイアウトは2次元配置に Grid、1次元に Flex（既定は Grid）。`@apply` や独自ユーティリティで先回り抽象化しない（005:63-65）。
