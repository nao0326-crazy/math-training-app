# Project Development Rules

## Maintenance Mode (must remain enabled)

`VITE_MAINTENANCE_MODE` is the public-build switch for taking the application offline without deleting the project, deployment, domain, or data.

- `VITE_MAINTENANCE_MODE=true`: render only `MaintenancePage`; do not mount or expose the normal application.
- `VITE_MAINTENANCE_MODE=false`: render the normal application.
- The value is a public build-time flag, not a secret. Never put API keys, service-role keys, LINE credentials, mail credentials, or other secrets in it.
- Changing URLs, routes, pages, UI, or features must not remove or bypass this gate.
- When maintenance mode is true, no normal route, page, quiz, history, calendar, or other application content may be reachable.

### Protected implementation points

Do not delete, rename, or unintentionally change these mechanisms:

- `src/App.tsx`: the top-level maintenance-mode branch
- `src/components/MaintenancePage.tsx`: the maintenance screen
- `src/utils/maintenanceMode.ts`: the environment-value parsing and boolean decision
- `src/utils/maintenanceMode.test.ts`: the maintenance-mode regression tests

If routing is introduced or changed, keep the maintenance check above route resolution and before mounting the normal application. A route-level-only check is insufficient unless it is guaranteed to run before every normal entry point.

### Required checks for maintenance-related changes

Before completing any change that could affect maintenance mode, URLs, routing, or the normal application, verify all of the following:

1. `VITE_MAINTENANCE_MODE=true` shows only `MaintenancePage`.
2. `VITE_MAINTENANCE_MODE=false` shows the normal application.
3. Normal quiz, history, and calendar functionality still work in the false state.
4. `npm test`
5. `npm run typecheck`
6. `npm run build`

Vercel environment changes and production deployments are separate operations. Do not change them unless explicitly requested.

## Code Change and Verification Rules

### Props / types / data flow
- When changing React props, types, function arguments, or data structures, search all usages.
- For added/removed/changed required props, verify every call site.
- When adding props, confirm value source and data flow.
- Do not hide type errors with `any`, empty objects, or type assertions.
- If a prop becomes unnecessary, review component/caller responsibilities.
- Add or update tests for changed behavior; preserve existing behavior.
- Fix root causes, not symptoms.

### Local verification (single command)
Run `pnpm run verify` before claiming completion. It runs (in order, failing fast):
1. `pnpm run typecheck`
2. `pnpm test`
3. `pnpm run build`
4. `pnpm run lint`
5. `git diff --check`

Playwright/E2E scripts are run separately when relevant:
- `node scripts/e2e-acceptance.mjs` (requires dev server / Chrome)
Do not report partial test runs as full success.

### Package manager
- Formal package manager: **pnpm**.
- `pnpm-lock.yaml` is the only lockfile. Do not reintroduce `package-lock.json`.
- Use `pnpm install --frozen-lockfile` in CI/Vercel.
- Node version should be pinned in CI (see `.github/workflows/ci.yml`).

### GitHub Actions
- CI runs on push/PR to `main`: typecheck, test, build.
- CI uses pnpm and `pnpm-lock.yaml`.
- Branch protection must be configured in GitHub settings; this repo's files alone cannot enforce it.

### Production deploy quality gate
A production deploy is complete only when:
- local `pnpm run verify` succeeds
- GitHub CI succeeds for the same commit
- Vercel production build succeeds
- public version/assets are verified
- critical flows are checked in a real browser

Vercel build success and public runtime verification are separate.


### Props / types / data flow
- When changing React props, types, function arguments, or data structures, search all usages.
- For added/removed/changed required props, verify every call site.
- When adding props, confirm value source and data flow.
- Do not hide type errors with `any`, empty objects, or type assertions.
- If a prop becomes unnecessary, review component/caller responsibilities.
- Add or update tests for changed behavior; preserve existing behavior.
- Fix root causes, not symptoms.

### Local verification (single command)
Run `pnpm run verify` before claiming completion. It runs (in order, failing fast):
1. `pnpm run typecheck`
2. `pnpm test`
3. `pnpm run build`
4. `pnpm run lint`
5. `git diff --check`

Playwright/E2E scripts are run separately when relevant:
- `node scripts/e2e-acceptance.mjs` (requires dev server / Chrome)
Do not report partial test runs as full success.

### Package manager
- Formal package manager: **pnpm**.
- `pnpm-lock.yaml` is the only lockfile. Do not reintroduce `package-lock.json`.
- Use `pnpm install --frozen-lockfile` in CI/Vercel.
- Node version should be pinned in CI (see `.github/workflows/ci.yml`).

### GitHub Actions
- CI runs on push/PR to `main`: typecheck, test, build.
- CI uses pnpm and `pnpm-lock.yaml`.
- Branch protection must be configured in GitHub settings; this repo's files alone cannot enforce it.

### Production deploy quality gate
A production deploy is complete only when:
- local `pnpm run verify` succeeds
- GitHub CI succeeds for the same commit
- Vercel production build succeeds
- public version/assets are verified
- critical flows are checked in a real browser

Vercel build success and public runtime verification are separate.

`VITE_MAINTENANCE_MODE` is the public-build switch for taking the application offline without deleting the project, deployment, domain, or data.

- `VITE_MAINTENANCE_MODE=true`: render only `MaintenancePage`; do not mount or expose the normal application.
- `VITE_MAINTENANCE_MODE=false`: render the normal application.
- The value is a public build-time flag, not a secret. Never put API keys, service-role keys, LINE credentials, mail credentials, or other secrets in it.
- Changing URLs, routes, pages, UI, or features must not remove or bypass this gate.
- When maintenance mode is true, no normal route, page, quiz, history, calendar, or other application content may be reachable.

### Protected implementation points

Do not delete, rename, or unintentionally change these mechanisms:

- `src/App.tsx`: the top-level maintenance-mode branch
- `src/components/MaintenancePage.tsx`: the maintenance screen
- `src/utils/maintenanceMode.ts`: the environment-value parsing and boolean decision
- `src/utils/maintenanceMode.test.ts`: the maintenance-mode regression tests

If routing is introduced or changed, keep the maintenance check above route resolution and before mounting the normal application. A route-level-only check is insufficient unless it is guaranteed to run before every normal entry point.

### Required checks for maintenance-related changes

Before completing any change that could affect maintenance mode, URLs, routing, or the normal application, verify all of the following:

1. `VITE_MAINTENANCE_MODE=true` shows only `MaintenancePage`.
2. `VITE_MAINTENANCE_MODE=false` shows the normal application.
3. Normal quiz, history, and calendar functionality still work in the false state.
4. `npm test`
5. `npm run typecheck`
6. `npm run build`

Vercel environment changes and production deployments are separate operations. Do not change them unless explicitly requested.
