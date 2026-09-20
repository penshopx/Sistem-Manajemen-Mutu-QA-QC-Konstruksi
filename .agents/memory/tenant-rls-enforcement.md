---
name: Tenant RLS enforcement
description: PostgreSQL RLS constraints specific to this Replit database and Drizzle schema push.
---

RLS-protected application transactions must switch to a non-superuser, non-`BYPASSRLS` role. Enabling and forcing RLS does not constrain the default Replit database connection because it currently connects as a PostgreSQL superuser.

**Why:** A live isolation test showed cross-project rows remained visible despite both `relrowsecurity` and `relforcerowsecurity` being true. The connection role was `postgres` with `rolsuper=true`. In addition, Drizzle schema push created the named policy but omitted its `USING` and `WITH CHECK` expressions, so those expressions require explicit verification in `pg_policies`.

**How to apply:** After schema synchronization, apply the tenant-policy enforcement step that creates/grants the restricted role, recreates policy expressions, and forces RLS. Test through `SET LOCAL ROLE` and assert both catalog state and cross-project read/write denial.