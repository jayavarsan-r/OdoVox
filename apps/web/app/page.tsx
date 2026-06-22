import {
  Activity,
  CalendarDays,
  ChevronRight,
  FlaskConical,
  IndianRupee,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { VoiceButton } from '@/components/ui/voice-button';
import { cn } from '@/lib/utils';

const SWATCHES: { name: string; varName: string; hex: string; dark?: boolean }[] = [
  { name: 'Ink', varName: '--color-ink', hex: '#0A0A0A', dark: true },
  { name: 'Ink Soft', varName: '--color-ink-soft', hex: '#1A1A1A', dark: true },
  { name: 'Paper', varName: '--color-paper', hex: '#FAFAFA' },
  { name: 'Paper Warm', varName: '--color-paper-warm', hex: '#F5F5F7' },
  { name: 'Lime', varName: '--color-lime', hex: '#D4F564' },
  { name: 'Lime Soft', varName: '--color-lime-soft', hex: '#E8F8B5' },
  { name: 'Peach', varName: '--color-peach', hex: '#FFD4A3' },
  { name: 'Peach Soft', varName: '--color-peach-soft', hex: '#FFE8D1' },
  { name: 'Sky', varName: '--color-sky', hex: '#BFE3FF' },
  { name: 'Sky Soft', varName: '--color-sky-soft', hex: '#DFF1FF' },
  { name: 'Sage', varName: '--color-sage', hex: '#C8E6C9' },
  { name: 'Sage Soft', varName: '--color-sage-soft', hex: '#E3F2E4' },
  { name: 'Lavender', varName: '--color-lavender', hex: '#E0D4FF' },
  { name: 'Lavender Soft', varName: '--color-lavender-soft', hex: '#EFE9FF' },
  { name: 'Success', varName: '--color-success', hex: '#16A34A', dark: true },
  { name: 'Warning', varName: '--color-warning', hex: '#F59E0B', dark: true },
  { name: 'Danger', varName: '--color-danger', hex: '#DC2626', dark: true },
  { name: 'Info', varName: '--color-info', hex: '#2563EB', dark: true },
];

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-text-subtle">{title}</h2>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ToothChip({ number, status }: { number: number; status: string }) {
  const tone: Record<string, string> = {
    HEALTHY: 'bg-sage-soft text-ink border-sage',
    CARIES: 'bg-peach-soft text-ink border-peach',
    RCT: 'bg-lavender-soft text-ink border-lavender',
    CROWN: 'bg-sky-soft text-ink border-sky',
  };
  return (
    <div
      className={cn(
        'flex w-14 flex-col items-center rounded-md border px-2 py-1.5',
        tone[status] ?? 'bg-paper-warm text-ink border-border',
      )}
    >
      <span className="font-mono text-sm font-semibold">{number}</span>
      <span className="text-[10px] uppercase tracking-wide opacity-70">{status}</span>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={cn('flex size-11 items-center justify-center rounded-md text-ink', accent)}
          aria-hidden
        >
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function PatientRow({
  initials,
  name,
  code,
  meta,
  tone,
}: {
  initials: string;
  name: string;
  code: string;
  meta: string;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-muted">
      <Avatar>
        <AvatarFallback className={tone}>{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{name}</p>
          <span className="font-mono text-[11px] text-text-subtle">{code}</span>
        </div>
        <p className="truncate text-xs text-muted-foreground">{meta}</p>
      </div>
      <ChevronRight className="size-4 text-text-subtle" />
    </div>
  );
}

export default function ShowcasePage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-mobile px-5 py-10 sm:max-w-3xl">
      {/* Wordmark */}
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">
            Odo<span className="text-lime [text-shadow:0_1px_0_rgba(0,0,0,0.15)]">vox</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Voice-first dental clinic OS</p>
        </div>
        <Badge variant="outline" className="font-mono">
          Phase 0
        </Badge>
      </header>

      <div className="space-y-12">
        {/* Colors */}
        <Section title="Color tokens" subtitle="Soft, desaturated, dental-clinic friendly palette.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {SWATCHES.map((s) => (
              <div key={s.varName} className="overflow-hidden rounded-md border border-border">
                <div
                  className="flex h-16 items-end p-2"
                  style={{ backgroundColor: `var(${s.varName})` }}
                >
                  <span
                    className={cn(
                      'font-mono text-[11px]',
                      s.dark ? 'text-white/90' : 'text-ink/70',
                    )}
                  >
                    {s.hex}
                  </span>
                </div>
                <div className="bg-surface px-2 py-1.5 text-xs font-medium">{s.name}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Buttons */}
        <Section title="Buttons" subtitle="Variants and sizes.">
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
        </Section>

        {/* Surfaces */}
        <Section title="Surfaces & cards" subtitle="Elevation tokens on each background.">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="bg-surface">
              <CardHeader>
                <CardTitle className="text-base">Surface</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">shadow-card</CardContent>
            </Card>
            <Card className="bg-paper-warm shadow-soft">
              <CardHeader>
                <CardTitle className="text-base">Paper warm</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">shadow-soft</CardContent>
            </Card>
            <Card className="bg-ink text-paper shadow-hero">
              <CardHeader>
                <CardTitle className="text-base text-paper">Ink</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-paper/70">shadow-hero</CardContent>
            </Card>
          </div>
        </Section>

        {/* Voice button */}
        <Section title="Voice capture" subtitle="The mic button used across the app. Tap to toggle.">
          <Card>
            <CardContent className="flex justify-center py-8">
              <VoiceButton />
            </CardContent>
          </Card>
        </Section>

        {/* Tooth chips */}
        <Section title="Tooth chips" subtitle="FDI numbering with status tones.">
          <div className="flex flex-wrap gap-2">
            <ToothChip number={16} status="HEALTHY" />
            <ToothChip number={26} status="CROWN" />
            <ToothChip number={36} status="RCT" />
            <ToothChip number={46} status="CARIES" />
          </div>
        </Section>

        {/* Stat tiles */}
        <Section title="Stat tiles">
          <div className="grid grid-cols-2 gap-3">
            <StatTile
              icon={<Users className="size-5" />}
              label="Patients today"
              value="24"
              accent="bg-peach"
            />
            <StatTile
              icon={<CalendarDays className="size-5" />}
              label="Appointments"
              value="11"
              accent="bg-sky"
            />
            <StatTile
              icon={<IndianRupee className="size-5" />}
              label="Collected"
              value="₹18,400"
              accent="bg-lime"
            />
            <StatTile
              icon={<FlaskConical className="size-5" />}
              label="Lab cases"
              value="3"
              accent="bg-lavender"
            />
          </div>
        </Section>

        {/* Patient list */}
        <Section title="Patient list row">
          <Card>
            <CardContent className="p-2">
              <PatientRow
                initials="MN"
                name="Meera Nair"
                code="PT-0001"
                meta="34 • Female • O+ • Penicillin allergy"
                tone="bg-peach-soft text-ink"
              />
              <Separator />
              <PatientRow
                initials="AR"
                name="Arjun Reddy"
                code="PT-0002"
                meta="28 • Male • B+"
                tone="bg-sky-soft text-ink"
              />
              <Separator />
              <PatientRow
                initials="FS"
                name="Fatima Sheikh"
                code="PT-0003"
                meta="45 • Female • A+ • Diabetes"
                tone="bg-sage-soft text-ink"
              />
            </CardContent>
          </Card>
        </Section>

        {/* Badges */}
        <Section title="Status badges">
          <div className="flex flex-wrap gap-2">
            <Badge>Active</Badge>
            <Badge variant="success">
              <Activity className="size-3" /> Healthy
            </Badge>
            <Badge variant="info">Scheduled</Badge>
            <Badge variant="warning">Low stock</Badge>
            <Badge variant="destructive">No-show</Badge>
            <Badge variant="outline">Draft</Badge>
          </div>
        </Section>

        <footer className="pt-4 text-center text-xs text-text-subtle">
          Odovox design system · tokens served from{' '}
          <code className="font-mono">@odovox/ui</code>
        </footer>
      </div>
    </main>
  );
}
