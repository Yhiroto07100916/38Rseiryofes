# 工具貸出管理

この機能は `tool-rental` リポジトリの在庫・貸出管理フローを、38Rseiryofes の認証・権限・Cloudflare D1 に統合したものです。

## 機能

- 工具・機材マスターの登録、編集、並び替え、利用停止
- 個体ごとの管理番号・在庫状態管理
- 貸出、個体単位の部分返却、返却担当者の記録
- 予約待ち一覧、順番管理、予約からの貸出
- 現在貸出中の一覧、返却期限、貸出延長
- 貸出履歴、個別履歴の修正・削除、返却済み履歴の一括削除
- 通常クラス・チーフ別の全体返却時刻
- 貸出期限前・期限到来時・全体返却時刻前後の通知
- Discord / LINE 通知、LINE webhook による送信先候補の収集

## 38R 側での統合方針

- ログイン・セッションは38Rサイト共通の認証を使用します。
- tool-rental 独自のログイン画面・管理者アカウント管理は重複するため移植しません。
- 操作権限は `tool_rental.view`、`tool_rental.checkout`、`tool_rental.return`、`tool_rental.history`、`tool_rental.manage` で制御します。
- 通知設定の閲覧・変更は `tool_rental.manage` が必要です。

## D1 マイグレーション

- `0042_tool_rental_full_inventory.sql`: 個体管理・貸出・返却・予約・履歴のスキーマと旧データ移行
- `0043_tool_rental_notifications.sql`: 通知設定・LINE送信先・通知履歴のスキーマ

本番・Preview の D1 へ適用する前に、対象データベースとバックアップを確認してください。

## 通知設定の暗号化キー

Discord Webhook URL と LINE の認証情報は AES-GCM で暗号化して D1 に保存します。Worker Secret `TOOL_RENTAL_ENCRYPTION_KEY` が必要です。32文字以上のランダムな値を使用してください。既存の認証情報を流用せず、専用の値を設定してください。

設定コマンド（デプロイ時に実行）:

```sh
cd worker
openssl rand -hex 32 | npx wrangler secret put TOOL_RENTAL_ENCRYPTION_KEY
```

このコマンドは Worker Secret を変更するため、コード確認・デプロイのタイミングで実行してください。今回の作業では実行していません。

## 通知先

- Discord: 管理画面に Webhook URL を入力します。
- LINE: Channel Access Token / Channel Secret を入力し、Bot が参加するトークからメッセージを受信すると候補に登録されます。
- LINE webhook URL: `https://api.38r-seiryofes.com/api/tool-rental/line/webhook`

Worker の Cron は毎分実行し、貸出期限・全体返却時刻の通知対象を確認します。

## 画面

- `/tool-rental`: 管理トップ
- `/tool-rental/tools`: 在庫・個体管理
- `/tool-rental/loans`: 貸出
- `/tool-rental/loans/return`: 返却
- `/tool-rental/loans/current`: 現在貸出中
- `/tool-rental/loans/history`: 貸出履歴
- `/tool-rental/reservations`: 予約
- `/tool-rental/settings`: 通知・全体設定
