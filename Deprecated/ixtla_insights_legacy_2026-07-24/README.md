# Ixtla Insights legacy archive

Archived on 2026-07-24 while restarting Ixtla Insights from the minimal
`gpt_probe.php` integration.

These files are retained for reference only and are not part of the active
assistant runtime:

- `analytics.php`: legacy metric execution and RBAC analytics layer.
- `chat.php`: legacy orchestrator for structured chat, reports and widgets.
- `catalog.php`, `departments.php`, `draft.php`: legacy frontend support APIs.
- `conversation_service.php`: legacy classifier and report-plan executor.
- `tests/`: tests specific to the archived contracts and conversation flow.
- `js/` and `views/`: dashboard temporal anterior y su estado local.

The active minimal runtime remains under `db/ixtla_insights/`:

- `bootstrap.php`
- `gpt_probe.php`
- `health.php`
- `contracts.php` (temporarily retained because `bootstrap.php` still loads it)

Do not restore individual legacy files into the active route without first
reviewing their dependencies and authorization model.
