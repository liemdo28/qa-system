# Internal QA System

Automated QA department system that tests all company projects from local source, GitHub, websites, admin dashboards, APIs, and role-based user flows.

## Main Purpose

- Scan all projects under `E:\Project\Master`
- Pull and check GitHub repository status
- Run install, build, and test commands
- Check UI/UX with Playwright browser automation
- Test buttons, forms, navigation flows
- Simulate CEO / Admin / Marketing / Accounting / Store Manager / User roles
- Run safe concurrent stress tests
- Capture screenshots and record walkthrough videos
- Generate CEO business summary and Dev technical reports

## Quick Start

```bash
# 1. Copy env example and fill in credentials
cp .env.example .env.qa.local

# 2. Edit .env.qa.local with your credentials
# (Never commit this file)

# 3. Run full QA suite
npm run qa

# 4. Run for a single project
npm run qa -- --project "Bakudan Website Sub"

# 5. Run only source and build checks (no browser)
npm run qa:fast

# 6. Generate reports from last run
npm run report
```

## Output

Reports are saved under:

```
qa-reports/YYYY-MM-DD-HH-mm/
  ceo-summary.md        ← Business-level summary for CEO
  dev-report.md         ← Technical report for developers
  raw-results.json      ← Full structured data
  screenshots/          ← Page screenshots per role
  videos/               ← Walkthrough recordings
  logs/                 ← Console and network logs
```

## Adding a New Project

Edit `config/projects.json` and add an entry:

```json
{
  "name": "My New Project",
  "localPath": "E:\\Project\\Master\\my-new-project",
  "github": "https://github.com/liemdo28/my-new-project",
  "type": "website",
  "publicUrl": "https://myproject.com",
  "buildCommands": ["npm install", "npm run build"],
  "testLevels": ["source", "build", "ui", "role", "stress"]
}
```

No code changes needed. The system picks it up automatically on next run.

## Test Levels

| Level    | What it tests                                      |
|----------|----------------------------------------------------|
| `source` | File structure, Git status, secret scanning        |
| `build`  | npm install, build commands, output artifacts      |
| `ui`     | Playwright: all pages, buttons, forms, mobile      |
| `api`    | API endpoint reachability, auth, response format   |
| `seo`    | Meta tags, OG tags, page speed, accessibility      |
| `role`   | Each role login, permission check, action flow     |
| `stress` | Concurrent users, repeated clicks, long sessions   |

## Environment Variables

See `.env.example` for full list. Key variables:

| Variable                  | Default           | Description                         |
|---------------------------|-------------------|-------------------------------------|
| `QA_SAFE_MODE`            | `true`            | Limits stress test impact on prod   |
| `QA_SCREENSHOT_ENABLED`   | `true`            | Capture page screenshots            |
| `QA_VIDEO_RECORDING_ENABLED` | `true`         | Record browser session videos       |
| `QA_STRESS_TEST_ENABLED`  | `true`            | Enable stress test runner           |
| `QA_MAX_USERS`            | `100`             | Max concurrent users for stress     |
| `QA_MASTER_PATH`          | `E:\Project\Master` | Root path for local projects      |

## Architecture

```
src/
  index.ts              ← Main orchestrator
  scanner/              ← Source code inspection
  runner/               ← Build, UI, API, stress runners
  browser/              ← Playwright browser control
  reports/              ← CEO and Dev report generators
  security/             ← Credential masking, safe mode
  utils/                ← Logger, command runner, file utils
```

## Policy

See [QA_POLICY.md](QA_POLICY.md) for full rules on what the system can and cannot do.
