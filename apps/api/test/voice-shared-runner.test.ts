import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { extractFromTranscript } from '../src/lib/ai/extractors/index.js';
import type { Extractor } from '../src/lib/ai/extractors/index.js';

/** Phase 9.7 W1.4 — the shared extractor runner: provider-selected, Zod-gated. */

interface DemoCtx {
  clinicId: string;
}
interface DemoOut {
  items: Array<{ name: string; quantity: number }>;
  notes: string | null;
}

const demoExtractor = (mock: (t: string) => unknown): Extractor<DemoOut, DemoCtx> => ({
  id: 'demo',
  promptVersion: 'demo-v1',
  buildSystemInstruction: (ctx) => `Extract items for clinic ${ctx.clinicId}.`,
  responseSchema: { type: 'OBJECT' },
  zodSchema: z.object({
    items: z.array(z.object({ name: z.string(), quantity: z.number().int().positive() })),
    notes: z.string().nullable(),
  }) as z.ZodType<DemoOut>,
  mockExtract: (t) => mock(t) as DemoOut,
});

describe('extractFromTranscript (shared runner)', () => {
  it('runs the mock provider and returns the Zod-parsed result', async () => {
    const extractor = demoExtractor((t) => ({
      items: [{ name: t.includes('gloves') ? 'Gloves' : 'Unknown', quantity: 100 }],
      notes: null,
    }));
    const out = await extractFromTranscript(extractor, 'bought 100 gloves', { clinicId: 'c1' });
    expect(out.items).toEqual([{ name: 'Gloves', quantity: 100 }]);
  });

  it('rejects an invalid provider shape with 502 EXTRACTION_FAILED (never half-parsed)', async () => {
    const extractor = demoExtractor(() => ({ items: [{ name: 'Gloves', quantity: -5 }], notes: null }));
    await expect(extractFromTranscript(extractor, 'anything', { clinicId: 'c1' })).rejects.toMatchObject({
      statusCode: 502,
      code: 'EXTRACTION_FAILED',
    });
  });
});
