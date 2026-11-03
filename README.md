# Frontend: Next.js 16

School portal (`/app`), sign-in, super admin console (Phase 1) and per-school public websites (`/site/[host]`, reached via `src/proxy.ts`).

```bash
npm install
npm run dev          # http://localhost:3000 (API expected on http://localhost:8080)
npm test             # unit tests (Vitest)
npm run typecheck    # route types + tsc
npm run lint
npm run e2e          # Playwright; needs the API running (see ../README.md)
npm run gen:api      # regenerate src/lib/api/schema.d.ts from ../backend/target/openapi.json
```

Environment: see `.env.example`. Next.js 16 differs from older versions; read `AGENTS.md` first.
