# Demo access

- Application: https://agenticmigrator.vercel.app
- Repository: https://github.com/PDGamerSG/Agentic-Data-Migration-Planner-and-Reconciliation-Workbench
- No sign-in, password or upload is needed. Enter a review label in the bottom operator field and choose **New test**.
- The Groq-backed planner is configured. Its model/provider and persisted inspection calls appear in the AI planner. The offline provider is reserved for development and reproducible tests.
- The staged sample has 250 synthetic legacy CRM customers and 20 pre-existing target customers. The workbench permits at most 1,000 records from one source to one target.

## Sample decisions

Use `MM/DD/YYYY` precedence, hold undocumented status X, hold N/A credit limits, confirm false marketing consent, confirm omission of notes/login IP history, and keep the first valid duplicate email. Run a dry run after saving the answers, inspect held-record evidence, then review the high risks before approval.

The reference plan with these decisions produces 212 accepted and 38 held records. The model can propose a different valid mapping; use the persisted dry-run evidence for the actual plan rather than assuming reference counts.

For an interruption demonstration, enable the simulator in Load & verify. Retry skips already loaded rows. Reconcile afterwards; roll back the test migration with a reason to return the target to its baseline. The demo retains plan versions and audit history.

## Operational limits

The demo workspace is shared and operator labels are not authenticated identities. One migration may execute at a time; the planner allows 20 sessions per hour across the workspace. Provider quotas or malformed responses create a failed session with an error, rather than a silently substituted offline result. A second reviewer may see earlier activity.

Do not supply real customer information, database credentials or production secrets. [The full walkthrough](demo-script.md) and [README](../README.md) document scope and local reproduction.
