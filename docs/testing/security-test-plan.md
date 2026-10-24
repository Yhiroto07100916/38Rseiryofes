# API and security test plan — 38R Seiryofes

## 1. Scope and baseline

- Repository: `Yhiroto07100916/38Rseiryofes`
- Baseline: `main` at `f3d0a03dd08d055b7348b564a561932b058ec235`
- Backend: Cloudflare Worker, D1, R2, Workers AI
- Existing runner: Vitest, `worker/package.json` script `npm test` runs `vitest run --pool=forks --maxWorkers=1`
- Existing test files observed: `worker/test/index.spec.ts`, `worker/test/tasks.spec.ts`, `worker/test/decisions.spec.ts`
- Test target requested: dedicated test/staging environment, all API functional/authorization coverage, and safe penetration testing.
- Current execution status: **planning and source inventory only. No requests were sent to the deployed test service, no production systems were tested, and no tests have yet been reported as passed/failed.**

## 2. Safety gate — required before any remote test execution

The current `worker/wrangler.jsonc` defines a preview D1 database binding, but the R2 binding names the normal `38r-seiryofes-files` bucket and no preview R2 override is visible in this file. Before running upload/delete/archive/receipt-attachment/OCR tests, verify the deployed preview binding configuration and create a dedicated test R2 bucket. Do not assume preview is isolated from production merely because a preview D1 is configured.

Required setup:
- [ ] Dedicated Worker/Preview URL, confirmed by owner.
- [ ] Dedicated D1 database with migrations applied through the current migration head.
- [ ] Dedicated R2 bucket; verify no production bucket is bound.
- [ ] Dedicated Workers AI binding or a stub/mock for OCR tests.
- [ ] Synthetic users for each role: unauthenticated, ordinary member, class representative, accounting viewer, accounting editor/creator/approver, file manager, admin.
- [ ] Synthetic fixtures only; no real student records, passwords, receipts, or production files.
- [ ] Snapshot/reset procedure for D1 and R2; every mutating test cleans up its fixtures.
- [ ] Confirm no production data, real email/notifications, or external services can be changed by tests.
- [ ] Set explicit low request-rate and concurrency ceilings for remote tests.
- [ ] Store credentials only in local environment variables/CI secrets; never commit cookies, tokens, passwords, or test data.

**Do not start destructive remote tests until the R2 isolation check is complete.** If test credentials or a confirmed test base URL are not available, continue with local Worker/Vitest tests and source-based inventory only.

## 3. Test layers

### A. Route and contract tests — every route/method branch

For each route in `api-inventory.md`, test:
- Expected method and response status.
- Correct JSON/content type and stable response schema.
- Missing/invalid JSON, wrong content type, empty body, missing fields, wrong field types, boundary values, oversized values.
- Unknown ID, malformed ID, unsupported method, trailing slash, encoded path segments.
- No stack traces, secrets, SQL details, or raw internal exceptions in responses.
- Pagination/search limits, sort parameters, and empty datasets where applicable.

### B. Authentication matrix

For every protected endpoint:
1. No cookie/session.
2. Malformed cookie.
3. Expired/revoked session.
4. Valid ordinary-user session.
5. Valid role/permission-appropriate session.
6. Valid admin session.

Expected result must be defined per endpoint; do not blindly assert all unauthorized cases return the same status if the API contract explicitly uses 401/403/404 to avoid information disclosure. Confirm cookies use appropriate HttpOnly, Secure, SameSite, path, and expiry attributes.

### C. Authorization / object-level access matrix

Use at least two synthetic users (A and B) and fixtures owned by each:
- Read, update, delete, share, archive, restore, comment, assign, and export resources across user/role boundaries.
- Attempt ID substitution on tasks, comments, scripts, scenes, files, receipts, budgets, surveys, decisions, and attendance.
- Verify class-representative-scoped tasks cannot be read or modified by ordinary members through direct API calls.
- Verify accounting permissions are enforced by the API, not only by frontend navigation.
- Verify file category, receipt attachment, share-link creation/revocation, and public-file-token rules.
- Verify role/permission changes require administrator privileges and cannot elevate the caller.
- Verify survey eligibility, duplicate submissions, results visibility, and anonymity properties.
- Verify nonrespondent/attendance endpoints do not disclose more student information than intended.

