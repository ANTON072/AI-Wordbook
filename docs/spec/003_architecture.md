# 技術仕様書

## 概要

### PRD・機能設計書との対応関係

本書は PRD(001) の非機能要件（性能・コスト・セキュリティ）と、機能設計書(002) が「003 技術仕様書に委譲」と明記した3点（性能要件の詳細・コスト最適化・IAM 詳細設計）を、実装可能な物理設計・運用チューニングのレベルまで具体化する。

002 が確定した論理設計（コンポーネント責務・データフロー・DynamoDB 論理キー設計・JWT 検証項目・MCP ツール IF）は正として前提にし、本書では**繰り返さない**。本書が扱うのは「選んだ技術をどう設定して非機能要件を満たすか」「今後追加するライブラリ／インフラをどの根拠で選ぶか」である。

### 技術仕様スコープ

- 対象：技術スタック選定根拠、主要ライブラリ選定（テスト・UI ライブラリの**選定**を含む）、性能設計、コスト設計、IAM・セキュリティ設計、環境変数一覧、デプロイ環境・ドメイン
- 対象外（002 機能設計書が担う）：ユースケース、画面設計、ビジネスルール、データフロー、MCP ツールのインターフェース仕様
- 対象外（001 PRD が担う）：スコープ判断、機能要件の取捨選択
- 対象外（004/005 に委譲）：テスト戦略（単体／統合の範囲・カバレッジ方針）、Web のコンポーネント設計・CSS 設計、ディレクトリ構造、コーディング規約。本書はテスト・UI の「どのライブラリを使うか」の選定までを担い、「どう書くか・どう構成するか」は 004 リポジトリ構造定義書・005 開発ガイドラインに委ねる

### リージョン

全リソースを `ap-northeast-1`（東京）に固定する。ユーザー・管理者が国内であり、レイテンシとデータ所在の観点で東京が妥当。マルチリージョン冗長化は本フェーズでは行わない。**例外：** ACM 証明書は CloudFront 要件により `us-east-1` で発行する（後述「デプロイ環境・ドメイン」）。Route53 ホストゾーンはグローバルサービスのためリージョン概念を持たない。

### デプロイ環境・ドメイン

- **stage は `production` のみ**。SST の stage 機能で複数環境（staging 等）を設けず、単一の本番環境で運用する。個人・少人数の学習プロジェクトであり、環境分離のコストに見合わないため。
- **ドメインは Route53 で管理**する。Route53 でホストゾーンを保持し、ACM（`us-east-1`、CloudFront 要件）で TLS 証明書を発行、SST `NextjsSite` の `domain` 設定で CloudFront にカスタムドメインをバインドする。以降、環境変数等の URL 基点はこの独自ドメイン（`https://{独自ドメイン}`）を指す。**独自ドメイン採用の根拠：** CloudFront のデフォルトドメイン（`*.cloudfront.net`）は技術的に動作するが、Cognito の OAuth コールバック URL はドメインと 1 対 1 で登録するため、ドメインが変わるたびに Cognito 設定変更が必要になる。独自ドメインを採用することでドメインを安定させ、単語帳 URL（個別ページ）のブックマーク有効性も保つ。追加コストは Route53 ホストゾーン約 $0.50/月 + ドメイン登録年額のみであり、5 名の学習 MVP でも許容できると判断した（コスト設計「Route53」行参照）。

## 技術スタック選定

### 選定一覧と根拠

