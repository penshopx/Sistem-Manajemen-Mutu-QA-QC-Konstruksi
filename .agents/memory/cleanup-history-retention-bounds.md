---
name: Cleanup history retention bounds
description: Safety constraints for configuring attachment cleanup event history retention.
---

Configure cleanup history retention in whole days. Keep the default at 30 days and enforce a range of 1 through 3650 days.

**Why:** The latest 24 hours feed the operational cleanup summary and must never be deleted, while an upper bound prevents accidental effectively-unlimited retention.

**How to apply:** Any new configuration surface or alternate cleanup entry point must use the same bounds and reject invalid values before deletion begins.