"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { signInWithGoogle } from "@/lib/sync";
import styles from "./login.module.css";

type GoogleId = {
  initialize(options: {
    client_id: string;
    callback: (response: { credential: string }) => void;
    nonce: string;
    use_fedcm_for_prompt?: boolean;
    itp_support?: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

// ことのあめ's own Google client, as on its login page: Google hands the page an ID token and Supabase signs in with
// it, so a Google account made in ことのあめ is the same account here. This page's address has to be among the
// client's authorized JavaScript origins (Google Cloud console), or Google refuses to show the button.
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Google で続ける; nothing at all when the app has no Google client set. */
export function GoogleButton({ onDone, onError }: { onDone: () => void; onError: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID || !ready || !box.current || !window.google) return;
    const google = window.google.accounts.id;
    const parent = box.current;
    let cancelled = false;
    // A fresh nonce for this page: Google puts its hash in the token, Supabase checks it against the raw one.
    const raw = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
    void sha256Hex(raw).then((hashed) => {
      if (cancelled) return;
      google.initialize({
        client_id: CLIENT_ID,
        nonce: hashed,
        use_fedcm_for_prompt: true,
        itp_support: true,
        callback: async ({ credential }) => {
          if (await signInWithGoogle(credential, raw)) onDone();
          else onError();
        },
      });
      google.renderButton(parent, {
        type: "standard",
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
        locale: "ja",
        width: Math.min(400, Math.round(parent.offsetWidth)),
      });
    });
    return () => {
      cancelled = true;
    };
    // The callbacks are fresh functions each render; the button only needs setting up once the script is there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!CLIENT_ID) return null;
  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => setReady(true)} />
      <div ref={box} className={styles.google} />
    </>
  );
}
