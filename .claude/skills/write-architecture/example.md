# 技術仕様書

## 概要

### PRD・機能設計書との対応関係

本書は PRD(001) の非機能要件（性能・コスト・セキュリティ）と、機能設計書(002) が「003技術仕様書に委譲」と明記した3点（性能要件の詳細・コスト最適化・IAM詳細設計）を、実装可能な物理設計・運用チューニングのレベルまで具体化する。

002 が確定した論理設計（コンポーネント責務・データフロー・DynamoDB論理キー設計・JWT検証項目・MCPツールIF）は正として前提にし、本書では**繰り返さない**。本書が扱うのは「選んだ技術をどう設定して非機能要件を満たすか」「今後追加するライブラリ/インフラをどの根拠で選ぶか」である。

### 技術仕様スコープ

- 対象：技術スタック選定根拠、主要ライブラリ選定、性能設計、コスト設計、IAM・セキュリティ設計、環境変数一覧
- 対象外（002機能設計書が担う）：ユースケース、画面設計、ビジネスルール、データフロー、MCPツールのインターフェース仕様

## 技術スタック選定

### 選定一覧と根拠

| レイヤー | 採用技術 | 選定根拠 | 検討した代替案と却下理由 |
| --- | --- | --- | --- |
| 言語 | TypeScript | フロント（Next.js）とバックエンド（Lambda）で型定義（`Entry` 型等）を共有でき、単語データ構造の齟齬を防げる | — |
| IaC / デプロイ | SST v3（ion） | Next.js を OpenNext 化して CloudFront + Lambda に載せる `NextjsSite` を宣言的に扱え、個人プロジェクトの運用コストが最小 | CDK単体（Next.jsのOpenNext統合を手書きする必要があり冗長） |
| MCP認証 | Amazon Cognito | OAuth 2.0 PKCE の Hosted UI を標準提供し、JWT の `sub` でユーザー分離できる。管理者によるユーザー手動作成（自由登録不可）も満たす | Auth0（無料枠を超える運用が視野に入るため個人利用ではオーバースペック） |
| Web認証 | Better Auth | Cognito を OAuth プロバイダーとして使いつつ、HTTP-only Cookie セッションを自前DBに持てる。Next.js App Router との親和性が高く型安全 | **NextAuth.js（採用せず）**：v5(Auth.js)移行期でDynamoDBアダプタの安定性に不安があり、セッション制御の自由度が Better Auth に劣ると判断 |
| DB | DynamoDB | ユーザー単位の単語CRUDと前方一致検索が単一テーブル・オンデマンド課金で無料枠に収まる | RDS（常時起動コストが無料枠運用に不適） |
| ホスティング | CloudFront + Lambda（OpenNext） | リクエスト従量課金でアイドル時コストゼロ。個人5名規模ではコールドスタートを許容できる | Vercel（AWS/SST 前提のスタックと分離され構成が二重化する） |

### 主要ライブラリ選定

| 用途 | ライブラリ | バージョン方針 | 選定根拠 |
| --- | --- | --- | --- |
| JWT検証（MCP） | `jose` | ^5 | Cognito 公開鍵（JWKS）での署名検証・`exp`/`iss`/`client_id`/`token_use` 検証を標準APIで実装でき、Lambda上で軽量に動く |
| DynamoDBクライアント | `@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb` | AWS SDK v3 | DocumentClient でJSONの入出力が容易。Lambdaランタイム同梱版と揃える |
| MCPサーバー実装 | `@modelcontextprotocol/sdk` | 最新安定版 | MCP over HTTP のトランスポートを公式実装で担保 |
| Web認証 | `better-auth` | 最新安定版 | 上記の選定根拠に同じ。DynamoDB アダプタでセッションを永続化 |

## 性能設計

PRD の性能目標（登録3秒以内・一覧表示3秒以内）を、以下の設定で満たす。

| 項目 | 設定値 | 根拠 |
| --- | --- | --- |
| Lambda メモリ（MCP） | 512 MB | JWT検証（JWKS取得含む）+ DynamoDB 1回書き込みで十分。無料枠（400,000 GB秒/月）内に収まる |
| コールドスタート対策 | Provisioned Concurrency **不使用** | 5名・低頻度利用では常時課金の方が不経済。初回1〜2秒の遅延は3秒目標内で許容 |
| DynamoDB キャパシティ | オンデマンド | トラフィックが読めず低頻度のため、プロビジョンドより無料枠運用に適する |
| JWKS キャッシュ | Lambda実行環境内でメモリキャッシュ | 毎リクエストの公開鍵取得を避け、ウォーム時のレイテンシを削減 |
| Web 一覧取得 | `Query`（PK=userId）single-request | GSI不要・1回のQueryで完結（002のキー設計に準拠） |