| レイヤー | 採用技術 | 選定根拠 | 検討した代替案と却下理由 |
| --- | --- | --- | --- |
| 言語 | TypeScript | フロント（Next.js）とバックエンド（Lambda）で単語データの型（`Entry` / `Example` 型等）を共有でき、MCP・Web 間でデータ構造の齟齬を防げる | JavaScript（型共有の恩恵を失う） |
| IaC / デプロイ | SST v3（ion） | Next.js を OpenNext 化して CloudFront + Lambda に載せる `NextjsSite` を宣言的に扱え、`Secret`・DynamoDB リソース参照・IAM 権限付与を一元管理できる。個人プロジェクトの運用コストが最小 | CDK 単体（Next.js の OpenNext 統合を手書きする必要があり冗長）／Serverless Framework（Next.js 統合が弱い） |
| MCP 認証 | Amazon Cognito（Hosted UI + OAuth 2.0 PKCE） | OAuth 2.0 PKCE の Hosted UI を標準提供し、JWT の `sub` でユーザー分離できる。管理者によるユーザー手動作成（自由登録不可）・初回パスワード変更強制も設定で満たせる | Auth0（無料枠を超える運用が視野に入り個人利用ではオーバースペック）／自前 IdP（学習範囲を超え、認証を安全に自作するコストが高い） |
| Web 認証 | Cognito ＋ Next.js 自前実装（OAuth 認可コードフロー） | Cognito の Hosted UI でログインし、Next.js の Route Handler でコード交換 → 取得した JWT を HTTP-only Cookie に保持。Cognito 発行の JWT に `sub` が含まれるため、**MCP と同じ `jose` による JWT 検証をそのまま共用**でき、認証ロジックが一本化される。DB セッション・認証ライブラリを持たず最小構成 | **Better Auth（不採用）**：独自の user id 発番・`user`/`account`/`session` の管理・DynamoDB 用 custom adapter 自前実装が必要で、単一 IdP（Cognito のみ）の本アプリには過剰。**NextAuth.js / Auth.js（不採用）**：同様に独自ユーザー管理層が重く、DynamoDB アダプタの安定性にも不安 |
| DB | Amazon DynamoDB | ユーザー単位の単語 CRUD と前方一致検索（`begins_with`）が単一テーブル・オンデマンド課金で無料枠に収まる | RDS（常時起動コストが無料枠運用に不適）／DocumentDB（最小構成でも高コスト） |
| ホスティング | CloudFront + Lambda（OpenNext） | リクエスト従量課金でアイドル時コストゼロ。個人5名規模ではコールドスタートを許容できる。SST `NextjsSite` で一体管理 | Vercel（AWS/SST 前提のスタックと分離され構成が二重化する）／ECS Fargate（常時起動コストが不経済） |
| MCP プロトコル | `@modelcontextprotocol/sdk`（公式） | MCP over HTTP のトランスポート・JSON-RPC フレーミングを公式実装で担保し、学習対象（JWT 検証の自前実装）に集中できる。プロトコル準拠と保守コストを SDK に委ねる | JSON-RPC 完全自前実装（プロトコル準拠の保守コストとバグリスクを負う。学習目的は JWT 検証側にあり、フレーミングまで自作する必要はない） |

**認証の役割分担（Cognito 一本化）：** Cognito は「ユーザーの実体・パスワード・OAuth 発行元」を担う唯一の ID プロバイダー。MCP・Web とも Cognito 発行の JWT を Route Handler で `jose` により自前検証する。MCP は Claude Desktop がアクセストークンを Bearer で送り、Web は Next.js が OAuth 認可コードフローで取得した JWT を HTTP-only Cookie に保持する（DB セッションは持たない）。両経路とも最終的なユーザー識別子は Cognito の `sub` であり、JWT から直接得られる。

**検証ロジックの共用範囲（重要）：** 002 が定めた検証項目のうち、署名・`exp`・`iss`・`token_use === "access"` の検証は MCP・Web で完全に共通だが、**`client_id` の期待値だけは経路ごとに異なる**。認可コードフローで発行された Web の JWT は `client_id` が Web クライアント ID になるためである。共用モジュールは `expectedClientId` を引数に取る設計とし、MCP 経路は `COGNITO_MCP_CLIENT_ID`、Web 経路は `COGNITO_WEB_CLIENT_ID` を渡す。

**Cognito アプリクライアントは2つ作成する：** MCP と Web はクライアント種別が異なり、Cognito のアプリクライアントは「シークレット有無」を切り替える単位のため、1つのクライアントで両立できない。

