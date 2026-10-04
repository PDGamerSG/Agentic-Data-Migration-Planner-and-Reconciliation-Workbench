# Five-minute demo

1. Open the overview: 250 source records, 20 pre-existing customers, 1,000-row cap.
2. Inspect schemas. Select `signup_dt` to see mixed formats and `country` to see unsupported aliases.
3. Draft a plan. Expand a tool call to show the source inspection or full-sample mapping test.
4. Answer every question: US slash-date precedence, reject X, reject N/A, confirm false consent and the two drops, keep the first duplicate email. Re-draft.
5. Review the new version. Point out missing consent, explicit data loss, supported transforms, and measured transform success.
6. Enter an operator name. Dry-run twice and compare fingerprints. Show 250 source, 234 transformed, 212 accepted, 38 held.
7. Inspect an invalid-email record and a failing date transform. Show original values and the exact failed step.
8. Approve the inspected version after checking all high risks.
9. Open the target. Enable interruption after batch 3. Execute: 150 inserts are committed before the simulated failure.
10. Retry from the run page. Show 62 inserted and 150 already loaded, with no duplicates.
11. Open the reconciliation ledger: 232 target rows, all count and content checks matched.
12. Roll back with a reason. The target returns to its 20 pre-existing customers; the rollback reconciliation matches.
13. Open the activity register and show the approval, failure, retry, execution and rollback records.

A successful repeat execution is a logged no-op. Edits create a new draft and cannot reuse an older version's approval. Changes to source/target keys after approval cause drift rejection. Changes to loaded content cause reconciliation mismatch and block rollback.
