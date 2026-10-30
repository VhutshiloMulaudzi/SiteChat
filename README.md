# SiteChat

An AI-assisted, embeddable website chatbot with an **ASP.NET Core / .NET 10 backend** and a **dependency-free JavaScript widget**. Add one script to a website you control; the widget's Shadow DOM keeps its styling separate from host-page styles. A live configuration playground is served by the same backend.

The demo assistant explains SiteChat. It does not crawl a website or automatically learn a business's information. Configure a reviewed server-side prompt for each bot to supply that knowledge. This project was built with assistance from Manus; it is a portfolio sample, not a claim of independently authored or production-hardened software.

## Embed on a website

First host the backend over HTTPS, configure the website's exact origin in its site's server configuration, and configure server-side model credentials. Then add this to the website's HTML:

```html
<script defer
  src="https://YOUR-BOT-HOST/widget/sitechat.js"
  data-site-id="demo"
  data-bot-name="Your assistant"
  data-welcome="Hello! How can I help?"
  data-accent="#A7F3D0"
  data-position="right"></script>
```

Replace `YOUR-BOT-HOST` with **your hosted backend**, not the website receiving the widget. No API key belongs in the snippet. Scripts, styles, fonts and chat requests come from the bot host. Sites with a strict CSP must allow that origin in `script-src`, `style-src`, `font-src` and `connect-src`. Website builders must permit custom scripts; an integration cannot override CMS or browser restrictions.

The playground generates this snippet with your chosen appearance. The bot ID selects server-side knowledge and origins. The bot name, welcome text and colours change presentation only.

## Run locally

Install the .NET 10 SDK. No database, Docker or frontend build is needed to run the application:

```sh
dotnet restore --locked-mode
dotnet build -c Release --no-restore
dotnet test -c Release --no-build
dotnet run --project server/SiteChat.Api --no-launch-profile --urls http://localhost:3000
```

Open `http://localhost:3000`. Without model credentials, the UI still works and chat displays an actionable service-not-configured error rather than a fake AI response. ASP.NET Core does **not** automatically load `.env`; use environment exports, local user-secrets, platform secrets or Docker's `--env-file`.

### AI credentials

On Manus-managed hosting, the server uses the supplied `MANUS_API_URL` and `MANUS_API_KEY`. The managed default model, `gpt-6-luna`, was checked against the live project catalog during development; it uses low reasoning effort.

On independent hosting, set these environment variables using a model available from your own OpenAI-compatible provider:

```sh
export AI_BASE_URL=https://api.openai.com/v1
export AI_API_KEY=your-own-server-only-key
export AI_MODEL=your-supported-model
```

`AI_BASE_URL` must include `/v1` and use HTTPS. The adapter uses the Chat Completions endpoint and `max_completion_tokens`; select a provider/model supporting that request shape. Optional `AI_REASONING_EFFORT` is sent only when explicitly configured for independent providers. Credentials are read at runtime and never compiled into browser assets. `.env.example` contains placeholders and additional configuration examples.

### Allowed websites and bot knowledge

Configure `SiteChat:Sites` in `server/SiteChat.Api/appsettings.json`, or override entries with environment variables:

```sh
export SiteChat__Sites__demo__Origins__0=https://www.example.com
export SiteChat__Sites__support__Origins__0=https://shop.example.com
export SiteChat__Sites__support__SystemPrompt='You are our shop assistant. Add verified public business information here.'
```

Origins contain scheme, hostname and optional port, **without a trailing slash**. Add every required origin, including the bot's own origin if you use its playground. To avoid retaining default development origins, replace the complete array in your deployment's settings file. ASP.NET Core environment array overrides replace indices, not the entire array; unused indices remain unless removed from configuration. Unknown bot IDs and disallowed origins are rejected before the model is called.

## Widget SDK

For programmatic use, load the script with `data-manual="true"`. Then call:

```js
const chat = window.SiteChat.init({
  siteId: 'support',
  endpoint: 'https://YOUR-BOT-HOST/api/chat',
  botName: 'Support',
  welcomeMessage: 'How can I help?',
  accentColor: '#A7F3D0',
  position: 'right'
});
chat.open();
chat.close();
chat.destroy();
```

`init` replaces an existing instance safely. Optional `container: HTMLElement` mounts an always-open inline panel instead of a floating launcher. Optional `suggestedQuestions: string[]` shows up to five opening questions. The external stylesheet is resolved from the widget script host. Message content is displayed as text, not unsafe HTML.

## What is implemented

The widget supports desktop/mobile layouts, keyboard Escape and focus restoration, labelled controls, a live typing state, duplicate-submit prevention, a 40-second request timeout, failed-message recovery and retry without duplicate turns, clear conversation, left/right placement, configurable branding, and no persistent browser storage.

The API validates alternating user/assistant history, at most 20 messages, 2,000 characters per message and 12,000 characters per request conversation. The final message must be from the user, so accepted histories have an odd length and at most 19 messages. The widget discards old complete turns to stay within those limits. Server request bodies are limited to 32 KiB; replies are capped at 2,000 characters. Limits count JavaScript/.NET UTF-16 code units, not grapheme clusters. The in-memory request limiter allows 60 requests per IP per five minutes, with at most 16 concurrent model requests per process. Errors use consistent codes without exposing provider bodies or credentials.

`GET /health` reports process liveness, not model-provider readiness. `POST /api/chat` accepts `{ "siteId": "demo", "messages": [{ "role": "user", "content": "How do I install SiteChat?" }] }`, and returns `{ "reply": "..." }`. Direct HTTP tests must include an allowed `Origin` header. CORS preflight permits only POST and Content-Type from configured origins.

## Test the widget

Node is needed **only for development tests**, not the deployed widget. Use Node >=22.22.2 and the pinned pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
```

Backend tests cover validation, origin enforcement, preflight, HTTP errors, provider response parsing, system-prompt ownership and credential isolation. DOM-based widget tests cover script-host endpoint resolution, lifecycle, safe text rendering, pending-state duplicate prevention, retry, history bounds and inline mode. DOM emulation is not a claim of exhaustive cross-browser compatibility.

## Deploy

```sh
docker build -t sitechat .
docker run --rm -p 3000:3000 --env-file .env sitechat
```

Use `.env.example` to prepare your own local `.env`, select a supported model, and remove placeholder keys. Put the container behind an HTTPS reverse proxy. The container runs as the image's non-root application user and honors `PORT`. Static frontend files are published with the .NET application; no database is required.

For production, review [security and privacy](docs/security.md), configure provider spend limits and gateway controls, and replace development origins. CORS and public site IDs are **not authentication**. In-memory limits reset on restart and are independent per replica. No durable transcripts, user accounts, RAG, human handoff or privileged actions are implemented.

## Project layout

```text
server/SiteChat.Api/        HTTP API, site policies, model adapter
  wwwroot/widget/          Standalone embeddable JS and CSS
  wwwroot/                 Configuration playground and local font assets
tests/SiteChat.Tests/       .NET unit and HTTP integration tests
tests/widget/              Development-only DOM widget tests
docs/                      Security, source provenance, interview notes
Dockerfile                 Multi-stage deployment build
```

## License and provenance

Application source is MIT licensed. DM Sans is locally hosted under its SIL Open Font License; the original notice is in `server/SiteChat.Api/wwwroot/assets/DM-Sans-OFL.txt`. See [sources](docs/sources.md) and the [interview walkthrough](docs/interview-guide.md). No fabricated commit dates or activity history are used.
