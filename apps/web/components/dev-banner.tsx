'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const DISMISS_KEY = 'odovox-dev-banner-dismissed';
const isDev = process.env.NODE_ENV !== 'production';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Thin dev-only banner with the mock OTP + API target. Dismissable per session. */
export function DevBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isDev && sessionStorage.getItem(DISMISS_KEY) !== '1') setShow(true);
  }, []);

  if (!isDev || !show) return null;

  const host = API_URL.replace(/^https?:\/\//, '');
  return (
    <div className="flex h-6 items-center justify-center gap-2 bg-glass-dark px-3 font-mono text-[11px] text-lime backdrop-blur-glass-sm">
      <span>DEV MODE · OTP: 123456 · API: {host}</span>
      <button
        type="button"
        aria-label="Dismiss dev banner"
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, '1');
          setShow(false);
        }}
        className="ml-1 opacity-70 transition-opacity hover:opacity-100"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
