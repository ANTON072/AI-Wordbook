# プロダクト要求定義書

## プロダクト概要

### 名称

**AI-Wordbook** — Claude × MCP で操作する英単語帳

### プロダクトコンセプト

- **会話で登録**：Claude アプリとの会話の中で英単語の辞書情報を生成し、MCP ツールで単語帳に保存する
- **MCPで完結する書き込み**：登録・削除・更新・検索はすべて MCP ツール経由。管理画面は持たない
- **Webで閲覧**：登録済み単語の確認は専用 Web 画面から。MCP は閲覧先 URL を返す

### プロダクトビジョン

MCP サーバーの自作を通じて Claude × AWS の統合を学ぶ個人プロジェクト。
英単語帳というシンプルなドメインを題材に、Claude との自然な対話で語彙を蓄積できる体験を実現する。
第一目的は MCP サーバー自作の学習であり、機能の網羅性よりも MCP 経由の CRUD が一通り動くことを優先する。

### 目的

- MCP サーバー開発の実践的な学習（リモート HTTP × OAuth 2.0 PKCE × Lambda での JWT 検証を自力実装・デプロイし、認証フローを説明できる状態になる）
- 英単語を Claude に投げるだけで辞書情報（和訳・品詞・例文）を会話の中で生成して保存
- ユーザーごとに独立した単語帳を管理
- Web 画面で登録済み単語をいつでも確認

### MVP 完了条件

以下がすべて確認できたら MVP 完了とする。

- 4つの MCP ツール（register / delete / update / search）が Claude Desktop から実行できる
- 単語登録は Claude との 1 往復（ユーザー発話 → ツール実行 → URL 返却）で完結する
- Web 一覧・個別ページが表示できる
- Cognito 認証でユーザー分離（他ユーザーのデータにアクセスできないこと）が確認できる
- リモート HTTP × OAuth 2.0 PKCE × Lambda での JWT 検証の認証フローを説明できる

## ターゲットユーザー

### プライマリーペルソナ

管理者（作者）が招待した限定ユーザー。初期は作者本人を含め 5 名以内。
Claude アプリを日常的に使い、英語記事を読む中で知らない単語に出会ったとき、会話の流れでそのままメモとして登録したい中〜上級学習者。

**ユーザーストーリー（代表例）：** 英語記事を読んでいて `reliable` という単語に出会う → Claude Desktop で「reliable を単語帳に登録して」と発話 → Claude が品詞・和訳・例文を生成し `register_word` を実行 → 返却された個別ページ URL で登録内容を確認する。

**単語帳の共有：** ユーザー間で単語帳は完全非共有。共有機能は本フェーズおよび次フェーズでも扱わない。

## 機能要件

### コア機能（MVP）

#### アーキテクチャ方針

- **辞書情報の生成主体**：Claude Desktop（MCP 呼び出し側の LLM）。Claude との会話の中で和訳・品詞・例文を生成し、生成した辞書情報を MCP ツールに渡して保存する。MCP サーバーはデータを受け取って永続化するだけで、サーバー側からは Claude API を呼ばない。
- **MCP トランスポート**：リモート HTTP（stdio ではない）。Next.js の API ルート（`/api/mcp`）として実装し、SST NextjsSite（OpenNext + CloudFront + Lambda）上にホストする。Web 閲覧画面と同一の Next.js アプリに統合する。
- **ユーザー認証**：OAuth 2.0 PKCE（Cognito 連携）。Claude Desktop が初回起動時に Cognito Hosted UI へリダイレクト → アクセストークン（JWT）を取得 → 以降のリクエストは Bearer トークン付きで送信。MCP サーバーは Cognito 発行のアクセストークンを検証し、`sub` クレームをユーザー ID として使用する（検証詳細は[機能設計書（002）](./002_functional-design.md)を参照）。トークン失効時は Claude Desktop 側で Cognito Hosted UI 再認証を促す。

#### 単語の正規化ルール

登録・検索・重複判定はすべて正規化後のキーを基準とする（正規化ルールの詳細は[機能設計書（002）](./002_functional-design.md)を参照）。