| クライアント | 種別 | シークレット | フロー | 用途 |
| --- | --- | --- | --- | --- |
| MCP 用アプリクライアント | パブリック | **無し** | OAuth 2.0 PKCE | Claude Desktop が直接トークン取得。MCP の JWT `client_id` 検証はこのクライアント ID を期待値とする |
| Web 用アプリクライアント | コンフィデンシャル | 有り | 認可コードフロー | Next.js の callback ハンドラ（`/api/auth/callback`）がサーバーサイドでトークン交換に使用。`COGNITO_WEB_CLIENT_SECRET` をサーバーで安全に保持 |

002 が定めた「アクセストークンの `client_id` 検証」は経路ごとに期待値が異なる：**MCP 経路は `COGNITO_MCP_CLIENT_ID`、Web 経路（Cookie 内 JWT）は `COGNITO_WEB_CLIENT_ID`** を期待値とする。MCP 経路を Web クライアント ID で検証しても、Web 経路を MCP クライアント ID で検証しても、いずれも `client_id` 不一致で恒常的に失敗する。両者を取り違えない。

**Cognito 課金階層：** Essentials 階層を前提とする（Hosted UI・OAuth 2.0 PKCE を含む）。無料 MAU 枠（Essentials は月間一定 MAU まで無料）内の5名規模のため課金は発生しない。

**Claude Desktop（MCP 用）のリダイレクト URI：** PKCE フローでは Claude Desktop がランダムポートのループバックサーバーを起動し、Cognito がこの URI（`http://127.0.0.1` + 動的ポート）に認可コードをリダイレクトする。Cognito MCP 用アプリクライアントの「許可されたコールバック URL」に `http://127.0.0.1` を登録する（Cognito はポート部分を区別せず、ホスト部分が一致すれば受け入れる）。

**アクセストークンの有効期限：** Cognito デフォルトの 60 分で運用する。本フェーズはリフレッシュトークンを実装しないため、期限切れ時は再ログインが必要になる（制約事項「Web トークンのリフレッシュ未実装」参照）。

**OAuth state の保持方式：**
- MCP（Claude Desktop）：`@modelcontextprotocol/sdk` がフロー中の state をメモリに保持・検証する。アプリ実装では担わない。
- Web：`/login` Route Handler が state を生成し HTTP-only Cookie に格納。`/api/auth/callback` での state 照合で CSRF を防ぐ（詳細は 002 シーケンス図）。

### 主要ライブラリ選定

| 用途 | ライブラリ | バージョン方針 | 選定根拠 |
| --- | --- | --- | --- |
| MCP サーバー実装 | `@modelcontextprotocol/sdk` | 最新安定版（`^1`） | MCP over HTTP のトランスポート・ツール登録・JSON-RPC フレーミングを公式実装で担保。Route Handler にマウントして使う |
| JWT 検証（MCP・Web 共用） | `jose` | 最新安定版（`^6`） | 002 が定めた検証項目を標準 API で実装でき、Lambda 上で軽量に動く。`nodejs24.x` は v6 の動作要件を満たす。`createRemoteJWKSet` で JWKS キャッシュも標準サポート。MCP のアクセストークン検証と Web の Cookie 内 JWT 検証で同一モジュールを使う（`client_id` 期待値のみ引数で切替。上記「検証ロジックの共用範囲」参照） |
| DynamoDB クライアント | `@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb` | AWS SDK v3 | `DynamoDBDocumentClient` で JSON の入出力が容易。Lambda ランタイム同梱版とメジャーを揃え、バンドルサイズを抑える |
| Web 認証（OAuth コードフロー） | 自前実装（追加ライブラリなし） | — | Cognito の `/oauth2/authorize`・`/oauth2/token` を Next.js の Route Handler から呼ぶだけで完結する。トークン交換は標準 `fetch`、`state` 検証・Cookie 発行も薄い自前コードで足りる。認証ライブラリ（Better Auth 等）は導入しない |
| バリデーション | `zod` | `^4` | MCP ツール入力（`WordInput` / `Entry` / `prefix`）のスキーマ検証を型と一元化。正規化後の値に対して 002 のバリデーション規則を宣言的に表現 |
| 単語正規化（共通モジュール） | 自前実装（`lib/normalize`） | — | Web と MCP で共通利用（002 の正規化ルールを単一実装に集約）。外部依存不要で、全角→半角・小文字化・空白正規化のみ |
| テスト | `vitest` | 最新安定版 | TypeScript／Vite/Next.js エコシステムと親和性が高く、正規化・バリデーション・JWT 検証ロジックの単体テストを軽量に実行できる。テスト戦略・カバレッジ方針は 005 に委ねる |
| UI スタイリング | `tailwindcss` | 最新安定版（Next.js 標準セットアップ） | 一覧・モーダル・個別ページの最小限の UI を素早く構築でき、追加のデザインシステム依存を持ち込まない。コンポーネント設計・CSS 設計は 004/005 に委ねる |
| lint / formatter | `biome` | 2 系最新（`^2`） | Lint と Format を単一ツール・単一設定・高速に実行でき、ESLint + Prettier の二本立てより設定と依存を最小化できる。5 名規模で設定メンテのコストを抑えられる。書き方・どこまで縛るかの規約は 005 に委ねる |
| パッケージマネージャ | `pnpm` | 最新安定版 | 内容アドレス方式のストアでディスク効率がよく、依存解決が厳格。`pnpm-lock.yaml` の単一 lockfile で再現性を保つ。運用ルールは 005 に委ねる |

