# AGENTS.md

## 1. Project Overview

This repository contains the 38R Seiryofes preparation web application.

The application helps class 38R organize Seiryofes preparation, including task management, scheduling, member management, notifications, scripts, supplies, accounting, documents, attendance, voting, and activity records.

The primary goal is to provide a reliable, secure, and easy-to-use application that supports collaboration among approximately 40 students and the executive committee.

All code changes must preserve existing functionality unless a change is explicitly requested.

## 2. Repository Structure

The repository contains separate application and API components.

- `app/`: Nuxt frontend application.
- `worker/`: Cloudflare Workers API and related backend configuration.

Important configuration files include:

- `app/nuxt.config.ts`
- `worker/wrangler.jsonc`
- The `package.json` files in the relevant application directories.

Before reviewing a change, inspect the actual repository structure, relevant configuration files, and package scripts. Do not assume that commands or configuration files belong to the repository root.

Follow existing architectural conventions rather than introducing a new framework, library, or design pattern without a clear reason.

## 3. Technology Stack

### Frontend

- Nuxt
- Vue 3
- TypeScript
- Vuetify
- Nuxt server-side rendering and Nitro
- Progressive Web App functionality

### Backend and Infrastructure

- Cloudflare Workers
- Cloudflare D1
- Cloudflare R2 where applicable
- TypeScript

The application uses Cloudflare infrastructure. Review changes with the runtime constraints, deployment configuration, and resource bindings of Cloudflare Workers in mind.

Do not assume that Node.js-specific APIs, filesystem access, or other Node.js runtime features are available in Cloudflare Workers.

Verify compatibility against the actual dependencies and configuration in the repository.

## 4. Code Review Priorities

Review every change in the following order of importance.

### P0: Critical Security Issues

Look for:

- Authentication bypasses.
- Authorization failures and privilege escalation.
- Exposure of secrets, API keys, session tokens, or credentials.
- SQL injection and other injection vulnerabilities.
- Unauthorized access to another user's or class member's data.
- Insecure handling of uploaded files.
- Vulnerabilities that could expose sensitive information or compromise the application.

Report confirmed, actionable critical security issues immediately.

### P1: Bugs and Data Integrity

Look for:

- Incorrect business logic.
- Runtime exceptions and unhandled failure cases.
- Data loss or unintended data modification.
- Incorrect database queries or schema assumptions.
- Missing validation of user input.
- Race conditions and duplicate operations.
- Incorrect handling of asynchronous operations.
- Broken API request or response contracts.
- Failures affecting multiple users or shared class data.

Pay particular attention to operations that create, update, delete, or retrieve tasks, schedules, scripts, attendance records, and other shared resources.

### P1: Build and Deployment Reliability

Look for:

- TypeScript errors.
- Nuxt compilation errors.
- Invalid imports or unresolved modules.
- Incorrect environment variable usage.
- Missing or incorrectly configured Cloudflare bindings.
- Incompatible Worker runtime APIs.
- Incorrect Wrangler configuration.
- Changes that work locally but fail during production builds or deployment.

Check whether configuration changes are consistent with the actual deployment architecture.

Do not assume that a successful build proves that runtime behavior is correct.

### P2: Frontend and User Experience

Look for:

- Broken navigation or user workflows.
- Incorrect loading, error, and empty states.
- Missing form validation.
- Incorrect reactive state updates.
- Vue hydration mismatches.
- SSR/client-side behavior differences.
- Accessibility problems affecting essential functionality.
- Responsive layout regressions.
- Duplicate submissions or confusing feedback during asynchronous operations.

Preserve the existing visual design and interaction patterns unless a redesign is explicitly requested.

### P2: Maintainability and Performance

Look for:

- Unnecessary duplication.
- Excessive database queries.
- Inefficient data processing.
- Memory or resource usage problems.
- Unnecessary dependencies.
- Dead code introduced by the change.
- Overly complex logic that increases the likelihood of defects.

Do not report stylistic preferences as bugs unless they cause a concrete problem.

## 5. Authentication and Authorization

Authentication and authorization must be reviewed separately.

For every API endpoint that accesses protected resources, verify that:

- The caller is authenticated when required.
- The caller has permission to perform the requested operation.
- Resource ownership and class-level access restrictions are enforced on the server.
- User-supplied identifiers cannot be used to access unauthorized resources.
- Sensitive operations cannot be performed merely by hiding frontend controls.

Never rely exclusively on frontend validation or visibility restrictions to enforce permissions.

Preserve existing authentication middleware and session-handling conventions unless a change explicitly requires modifying them.

## 6. Database and API Changes