#### MCP ツール

Claude アプリから以下の操作を自然言語で実行できる。

| ツール名 | 操作 | 正常系の戻り値 | 異常系の戻り値 |
| --- | --- | --- | --- |
| `register_word` | 英単語・品詞エントリ配列（品詞・和訳・例文）を受け取り保存 | 単語の個別ページ URL | バリデーションエラーの内容 |
| `delete_word` | 単語を削除 | 削除完了メッセージ | 単語が存在しない旨のメッセージ |
| `update_word` | 単語の辞書情報を全フィールド全置換で上書き保存 | 単語の個別ページ URL | 単語が存在しない旨のメッセージ |
| `search_words` | 英単語名で前方一致検索（大文字小文字を区別しない） | 一致した単語の一覧（最大 20 件、アルファベット順） | 0 件の旨のメッセージ |

**`register_word` と `update_word` の使い分け：**
- `register_word`：新規登録専用。同一単語が既存の場合は上書きせず既存の個別ページ URL を返す。
- `update_word`：既存単語の全フィールドを全置換。Claude が全品詞エントリを再生成して渡す。単語が存在しない場合はエラー。

**入力単位：** 1 回のツール呼び出しで 1 単語。複数単語の一括登録は非対応。

**ツール実行失敗時：** DynamoDB 書き込み失敗・Lambda タイムアウト等の場合、Claude に対し原因の分かる自然言語エラーメッセージを返す。

**`search_words` の件数超過：** 21 件以上の場合は先頭 20 件と「X 件中 20 件を表示」のメッセージを返す。

#### 単語データ構造

| フィールド | 内容 |
| --- | --- |
| 英単語（キー） | 正規化後の文字列。例：`reliable`（キー設計の詳細は[機能設計書（002）](./002_functional-design.md)を参照） |
| 品詞エントリ | 品詞・和訳・例文のセットを配列で保持（複数品詞対応） |
| 登録日時 | ISO 8601 |
| 更新日時 | ISO 8601 |

**同綴異義語の扱い：** 1 単語 = 1 エントリ。`book` のように複数品詞がある場合、Claude が名詞・動詞などすべての品詞エントリを一括生成して配列として渡す。後から品詞エントリを追加する操作は非対応（更新が必要なら `update_word` で全再生成）。

**品詞エントリの構造例：**

```json
{
  "word": "book",
  "entries": [
    {
      "partOfSpeech": "noun",
      "translation": "本、書籍",
      "examples": [
        { "en": "I read a book every night.", "ja": "私は毎晩本を読む。" },
        { "en": "She returned the book to the library.", "ja": "彼女は図書館に本を返した。" },
        { "en": "This book changed my life.", "ja": "この本は私の人生を変えた。" }
      ]
    },
    {
      "partOfSpeech": "verb",
      "translation": "予約する",
      "examples": [
        { "en": "I booked a hotel for the trip.", "ja": "旅行のためにホテルを予約した。" },
        { "en": "Please book a table for two.", "ja": "2名分のテーブルを予約してください。" },
        { "en": "She booked the flight in advance.", "ja": "彼女は事前にフライトを予約した。" }
      ]
    }
  ]
}
```

#### バリデーション規則

| フィールド | 規則 |
| --- | --- |
| 英単語 | 必須。1〜64 文字。使用可能文字：半角英小文字・スペース・ハイフン・アポストロフィ（熟語・句動詞を許容） |
| 品詞エントリ配列 | 必須。1 件以上 |
| 品詞（partOfSpeech） | 必須。noun / verb / adjective / adverb / preposition / conjunction / pronoun / interjection のいずれか |
| 和訳（translation） | 必須。1〜200 文字 |
| 例文（examples） | 1〜3 件（Claude が生成できた件数を許容）。英文・和訳ともに必須 |

#### Web 画面

