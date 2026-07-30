# CLAUDE.md

このファイルは、このリポジトリ内のコードを扱う際に、Claude Code にガイダンスを提供するものです。

## このプロダクトについて

AI英単語帳アプリ。ユーザーが手元のClaudeアプリからmcpを介して単語を操作できる。Web画面で登録した単語が閲覧可能。

## 永続的ドキュメント

アプリケーション全体の「何を作るか・どう作るか」を定義する恒久ファイル。
基本設計が変わらない限り更新しないのが原則。

`docs/spec/001_` 〜 `docs/spec/006_` のいずれかのファイルを新規作成・編集した後は、**必ず** `docs-integration-reviewer` エージェントを起動して横断レビューを実施する。レビュー結果はユーザーに提示し、重大な矛盾・DRY違反が検出された場合はその場で修正案を提案する。

これら永続的ドキュメントを書く・推敲する際の文体は `doc-writing-style` スキルの規範に従う。

|ドキュメント|読むタイミング|
|----|----|
|[001_プロダクト要求定義書(PRD)](./docs/spec/001_product-requirements.md)|スコープ判断が必要な時。新機能追加の前・PRDに関する質問|
|[002_機能設計書](./docs/spec/002_functional-design.md)|コードを書く前・アーキテクチャに影響する変更の前|
|[003_技術仕様書](./docs/spec/003_architecture.md)|新しいライブラリ・インフラ選定の前|
|[004_リポジトリ構造定義書](./docs/spec/004_repository-structure.md)|新しいファイル・ディレクトリを作る前|
|[005_開発ガイドライン](./docs/spec/005_development-guidelines.md)|コードレビュー・コーディング規約に関する判断の前|
|[006_ユビキタス言語定義（共通言語）](./docs/spec/006_glossary.md)|変数名・用語の命名に迷った時|

## 作業単位ドキュメント（ステアリング）

1回の開発作業（機能追加・バグ修正・改善など）で「今回何をするか」を定義するファイル。永続的ドキュメント(`docs/spec/`)が基本設計を定める恒久ファイルなのに対し、ステアリングファイル(`docs/steering/`)は作業単位で作り、完了後は参照用として保持する。この2種類でライフサイクルを分離する。

機能追加・バグ修正・改善など**新しい開発作業を始める前に** `/write-steering [実装したいこと]` を実行し、`docs/steering/[YYYYMMDD]-[開発タイトル]/` に `plan.md`（要求と設計）と `tasklist.md`（タスクと進捗）を作成する。作業中は `tasklist.md` の進捗を更新する。新しい作業では既存を書き換えず、新しいディレクトリを作る。

ステアリングファイルは永続的ドキュメント(001〜006)をベースにする。永続的ドキュメントに既にある記述は繰り返さず、該当箇所をリンク参照する（DRY）。

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Warning

- 社内規定のため Claude Code の Hook を利用することはできません。
- 社内規定のため外部 MCP を利用することはできません。
