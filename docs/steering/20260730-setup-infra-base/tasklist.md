# タスクリスト

## 実装タスク

- [x] **[HUMAN]** `aws sso login --profile ougi` を実行して AWS SSO にログイン → 完了したら報告してください
- [x] `pnpm add sst@latest --save-dev` で SST v3 (ion) を devDependencies に追加（sst@4.17.1）
- [x] `node_modules/next/dist/docs/` を参照し、OpenNext が要求する `next.config.ts` の設定を確認・適用（`output: "standalone"` を追加）
- [x] `sst.config.ts` を新規作成し、DynamoDB `Wordbook` テーブルを定義（PK: `userId`、SK: `word`、PAY_PER_REQUEST）
- [x] `sst.config.ts` に Cognito User Pool を追加（セルフサインアップ無効・初回パスワード変更強制）
- [x] `sst.config.ts` に MCP 用アプリクライアント（パブリック / PKCE / コールバック `http://127.0.0.1`）を追加
- [x] `sst.config.ts` に Web 用アプリクライアント（コンフィデンシャル / 認可コードフロー / コールバック `https://ai-wordbook.com/api/auth/callback`）を追加
- [x] `sst.config.ts` に SST Secret（`CognitoWebClientSecret`）を追加
- [x] `sst.config.ts` に `NextjsSite`（ドメイン `ai-wordbook.com`・003 の環境変数一覧を SST リソース参照から注入・DynamoDB 最小権限）を追加
- [x] `.env.local.example` を新規作成（[003 の環境変数一覧](../../spec/003_architecture.md#環境変数一覧) の全項目を空値で列挙）
- [x] `.gitignore` に `.env.local` が除外指定されているか確認し、`.sst` ディレクトリを追加（`.env*` パターンで `.env.local` はカバー済み）
- [ ] **[HUMAN]** `npx sst deploy --stage production` を実行 → 正常終了したら報告してください（初回は ACM 証明書の DNS 検証・CloudFront 配布で 10〜20 分かかります）
- [ ] **[HUMAN]** デプロイ出力から各 Cognito クライアント ID・User Pool ID・ドメインを `.env.local` に設定し、ローカルで `pnpm dev` が起動することを確認 → 完了したら報告してください
- [ ] **[HUMAN]** `https://ai-wordbook.com` にブラウザでアクセスし、Next.js ページが表示されることを確認 → 確認できたら報告してください
- [ ] **[HUMAN]** Cognito コンソールでテスト用ユーザー（管理者本人）を手動作成し、初回パスワード変更を完了させる → 完了したら報告してください
- [ ] **[HUMAN]** AWS Budgets コンソールで月額 500 円超過アラートを設定 → 完了したら報告してください

## テスト

<!-- インフラ基盤のセットアップ作業であり、アプリケーションロジックの vitest テストは対象外。
     受け入れ条件の確認が検証を兼ねる。write-tests スキルを参照したが、今回はデプロイ検証が主であり
     新規アプリコードがないため自動テスト項目はなし。 -->

- [ ] AWS コンソールで DynamoDB テーブル `Wordbook` が `ap-northeast-1` に存在することを確認（受け入れ条件 1）
- [ ] AWS コンソールで Cognito User Pool に 2 クライアントが存在することを確認（受け入れ条件 4）
- [ ] `https://ai-wordbook.com` が 200 を返すことをブラウザで確認（受け入れ条件 3）

## コードレビューループ

<!-- 今回のレビュー対象は sst.config.ts（IAM 最小権限設定・環境変数注入の正確さ・SST リソース参照の適切さ）。
     アプリロジックは含まないため、implementation-guide スキルではなく IAM・セキュリティ観点を中心に見る。 -->

- [ ] **1周目**: `code-reviewer` エージェントを起動 → 指摘一覧をユーザーに提示
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

- 2026-07-30 作業開始。AWS SSO ログイン完了。
- 2026-07-30 SST 4.17.1 インストール、next.config.ts 更新（output: standalone）、sst.config.ts 新規作成（DynamoDB・Cognito・NextjsSite）、.env.local.example 作成、.gitignore 更新（.sst 追加）完了。次は [HUMAN] タスク: `npx sst deploy --stage production`。
