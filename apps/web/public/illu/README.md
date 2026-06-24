# Illustration assets

These are **placeholder** 1×1 transparent PNGs. Replace each with the real
AI-generated render at **1024×1024, transparent background**. Until you do,
`<MascotMoment>` shows a graceful inline-SVG placeholder of Odo, and
`<DecorativeArt>` shows nothing (the transparent PNG).

Keep the **filenames exactly as-is** — they are referenced by CSS variables in
`packages/ui/src/tokens.css` (`--illu-mascot-*`, `--illu-object-*`).

## Mascot (Odo) — `illu/mascot/`
| File | Pose | Used on |
| --- | --- | --- |
| `odo-hero.png` | arms raised welcome | splash, onboarding slide 1 |
| `odo-smile.png` | gentle closed-mouth smile | onboarding slide 2, small success |
| `odo-celebrate.png` | both arms up, confetti | clinic created / `/done` |
| `odo-thinking.png` | hand under chin | empty list states, error fallback |
| `odo-sleeping.png` | eyes closed, ZZZ | no-data / off-hours states |

## Objects — `illu/objects/`
`tooth.png`, `xray-film.png`, `dental-mirror.png`, `pill-bottle.png`, `clipboard.png`

**The exact generation prompts + the consistency technique (one reference image,
Midjourney `--cref`) live in `docs/design-system.md` §13.**
