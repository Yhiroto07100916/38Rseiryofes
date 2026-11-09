# Web Push 通知の環境設定

この機能を動かすには、VAPID鍵を一度生成し、Workerの環境変数として設定する必要があります。秘密鍵はGitにコミットしないでください。

## 1. VAPID鍵を生成する

リポジトリのルートから実行します。

```powershell
cd worker
npx @pushforge/builder vapid
```

表示された公開鍵と秘密鍵（JWK形式）を控えます。鍵は本番・Preview・ローカルで同じペアを使うか、環境ごとに別のペアを用意してください。公開鍵と秘密鍵は必ず同じペアにします。

## 2. ローカル開発環境

`worker/.dev.vars.example`をコピーして`worker/.dev.vars`を作成し、生成した値を設定します。

```text
VAPID_PUBLIC_KEY=生成した公開鍵
VAPID_PRIVATE_KEY='生成した秘密鍵JWKを1行のJSONで記載'
VAPID_SUBJECT=https://38r-seiryofes.com
```

`worker/.dev.vars`はGit管理対象外です。公開鍵・秘密鍵のどちらもコミットしないでください。

ローカルDBにマイグレーションを適用します。

```powershell
npm --prefix worker run db:migrate:local
```

Workerを起動してから、Nuxtアプリを起動します。ローカルのCron Triggerは自動実行ではなく、次のURLで手動実行できます。

```text
http://localhost:8787/cdn-cgi/local/scheduled?format=json
```

## 3. Cloudflare本番環境

Workerディレクトリで、各値をCloudflare Worker Secretとして登録します。

```powershell
npx wrangler secret put VAPID_PUBLIC_KEY --config wrangler.jsonc
npx wrangler secret put VAPID_PRIVATE_KEY --config wrangler.jsonc
npx wrangler secret put VAPID_SUBJECT --config wrangler.jsonc
```

秘密鍵はコマンドの入力プロンプトに貼り付けます。秘密鍵をソースコード、設定ファイル、GitHubのIssueやPull Requestに貼り付けないでください。

本番D1へのマイグレーション適用とWorkerのデプロイは、コードレビューと実機テストの後に別途実施してください。

## 4. 動作確認

1. HTTPSの本番または対応するテスト環境でサイトを開く。
2. iPhoneではサイトをホーム画面に追加し、そのアイコンから起動する。
3. マイページの「お知らせのプッシュ通知」から「通知を有効にする」を押す。
4. OS・ブラウザの許可画面で通知を許可する。
5. D1にSubscriptionが登録されたことを確認する。
6. テスト用のお知らせを新規作成し、登録端末に通知が届くことを確認する。
7. 通知をタップし、該当のお知らせ詳細が開くことを確認する。
8. 「通知を無効にする」で登録が解除されることを確認する。

## 注意

- 通知の登録・解除APIはログインが必要ですが、登録後の配信はログイン状態に依存しません。
- OS側で通知を拒否した場合、サイトのボタンだけでは許可を戻せません。スマートフォン側の設定から変更してください。
- Cron Triggerは毎分実行の設定です。1分・5分・15分の再送は、Cronの実行タイミングにより指定時刻より遅れる場合があります。
- Push Serviceから成功応答が返っても、通知が画面に表示されたことまでは保証されません。