### D. Input and injection tests

Use harmless test strings and non-executable payloads first; never use destructive payloads on remote environments:
- HTML escaping in names, descriptions, comments, script blocks, news, survey labels, file names, and accounting exports.
- SQL injection probes as strings against search/filter inputs; confirm parameterized behavior and stable errors.
- CSV formula-injection cases in a local/test export and verify exported values are neutralized.
- Path traversal / encoded slash / double-encoding cases against file object-key routes.
- MIME spoofing, filename extension mismatch, zero-byte and oversized uploads.
- Malformed JSON, invalid Unicode, malformed percent-encoding, and large-but-bounded payloads.
- CSRF checks for cookie-authenticated state-changing methods; verify origin/SameSite defenses and CORS behavior.
- Security headers on HTML/file responses, especially uploaded HTML/SVG and inline file delivery.

### E. Business invariants and transaction tests

- Failed budget-source changes must not partially update values.
- Budget allocation totals cannot exceed the budget.
- Receipt totals equal the validated sum of line items; invalid payment method/amount is rejected.
- Receipt-file attachment accepts only allowed receipt-category files and enforces ownership/permissions.
- Reimbursement status transitions are authorized and valid.
- Concurrent edits do not silently overwrite incompatible data; duplicate submissions are idempotent where required.
- Survey anonymous mode does not retain a reversible identity-to-answer mapping if the product promises true anonymity.
- Script act/scene/block parent-child IDs cannot be mixed across scripts.
- Deleting or archiving a resource does not leave unintended dangling records or accessible orphaned files.

### F. Reliability and low-load performance

After functional and authorization tests are stable:
- Start with 1 virtual user and a low request rate.
- Increase only to a pre-agreed modest target (e.g. 5–10 virtual users) on the isolated test service.
- Measure p50/p95 latency, request rate, HTTP 4xx/5xx, timeouts, Worker CPU, and D1 query behavior.
- Do not perform high-volume stress/DoS tests against shared Cloudflare infrastructure without explicit platform authorization and a defined ceiling.
- Use a separate test for N+1 query behavior (e.g. task list with synthetic 1, 10, 50 tasks) before any broad concurrency run.

## 4. Initial priority order

| Priority | Area | Why |
|---|---|---|
| P0 | Verify test isolation: D1, R2, AI | Prevent test data from reaching production |
| P1 | Auth/session and admin/permission endpoints | Controls every protected data domain |
| P1 | Files and public share links | Sensitive files, untrusted MIME, object-key handling |
| P1 | Accounting and receipts | Financial integrity and partial updates |
| P1 | Task scope and object-level authorization | Cross-role disclosure/modification risk |
| P1 | Survey response/result/anonymity | Sensitive class opinions and respondent privacy |
| P2 | Scripts, calendar, news, decisions, equipment | Data integrity and authorization |
| P2 | Input validation, CORS/CSRF, error handling | Common cross-cutting risks |
| P2 | Load and query efficiency | Only after correctness and isolation are established |

## 5. Existing test suite and next commands

Run only against the local checkout with test bindings/mocks:
```sh
cd worker
npm ci
npm test
```

Before any local test that requires D1/R2/AI, inspect the Vitest configuration and test setup to confirm that it uses isolated test bindings. Do not use `wrangler dev --remote` or remote D1/R2 for initial tests.

After existing tests pass, add table-driven tests for every route family and authorization role. Keep destructive test fixtures unique and clean them up in `afterEach`/transactions or reset the isolated test database.

## 6. Evidence and reporting format

For each test case record:
- Test ID and endpoint/method.
- Required role and fixture IDs (synthetic only).
- Request shape (redact credentials).
- Expected status/body and expected DB/R2 side effects.
- Actual status/body, response time, and side effects.
- Result: PASS / FAIL / BLOCKED / NOT RUN.
- Reproducible steps, code line references, severity, and remediation.
- Test environment identifier and code commit SHA.

Do not call a test “passed” unless it was executed and the expected behavior and side effects were checked. Keep “not run” distinct from “blocked by environment”.
