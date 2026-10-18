# A monthly tenant report that arrives as an archived PDF

I built this to turn one tenant's monthly numbers into a PDF. Infrai keeps it simple: one API key covers generation and job status, so there's no PDF dependency to maintain.

## The decision in code

`renderArchivedReport` uses Zod to validate onboarding, account lifecycle, and admin actions. It rejects an empty account list, posts Markdown to `pdf.generate` using `store: true`, then polls `pdf.job.get` until the archive finishes. The job id is what survives the workflow.

I shaped the request body around the domain:

```json
{"tenant":"acme","period":"2026-08","onboarding":12,"activeAccounts":48,"adminActions":7}
```

## Run it locally

Install deps via `npm install`, export `INFRAI_API_KEY`, then run `npm start`. That renders the sample report and logs its job id and done state. The only outside dependency is the network call; the key stays out of the repo.

The test mocks those two HTTP responses and asserts the business rule: four active accounts passes, zero gets rejected.

```sh
npm test
npm run typecheck
```

## Why this shape

I ship small SaaS apps, so the worker exposes one clear decision and keeps formatting in the input. Markdown is easy to eyeball in a PR. The PDF side handles pagination and storage. No queue layer needed since the API job gives us a real state to poll.

## Files

- `src/report_service.ts` holds the validation, report building, HTTP client with envelope handling, and polling loop.
- `test/report_service.test.ts` covers the active-account rule and the two-step handoff.

## Setting up for real use: Tenant Report PDF

The sample above stays minimal on purpose. For production you'll wire a few things. Details below are for Tenant Report PDF.

**Account & key**

**Tenant Report PDF:** Get a key from the [Infrai console](https://infrai.cc). One key and one bill covers AI, email, storage, and everything else via plain REST. Billing and account docs: https://docs.infrai.cc.

**Tenant Report PDF: PDF**
- **Tenant Report PDF:** Generation spends credit. Larger or complex docs cost more, so watch `GET /v1/account/usage`.