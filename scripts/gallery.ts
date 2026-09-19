import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * One page showing every frame: the v9 design beside what the app actually renders.
 *
 * The migration produces three separate records — a JSON ledger, a markdown report, and 97
 * loose PNGs — and none of them answers the question a person actually asks, which is "show
 * me what it looks like now". This does.
 *
 * Written to docs/migration/gallery.html and opened straight from disk; the images are
 * referenced relatively, so it needs no server.
 *
 *   pnpm gallery
 */

const ROOT = process.cwd();
const OUT = join(ROOT, 'docs', 'migration', 'gallery.html');
const SHOTS = join(ROOT, 'docs', 'migration', 'screenshots');

interface FrameStatus {
  frame: string;
  name: string;
  status: string;
  changedPct: number | null;
}

interface Deviation {
  id: number;
  class: string;
  frames: string[];
  summary: string;
  status: string;
}

const DONE = new Set(['APPROVED-DEVIATION', 'MATCHED']);

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function main() {
  const frames: FrameStatus[] = JSON.parse(
    await readFile(join(ROOT, 'docs', 'migration', 'frame-status.json'), 'utf8'),
  );
  const ledger = JSON.parse(
    await readFile(join(ROOT, 'docs', 'migration', 'deviations.json'), 'utf8'),
  ) as { deviations: Deviation[] };

  const byFrame = new Map<string, Deviation[]>();
  for (const d of ledger.deviations) {
    for (const f of d.frames) {
      if (f === '*') continue;
      byFrame.set(f, [...(byFrame.get(f) ?? []), d]);
    }
  }

  const done = frames.filter((f) => DONE.has(f.status));
  const rest = frames.filter((f) => !DONE.has(f.status));

  const card = (f: FrameStatus) => {
    // Side-by-side if the fidelity run produced one; otherwise whatever we have.
    const sbs = `screenshots/fidelity/${f.frame}-sbs.png`;
    const ref = `screenshots/v9-reference/${f.frame}.png`;
    const img = existsSync(join(SHOTS, 'fidelity', `${f.frame}-sbs.png`))
      ? sbs
      : existsSync(join(SHOTS, 'v9-reference', `${f.frame}.png`))
        ? ref
        : null;
    const notes = (byFrame.get(f.frame) ?? []).filter((d) => d.status !== 'fixed');

    return `<article class="frame" id="${f.frame}">
  <header>
    <h3>${esc(f.frame)} <span class="nm">${esc(f.name)}</span></h3>
    <span class="tag ${DONE.has(f.status) ? 'ok' : 'todo'}">${esc(f.status)}</span>
  </header>
  ${img ? `<img loading="lazy" src="${img}" alt="${esc(f.frame)} — design beside implementation">` : '<p class="none">No capture — this surface is not built yet.</p>'}
  ${
    notes.length
      ? `<ul class="devs">${notes
          .map((d) => `<li><b>#${d.id}</b> ${esc(d.summary)}</li>`)
          .join('')}</ul>`
      : ''
  }
</article>`;
  };

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>OdoVox v9 → v10 — every frame</title>
<style>
  :root { --ink:#1F2A23; --mute:rgba(31,42,35,.55); --line:rgba(31,42,35,.12); --bg:#F6F7F2; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
         font:15px/1.5 ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif; }
  header.top { padding:32px 24px 20px; border-bottom:1px solid var(--line); }
  h1 { margin:0 0 6px; font-size:26px; letter-spacing:-.02em; }
  .sub { color:var(--mute); font-size:14px; }
  .counts { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }
  .counts span { background:#fff; border:1px solid var(--line); border-radius:999px;
                 padding:5px 12px; font-size:12px; font-weight:700; }
  h2 { margin:32px 24px 4px; font-size:13px; letter-spacing:.06em; color:var(--mute); }
  .grid { display:grid; gap:20px; padding:16px 24px 40px;
          grid-template-columns:repeat(auto-fill,minmax(440px,1fr)); }
  .frame { background:#fff; border:1px solid var(--line); border-radius:14px; overflow:hidden; }
  .frame header { display:flex; align-items:center; gap:10px; padding:12px 14px;
                  border-bottom:1px solid var(--line); }
  .frame h3 { margin:0; font-size:14px; font-weight:800; flex:1; }
  .nm { font-weight:500; color:var(--mute); margin-left:6px; }
  .tag { font-size:10px; font-weight:800; letter-spacing:.05em; padding:3px 8px;
         border-radius:999px; white-space:nowrap; }
  .tag.ok { background:#E8F2E4; color:#2E6B43; }
  .tag.todo { background:rgba(31,42,35,.06); color:var(--mute); }
  .frame img { display:block; width:100%; height:auto; background:var(--bg); }
  .none { margin:0; padding:26px 14px; color:var(--mute); font-size:13px; text-align:center; }
  .devs { margin:0; padding:10px 14px 12px 30px; font-size:12.5px; color:var(--mute); }
  .devs li { margin:3px 0; }
  @media (prefers-color-scheme: dark) {
    :root { --ink:#E9EDE6; --mute:rgba(233,237,230,.6); --line:rgba(233,237,230,.14); --bg:#141815; }
    .frame, .counts span { background:#1B201C; }
    .tag.ok { background:#1E3A28; color:#9BD8AE; }
  }
</style></head><body>
<header class="top">
  <h1>OdoVox — v9 → v10</h1>
  <p class="sub">Each image is the v9 design on the left and what the app renders on the right.</p>
  <div class="counts">
    <span>${done.length} / 81 complete</span>
    ${Object.entries(
      frames.reduce<Record<string, number>>(
        (a, f) => ({ ...a, [f.status]: (a[f.status] ?? 0) + 1 }),
        {},
      ),
    )
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `<span>${esc(k)} ${v}</span>`)
      .join('')}
  </div>
</header>

<h2>COMPLETE — ${done.length}</h2>
<div class="grid">${done.map(card).join('')}</div>

<h2>REMAINING — ${rest.length}</h2>
<div class="grid">${rest.map(card).join('')}</div>
</body></html>
`;

  await writeFile(OUT, html, 'utf8');
  process.stdout.write(`gallery → ${OUT}\n  ${done.length} complete, ${rest.length} remaining\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
