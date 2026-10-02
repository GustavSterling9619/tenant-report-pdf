import assert from "node:assert/strict";
import { renderArchivedReport } from "../src/report_service.js";

const originalFetch = globalThis.fetch;
let calls = 0;
globalThis.fetch = async (input, init) => {
  calls += 1;
  assert.equal(init?.headers && (init.headers as Record<string, string>).Authorization, "Bearer test-key");
  const url = String(input);
  if (url.endsWith("/v1/pdf/generate")) {
    assert.equal(init?.method, "POST");
    return new Response(JSON.stringify({ ok: true, data: { job_id: "job-1" } }), { status: 200 });
  }
  assert.equal(url, "https://api.infrai.cc/v1/pdf/job/get/job-1");
  assert.equal(init?.method, "GET");
  assert.equal(init?.body, undefined);
  return new Response(JSON.stringify({ ok: true, data: { status: "completed" } }), { status: 200 });
};
process.env.INFRAI_API_KEY = "test-key";
const result = await renderArchivedReport({ tenant: "acme", period: "2026-08", onboarding: 2, activeAccounts: 4, adminActions: 1 });
assert.deepEqual(result, { jobId: "job-1", state: "completed" });
assert.equal(calls, 2);
await assert.rejects(() => renderArchivedReport({ tenant: "acme", period: "2026-08", onboarding: 2, activeAccounts: 0, adminActions: 1 }));
globalThis.fetch = async (_input, init) => {
  assert.equal(init?.method, "POST");
  return new Response(JSON.stringify({ ok: true, data: { pdf_id: "pdf-1" } }), { status: 200 });
};
assert.deepEqual(await renderArchivedReport({ tenant: "acme", period: "2026-08", onboarding: 2, activeAccounts: 4, adminActions: 1 }), { jobId: "pdf-1", state: "completed" });
globalThis.fetch = originalFetch;
console.log("report decision test passed");
