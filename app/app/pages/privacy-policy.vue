<template>
  <v-container class="legal-page py-8" max-width="900">
    <v-btn to="/" variant="text" prepend-icon="mdi-arrow-left" class="mb-5">
      トップへ戻る
    </v-btn>

    <header class="mb-8">
      <div class="legal-eyebrow">PRIVACY</div>
      <h1 class="text-h4 text-sm-h3 font-weight-bold mt-2">プライバシーポリシー</h1>
      <p class="text-body-2 text-medium-emphasis mt-3">最終更新日：2026年11月11日</p>
    </header>

    <v-alert type="warning" variant="tonal" class="mb-8" icon="mdi-clipboard-alert-outline">
      <div class="font-weight-bold mb-1">公開前の確認が必要なドラフトです</div>
      運営主体・問い合わせ先・データの保存期間・削除手続など、運営者による確認と確定が必要な項目を含みます。確認が完了するまでは正式なポリシーとして扱わないでください。
    </v-alert>

    <article class="legal-content">
      <section>
        <h2>1. 基本方針・運営者</h2>
        <p>
          38R 星陵祭準備サイト（以下「本サイト」）は、星陵祭に向けたクラス活動の連絡、予定・タスク管理、資料共有その他の準備活動を支援するためのサイトです。
        </p>
        <p>
          本サイトの運営・個人情報の取扱いに関する責任者は、<strong>公開前に運営者が正式名称を記載してください。</strong>
        </p>
      </section>

      <section>
        <h2>2. 取得する情報</h2>
        <p>本サイトでは、機能の利用に応じて次の情報を取得・保存する場合があります。</p>
        <ul>
          <li><strong>アカウント情報：</strong>学籍番号、氏名、ニックネーム、アカウント権限、活動上の役割。</li>
          <li><strong>認証・セキュリティ情報：</strong>パスワードを検証するためのハッシュ値、ログインセッション、ログイン試行の記録。ログイン試行の制限には識別情報や接続元IPアドレスをハッシュ化した値を使用します。</li>
          <li><strong>利用者が登録する情報：</strong>タスク、予定、お知らせ、台本、会計情報、出欠、アンケート、提出物、ファイル、備品・工具の貸出記録、コメント等。</li>
          <li><strong>プッシュ通知情報：</strong>通知を配信するためのブラウザーのPush Subscription情報。通知の利用はブラウザー側で許可した場合に限られます。</li>
          <li><strong>運用・操作情報：</strong>設定変更履歴、操作履歴、エラー調査や不正利用防止に必要な記録。</li>
        </ul>
        <p>
          パスワードそのものを平文で保存することを目的としていません。機能の利用状況により、実際に取得する情報は異なります。
        </p>
      </section>

      <section>
        <h2>3. 情報の利用目的</h2>
        <ul>
          <li>本人確認、ログイン認証、アカウントおよび権限の管理</li>
          <li>星陵祭準備に関する情報の共有、予定・タスク・提出物等の管理</li>
          <li>利用者が許可したプッシュ通知の配信</li>
          <li>サイトの保守、障害対応、問い合わせへの対応</li>
          <li>不正利用の防止、セキュリティ確保および利用状況の確認</li>
          <li>本サイトの機能改善と運営に必要な連絡</li>
        </ul>
      </section>

      <section>
        <h2>4. 情報の保存・外部サービス</h2>
        <p>
          本サイトは、Cloudflare Workers、D1、R2等のCloudflareサービスを利用して、アプリケーションの実行、データベース管理およびファイル保存を行います。これらのサービスの提供に必要な範囲で情報が処理されます。
        </p>
        <p>
          保存場所、委託先の詳細、国外でのデータ処理の有無については、利用するサービスの契約・設定を運営者が確認したうえで必要な情報を追記します。
        </p>
      </section>

      <section>
        <h2>5. 第三者への提供・共有</h2>
        <p>
          本サイトでは、機能ごとの閲覧権限に応じて、登録された情報が他の利用者に表示される場合があります。情報を登録する際は、共有範囲や内容を確認してください。
        </p>
        <p>
          法令に基づく場合などを除き、運営者が個人情報を第三者へ提供する条件・手続については、運営主体が確定した正式版で明記します。外部サービスの利用に伴う取扱いについても、前項の内容を確認してください。
        </p>
      </section>

      <section>
        <h2>6. Cookie・セッション・プッシュ通知</h2>
        <p>
          本サイトはログイン状態を維持するためにセッションCookie等を使用します。ブラウザーの設定でCookieを制限すると、ログイン等の機能が利用できない場合があります。
        </p>
        <p>
          プッシュ通知はブラウザーまたは端末で許可した場合に配信されます。通知の停止や許可の変更は、ブラウザー・端末の通知設定から行えます。
        </p>
      </section>

      <section>
        <h2>7. 安全管理</h2>
        <p>
          本サイトでは、アカウント権限によるアクセス制御、認証情報の保護、通信の暗号化、操作履歴の記録等、情報を適切に管理するための対策を実施します。ただし、インターネット上の通信・保存に完全な安全性を保証するものではありません。
        </p>
      </section>

      <section>
        <h2>8. 保存期間・削除・開示等の請求</h2>
        <p>
          情報の保存期間、アカウント削除時のデータの取扱い、本人または保護者等からの開示・訂正・削除の申出方法は、運営主体および学校等の運用ルールを確認して正式に定めます。
        </p>
        <p class="draft-note">
          <strong>運営者確認事項：</strong>保存期間、卒業・活動終了後のアカウント処理、バックアップの削除時期、請求窓口を公開前に確定してください。
        </p>
      </section>

      <section>
        <h2>9. 未成年の利用</h2>
        <p>
          本サイトの利用者には未成年者が含まれる場合があります。利用にあたっては、学校、保護者および本サイト運営者からの案内に従い、必要以上の個人情報や他人の情報を登録しないでください。
        </p>
      </section>

      <section>
        <h2>10. ポリシーの変更</h2>
        <p>
          本ポリシーは、法令や本サイトの機能・運用の変更に応じて改定する場合があります。重要な変更を行う場合は、本サイト上で変更内容と適用時期を案内します。
        </p>
      </section>

      <section>
        <h2>11. お問い合わせ</h2>
        <p>
          個人情報の取扱いに関する問い合わせ先は、<strong>公開前に運営者が正式な窓口（担当者・連絡方法）を記載してください。</strong>
        </p>
      </section>
    </article>
  </v-container>
</template>

<script setup lang="ts">
useHead({
  title: "プライバシーポリシー",
  meta: [
    {
      name: "description",
      content: "38R 星陵祭準備サイトにおける個人情報の取扱いについて説明します。",
    },
  ],
})
</script>

<style scoped>
.legal-page {
  min-height: 70vh;
}

.legal-eyebrow {
  color: rgb(var(--v-theme-primary));
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.16em;
}

.legal-content {
  display: flex;
  flex-direction: column;
  gap: 30px;
  color: rgba(var(--v-theme-on-surface), 0.86);
  line-height: 1.9;
}

.legal-content h2 {
  margin-bottom: 10px;
  color: rgb(var(--v-theme-on-surface));
  font-size: 1.15rem;
  font-weight: 800;
}

.legal-content p {
  margin: 0 0 10px;
}

.legal-content ul {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-left: 1.4rem;
}

.draft-note {
  padding: 14px 16px;
  border-left: 3px solid rgb(var(--v-theme-warning));
  background: rgba(var(--v-theme-warning), 0.08);
  border-radius: 4px;
}
</style>