**バージョン方針の原則：** メジャーバージョンを固定（キャレット指定）し、マイナー・パッチは自動追従。AWS SDK v3 は Lambda ランタイム同梱バージョンとメジャーを合わせる。Node.js ランタイムは Lambda で `nodejs24.x`（24 系 LTS）を採用する。

### Web セッション（Cookie）方式

Web のログイン状態は**認証用の DB テーブルを持たず、HTTP-only Cookie に格納した JWT だけで表現**する（ステートレス）。Better Auth のような認証ライブラリを使わないため、独自 user id の発番も `sub` 解決の一手間も発生しない。

| 項目 | 値 |
| --- | --- |
| 保持するもの | Cognito 発行の JWT を HTTP-only・`Secure`・`SameSite=Lax` の Cookie に格納 |
| ユーザー識別 | 毎リクエストで Cookie 内 JWT を `jose` 検証し、`sub` クレームを直接 userId として使う（MCP と同一モジュール。ただし `client_id` 期待値は `COGNITO_WEB_CLIENT_ID`） |
| 単語クエリ | `Query(PK=sub)`。MCP 側の PK（アクセストークンの `sub`）と完全に一致する |
| ログアウト／失効 | Cookie 削除、または JWT の `exp` 到達で失効。失効時はログインページへリダイレクト |
| トークン期限切れ | 本フェーズではリフレッシュを実装せず、期限切れ時は再ログイン（PRD の「セッション失効時はログインページへリダイレクト」に準拠。将来リフレッシュトークン運用に拡張可能） |

Cookie に JWT を載せるため、CSRF 対策として `SameSite=Lax` を基本とし、`state` パラメータで認可コードフローの改ざんを防ぐ。Cookie サイズは 4KB 制限に収まる範囲（アクセストークン単体）で運用する。

## 性能設計

PRD の性能目標（MCP 書き込み3秒以内・Web 一覧表示3秒以内、いずれもウォーム状態）を、以下の設定で満たす。

