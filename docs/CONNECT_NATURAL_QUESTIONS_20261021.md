# WhatsApp natural questions — 2026-10-21

## Problem and resulting behavior

“Qual a próxima escala?” was unknown because the previous recognizer required “minha”. WhatsApp Assist silently skipped unknown requests before account linking or the real domain query. Shared Portuguese words also triggered Spanish replies.

`connectQuestionUnderstanding.ts` now classifies supported read requests by vocabulary and meaning-bearing combinations rather than an exact sentence list. Core, product routing and WhatsApp use the same result. Common next-scale, repertoire, chart and attendance queries retain the existing Hub grant/session and MusicScale Tool Gateway authority. No identity or permission is inferred from wording or a phone.

Unlinked requests receive the secure link. Authorized reads return the actual domain response, including an explicit empty result. Upstream errors produce a temporary-unavailability reply; they do not mean no scale. Meta send/persistence failures remain outside the upstream catch, preventing a second send after ambiguous provider acceptance. Durable inbound tenant/conversation/sender/recipient and service-window evidence are checked even without product routing.

Specific-date/history/team/other-person queries cannot be answered by the current next-personal-scale tool and receive explicit scope guidance. Mutation requests are never converted into completed changes. The enabled MusicScale agent handles clarification without a domain read; disabled agents and human-owned threads remain under the existing router policy. When routing is disabled, otherwise unknown durable text gets guidance instead of disappearing.

## AI and supported scope

This increment uses a local deterministic language interpreter, with zero model calls and no new provider or paid service. It is not an unrestricted LLM conversation or a claim that every paraphrase is supported. The existing NestAI client remains an authenticated in-app suggestion interface. Its Hub token contract requires verified App Check; WhatsApp server-side grants do not supply that browser proof. Do not fabricate App Check or reuse an operator/browser token to enable an LLM in the channel. A separate reviewed service-token contract would be needed for that optional extension.

## Validation and production evidence

Targeted natural-question tests exercise the real Core with synthetic authorized boundaries: exact reported wording, PT/EN/ES, account linking, scale/empty/denied/failed results, clarification without reads, cross-tenant/expired evidence rejection and no duplicate fallback after ambiguous sends. Existing full Core/HTTP, WhatsApp linking and product-routing suites pass; TypeScript and web/Core builds pass locally. These are synthetic tests, not the user's real WhatsApp delivery.

Publication and an actual provider message/response must be verified separately before declaring the incident resolved in production. Do not replay an older inbound message automatically.
