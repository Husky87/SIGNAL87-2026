# Signal87 redesign API compatibility

The redesigned frontend must preserve the existing backend API contract.

## Provider routing

1. OpenAI / GPT is primary.
2. Google Gemini is the second provider.
3. xAI Grok is the third fallback.

## Existing frontend-facing endpoints

- `/api/chat`
- `/api/analyze`
- `/api/research`
- `/api/compare`
- `/api/summarize`
- `/api/documents/*`
- `/api/create-checkout-session`
- `/api/health`

## Main chat contract

The new interface should call `/api/chat` and preserve support for:

- `prompt`
- `messages`
- `documents`
- `ingestedFilesData`
- `attachedFiles`

The UI should consume `text`, `citations`, `provider`, `modelUsed`, `fallbackTriggered`, `fallbackReason`, `latencyMs`, and `verificationTrace` from the response.

API keys must remain server-side. The mobile and desktop clients must never call provider APIs directly with secret keys.