| 項目 | 設定値 | 根拠 |
| --- | --- | --- |
| Lambda メモリ（サーバー Lambda・単一関数） | 512 MB | MCP 経路（JWT 検証 + DynamoDB 1回操作）・Web 経路（Query 1回 + レンダリング）とも同一関数で処理。いずれも 512 MB で十分で、無料枠（400,000 GB秒/月）内に収まる |
| Lambda タイムアウト | 10 秒 | 3秒目標に対し余裕を持たせつつ、ハング時の課金を抑える。502/504 は CloudFront 経由でクライアントに返る（002 エラーハンドリング方針に準拠） |
| コールドスタート対策 | Provisioned Concurrency **不使用** | 5名・低頻度利用では常時課金の方が不経済。初回1〜2秒の遅延は3秒目標内で許容（PRD がコールドスタート遅延を許容と明記） |
| DynamoDB キャパシティ | オンデマンド（PAY_PER_REQUEST） | トラフィックが読めず低頻度のため、プロビジョンドより無料枠運用に適する。キャパシティ計画不要 |
| JWKS キャッシュ | `jose` の `createRemoteJWKSet`（Lambda 実行環境内メモリキャッシュ） | 毎リクエストの公開鍵取得を避け、ウォーム時のレイテンシを削減。鍵ローテーション時は検証失敗を契機に再取得（後述トレードオフ参照） |
| DynamoDB 接続再利用 | クライアントを Lambda ハンドラ外で初期化 | ウォーム実行間で TCP コネクションを再利用しレイテンシを削減 |
| Web 一覧取得 | `Query`（PK=userId、userId は Cookie 内 JWT を検証して得た Cognito `sub`）single-request | GSI 不要・1回の Query で全件取得（002 のキー設計に準拠）。`createdAt` 降順ソートはアプリ側で実施 |
| `search_words` | `Query`（PK=userId, SK begins_with prefix） | SK 順（アルファベット順）でネイティブに取得。全一致をアプリ側でスライスして最大20件返却（002 のツール仕様に準拠） |

**性能目標の内訳（ウォーム時の想定）：** JWKS メモリヒット（0ms）+ JWT 検証（数ms）+ DynamoDB 単一操作（一桁〜十数ms）で MCP 書き込みは 100ms 未満に収まる見込み。3秒目標に対し十分なマージンがあり、目標を脅かすのはコールドスタート時のみ（許容範囲）。

### CloudFront の `/api/mcp` ビヘイビア設定

CloudFront はデフォルトで `Authorization` ヘッダを origin に転送せず、POST レスポンスの扱いもポリシー次第のため、アクセストークン（Bearer）が Lambda に届くよう明示設定する。SST `NextjsSite`（OpenNext）が概ね面倒を見るが、本書が非機能の設定責任を負う以上、以下を確約する。

| 設定 | 値 | 根拠 |
| --- | --- | --- |
| キャッシュポリシー | 無効（`CachingDisabled` 相当） | 認証付き動的レスポンスを誤キャッシュしない |
| オリジンリクエストポリシー | `Authorization` を含むヘッダを origin へ転送 | アクセストークン（Bearer）を Lambda に到達させる |
| 許可メソッド | `POST`（`GET`/`HEAD` 含む） | MCP は JSON-RPC over POST |

`/.well-known/oauth-protected-resource`（後述の OAuth ディスカバリ）も Next.js のサーバールートであり、オリジン（Lambda）へ転送し長期キャッシュしない。ディスカバリ経路と `/api/mcp` はいずれも「サーバー関数へ転送・キャッシュ無効」で統一する。

### MCP の OAuth ディスカバリ・エンドポイント

リモート HTTP MCP で Claude Desktop が Cognito の認可経路を発見できるよう、Next.js が以下のメタデータを露出する。JSON-RPC フレーミングと同様、`@modelcontextprotocol/sdk` の提供機能で賄える範囲は SDK に委ね、Cognito 実値へのマッピングのみ設定する。

| エンドポイント | 返す内容 | 供給元 |
| --- | --- | --- |
| `/.well-known/oauth-protected-resource` | 保護リソースメタデータ（authorization server の所在＝Cognito、リソース識別子） | Next.js（SDK 補助 or 自前） |
| authorization endpoint | Cognito Hosted UI の `/oauth2/authorize` | Cognito（`COGNITO_DOMAIN`） |
| token endpoint | Cognito の `/oauth2/token` | Cognito |
| jwks_uri | `{iss}/.well-known/jwks.json`（`iss` は User Pool ID から導出） | Cognito |
| scopes | `openid` のみ（最小）。本設計は `aud` を持たず `client_id`＋`token_use` で認可するため、スコープは認可判定には用いず、ディスカバリ表示とトークン発行のための最小指定に留める（カスタムリソースサーバースコープは作成しない） | Cognito アプリクライアント設定 |

JWT 検証（検証項目は002。`client_id` の経路別期待値は上記「検証ロジックの共用範囲」）のみ自前実装し、上記ディスカバリと JSON-RPC トランスポートは SDK/Cognito に委ねるのが実装境界。

