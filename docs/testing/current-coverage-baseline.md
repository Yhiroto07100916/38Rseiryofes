# Current automated-test baseline

- Source: `main` at `f3d0a03dd08d055b7348b564a561932b058ec235`
- Reviewed from GitHub source files on 2026-10-23.
- **Execution status: NOT RUN in this review session.** This document records test cases present in source, not a pass/fail result.

## Existing Vitest tests found

| File | Count | Current coverage |
|---|---:|---|
| `worker/test/index.spec.ts` | 2 | Unauthenticated task-create request returns 401; unknown route returns 404 |
| `worker/test/tasks.spec.ts` | 3 | Task creation writes linked records; invalid linked file does not create task; PATCH without assignment fields preserves assignments |
| `worker/test/decisions.spec.ts` | 3 | Decisions require authentication; create/update/delete history is preserved; history is forbidden without `decisions.view` |
| **Total** | **8** | Focused regression tests for three areas; not broad API coverage |

Vitest configuration is `worker/vitest.config.mts`, using `@cloudflare/vitest-plugin` and the local Worker test runtime. The package script is:

```sh
npm test
# runs: vitest run --pool=forks --maxWorkers=1
```

## Important gaps

The current suite does not establish coverage for all API endpoints. In particular, no dedicated tests were found in the listed test files for:
- login/logout/password change/session expiry and malformed cookies;
- user, role, account-role, and permission administration;
- calendar events/categories/attendance, news, scripts/scenes/blocks, equipment;
- accounting receipts/budgets/reimbursements/exports/OCR;
- file upload/download/share/public-token/archive/restore;
- survey creation/submission/results/anonymity;
- decisions' full authorization matrix and malformed input cases;
- object-level authorization/IDOR across two different users;
- systematic method/path/body validation, CSRF/CORS, response security headers, or rate limiting.

Absence from these test files does not prove a behavior is untested elsewhere, but no other `worker/test/*.spec.ts` files were present in the repository tree inspected for this baseline.

## Safe local execution procedure

Run in the developer's local checkout, from the Worker directory:

```sh
cd /Users/yoshimihiroto/38Rseiryofes/worker
npm test
```

This uses the repository's Vitest/Cloudflare test runtime and should not be replaced with `wrangler dev --remote` for the initial pass. Confirm the output shows only local test execution and inspect any failures before proceeding.

For test isolation, `worker/wrangler.jsonc` configures a preview D1 database but does not show a separate preview R2 bucket: `FILES_BUCKET` names `38r-seiryofes-files`. Keep all remote file mutation tests blocked until the preview deployment is confirmed to use a dedicated test R2 bucket. Do not run destructive tests against the production Worker or production storage.

## Reporting rule

Mark cases as `PASS` only after running them and checking both HTTP results and expected database/storage side effects. Use `NOT RUN` for tests not executed, and `BLOCKED` when environment or credentials prevent safe execution.