| 画面 | 機能 |
| --- | --- |
| 一覧ページ（`/wordbook`） | 英単語・品詞・和訳を一覧表示（登録日時降順・全件表示・ページングなし）。英単語の前方一致検索対応 |
| モーダル | 一覧で単語をクリックするとモーダルで詳細（全品詞エントリ＋例文）を表示。一覧上のクイックプレビュー用途 |
| 個別ページ（`/wordbook/[word]`） | MCP が返す URL の遷移先。モーダルと同一の詳細情報を独立ページとして表示（ディープリンク・ブックマーク用途） |

**検索の並び順：** Web 一覧は登録日時降順、`search_words` はアルファベット順。用途の違いによる意図的な差。Web は「最近登録した単語を上に」、MCP 検索は「スペルで探しやすく」という目的に対応する。

**個別ページの URL キー：** 正規化済み英単語を URL エンコードした値（URL エンコードの詳細例は[機能設計書（002）](./002_functional-design.md)を参照）。

#### 認証

- **Web：** Next.js が Cognito Hosted UI 経由でログイン。トークンは HTTP-only Cookie のセッションとして保持。セッション失効時はログインページへリダイレクト。
- **MCP：** OAuth 2.0 PKCE（Cognito 連携）。Claude Desktop がトークン取得・管理を担う。MCP サーバーが 401 を返した場合、Claude Desktop は Cognito Hosted UI 再認証フローを起動する。
- ユーザーは管理者が AWS Cognito コンソールから手動作成・配布（自由登録不可）
- 初回ログイン時のパスワード変更を強制
- ユーザーごとに独立した単語帳（他ユーザーの単語は参照・操作不可）

### 本フェーズで扱わないこと

- 単語・例文の音声読み上げ（次フェーズ以降で OpenAI API を活用予定）
- Web 画面からの単語追加・編集・削除
- ユーザーの自己登録・招待フロー

## 非機能要件

### パフォーマンス

- MCP ツール経由の書き込み：MCP サーバーがリクエストを受信してから DynamoDB 書き込み完了まで 3 秒以内（ウォーム状態。Lambda コールドスタート時の遅延は許容、Provisioned Concurrency は使用しない）
- Web 一覧ページの初期表示：3 秒以内（ウォーム状態）

### 信頼性

- 単語登録は冪等に設計する（重複時は既存データを保持して URL を返す）
- DynamoDB の PITR（Point-In-Time Recovery）は無効。個人プロジェクトのためデータ消失は許容する

### セキュリティ

- Cognito 認証済みユーザーのみ単語帳へアクセス可能
- MCP ツールは JWT の `sub` に基づき操作対象の単語帳を限定（他ユーザーのデータへのアクセス不可）
- MCP ツールは Cognito 発行のアクセストークンを検証することで認可する（検証項目の詳細は[機能設計書（002）](./002_functional-design.md)を参照）
- AWS IAM 最小権限原則に従ったロール設計
- Claude API はサーバー側から呼ばないため、API キーをサーバーに持つ必要はない

### コスト

- 月数百円以内を目安とする
- DynamoDB・Lambda は無料枠内での運用を想定

### 監視

- Lambda のログを CloudWatch Logs に出力。CloudFront はエラー率・レイテンシを標準メトリクスで確認（詳細は[技術仕様書（003）](./003_architecture.md)を参照）
- エラー率・実行時間を最低限確認できること

### 対応環境

- Web：モダンブラウザ（Chrome / Safari / Firefox 最新版）
- MCP：Claude Desktop App（Mac）

## 技術スタック

| 領域 | 技術 |
| --- | --- |
| 言語 | TypeScript |
| インフラ | AWS / SST |
| フロントエンド / MCP サーバー | Next.js（Web 閲覧画面 + MCP API ルートを統合） |
| 認証（MCP） | Amazon Cognito（Hosted UI + OAuth 2.0 PKCE） |
| 認証（Web） | Cognito（OAuth 2.0 認可コードフロー）＋ Next.js 自前実装（取得した JWT を HTTP-only Cookie で保持。検証方式の詳細は[技術仕様書（003）](./003_architecture.md)を参照） |
| データベース | Amazon DynamoDB |
| ホスティング | SST NextjsSite（OpenNext + CloudFront + Lambda） |
| LLM（将来の音声） | OpenAI API（次フェーズ） |