For Cloudflare D1 and other database operations:

- Verify that SQL statements match the actual schema.
- Check parameter binding and input validation.
- Check constraints, indexes, foreign keys, and migration behavior where applicable.
- Identify unintended changes to existing records.
- Check transaction boundaries and consistency requirements.
- Consider concurrent requests and duplicate submissions.
- Verify that error handling does not silently report failed operations as successful.

For API changes:

- Keep frontend and backend request/response contracts consistent.
- Validate data at the server boundary.
- Handle missing, malformed, and unauthorized requests.
- Avoid exposing internal errors, database details, or secrets in client-facing responses.
- Consider backward compatibility with existing callers.

Do not assume that a migration, binding, table, or endpoint exists without verifying the repository.

## 7. Cloudflare Workers, D1, and R2

For infrastructure-related changes:

- Verify that the correct Wrangler configuration is modified.
- Check binding names and types against the configuration and source code.
- Distinguish local, preview, and production environments.
- Check that required bindings and environment variables are configured consistently.
- Do not introduce hardcoded credentials or production-only assumptions.
- Verify R2 object access permissions and upload validation where applicable.
- Consider request limits, execution constraints, and failure handling.

Do not make deployment or production configuration changes merely to silence a build error without understanding the underlying cause.

Do not assume that a binding configured in one environment is automatically configured in another.

## 8. TypeScript, Vue, and Nuxt

Follow the existing TypeScript and Vue conventions.

Review for:

- Incorrect types or unsafe type assertions.
- Unnecessary use of `any`.
- Missing handling of nullable or optional values.
- Incorrect Vue reactivity.
- Lifecycle and asynchronous state-management issues.
- SSR hydration problems.
- Incorrect use of server-only and client-only APIs.
- Inconsistent component props and emitted events.
- Incorrect API error handling.

Avoid unnecessary refactoring of unrelated code.

Do not recommend replacing established project conventions solely because another approach is stylistically preferable.

## 9. Testing and Verification

When reviewing a change, determine which checks are relevant and inspect the available package scripts before recommending commands.

Where appropriate, verify:

- Type checking.
- Linting.
- Unit tests.
- API tests.
- Production builds.
- Database migration behavior.
- Authentication and authorization.
- Important user workflows.

Run or recommend only checks supported by the actual project configuration.

Do not claim that tests, builds, or deployments passed unless their results have been verified.

If a check cannot be performed, state the limitation clearly and identify the most useful next verification step.

A passing build does not eliminate the need to inspect the logic and security implications of a change.

## 10. Review Comment Guidelines

Report findings only when they identify a concrete, actionable problem.

For each finding:

1. Identify the specific file and affected lines.
2. Explain the conditions under which the problem occurs.
3. Describe the actual consequence.
4. Recommend a specific correction when possible.
5. Assign an appropriate severity.

Use these severity levels:

- **P0 — Critical:** Severe security vulnerabilities or catastrophic failures.
- **P1 — High:** Significant bugs, authorization problems, data integrity issues, or broken core functionality.
- **P2 — Medium:** Non-critical bugs, important edge cases, or meaningful performance and reliability problems.
- **P3 — Low:** Minor issues with a clear practical impact.

Do not inflate severity.

Do not report speculative issues as confirmed defects. Explain relevant assumptions when the evidence is incomplete.

Avoid duplicate findings and comments that merely restate the code.

Do not flag existing problems as newly introduced unless the change causes, worsens, or exposes them in a meaningful way.

## 11. Scope Control

Review the actual diff and its relevant surrounding code.

Prioritize problems introduced by the proposed changes.

Do not demand unrelated refactoring, formatting changes, or architectural redesigns.

Do not recommend new dependencies when the same requirement can be addressed safely using existing project capabilities.

Preserve backward compatibility unless breaking changes are explicitly intended.

If a change affects authentication, authorization, database schemas, shared data, or deployment configuration, increase the depth of the review accordingly.

## 12. Expected Review Output

Provide a concise summary of the change and its principal risks.

List findings in descending severity order.

For every finding, include:

- Severity.
- File and line reference.
- Explanation of the defect.
- Impact and triggering conditions.
- Recommended fix.

If no actionable issues are identified, state that no actionable findings were found in the reviewed changes. Do not claim that the code is completely bug-free or secure.

Prioritize correctness, security, data integrity, and deployment reliability over stylistic preferences.

## 13. Language

Write review summaries and findings in Japanese unless the surrounding review context explicitly requires another language.

Keep technical identifiers, filenames, commands, API names, and configuration keys in their original form.

Use concise, specific, and actionable language.
