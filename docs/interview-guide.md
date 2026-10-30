# Interview walkthrough

Start with the actual user journey: a website owner hosts the ASP.NET Core service, configures a bot's permitted origins and verified knowledge, and adds a script tag. The visitor opens a Shadow DOM widget. The widget posts bounded user/assistant history to the backend. The backend validates the request, checks that specific bot's origin allowlist and supplies its own system prompt to the model provider. The reply is rendered as text.

Explain why the API key is never in the widget. Browser code and site IDs are public; a public token cannot be treated as secret. Explain the difference between a CORS allowlist and authentication, and why a determined non-browser caller can spoof Origin.

Walk through `ChatContracts.cs` for alternating-role and size validation, `SiteOptions.cs` for exact scheme/host/port matching, `ChatResponder.cs` for trusted prompt ownership and provider error handling, and `Program.cs` for HTTP composition and rate limits. Show the tests proving a system-role request and a disallowed origin never reach the provider.

Walk through the widget's lifecycle and request state. Explain why re-init destroys old listeners, why failed user turns are reused rather than appended again, why request cancellation prevents an old reply changing a new instance, and why context trimming preserves complete turns. Demonstrate an API error and recovery rather than hiding failure handling.

The demo changes display settings, not privileged server knowledge. Shadow DOM isolates styles but is not a security sandbox. Transcript history is in memory, not local storage or a database. Liveness is not provider readiness. In-memory limits do not coordinate replicas and can aggregate users behind a proxy if visitor IP handling is not configured correctly.

A useful next contribution you can implement and explain yourself is a small tested configuration endpoint returning only public bot presentation settings. Alternatively, add a carefully bounded FAQ retrieval component using a reviewed knowledge source, with tests proving retrieved data cannot override the system instructions. Do not claim RAG, persistent conversations, customer support handoff, or production-scale protections before implementing them.

This is an AI-assisted sample. Read the code, run the demo, make a genuine improvement and describe what you understand; do not present assistance or upstream dependencies as independent authorship.
