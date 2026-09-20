---
name: HEIC converter bundling
description: Runtime compatibility constraints for the server-side HEIC conversion dependency.
---

The HEIC converter and its WebAssembly dependency rely on CommonJS globals and dynamic requires. Keep the API server's ESM bundle compatibility shims for `require`, `__filename`, and `__dirname`.

**Why:** A plain ESM test bundle can compile successfully but fail at module load with missing `__dirname` or unsupported dynamic `require`.

**How to apply:** When changing the API bundler or HEIC library, verify the built server starts and run converter tests through a Node-compatible CommonJS bundle or the same compatibility banner used by the server build.