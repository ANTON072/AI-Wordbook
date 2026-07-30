# 要求と設計

## ベースにする永続ドキュメント

- [003 技術仕様書 — デプロイ環境・ドメイン](../../spec/003_architecture.md#デプロイ環境ドメイン)
- [003 技術仕様書 — 技術スタック選定（SST / Cognito / DynamoDB）](../../spec/003_architecture.md#技術スタック選定)
- [003 技術仕様書 — IAM・セキュリティ設計](../../spec/003_architecture.md#iamセキュリティ設計)
- [003 技術仕様書 — 環境変数一覧](../../spec/003_architecture.md#環境変数一覧)
- [003 技術仕様書 — コスト設計（AWS Budgets）](../../spec/003_architecture.md#コスト設計)
- [002 機能設計書 — システム構成図](../../spec/002_functional-design.md#システム構成図)

## 要求

### 変更・追加する機能の説明

アプリケーションコードの開発に入る前に、AWS 上のインフラ基盤を構築する。SST v3（ion）を導入し、DynamoDB テーブル・Cognito User Pool（アプリクライアント 2 つ）・`sst.aws.Nextjs`（CloudFront + Lambda）・カスタムドメイン（`ai-wordbook.com`）を `sst.config.ts` で宣言する。`npx sst deploy --stage production` を実行すれば全インフラが立ち上がり、アプリケーション実装を開始できる状態にすることがゴール。

### ユーザーストーリー

- 管理者として、`npx sst deploy --stage production` を実行するだけで全 AWS リソースが揃った状態にしたい
- 管理者として、`https://ai-wordbook.com` にアクセスしたとき Next.js ページが表示されることを確認したい
- 管理者として、Cognito コンソールでユーザーを手動作成し、MCP・Web の両認証フローを動かせる準備が整っていることを確認したい

### 受け入れ条件

1. `sst.config.ts` が存在し、DynamoDB・Cognito（2 クライアント）・NextjsSite・SST Secret が宣言されている
2. `npx sst deploy --stage production` が正常終了する
3. `https://ai-wordbook.com` が CloudFront 経由で Next.js ページを返す
4. Cognito User Pool に MCP 用（パブリック / PKCE）・Web 用（コンフィデンシャル / シークレット有）の 2 クライアントが作成されている
5. `.env.local.example` に [003 の環境変数一覧](../../spec/003_architecture.md#環境変数一覧) の全項目が空値で列挙されている
6. AWS Budgets で月額 500 円超過アラートが設定されている

### 制約事項

- stage・リージョン・Cognito セルフサインアップ無効: [003](../../spec/003_architecture.md#デプロイ環境ドメイン) に定義済み
- ドメイン `ai-wordbook.com` は Route53 で購入済み。ホストゾーンは購入時に自動作成されているはず
- AWS プロファイルは `ougi`（AWS SSO / IAM Identity Center）。デプロイ前に `aws sso login --profile ougi` が必要

## 設計

### 実装アプローチ

1. `pnpm add sst@latest --save-dev` で SST v3 をインストールし、`sst.config.ts` を手動で作成する（`npx sst@latest init` は既存の Next.js 設定を上書きするリスクがあるため使わない）
2. SST の各コンポーネントを宣言し、依存関係（環境変数の注入・IAM 権限）を SST のリソース参照で解決する。ARN・ID をハードコードしない
3. 既存の `node_modules/next/dist/docs/` を参照し、OpenNext が要求する `next.config.ts` の設定を確認・適用する
4. `aws sso login --profile ougi` → `npx sst deploy --stage production` でデプロイ

### 変更するコンポーネント

| ファイル | 変更内容 |
|---|---|
| `sst.config.ts` | 新規作成。DynamoDB・Cognito・NextjsSite・SST Secret・IAM 定義 |
| `.env.local.example` | 新規作成。003 の環境変数一覧の全項目を空値で列挙 |
| `package.json` | `sst` を devDependencies に追加 |
| `next.config.ts` | OpenNext が要求する設定を確認・追加（実装時に確認） |

### SST リソース構成（概要）

Cognito クライアントの種別・シークレット有無・フローは [003 の Cognito クライアント表](../../spec/003_architecture.md#技術スタック選定) を参照。`COGNITO_MCP_CLIENT_ID`・`COGNITO_WEB_CLIENT_ID` の用途と注入方針は [003「環境変数一覧」および「検証ロジックの共用範囲」](../../spec/003_architecture.md#環境変数一覧) を参照。

```
Wordbook (sst.aws.Dynamo)
  PK: userId (string), SK: word (string)
  billing: PAY_PER_REQUEST

UserPool (sst.aws.CognitoUserPool)
  selfSignUpEnabled: false, 初回パスワード変更強制

McpClient (UserPool.addClient)
  コールバック: http://127.0.0.1

WebClient (UserPool.addClient)
  コールバック: https://ai-wordbook.com/api/auth/callback

CognitoWebClientSecret (sst.Secret)
  → COGNITO_WEB_CLIENT_SECRET として Site に注入

Site (sst.aws.Nextjs)
  domain: ai-wordbook.com（ACM + Route53 は SST が自動処理）
  environment: 003 の環境変数一覧を SST リソース参照から注入（ARN・ID のハードコード禁止）
  permissions: Wordbook テーブルへの最小権限（[003 IAM 設計](../../spec/003_architecture.md#iamセキュリティ設計) に準拠）
```

### 影響範囲の分析

- アプリケーションコードへの影響なし。`sst.config.ts` と設定ファイルの追加のみ
- `next.config.ts` に OpenNext が要求する設定が必要になる可能性あり（実装時に `node_modules/next/dist/docs/` を参照して確認）
