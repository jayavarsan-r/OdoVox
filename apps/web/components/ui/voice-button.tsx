'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface VoiceButtonProps {
  recording?: boolean;
  onToggle?: (next: boolean) => void;
  className?: string;
  label?: string;
}

const BAR_COUNT = 5;

/**
 * The Odovox mic button — pulses and animates a waveform while "recording".
 * This pattern recurs throughout the app (consultation capture), so it's built now.
 */
export function VoiceButton({ recording = false, onToggle, className, label }: VoiceButtonProps) {
  const [internal, setInternal] = React.useState(recording);
  const isControlled = onToggle !== undefined;
  const isRecording = isControlled ? recording : internal;

  const toggle = () => {
    const next = !isRecording;
    if (isControlled) onToggle(next);
    else setInternal(next);
  };

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <motion.button
        type="button"
        onClick={toggle}
        aria-pressed={isRecording}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        whileTap={{ scale: 0.92 }}
        animate={
          isRecording
            ? { boxShadow: ['0 0 0 0 rgba(212,245,100,0.6)', '0 0 0 18px rgba(212,245,100,0)'] }
            : { boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }
        }
        transition={
          isRecording
            ? { duration: 1.4, repeat: Infinity, ease: 'easeOut' }
            : { duration: 0.24 }
        }
        className={cn(
          'relative flex size-20 items-center justify-center rounded-pill transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          isRecording ? 'bg-ink text-lime' : 'bg-lime text-ink',
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isRecording ? (
            <motion.span
              key="bars"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-end gap-1"
            >
              {Array.from({ length: BAR_COUNT }).map((_, i) => (
                <motion.span
                  key={i}
                  className="w-1 rounded-pill bg-lime"
                  animate={{ height: [6, 22, 10, 26, 8] }}
                  transition={{
                    duration: 0.9,
                    repeat: Infinity,
                    repeatType: 'mirror',
                    delay: i * 0.1,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </motion.span>
          ) : (
            <motion.span
              key="mic"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
            >
              <Mic className="size-7" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {isRecording ? (
          <>
            <Square className="size-3 fill-danger text-danger" /> Recording…
          </>
        ) : (
          (label ?? 'Tap to speak')
        )}
      </span>
    </div>
  );
}
