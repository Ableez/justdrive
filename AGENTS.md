## Project

- Monorepo: `apps/web` (Next.js 16 web app at `drive.astexlabs.com`), `packages/cli` (`justdrive`), `packages/shared` (types, constants, urls, utils, errors).
- Core objective: move files between machines through the user's Google Drive. Machines get short-lived Google tokens and talk to Drive directly, so file bytes never pass through our servers.
- No fancy extras. Keep scope to what the transfer flow needs.

## Git

- Preserve unrelated user changes. Never reset, clean, or overwrite work without explicit approval.
- For granular commit requests, verify `git config --list` and `gh auth status`; report the configured username and email before committing.
- Keep commit messages under 600 characters and DO NOT add `Co-authored-by` trailers.
- Always communicate in English.
- Commits must not be more than 3 files at once related logics or changes max commit per files is 3-4

## Verification

- Write tests for functional utilities, API routes, CLI commands, and shared helpers. UI-only components may skip tests unless behavior is complex or regression-prone.
- While iterating, run the narrowest useful check. Before handoff, run in this order and stop at the first failure: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Scope with `pnpm --filter @juststore/web ...` (or `justdrive`, `@juststore/shared`) when only one package changed.
- Do not claim success from a passing typecheck alone when the change affects runtime behavior.

## React and Next.js rules

- Prefer Server Components. Add `'use client'` only at the smallest boundary that needs browser APIs, event handlers, or client state.
- Read the bundled docs for async Next.js APIs, route conventions, Server Actions, Route Handlers, caching, Suspense, metadata, images, fonts, and error boundaries before changing those areas.
- Avoid `useEffect` for derived state or prop synchronization. Never call a state setter synchronously inside an effect. Derive during render, update from the event that caused the change, or use an effect only to synchronize with an external system.
- Never trust client-side validation or authorization. Validate inputs and enforce permissions on the server.
- Avoid data waterfalls; use server-side parallelism, Suspense, or the documented caching patterns where appropriate.

## Code style and structure

- Keep every module responsible for one piece of functionality.
- Each `.tsx` file contains one component. Put extracted route components in a nearby `_components` directory and check `src/components/shared` before creating a shared component.
- Use lowercase, dash-separated filenames. Use camelCase for variables and functions.
- Do not add comments unless they document a hidden invariant, real trade-off, or necessary workaround. Names and structure should explain normal code.
- Do not use fake letter-spacing, shadows, or shadcn Cards. Use borders only when they materially separate UI.
- Prefer the smallest functional implementation. Avoid cosmetic abstractions, cleverness, and duplicate logic.
- Keep copy and error messages short and human.

## Let errors drive fixes

- Start with the exact error, source frame, route, and runtime state. Do not hide a framework error with a cosmetic workaround.
- When Next.js provides a `Learn more` link, read the matching error documentation before editing. Error pages under `nextjs.org/docs/messages` may not be bundled, so use the linked page when necessary.
- For Cache Components or prerendering errors, read the relevant bundled guide and choose deliberately between streaming with `<Suspense>`, caching with `use cache`, or allowing blocking behavior. Do not enable `cacheComponents` or change caching semantics unless the task requires it.
- If a production build error is hard to trace, use the version-matched build debugging options documented by the installed Next.js package.
- After the fix, reproduce the original failure and verify the runtime behavior that matters to the user.

## Skills and workflows

- Skills provide repeatable workflows; bundled Next.js docs provide framework knowledge. Read the exact relevant `SKILL.md` before using a skill, and follow any required checkpoints.
- Repo skills that exist: `apps/web/.agents/skills/neon` and `apps/web/.agents/skills/neon-postgres`, mirrored under `apps/web/.claude/skills/` and pinned by `apps/web/skills-lock.json`. They cover the Postgres side only.
- Root `.agents/skills/` does not exist. Add it only when a workflow actually repeats, starting with one narrow skill instead of a framework bundle.
- Available skills worth using here: `vercel-react-best-practices` for React 19 / Next.js 16 work in `apps/web`, `diagnosing-bugs` for OAuth, device-flow, and Drive API failures where types pass but runtime breaks, `review` for checking a branch against these standards and the task spec, `tdd` for the vitest suites in `packages/cli` and `packages/shared`, and `deploy-to-vercel` only when shipping `apps/web`.
- Use the smallest skill that covers the task. Do not install or invoke a broader workflow without a reason.

## Learning more about Effect

This repository uses the Effect TypeScript library.

Before writing any Effect code, first read `node_modules/effect/AGENTS.md`
completely, and follow the links in the file when required.