## コスト設計

PRD のコスト目標（月数百円以内・原則無料枠）を以下で担保する。

| サービス | 課金方針 | 想定コスト |
| --- | --- | --- |
| Lambda | リクエスト従量。無料枠 100万リクエスト/月・400,000 GB秒/月 | 実質0円（5名・低頻度） |
| DynamoDB | オンデマンド。**PITR 無効**（個人利用のためデータ消失許容） | 無料枠（25GB ストレージ・225万リクエスト相当）内で0円 |
| CloudFront | 従量。無料枠 1TB/月・1,000万リクエスト/月 | 実質0円 |
| Cognito | MAU 課金。無料枠内（5名） | 0円 |
| CloudWatch Logs | **保持期間14日**に設定しログ蓄積コストを抑制 | ほぼ0円 |
| S3（OpenNext 静的アセット） | ストレージ・リクエスト従量 | 数円未満 |
| OpenNext 付随リソース（再検証キュー SQS・ISR キャッシュテーブル DynamoDB・画像最適化 Lambda） | 従量・無料枠内 | 僅少（低頻度アクセスのためほぼ0円） |
| Route53 | ホストゾーン月額固定 + ドメイン登録は年額 | ホストゾーン 約$0.50/月、ドメイン登録は TLD により年額数百〜数千円。本構成で唯一の恒常課金 |
| ACM | パブリック証明書は無料 | 0円 |

**コスト監視：** AWS Budgets で月額アラート（閾値 500円）を設定し、無料枠超過を早期検知する。個人・少人数の低頻度利用では暴走課金のリスクが小さいため、reserved concurrency 等の追加の課金上限制御は本フェーズでは設けない。

### 監視設計

PRD 監視要件（エラー率・実行時間を最低限確認できること）を、Lambda の標準メトリクスで満たす。専用のアラーム・SNS トピック・ダッシュボードは本フェーズでは設けない（個人・少人数運用でオーバースペックのため）。

| 項目 | 手段 |
| --- | --- |
| エラー率 | Lambda `Errors` メトリクスを CloudWatch コンソールで確認 |
| 実行時間 | Lambda `Duration` メトリクスを CloudWatch コンソールで確認 |
| スロットリング | Lambda `Throttles` メトリクスを CloudWatch コンソールで確認 |
| ログ調査 | Lambda のログを CloudWatch Logs（保持14日）に出力し、個別リクエストのエラー内容を追跡 |
| CloudFront | 標準メトリクス（リクエスト数・エラー率・レイテンシ）を CloudWatch コンソールで確認。アクセスログの S3 出力は本フェーズでは有効化しない（PRD 監視要件「エラー率・実行時間の確認」は Lambda 側と CloudFront 標準メトリクスで満たせるため） |

必要になった段階でアラーム（`Errors` 閾値超過→通知）を追加できるが、本フェーズでは導入しない。

**PITR 無効の根拠：** DynamoDB のポイントインタイムリカバリは月額ストレージ課金が発生する。個人学習データであり誤削除・障害からの復旧を要件としない（PRD 信頼性要件に準拠）ため無効化する。

## IAM・セキュリティ設計

### IAM ポリシー設計

最小権限原則に基づき、Lambda 実行ロールに必要なアクション・リソースのみを許可する。ワイルドカード（`dynamodb:*` や `Resource: "*"`）は使用しない。SST の DynamoDB リソース参照経由で ARN を注入し、テーブル ARN をハードコードしない。

**関数構成の前提：** 002 が確定した「MCP と Web を同一 Next.js アプリに統合」に従い、OpenNext は既定でこれを**1つのサーバー Lambda 関数**にバンドルする。`/api/mcp`（要 Wordbook 書き込み）も `/wordbook`（Wordbook 読み取り）も同一関数が処理するため、実行ロールは1つで、権限は両経路の和集合になる。MCP 用・Web 用にロールを物理分離することは本構成では行わない（関数分割はデプロイ・境界の複雑化を招くため採らない）。

