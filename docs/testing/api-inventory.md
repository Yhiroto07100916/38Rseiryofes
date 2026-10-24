# API inventory — 38R Seiryofes

- Reviewed source ref: `main`
- Reviewed commit: `f3d0a03dd08d055b7348b564a561932b058ec235`
- Entry point: `worker/src/index.ts`
- Route handlers: `worker/src/routes/*.ts`
- Status: source-derived inventory; not yet an executed runtime/API test report.
- Important: this is a manually derived route-family inventory, not a formal OpenAPI specification. Nested routes and method guards must be reconciled with tests before claiming exhaustive coverage.

## Global routes

| Method | Path | Purpose / expected test |
|---|---|---|
| GET | `/health` | Worker liveness; verify stable JSON and no sensitive details |
| GET | `/health/db` | D1 connectivity probe; verify response and error handling |
| OPTIONS | routed API paths | CORS preflight; test allowed and disallowed origins and requested headers |
| any unmatched | other paths | 404 response; verify no stack trace or internal data |

The entry point explicitly allows CORS origins for local development and the listed Seiryofes Pages/site origins. The allow-headers list currently contains `Content-Type`; test the actual frontend request patterns, cookies, and preflight behavior in the test environment.

## API route families

All paths below are relative to the Worker origin. `:id` means a path parameter. The verbs listed are routes visible in the current handler source; unsupported verbs should normally return a controlled 404/405, not an unhandled 500.

