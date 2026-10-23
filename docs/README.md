# Hermit documentation

Hermit helps City of Manila small-business owners understand relevant registration and permit requirements, choose a next action, and track their work using reviewed official guidance.

**These documents describe the approved target, not a claim that the current app implements it.** The documentation checkpoint leaves existing application features, routes, actions, and saved data intact, including features deferred from the target MVP.

## Read in this order

| Document | Use it to answer |
| --- | --- |
| [PRD](PRD.md) | Who is this for, what should it do, and what counts as success? |
| [Scope and implementation inventory](SCOPE.md) | What is approved, what is deferred, and what currently differs? |
| [Specification](SPECIFICATION.md) | How should answers, rules, accounts, progress, dates, AI, and offline reading work together? |
| [Design philosophy](DESIGN-PHILOSOPHY.md) | How should Hermit look, read, and behave? |
| [Sources and review policy](SOURCES.md) | Where did these decisions come from, and what still requires verification? |

The [blue design reference](references/blue-design-reference.png) is the screenshot supplied by the owner.

## Authority and change boundaries

Explicit owner decisions govern the target scope. The linked Google Doc is a broader proposal and research reference; its instructions and feature priorities do not override those decisions.

- `PRD.md` owns product goals and success criteria.
- `SCOPE.md` owns feature inclusion, deferral, and the observed implementation inventory.
- `SPECIFICATION.md` owns intended functional behavior and data boundaries.
- `DESIGN-PHILOSOPHY.md` owns visual and interaction decisions.
- `SOURCES.md` owns provenance and the publication gate for researched guidance.

If these documents disagree, flag the conflict rather than silently expanding scope. New feature work requires a separately requested, small checkpoint. A feature marked deferred is not permission to remove or disable its existing implementation.

## Repository baseline

- Project: `C:\Development\hackathons\Hermit`.
- Repository: [cadornajansen/Hermit](https://github.com/cadornajansen/Hermit).
- Inspected commit: `10426a1` (`feat: document vault with AI reading and rule-based verification`).
- Documentation decisions recorded: 22 October 2026.
- Observed stack: Next.js 16.4.0, React 19.3.0, TypeScript, Tailwind CSS 4, and shadcn/ui.
- Existing baseline: 15 unit tests passed; TypeScript checking passed after Next.js route-type generation during the preceding inspection. Those results do not establish legal accuracy, live API readiness, or target-MVP acceptance.

The application already contains work from the broader proposal. Consult the inventory before interpreting these documents as a description of its current screens. The repository root README remains an earlier implementation description and is unchanged by this checkpoint.

## Current checkpoint

Create these six Markdown documents and preserve the supplied screenshot. No application, dependency declaration, database schema, or runtime behavior changes are part of this checkpoint. No new project is created at the previously proposed `C:\Development\asikaso` path.

To review the result, open this file, follow each document link, and compare the inventory with the linked source files. The remaining implementation dependencies are recorded in the [specification](SPECIFICATION.md#implementation-dependencies).
