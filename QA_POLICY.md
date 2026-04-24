# QA System Policy

## Allowed

The QA system is allowed to:

- Access company local project folders under E:\Project\Master
- Pull GitHub repositories (read-only, no force push)
- Use approved admin/test/user credentials stored in `.env.qa.local`
- Login to internal systems for testing purposes
- Take screenshots of all pages during test runs
- Record walkthrough videos for evidence
- Test UI, buttons, forms, APIs, admin dashboards
- Simulate all department roles (CEO, Admin, Marketing, Accounting, Store Manager, User)
- Generate CEO summary and Dev technical reports
- Run safe stress tests with configurable concurrency limits

## Not Allowed

The QA system must not:

- Commit real credentials to any repository
- Expose passwords, tokens, or secrets in any report output
- Delete production data (read-only mode on all production systems)
- Run destructive tests on production environments
- Send real emails or SMS unless `QA_ENV=test` is set
- Run stress tests on production without explicit CEO approval (`QA_SAFE_MODE=false`)
- Bypass authentication or exploit vulnerabilities
- Store credentials in any file other than `.env.qa.local`

## Secret Handling

- All credentials must be stored in `.env.qa.local` — never `.env` or committed files
- `.env.qa.local` is listed in `.gitignore` and must never be committed
- All reports must mask credential values (e.g., `GOOGLE_REFRESH_TOKEN=********`)
- The credentialMasker module is applied to all report output before writing to disk
- GitHub tokens and API keys found in source code must be flagged as CRITICAL severity

## Safe Mode Rules

When `QA_SAFE_MODE=true` (default):

- Maximum concurrent users: 10 (overrides `QA_MAX_USERS`)
- Maximum requests per minute: 50 (overrides `QA_MAX_REQUESTS_PER_MINUTE`)
- No destructive form submissions on production
- No file deletion or data mutation
- Stress tests run against localhost or staging only

When `QA_SAFE_MODE=false`:

- CEO must be notified before run
- A confirmation prompt is required before starting stress tests
- All actions are logged with timestamps

## Report Policy

- Reports are generated per run under `qa-reports/YYYY-MM-DD-HH-mm/`
- CEO summary uses plain business language — no stack traces
- Dev technical report includes full error details, stack traces, and fix suggestions
- Screenshot and video evidence is linked in both reports
- Reports are never auto-sent — CEO reviews manually before sharing