| Base path / pattern | Methods seen | Handler / areas to cover |
|---|---|---|
| `/api/auth/login` | POST | Login; valid/invalid credentials, throttling, session cookie flags |
| `/api/auth/logout` | POST | Logout; revoke session, idempotency |
| `/api/auth/me` | GET | Current session; unauthenticated and expired session |
| `/api/auth/password` | PATCH | Change own password; current-password check, session invalidation policy |
| `/api/auth/profile` | PATCH | Update own profile; field allowlist and validation |
| `/api/users` | GET, POST | List/create users; admin permissions, initial password policy |
| `/api/users/:id` | GET, PATCH, DELETE | User read/update/delete; role enforcement, self/admin boundaries |
| `/api/users/:id/password` | PATCH | Admin password reset; admin-only, auditability |
| `/api/users/:id/account-roles` | GET, POST | Read/assign account roles for a user |
| `/api/users/:id/account-roles/:accountRoleId` | DELETE | Remove user account role |
| `/api/users/:id/roles` | GET | Read user's task/functional roles; admin-only dispatch guard |
| `/api/users/:id/roles/:roleId` | DELETE | Remove user's role; admin-only dispatch guard |
| `/api/roles` | GET, POST | List/create roles |
| `/api/roles/:id` | GET, PATCH, DELETE | Read/update/delete role |
| `/api/roles/:userId` | GET, POST | User-role assignment route in roles handler; verify route overlap/dispatch semantics |
| `/api/roles/:userId/:roleId` | DELETE | Remove a user-role assignment |
| `/api/account-roles` | GET, POST | List/create account roles |
| `/api/account-roles/:id` | GET, PATCH, DELETE | Read/update/delete account role |
| `/api/permissions` | GET | List permissions |
| `/api/permissions/users` | GET | Permission/user data route |
| `/api/permissions/:targetType/:targetId` | GET | Read permissions for account-role/role/user target |
| `/api/permissions/:targetType/:targetId/:permissionId` | PUT, DELETE | Grant/revoke permission |
| `/api/tasks` | GET, POST | Task list/create |
| `/api/tasks/assignment-users` | GET | Assignable users; tasks.assign |
| `/api/tasks/assignment-roles` | GET | Assignable roles; tasks.assign |
| `/api/tasks/:taskId` | GET, PATCH, DELETE | Task detail/update/delete |
| `/api/tasks/:taskId/comments` | GET, POST | List/add task comments |
| `/api/tasks/:taskId/comments/:commentId` | PATCH, DELETE | Edit/delete comment; ownership and permission tests |
| `/api/calendar/events` | GET, POST | List/create events |
| `/api/calendar/events/:eventId` | GET, PATCH, DELETE | Read/update/delete event |
| `/api/calendar/events/:eventId/attendance` | GET, PUT | Attendance list/update |
| `/api/calendar/events/:eventId/attendance/:userId` | PUT | Update one user's attendance |
| `/api/calendar/events/:eventId/attendance/nonrespondents` | GET | List nonrespondents; privacy and permission tests |
| `/api/calendar/categories` | GET, POST | List/create calendar categories |
| `/api/calendar/categories/:categoryId` | GET, PATCH, DELETE | Read/update/delete category |
| `/api/news` | GET, POST | List/create news |
| `/api/news/:newsId` | GET, PATCH, DELETE | Read/update/delete news |
| `/api/scripts` | GET, POST | List/create scripts |
| `/api/scripts/:scriptId` | GET, PATCH, DELETE | Read/update/delete script |
| `/api/scripts/:scriptId/characters` | GET, POST | List/create characters |
| `/api/scripts/:scriptId/characters/:characterId` | GET, PATCH, DELETE | Read/update/delete character |
| `/api/scripts/:scriptId/casts` | GET, POST | List/create cast records |
| `/api/scripts/:scriptId/casts/:castId` | PATCH, DELETE | Update/delete cast record |
| `/api/scripts/:scriptId/cast-members` | GET | Read cast members |
| `/api/scripts/:scriptId/acts` | GET, POST | List/create acts |
| `/api/scripts/:scriptId/acts/:actId` | PATCH, DELETE | Update/delete act |
| `/api/scripts/:scriptId/acts/:actId/scenes` | GET, POST | List/create scenes |
| `/api/scripts/:scriptId/acts/:actId/scenes/:sceneId` | GET, PATCH, DELETE | Read/update/delete scene |
| `/api/scripts/:scriptId/acts/:actId/scenes/:sceneId/characters` | GET, POST | Read/add scene character associations |
| `/api/scripts/:scriptId/acts/:actId/scenes/:sceneId/characters/:characterId` | DELETE | Remove scene character association |
| `/api/scripts/:scriptId/acts/:actId/scenes/:sceneId/blocks` | GET, POST | List/create script blocks |
| `/api/scripts/:scriptId/acts/:actId/scenes/:sceneId/blocks/:blockId` | GET, PATCH, DELETE | Read/update/delete script block |
| `/api/equipment` | GET, POST | Equipment list/create |
| `/api/equipment/:equipmentId` | PATCH, DELETE | Update/delete equipment; confirm exact supported methods in handler |
| `/api/accounting` | GET | Accounting summary |
| `/api/accounting/users` | GET | User choices for accounting |
| `/api/accounting/summary` | GET | Summary |
| `/api/accounting/receipts` | GET, POST | List/create purchase receipts |
| `/api/accounting/receipts/:receiptId` | GET, PATCH, DELETE | Read/update/delete receipt |
| `/api/accounting/receipts/:receiptId/files` | POST, DELETE | Attach/detach receipt files (DELETE includes file ID) |
| `/api/accounting/budgets` | GET, POST | List/create budgets |
| `/api/accounting/budgets/:budgetId` | PATCH, DELETE | Update/delete budget |
| `/api/accounting/budgets/:budgetId/sources` | PATCH | Update budget sources |
| `/api/accounting/budgets/:budgetId/items` | GET, POST | List/create budget items |
| `/api/accounting/budget-items/:itemId` | PATCH, DELETE | Update/delete budget item |
| `/api/accounting/reimbursements` | GET | List reimbursements |
| `/api/accounting/reimbursements/:reimbursementId` | PATCH | Approve/update reimbursement status |
| `/api/accounting/receipts/ocr` | POST | OCR receipt; size/type limits, AI errors, no raw sensitive logs |
| `/api/files` | GET, POST | List/upload files |
| `/api/files/:objectKey...` | GET, DELETE | File download/delete; path traversal, category authorization, response headers |
| `/api/files/categories` | GET, POST | List/create file categories |
| `/api/files/categories/:slug` | PATCH, DELETE | Update/deactivate category |
| `/api/files/:fileId/shares` | GET, POST | List/create share links |
| `/api/files/:fileId/shares/:shareId` | DELETE | Revoke share link |
| `/api/files/:fileId/archive` | POST | Archive file |
| `/api/files/:fileId/restore` | POST | Restore file |
| `/api/public/files/:token` | GET | Token-based public file access; token secrecy, revocation, expiry behavior |
| `/api/surveys` | GET, POST | List/create surveys |
| `/api/surveys/:surveyId` | GET, PATCH, PUT, DELETE | Read/update/delete survey |
| `/api/surveys/:surveyId/responses` | POST, PATCH | Submit/update response; eligibility, duplicate submission, anonymity |
| `/api/surveys/:surveyId/results` | GET | Results access control and anonymous data |
| `/api/decisions` | GET, POST | List/create decisions |
| `/api/decisions/:decisionId` | GET, PATCH, PUT, DELETE | Read/update/delete decision |
| `/api/decisions/:decisionId/history` | GET | Decision history access control |

### Route-inventory caveats

1. The source router has special-case dispatch before general handlers for user passwords and user roles. Tests must validate actual dispatch order, not only handler-local logic.
2. `/api/files/:objectKey...` is a catch-all path; URL decoding, encoded slashes, and object-key canonicalization need explicit tests.
3. The `roles` and `account-roles` handlers expose user assignment subroutes as well as role resources. The patterns above are provisional where a single segment could mean either a resource ID or a user ID; use handler branch conditions to make the final OpenAPI paths unambiguous.
4. Accounting contains additional path branches beyond the common routes above (receipt item-level operations, reimbursements, budget allocations, and related records). Expand those into individual cases during the test implementation; do not treat this table as proof that every branch has been covered.
5. Verify actual response status codes and auth requirements by execution. This inventory does not infer that an endpoint is secure merely because the frontend hides a page or button.
