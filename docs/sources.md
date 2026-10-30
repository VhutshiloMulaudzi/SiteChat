# Sources and dependencies

The approved visual direction is Soft Terminal: sage and charcoal, rounded geometry, subtle depth and DM Sans typography.

DM Sans font source: https://github.com/googlefonts/dm-fonts. The font is distributed under the SIL Open Font License; include its notice with locally hosted font assets.

The server-side model `gpt-6-luna` was selected from the live Manus model catalog and verified in this project's catalog on 30 October 2026. The catalog describes it as low cost per task and middle-rated for instruction following and writing; the implementation uses low reasoning effort for interactive replies. The model is configurable on the server.

Platform model calls use runtime MANUS_API_URL and MANUS_API_KEY, never browser credentials or hardcoded keys. A portable OpenAI-compatible provider path will be documented separately.
