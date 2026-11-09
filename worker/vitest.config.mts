import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

const migrations = await readD1Migrations("../migrations");

export default defineConfig({
        define: {
                __D1_MIGRATIONS__: JSON.stringify(JSON.stringify(migrations)),
        },
        plugins: [
                cloudflareTest({
                        // テストでは本番用の account_id / Preview D1 / AI binding を含まないローカル設定を使う。
                        // wrangler.jsonc を使うと Cloudflare の Preview session に接続し、認証エラーになる。
                        wrangler: { configPath: "./wrangler.local.jsonc" },
                }),
        ],
});
