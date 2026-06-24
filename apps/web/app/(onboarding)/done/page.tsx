'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Share2 } from 'lucide-react';
import { MobileShell } from '@/components/mobile-shell';
import { GlassCard } from '@/components/ds';
import { MascotMoment } from '@/components/illustrations';
import { Button } from '@/components/ui/button';
import { useClinicResult } from '@/lib/clinic-result-store';
import { copyToClipboard } from '@/lib/clipboard';
import { shareViaWhatsApp } from '@/lib/whatsapp';

const CONFETTI_COLORS = [
  'bg-lime',
  'bg-peach',
  'bg-sky',
  'bg-sage',
  'bg-lavender',
  'bg-lime',
  'bg-peach',
  'bg-sky',
  'bg-sage',
  'bg-lavender',
  'bg-lime',
  'bg-peach',
];

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-28 flex justify-center" aria-hidden>
      {CONFETTI_COLORS.map((color, i) => {
        const angle = (i / CONFETTI_COLORS.length) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            className={`absolute size-2.5 rounded-pill ${color}`}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: Math.cos(angle) * 140,
              y: Math.sin(angle) * 140 + 40,
              opacity: 0,
              scale: 0.5,
            }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />
        );
      })}
    </div>
  );
}

export default function DonePage() {
  const router = useRouter();
  const { clinicName, city, joinCode, clear } = useClinicResult();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!joinCode) router.replace('/home');
  }, [joinCode, router]);

  if (!joinCode) return null;

  const onCopy = async () => {
    const okFlag = await copyToClipboard(joinCode);
    if (okFlag) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const onShare = () => {
    shareViaWhatsApp(
      `Join our clinic on Odovox with code ${joinCode}. Download: https://odovox.app`,
    );
  };

  const onContinue = () => {
    clear();
    router.replace('/home');
  };

  return (
    <MobileShell className="px-7">
      <Confetti />
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 16 }}
          className="flex flex-col items-center"
        >
          <MascotMoment pose="celebrate" size="xl" animation="bounce-in" background="cream" />
          <h1 className="mt-4 text-[28px] font-semibold leading-tight tracking-tight text-ink">
            Your clinic is live
          </h1>
          <p className="mt-1.5 text-base text-muted-foreground">
            {clinicName}
            {city ? ` · ${city}` : ''}
          </p>
        </motion.div>

        <GlassCard tone="light" border="soft" className="mt-8 w-full p-6 shadow-lime-glow">
          <p className="text-xs font-medium uppercase tracking-widest text-ink/60">Join code</p>
          <p className="mt-2 font-mono text-[56px] font-semibold leading-none tracking-[0.2em] text-ink">
            {joinCode}
          </p>
        </GlassCard>

        <div className="mt-6 rounded-xl border border-border bg-surface p-4 shadow-soft">
          <QRCodeSVG value={`odovox://join?code=${joinCode}`} size={132} bgColor="#ffffff" fgColor="#0a0a0a" />
        </div>

        <div className="mt-6 flex w-full gap-3">
          <Button variant="ghost" className="flex-1" onClick={onCopy}>
            {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
            {copied ? 'Copied' : 'Copy code'}
          </Button>
          <Button variant="ghost" className="flex-1 bg-sage-soft text-ink hover:bg-sage-soft/80" onClick={onShare}>
            <Share2 className="size-4" />
            WhatsApp
          </Button>
        </div>

        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
          Anyone with this code joins your clinic. You can rotate it later in Clinic → Settings.
        </p>
      </div>

      <div className="pb-8 pt-2">
        <Button size="lg" className="w-full" onClick={onContinue}>
          Continue to Odovox
        </Button>
      </div>
    </MobileShell>
  );
}
