---
name: Temporary API test bundles
description: Constraints for API integration-test bundles emitted to a temporary directory.
---

Integration-test entries emitted outside the workspace must import entry-only packages through workspace-resolved absolute paths. Run these bundles without development-only logger transports that resolve modules relative to the temporary output.

**Why:** Source-file dependencies resolve from their original absolute paths during bundling, but bare imports declared only by a temporary entry and runtime-resolved logger transports use the temporary directory and fail despite being installed in the workspace.

**How to apply:** When an API test generates an entry under the OS temp directory, resolve its direct package imports from the artifact first and set the logger to its transport-free production mode before importing the generated bundle.