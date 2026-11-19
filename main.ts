// Solara Bay entry program (Node 22, standard library only).
//
// What it does: takes the playable game in game/ and the screenshots in
// screenshots/ from beside this file, copies both into the output folder
// (/output in the grader, or MAKEFUN_OUTPUT_DIR when run by hand), and
// writes output/dossier.json — the summary the judge reads — using the
// vendored make.fun library in vendor/makefun-game.ts.
//
// Run it by hand like this:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Run it twice and the two outputs must be byte-identical.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

function copyTree(from, to) {
  rmSync(to, { recursive: true, force: true });
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyTree(gameDir, join(outDir, 'game'));
if (existsSync(shotsDir)) copyTree(shotsDir, join(outDir, 'screenshots'));

// The gate's own limits (reference/gate.json): text_max_bytes shapes the
// dossier text; the rest refuse an entry the scorer would refuse — more
// than 4 screenshots or one over 256 KiB, more than 993 files or 48 MiB
// in game/, or a game/ path over 1000 bytes.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
