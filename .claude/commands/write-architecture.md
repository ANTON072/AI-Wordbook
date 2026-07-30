---
description: 技術仕様書を作成する
model: opus
allowed-tools: Read, Write, Bash(find *), Task
---

# /write-architecture

PRD(docs/spec/001_product-requirements.md)と機能設計書(docs/spec/002_functional-design.md)をもとに技術仕様書(docs/spec/003_architecture.md)を作成する。
002が「003技術仕様書に委譲」と明記した性能要件の詳細・コスト最適化・IAM詳細設計を実装可能なレベルまで具体化し、技術スタック・ライブラリの選定根拠と環境変数一覧を定義する。

## 手順

### 1. PRD・機能設計書の読み込みと技術判断の壁打ち

- `docs/spec/001_product-requirements.md` と `docs/spec/002_functional-design.md` を読む。**PRDと機能設計書は確定した正とし、その内容は疑わない。**
- 002が既に定義した論理設計（データフロー・論理キー設計・MCPツールIF）は繰り返さない。003が担う技術選定・性能・コスト・IAM・環境変数についてのみ壁打ちする。例：ライブラリのバージョン方針、Lambdaメモリ設定、DynamoDBのキャパシティモード、IAMポリシーの粒度、シークレット管理方法。
- 設計ツリーの各分岐を順に進み、決定間の依存関係を一つずつ解決する。
- 各質問には、推奨する回答を提示する。質問は一度に一つずつ行う。
- コードベースを探索することで回答できる質問があれば、代わりにコードベースを探索せよ。

### 2. テンプレートを読む

Read ツールで `.claude/skills/write-architecture/template.md` を読む。

### 3. ドラフト作成

インタビューで引き出した内容をテンプレートに流し込む。
選定根拠・性能設計・コスト設計・IAM設計・環境変数は表形式で具体的な値とともに記述する。
文体は `doc-writing-style` スキルの文体規範に従う。
完成例は `.claude/skills/write-architecture/example.md` を参照。

### 4. レビューを3周する

`docs/spec/003_architecture.md` の内容を読み、その全文を添えて `architecture-reviewer` エージェントにレビューを依頼する。
ユーザーに内容の確認をとって了承を得たらドラフトをレビューの内容で更新する。
この繰り返しを3周してドキュメントの精度を高める。