## コスト設計

PRD のコスト目標（月数百円以内・原則無料枠）を以下で担保する。

| サービス | 課金方針 | 想定コスト |
| --- | --- | --- |
| Lambda | リクエスト従量。無料枠 100万リクエスト/月 | 実質0円 |
| DynamoDB | オンデマンド。**PITR無効**（個人利用のため）| 無料枠（25GB・RCU/WCU）内で0円 |
| CloudFront | 従量。無料枠 1TB/月 | 実質0円 |
| Cognito | MAU課金。無料枠 内（5名） | 0円 |
| CloudWatch Logs | **保持期間14日**に設定しログ蓄積コストを抑制 | ほぼ0円 |

無料枠超過の監視は AWS Budgets で月額アラート（例：500円）を設定する。

## IAM・セキュリティ設計

### IAMポリシー設計

最小権限原則に基づき、Lambda 実行ロールに以下のみを許可する。

| ロール | 許可アクション | リソース | 備考 |
| --- | --- | --- | --- |
| MCP Lambda 実行ロール | `dynamodb:PutItem` `GetItem` `UpdateItem` `DeleteItem` `Query` | Wordbook テーブルの ARN のみ | `Scan` は付与しない（前方一致は Query で足りる） |
| MCP Lambda 実行ロール | `logs:CreateLogGroup` `CreateLogStream` `PutLogEvents` | 当該関数のロググループ ARN | CloudWatch 出力用 |
| Web Lambda 実行ロール | `dynamodb:Query` `GetItem`（+セッション用テーブルの読み書き） | Wordbook / セッションテーブル ARN | 単語は読み取り専用（WebからのCRUDはスコープ外） |

ワイルドカード（`dynamodb:*` や `Resource: "*"`）は使用しない。

### シークレット・認証情報管理

- Cognito のクライアントシークレット・Better Auth のシークレットキーは SST の `Secret` で管理し、リポジトリにコミットしない。
- Lambda へは環境変数として SST 経由で注入する。
- ユーザー分離は JWT の `sub`（MCP）／セッションの userId（Web）で行い、他ユーザーの単語へアクセスできないことをアプリ層で保証する。

## 環境変数一覧

| 変数名 | 用途 | 例 / 形式 | 設定元 |
| --- | --- | --- | --- |
| `COGNITO_USER_POOL_ID` | JWKS取得・`iss` 検証 | `ap-northeast-1_XXXX` | SST |
| `COGNITO_CLIENT_ID` | JWT の `client_id` 検証 | 文字列 | SST |
| `COGNITO_ISSUER_URL` | `iss` 期待値 | `https://cognito-idp.{region}.amazonaws.com/{poolId}` | SST |
| `DYNAMODB_TABLE_NAME` | 単語テーブル名 | `Wordbook` | SST（リソース参照） |
| `AWS_REGION` | SDK リージョン | `ap-northeast-1` | Lambda ランタイム |
| `BETTER_AUTH_SECRET` | Web セッション署名鍵 | ランダム32B以上 | SST Secret |
| `BETTER_AUTH_URL` | Web のベースURL | `https://{cloudfront-domain}` | SST |
| `APP_BASE_URL` | 個別ページURL生成の基点 | `https://{cloudfront-domain}` | SST |

## 制約事項・既知のトレードオフ

- **コールドスタートの初回遅延**：Provisioned Concurrency を使わないため、アイドル後の初回リクエストで1〜2秒の遅延が発生しうる。5名・低頻度の利用前提で許容する。
- **PITR無効**：DynamoDB のポイントインタイムリカバリを無効化しているため、誤削除からの復旧手段はない。個人学習データであり許容する。
- **リージョン固定**：`ap-northeast-1`（東京）に固定。マルチリージョン冗長化は本フェーズでは行わない。
- **JWKSキャッシュのTTL**：Cognito が鍵をローテーションした場合、キャッシュ期間中は旧鍵で検証を試みる。検証失敗時にキャッシュを破棄して再取得するフォールバックを実装する。
