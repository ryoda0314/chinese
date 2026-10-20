import { notFound } from "next/navigation";
import { currentJob, JOBS } from "@/lib/admin";

// The running (or last) job, for the admin page to follow. Development only.
export async function GET() {
  if (process.env.NODE_ENV !== "development") notFound();
  const job = currentJob();
  return Response.json(job ? { ...job, label: JOBS[job.kind].label } : null, { headers: { "cache-control": "no-store" } });
}
