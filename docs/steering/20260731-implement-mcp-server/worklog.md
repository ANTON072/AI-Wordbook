# 作業ログ

## 2026-07-31: Claude Desktop 接続デバッグと動作確認

`sst deploy` 成功後、Claude Desktop からの接続で 3 つの問題を順に解決し、`register_word`・`search_words` の動作確認まで完了した。

### 問題 1: claude_desktop_config.json でサーバーが読み込まれない

起動時に「有効な MCP サーバー設定ではないため、スキップされました: ai-wordbook」と表示された。

原因は設定形式。`claude_desktop_config.json` の `mcpServers` は stdio 型サーバー（`command` + `args`）専用で、`url` 直書きによるリモート HTTP サーバーの指定をサポートしていない。

対処: 設定ファイルからエントリを削除し、Claude の設定 → コネクタ → カスタムコネクタとして `https://ai-wordbook.com/api/mcp` を追加する方式に変更した。

### 問題 2: 自動クライアント登録（DCR）非対応エラー

カスタムコネクタ追加時に「ai-wordbook は自動クライアント登録をサポートしていません。コネクターを編集して、OAuth クライアント ID を追加してください」と表示された。

原因は Cognito が DCR（RFC 7591）に対応していないこと。Claude は接続時に認可サーバーの `registration_endpoint` で自動クライアント登録を試みるが、Cognito のメタデータにこのエンドポイントが存在しない。

対処は 2 点。

1. `sst.config.ts` の `McpClient` の `callbackUrls` を `http://127.0.0.1` から Claude のコールバック URL 2 つ（`https://claude.ai/api/mcp/auth_callback`・`https://claude.com/api/mcp/auth_callback`）に変更してデプロイした。
2. コネクタ編集画面の詳細設定に `McpClient` のクライアント ID（`5hnutba20srq23p11shcv7qc00`）を手動入力した。

クライアント ID は全ユーザー共通・公開可の値。ユーザーの識別はクライアント ID ではなく、ログイン後の JWT の `sub` で行う。各ユーザーの利用手順は「カスタムコネクタ追加 → 共通クライアント ID を入力 → 自分のアカウントでログイン」となる。手動入力をなくすには簡易 DCR（固定 ID を返す `registration_endpoint` の追加）が選択肢だが、現状の規模では見送り。

### 問題 3: 連携時に oauth_error=invalid_request

連携ボタンを押すと `oauth_error=invalid_request` で「接続できませんでした」になった。

curl での再現テストにより原因を特定した。Claude は `/.well-known/oauth-protected-resource` に `scopes_supported` が無い場合、Cognito メタデータの全スコープ（`openid email phone profile`）を認可リクエストで要求する。`McpClient` は `openid` しか許可していないため、Cognito が `invalid_scope`（リダイレクト上は `error=invalid_request`）で拒否していた。

対処: `src/features/mcp/discovery.ts` のメタデータに `scopes_supported: ["openid"]` を追加してデプロイした（テスト 1 件追加）。Claude はコネクタ作成時のメタデータをキャッシュするため、コネクタを削除・再作成して新メタデータを読ませたところ接続に成功した。

なお切り分けの過程で `allowedOauthScopes` を 4 スコープに広げる変更も用意したが、`scopes_supported` だけで解決したため取り消した。許可スコープは 003 の方針どおり `openid` のみを維持している。

### 動作確認の結果

- `register_word`: 「reliable を単語帳に登録して」で登録成功
- `search_words`: 「re で始まる単語を検索して」で `reliable` が 1 件返り成功
- 個別ページ URL（`https://ai-wordbook.com/wordbook/reliable`）はツールから返っているが、Web 閲覧画面は Block 5 未実装のため 404（想定どおり）

### 副次的な発見

CloudFront + Lambda 経由では `WWW-Authenticate` ヘッダーが `x-amzn-remapped-www-authenticate` に改名される。Claude は既定の well-known パスへのフォールバックで discovery できるため実害はないが、`WWW-Authenticate` を前提とするクライアントでは問題になりうる。

### ハマったポイントまとめ

次回以降に同種の作業をするときの注意点。詳しい経緯は上の各節を参照。

