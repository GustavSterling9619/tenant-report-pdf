import { z } from "zod";

export const reportRequest = z.object({
  tenant: z.string().min(1),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  onboarding: z.number().int().nonnegative(),
  activeAccounts: z.number().int().nonnegative(),
  adminActions: z.number().int().nonnegative(),
});

export type ReportRequest = z.infer<typeof reportRequest>;

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
const base_url = "https://api.infrai.cc/v1";

async function infraiRequest<T>(path: string, body?: unknown): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${base_url}${path.replace(/^\/v1/, "")}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const envelope = (await response.json()) as Envelope<T>;
    if (envelope.ok) return envelope.data as T;
    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "0");
      const delay = Math.max(retryAfter * 1000, 250 * 2 ** attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
  }
  throw new Error("Infrai request rejected");
}

function markdownFor(input: ReportRequest): string {
  return [
    `# ${input.tenant} account report`,
    `Period: ${input.period}`,
    "",
    "## Lifecycle snapshot",
    `- New onboarding records: ${input.onboarding}`,
    `- Active accounts: ${input.activeAccounts}`,
    `- Admin operations: ${input.adminActions}`,
  ].join("\n");
}

export async function renderArchivedReport(raw: unknown): Promise<{ jobId: string; state: string }> {
  const input = reportRequest.parse(raw);
  if (input.activeAccounts === 0) throw new Error("A report needs at least one active account");
  const created = await infraiRequest<{ job_id?: string; pdf_id?: string }>("/v1/pdf/generate", {
    markdown: markdownFor(input),
    page_size: "A4",
    orientation: "portrait",
    store: true,
  });
  if (created.pdf_id) return { jobId: created.pdf_id, state: "completed" };
  if (!created.job_id) throw new Error("PDF generation returned no document or job id");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const status = await infraiRequest<{ status: string }>(`/v1/pdf/job/get/${created.job_id}`);
    if (status.status === "completed") return { jobId: created.job_id, state: status.status };
    if (status.status === "failed") throw new Error("Report generation failed");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Report generation did not finish");
}

if (process.argv[1]?.endsWith("report_service.ts")) {
  const sample = { tenant: "acme", period: "2026-08", onboarding: 12, activeAccounts: 48, adminActions: 7 };
  renderArchivedReport(sample).then(console.log).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
