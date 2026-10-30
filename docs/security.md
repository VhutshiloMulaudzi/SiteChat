# Security and privacy

## Trust boundaries

The widget contains no API key. `data-site-id` is a public routing identifier, not a secret or authentication token. Visitor messages pass through your ASP.NET Core server to the configured model provider. Only the server supplies the system prompt and provider credentials. Browser-supplied system/tool messages are rejected, and the server enforces alternating user/assistant messages, per-message and total size limits, a 32 KiB request limit, a five-minute per-IP request limit and a process-wide concurrency cap.

The application does not write conversations to a database, cookies, analytics or local storage. The model provider and your hosting infrastructure may have their own retention policies. Do not promise zero retention or ask visitors to submit passwords, financial information or medical details. Application logging avoids chat contents and model response bodies; review infrastructure logs separately.

## Domain configuration

Allow origins individually per site, including scheme and port, with no trailing slash. CORS is not authentication: a non-browser client can spoof the Origin header. The check restricts ordinary website integrations and prevents accidental use from unrelated sites; it does not establish visitor identity or protect a paid AI endpoint from determined abuse.

For a production service, add gateway quotas, authenticated short-lived visitor sessions where appropriate, a distributed limiter, provider spend limits, bot protection and an emergency kill switch. All in-memory limits reset on restart and are independent between replicas. This sample intentionally does not claim production-grade abuse prevention. Behind a reverse proxy, configure trusted forwarded-header handling to get correct visitor IPs; do not blindly trust arbitrary X-Forwarded-For values.

## Content and isolation

Widget styling lives inside Shadow DOM and uses a separate stylesheet. Shadow DOM is style scoping, not a security sandbox. The host site controls its own scripts and can access an open shadow tree. Treat host pages as trusted. Displaying model output as text prevents HTML/script execution. A model is not a reliable authorization system: keep actions and secret data out of prompts, and never add privileged tools without server-side permission checks.

No automatic website scraping occurs. Supply only reviewed, public business information through the server-side site system prompt. Client-configured bot names and colours are presentation settings, not a way to change protected AI instructions.

## CSP and transport

Use HTTPS for the bot host and production websites. A restrictive host CSP must allow the bot origin in `script-src`, `style-src`, `font-src` and `connect-src`. The widget does not need inline script or eval. A website builder must permit custom scripts; CMS restrictions, CSP, and browser extensions can prevent any third-party integration, so “any website” means sites that allow the snippet and network access.

Keep `.env`, API keys, access tokens and private deployment config out of Git. `.env.example` contains placeholders only. ASP.NET Core does not load `.env` files automatically; use environment exports, platform secrets, user-secrets for local development, or Docker's `--env-file`.