| ロール | 許可アクション | リソース | 備考 |
| --- | --- | --- | --- |
| サーバー Lambda 実行ロール | `dynamodb:PutItem` `GetItem` `UpdateItem` `DeleteItem` `Query` | Wordbook テーブルの ARN のみ | `Scan` は付与しない（前方一致は `Query` + `begins_with` で足りる）。GSI を使わないため GSI ARN 不要 |
| サーバー Lambda 実行ロール | `logs:CreateLogGroup` `CreateLogStream` `PutLogEvents` | 当該関数のロググループ ARN | CloudWatch 出力用 |

Web 認証は Cookie 内 JWT のステートレス方式で認証用テーブルを持たないため、DynamoDB へのアクセスは Wordbook テーブル1つのみ。ARN は SST のリソース参照から注入し、ハードコードしない。

**JWKS 取得の権限：** Cognito の JWKS エンドポイントは公開 HTTPS であり、IAM 権限は不要（Lambda のアウトバウンド HTTPS のみ）。

**OpenNext 付随リソースの権限：** 再検証キュー（SQS）・ISR キャッシュテーブル・画像最適化関数など OpenNext が生成するリソースへの権限は、SST が各関数に**最小権限で自動付与**する。これらは上記の手書きロール表の対象外であり、手動でワイルドカードを付与しない。手書きで管理するのは Wordbook テーブルと CloudWatch Logs のアクセスに限る。

**認可の実装レイヤー（単一関数・単一ロール前提）：** 実行ロールは Wordbook の書き込み権限を必然的に持つため、「Web からの単語書き込み抑止」と「ユーザー間のデータ分離」は IAM ではなく**アプリ層（Route Handler）で保証する**。具体的には (1) 単語の書き込みは `/api/mcp` の MCP ツールハンドラ経由のみとし Web 画面ルートからは呼ばない、(2) 行レベルのユーザー分離は必ず検証済みトークン由来の識別子を PK に強制する — MCP はアクセストークンの `sub`、Web は Cookie 内 JWT を検証して得た `sub` を使い、クライアントから PK（userId）を受け取らない。

### シークレット・認証情報管理

- Cognito Web クライアントのシークレットは SST の `Secret` で管理し、リポジトリにコミットしない。
- Lambda へは SST 経由で環境変数として注入する（値そのものはビルド成果物・IaC 定義に平文で残さない）。
- MCP は Cognito 発行のアクセストークンを検証するのみで、クライアントシークレットを持たない（PKCE のため不要）。Cognito クライアントシークレットは Web の OAuth コードフロー（サーバーサイドのトークン交換）でのみ使用する。
- Claude API はサーバー側から呼ばないため、LLM の API キーをサーバーに持たない（PRD セキュリティ要件に準拠）。次フェーズの OpenAI API キーも本フェーズでは導入しない。

## 環境変数一覧

| 変数名 | 用途 | 例 / 形式 | 設定元 |
| --- | --- | --- | --- |
| `COGNITO_USER_POOL_ID` | JWKS 取得・`iss` 組み立ての基点 | `ap-northeast-1_XXXXXXXXX` | SST |
| `COGNITO_MCP_CLIENT_ID` | MCP トークンの `client_id` 検証の期待値（パブリック／PKCE クライアント） | 文字列 | SST |
| `COGNITO_WEB_CLIENT_ID` | Web OAuth コードフローのクライアント（コンフィデンシャル）＋ Web 経路 JWT の `client_id` 検証の期待値 | 文字列 | SST |
| `COGNITO_WEB_CLIENT_SECRET` | Web OAuth コードフローのトークン交換 | シークレット文字列 | SST Secret |
| `COGNITO_DOMAIN` | Hosted UI ドメイン（Web ログインリダイレクト・authorize/token エンドポイント基点） | `https://{prefix}.auth.ap-northeast-1.amazoncognito.com` | SST |
| `DYNAMODB_TABLE_NAME` | 単語テーブル名 | `Wordbook` | SST（リソース参照） |
| `AWS_REGION` | SDK リージョン | `ap-northeast-1` | Lambda ランタイム（予約変数） |
| `APP_BASE_URL` | 個別ページ URL 生成の基点（MCP 戻り値）＋ OAuth コールバック（`/api/auth/callback`）の基点 | `https://{独自ドメイン}` | SST |

