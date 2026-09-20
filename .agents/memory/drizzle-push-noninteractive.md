---
name: Drizzle push in non-interactive shells
description: How to handle Drizzle schema changes that require an interactive column-conflict prompt in this workspace.
---

Drizzle schema push can stop on a column-conflict prompt when no TTY is available, including when its force flag is used.

**Why:** A change to a newly introduced table could not be applied by either the normal or force push command because both attempted to render an interactive conflict resolver.

**How to apply:** Inspect the live table first, apply only the required `ALTER TABLE` and index statements in a transaction, then run the normal schema push again and require it to report no remaining changes. Do not use broad destructive SQL or modify unrelated tables.