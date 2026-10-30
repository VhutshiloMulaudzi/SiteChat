# Initial verification

On 30 October 2026 the .NET Release build completed with zero warnings and errors. All 49 backend tests and 12 widget/playground DOM tests passed. The script-tag auto-initialization regression and copied-snippet configuration wiring are covered explicitly; the tests also exercise cross-host API resolution, safe rendering, failed-turn retries and bounded history.

A real POST to `/api/chat` with a permitted local Origin returned HTTP 200 and a nonempty reply from the configured managed AI provider. The `/health` endpoint and `/manus-routes.json` responded successfully. This is not a claim of exhaustive cross-browser or load testing.

A direct-and-transitive NuGet vulnerability scan and a full pnpm audit, including development dependencies, reported no known vulnerable packages at that time. The widget has no production Node dependencies. Dependency scans are time-specific observations, not a guarantee of security.

The CI workflow restores .NET and development-only DOM-test lockfiles, checks JavaScript syntax, builds Release with warnings treated as errors, runs the suites and uploads TRX results. Run outcomes are visible in GitHub Actions once the repository is transferred.
