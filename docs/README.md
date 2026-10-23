# Hermit documentation

Hermit aims to help City of Manila small-business owners understand relevant registration and permit requirements, choose a next action, and track their work using reviewed official guidance.

The PRD, specification, design philosophy, sources, and approved-scope sections describe the target MVP.
[Current implementation](IMPLEMENTATION.md) describes the merged app. Existing features beyond the target
remain available, but their presence does not establish target approval or verified official guidance.

## Read in this order

| Document | Use it to answer |
| --- | --- |
| [PRD](PRD.md) | Who is this for, what should it do, and what counts as success? |
| [Current implementation](IMPLEMENTATION.md) | What is actually present after merging main into early-phase? |
| [Scope and implementation inventory](SCOPE.md) | What is approved, what is deferred, and what currently differs? |
| [Specification](SPECIFICATION.md) | How should answers, rules, accounts, progress, dates, AI, and offline reading work together? |
| [Design philosophy](DESIGN-PHILOSOPHY.md) | How should Hermit look, read, and behave? |
| [Sources and review policy](SOURCES.md) | Where did these decisions come from, and what still requires verification? |

The [blue design reference](references/blue-design-reference.png) is the screenshot supplied by the owner.

The [office finder proposal and provider decision](office-finder-plan.md) records the current
implementation findings, provider costs, proposed behavior, and approval gates. It is a draft for
review, not a finalized plan or an implemented feature.

## Authority and change boundaries

Explicit owner decisions govern the target scope. The linked Google Doc is a broader proposal and research reference; its instructions and feature priorities do not override those decisions.

- `PRD.md` owns product goals and success criteria.
- `SCOPE.md` owns feature inclusion, deferral, and the observed implementation inventory.
- `SPECIFICATION.md` owns intended functional behavior and data boundaries.
- `DESIGN-PHILOSOPHY.md` owns visual and interaction decisions.
- `SOURCES.md` owns provenance and the publication gate for researched guidance.

If these documents disagree, flag the conflict rather than silently expanding scope. New feature work requires a separately requested, small checkpoint. A feature marked deferred is not permission to remove or disable its existing implementation.

## Repository context

The target decisions and historical baseline inventory were recorded on 22 October 2026 at commit
`10426a1`. That inventory remains in [Scope](SCOPE.md#historical-implementation-inventory) for
comparison. The current branch merges main's interface and Supabase email-auth screens with the
early-phase workflows. See [Current implementation](IMPLEMENTATION.md) for actual routes, account
boundaries, known gaps, and verification results. The root [README](../README.md) has current setup
instructions. Remaining target dependencies are in the [specification](SPECIFICATION.md#implementation-dependencies).