**`iss` 期待値・JWKS URL の単一真実源：** `iss` は `https://cognito-idp.{AWS_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}`、JWKS URL は `{iss}/.well-known/jwks.json` で `COGNITO_USER_POOL_ID` から導出する。issuer URL を独立の環境変数として二重に持たせず、値の不整合を防ぐ。

**`APP_BASE_URL` の役割：** 独自ドメイン（Route53 で管理し CloudFront にバインドしたドメイン）を指し、MCP が返す個別ページ URL の基点と、Cognito OAuth のコールバック URL（`{APP_BASE_URL}/api/auth/callback`）の基点を兼ねる。URL 基点を単一の環境変数に集約し、ドメイン変更時の不整合を防ぐ。

**`AWS_REGION` について：** Lambda ランタイムの予約環境変数であり、SST から明示注入する必要はない。SDK は自動でこれを参照する。

## 制約事項・既知のトレードオフ

- **コールドスタートの初回遅延**：Provisioned Concurrency を使わないため、アイドル後の初回リクエストで1〜2秒の遅延が発生しうる。5名・低頻度の利用前提で許容する（PRD 明記事項）。
- **PITR 無効**：DynamoDB のポイントインタイムリカバリを無効化しているため、誤削除・障害からの復旧手段はない。個人学習データであり許容する。
- **リージョン固定**：`ap-northeast-1`（東京）に固定（例外：ACM 証明書のみ CloudFront 要件で `us-east-1`、Route53 はグローバル）。マルチリージョン冗長化・災害復旧は本フェーズでは行わない。
- **JWKS キャッシュのローテーション追従**：Cognito が署名鍵をローテーションした場合、`createRemoteJWKSet` のキャッシュ期間中は旧鍵で検証を試みる。未知の `kid` を検知した際に JWKS を再取得するフォールバック（`jose` の標準挙動）に依存する。頻度は低く、5名規模では実用上問題にならない。
- **単一 Lambda・単一ロールによる IAM 境界の限界**：002 の「MCP と Web を同一 Next.js アプリに統合」に従い OpenNext は単一サーバー Lambda になるため、実行ロールは Wordbook の書き込み権限を必ず持つ。「Web からの単語書き込み抑止」と「ユーザー間データ分離」は IAM では担保できず、アプリ層（Route Handler：MCP 経由のみ書き込み・トークン由来の `sub` を PK に強制）で保証する。IAM 分離を得たい場合は関数分割が必要だが、デプロイ・境界の複雑化を避けるため本フェーズでは採らない。
- **Web トークンのリフレッシュ未実装**：Web は Cognito アクセストークン（JWT）を Cookie に持つステートレス方式。アクセストークンの有効期限が切れると再ログインが必要になる（リフレッシュトークンによる自動更新は本フェーズでは実装しない）。PRD の「セッション失効時はログインページへリダイレクト」に準拠。体験を途切れさせたくなくなった段階でリフレッシュトークン運用へ拡張できる。
- **Cookie ベース認証の考慮**：JWT を HTTP-only Cookie に載せるため、CSRF 対策（`SameSite=Lax`）・認可コードフローの `state` 検証・Cookie サイズ（4KB 制限）に留意する。認証用 DB を持たない代わりに、失効の即時強制（サーバー側でのセッション無効化）はできない点はトレードオフ（`exp` 到達で自然失効）。
- **DynamoDB `Query` の 1MB 上限・ページネーション未実装**：Web 一覧の全件取得と `search_words` の全一致取得は、DynamoDB の 1リクエスト 1MB 上限に依存する。1ユーザーあたり数百語・1件あたり数 KB（品詞エントリ＋例文）を想定すると 1MB に十分収まるため、`LastEvaluatedKey` によるページング継続は実装しない。想定を大きく超える語数を登録したユーザーでは一覧・検索が途中までしか返らない制約があるが、5名・個人利用の規模では発生しない前提とする。
