# ハマりメモ

## Cognito User Pool Domain の "Domain already exists" / "UserPool does not exist" エラー

### 発生状況

`npx sst deploy --stage production` を繰り返す中で以下の2段階のエラーが発生した。

**1回目**
```
InvalidParameterException: Domain already exists.
```
前回の部分的なデプロイで Cognito の prefix domain `ai-wordbook` が AWS 上に作成されていたが、SST の state ファイルには記録されていなかった。SST が再度ドメイン作成を試みて衝突した。

**2回目（User Pool を AWS コンソールで手動削除した後）**
```
ResourceNotFoundException: UserPool with ID: ap-northeast-1_nXVEqku8q does not exist.
```
SST state に古い UserPool ID が残ったまま。削除済みのリソースに対してドメインを紐付けようとして失敗した。

### 原因

デプロイが途中失敗すると、AWS 上にリソースが中途半端に作成されることがある。SST の state ファイルはその状態を正確に反映しないため、state と AWS の実態がズレる。AWS コンソールでリソースを手動削除しても state は更新されないので、ズレがさらに広がる。

### 解決手順

1. AWS コンソールで中途半端なリソース（User Pool など）を手動削除する
2. `npx sst refresh --stage production` を実行して state と AWS の実態を同期する（存在しないリソースが state から除去される）
3. `npx sst deploy --stage production` を再実行する

### 教訓

- デプロイが失敗したとき、AWS コンソールで手動削除する前に `npx sst refresh` を試す
- 手動削除した後は必ず `npx sst refresh` で state を同期してから再デプロイする
- SST の state は S3 に保存されており、AWS コンソール操作では自動更新されない
