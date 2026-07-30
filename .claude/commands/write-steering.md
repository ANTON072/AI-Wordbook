---
description: ステアリングファイル（作業単位ドキュメント）を作成する
model: opus
allowed-tools: Read, Write, Bash(find *), Bash(date *), Task
argument-hint: [実装したいこと]
---

# /write-steering

今回の開発作業（機能追加・バグ修正・改善など）の「今回何をするか」を定義するステアリングファイルを作成する。
永続ドキュメント(001〜006)をベースに、`docs/steering/[YYYYMMDD]-[開発タイトル]/` に `plan.md`（要求と設計）と `tasklist.md`（タスクと進捗）を生成する。

永続ドキュメント(`docs/spec/`)は基本設計を定める恒久ファイル、ステアリングファイル(`docs/steering/`)は1回の開発作業ごとに作り完了後は参照用に保持するファイルであり、両者はライフサイクルが異なる。

## 使い方

- `/write-steering $ARGUMENTS` 渡された自然文（例：「タグ機能を実装して」）を今回の作業の起点とする。
- `$ARGUMENTS` が無い場合は「今回何を実装するか」を尋ね、答えを得てから進める。

## 手順

### 1. 永続ドキュメントの読み込み

`docs/spec/001`〜`006` を Read する。**永続ドキュメントは確定した正とし、その内容は疑わない。**
今回の作業のスコープ・用語・設計制約は、この永続ドキュメントを前提にする。

### 2. 壁打ち（深掘り）

`$ARGUMENTS` を鵜呑みにせず、共通理解に達するまでインタビューする。
受け入れ条件・制約・影響範囲など、今回の作業を定義するのに必要な点を詰める。

- 設計ツリーの各分岐を順に進み、決定間の依存関係を一つずつ解決する。
- 各質問には推奨する回答を提示する。質問は一度に一つずつ行う。
- 永続ドキュメントやコードベースを探索することで回答できる質問があれば、代わりに探索せよ。

### 3. ディレクトリ名の決定

`date +%Y%m%d` を実行して日付を得る。`$ARGUMENTS` から開発タイトルを kebab-case で表し、`docs/steering/YYYYMMDD-<title>/` を確定する（例：`docs/steering/20250115-add-tag-feature/`）。

### 4. テンプレートを読む

Read ツールで `.claude/skills/write-steering/plan-template.md` と `.claude/skills/write-steering/tasklist-template.md` を読む。

### 5. ドラフト作成

インタビューで引き出した内容をテンプレートに流し込み、`docs/steering/<dir>/plan.md` と `docs/steering/<dir>/tasklist.md` を Write する。
文体は `doc-writing-style` スキルの文体規範に従う。

**DRY原則**：永続ドキュメント(001〜006)に既にある記述（技術スタック・データモデル・キー設計・配置ルール・用語定義など）は繰り返さず、`docs/spec/00N_*.md` の該当箇所を正としてリンク参照する。ステアリングには「今回の作業で新たに決めたこと・変わること」だけを書く。既存記述への参照は `plan.md` 冒頭の「ベースにする永続ドキュメント」に集約する。

**完了条件の必須項目**：`tasklist.md` の完了条件には、必ず `pnpm check`（lint・format・test・typecheck を一括実行するコマンド）が all green になることを含める。これが all green でない限り、今回の作業は完了扱いにしない。

### 6. レビューする

`plan.md` と `tasklist.md` の内容を読み、その全文を添えて `steering-reviewer` エージェントにレビューを依頼する。
レビューは、要求・実装方法の妥当性と、永続ドキュメントとの乖離・DRY違反を対象とする。
ユーザーに内容の確認をとって了承を得たらドラフトをレビューの内容で更新する。
