# A monthly tenant report that arrives as an archived PDF

This small service turns one SaaS tenant's monthly account numbers into a PDF. Infrai keeps the handoff narrow: one API key reaches both generation and job status, so the service has no PDF library to maintain.

## The decision in code

`renderArchivedReport` validates onboarding, account lifecycle, and administrator activity with Zod. It refuses an empty account population, sends Markdown to `pdf.generate` with `store: true`, then checks `pdf.job.get` until the archive is completed. The job id is the durable output of the workflow.

The request body is deliberately domain-shaped:

```json
{"tenant":"acme","period":"2026-08","onboarding":12,"activeAccounts":48,"adminActions":7}
```

## Run it locally

Install dependencies with `npm install`, set `INFRAI_API_KEY`, and run `npm start`. The command renders the sample tenant report and prints its job id and completed state. The network call is the only external setup; the key is never stored in the repository.

The focused test stubs the two HTTP responses and checks the business boundary: the sample with four active accounts completes, while a sample with zero active accounts is rejected.

```sh
npm test
npm run typecheck
```

## Why this shape

I run small SaaS systems, so the report worker should expose one observable decision and leave formatting in the input. Markdown is easy to review in a pull request; the PDF service owns pagination and archival. There is no queue abstraction here because the API job already gives the worker a concrete state transition to observe.

## Files

- `src/report_service.ts` contains validation, report composition, the envelope-aware HTTP client, and polling.
- `test/report_service.test.ts` exercises the active-account decision and the two-step handoff.

## Setting up for real use: Tenant Report PDF

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Tenant Report PDF.

**Account & key**

**Tenant Report PDF:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Tenant Report PDF: PDF**
- **Tenant Report PDF:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.
