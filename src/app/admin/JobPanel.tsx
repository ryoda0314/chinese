"use client";

import { useEffect, useState, useTransition } from "react";
import type { Job, JobKind } from "@/lib/admin";
import { runJob } from "./actions";
import styles from "./admin.module.css";

type Shown = (Job & { label: string }) | null;

/** The pipeline steps as buttons, and the running (or last) one with its log, followed every second while it runs. */
export function JobPanel({ jobs }: { jobs: { kind: JobKind; label: string; note: string }[] }) {
  const [job, setJob] = useState<Shown>(null);
  const [pending, start] = useTransition();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    const poll = async () => {
      const next = (await fetch("/admin/job", { cache: "no-store" }).then((r) => r.json())) as Shown;
      if (live) setJob(next);
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 1000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [tick]);

  const running = job?.status === "running";
  return (
    <>
      <div className={styles.jobs}>
        {jobs.map((j) => (
          <div key={j.kind} className={styles.job}>
            <button
              type="button"
              className={`${styles.button} ${styles.primary}`}
              disabled={running || pending}
              onClick={() =>
                start(async () => {
                  await runJob(j.kind);
                  setTick((n) => n + 1);
                })
              }
            >
              {j.label}
            </button>
            <p>{j.note}</p>
          </div>
        ))}
      </div>
      {job ? (
        <section className={styles.section}>
          <p className={styles.status} data-state={job.status}>
            {job.label}：
            {job.status === "running"
              ? `動いています（${job.step}）`
              : job.status === "done"
                ? "終わりました"
                : "止まりました"}
          </p>
          <pre className={styles.log}>{job.log.join("\n")}</pre>
        </section>
      ) : null}
    </>
  );
}