| 症状 | 原因 | 教訓 |
|---|---|---|
| 起動時に「有効な MCP サーバー設定ではない」でスキップ | `claude_desktop_config.json` の `mcpServers` は stdio 型専用。`url` 直書きは無効 | リモート HTTP サーバーはカスタムコネクタで追加する。設定ファイル経由にしたい場合は `mcp-remote` でブリッジする |
| 「自動クライアント登録をサポートしていません」 | Cognito は DCR（RFC 7591）非対応 | コネクタ詳細設定にクライアント ID を手動入力する。ID は全ユーザー共通・公開可 |
| 連携時に `oauth_error=invalid_request` | discovery に `scopes_supported` が無いと Claude は認可サーバーの全スコープを要求し、許可外スコープで `invalid_scope` になる | `/.well-known/oauth-protected-resource` に `scopes_supported` を必ず含める。エラー画面の `invalid_request` の実体が `invalid_scope` のことがあるので、curl で認可リクエストを再現して切り分ける |
| discovery を修正・デプロイしても同じエラーが続く | Claude はコネクタ作成時のメタデータをキャッシュする | サーバー側の discovery を変えたらコネクタを削除して作り直す |
| 設定変更が AWS に反映されない | デプロイ実行の行き違い（変更を入れる前のデプロイを「完了」と認識していた） | 反映確認は思い込みではなく実測で行う。Cognito なら `describe-user-pool-client` の `LastModifiedDate`、SST なら `.sst/log/sst.log` の最終更新時刻を見る |
| `WWW-Authenticate` ヘッダーが届かない | CloudFront + Lambda が `x-amzn-remapped-www-authenticate` に改名する | 今回は Claude の well-known フォールバックで実害なし。このヘッダーを前提とするクライアントを想定するなら対策が必要 |

### 検証に使ったコマンド集

上記の切り分け・実測で実際に使ったコマンド。値は 2026-07-31 時点のもの（User Pool: `ap-northeast-1_OWwujpeGH`、MCP クライアント ID: `5hnutba20srq23p11shcv7qc00`、AWS プロファイル: `ougi`）。

#### Cognito クライアントの実測（デプロイ反映確認）

`LastModifiedDate` がデプロイ時刻と一致しているかで、変更が本当に反映されたかを判定する。

```sh
aws cognito-idp describe-user-pool-client \
  --user-pool-id ap-northeast-1_OWwujpeGH \
  --client-id 5hnutba20srq23p11shcv7qc00 \
  --profile ougi --region ap-northeast-1 \
  --query "UserPoolClient.{CallbackURLs:CallbackURLs,AllowedOAuthScopes:AllowedOAuthScopes,LastModifiedDate:LastModifiedDate}"
```

ID が分からないときは一覧から辿る。

```sh
aws cognito-idp list-user-pools --max-results 10 --profile ougi --region ap-northeast-1
aws cognito-idp list-user-pool-clients --user-pool-id ap-northeast-1_OWwujpeGH --profile ougi --region ap-northeast-1
```

#### SST デプロイの実測

最後のデプロイがいつ終わったかをログの末尾とファイル更新時刻で確認する。「デプロイしたつもり」の行き違いはこれで検出できた。

```sh
tail -5 .sst/log/sst.log      # 末尾に unlocking / server done が出ていれば完了
ls -la .sst/log/sst.log       # ファイルの mtime = 最終デプロイ時刻の目安
```

#### discovery メタデータの確認

デプロイ後、本番が新しいメタデータ（`scopes_supported` など）を返しているかを見る。

```sh
curl -s https://ai-wordbook.com/.well-known/oauth-protected-resource
curl -s https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_OWwujpeGH/.well-known/openid-configuration
```

#### 認可リクエストの再現（invalid_scope の切り分け）

Claude が送る認可リクエストを scope 違いで再現し、Cognito がどれを拒否するかを比較する。`code_challenge` はダミーで問題ない（ログイン画面へ 302 するかエラーで戻されるかを見るだけなので）。

```sh
CC="E9Mw6vXK5jXvQ8pZ2sT1uY4wA7bC3dF6gH9jK2mN5pQ"
BASE="https://ai-wordbook.auth.ap-northeast-1.amazoncognito.com/oauth2/authorize"
COMMON="client_id=5hnutba20srq23p11shcv7qc00&response_type=code&redirect_uri=https%3A%2F%2Fclaude.ai%2Fapi%2Fmcp%2Fauth_callback&state=test123&code_challenge=$CC&code_challenge_method=S256"

# 正常系: ログイン画面へ 302
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" "$BASE?$COMMON&scope=openid"

# 再現された異常系: claude.ai へ error=invalid_request&error_description=invalid_scope で 302
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" "$BASE?$COMMON&scope=openid%20email%20phone%20profile"
```

判定: リダイレクト先が Cognito の `/login` なら受理、`redirect_uri` に `error=...` 付きで戻されたら拒否。拒否理由は `error_description` に出る。

#### MCP エンドポイントの 401 応答ヘッダー確認

`WWW-Authenticate` の改名（`x-amzn-remapped-www-authenticate`）はこれで発見した。

```sh
curl -s -D - -o /dev/null -X POST https://ai-wordbook.com/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

### 残作業

- `update_word`・`delete_word` の動作確認と、`register_word` の冪等性（再登録で上書きされない）の確認
- MVP 完了条件の最終確認（tasklist.md 参照）
- `docs/note/local-dev-setup.md` の設定例修正（無効な `url` 直書き形式 → `mcp-remote` 形式）
