---
description: 機能設計書を作成する
model: opus
allowed-tools: Read, Write, Bash(find *), Task
---

# /write-functional-design

PRD(docs/001_product-requirements.md)をもとに機能設計書(docs/002_functional-design.md)を作成する。
PRDの要求を実装レベルに橋渡しする、機能ごとのアーキテクチャ・システム構成図・データモデル・ユースケース図・API設計を定義する。

## 手順

### 1. PRDの読み込みと設計判断の壁打ち

- `docs/001_product-requirements.md` を読む。**PRDは確定した正とし、その内容は疑わない。**
- PRDが定めていない設計レベルの決定についてのみ壁打ちする。例：構成図の粒度、コンポーネント分割、データモデルの詳細化、API/MCPツールのインターフェース仕様、シーケンスの分岐。
- 設計ツリーの各分岐を順に進み、決定間の依存関係を一つずつ解決する。
- 各質問には、推奨する回答を提示する。質問は一度に一つずつ行う。
- コードベースを探索することで回答できる質問があれば、代わりにコードベースを探索せよ。

### 2. テンプレートを読む

Read ツールで `.claude/skills/write-functional-design/template.md` を読む。

### 3. ドラフト作成

インタビューで引き出した内容をテンプレートに流し込む。
図（システム構成図・ユースケース図・シーケンス図）は Mermaid で記述する。
文体は `doc-writing-style` スキルの文体規範に従う。
完成例は `.claude/skills/write-functional-design/example.md` を参照。

### 4. レビューを3周する

`docs/002_functional-design.md` の内容を読み、その全文を添えて `functional-design-reviewer` エージェントにレビューを依頼する。
ユーザーに内容の確認をとって了承を得たらドラフトをレビューの内容で更新する。
この繰り返しを3周してドキュメントの精度を高める。
