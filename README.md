[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/bilowoabill-spec/gta6-open-world/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/bilowoabill-spec/gta6-open-world/reward.svg)](https://make.fun/bounty/gta6-01)

# Solara Bay — An Open-World Crime Story

An original open-world crime game built for the [gta6-01 bounty](https://make.fun/bounty/gta6-01) on make.fun: "Make GTA 6".

Explore the fictional sun-soaked city of **Solara Bay** on foot and by car. Steal cars, outrun the Solara Bay Police Department as your wanted level rises, and run four story missions for Mama Rosa — from wheelman jobs to the Big Score at the Solara Bank.

## Features

- A living city: road grid, downtown, parks, marina and a beach, with traffic and pedestrians
- Drive any car (steal it with **E**), on-foot movement, shooting with the mouse
- Wanted level (0–5 stars) with police cars and foot cops who chase, ram and arrest
- 4 story missions with objectives, a minimap, HUD, toasts and mission banners
- Combat against armed thugs, car damage and wrecks, health and money
- Start screen, pause, game over / busted / win states, and localStorage saves
- Synthesized WebAudio sound: engine, sirens, gunshots, pickups and a music loop — no audio files

## Controls

- **WASD / arrows** — move on foot, drive
- **E** — enter / exit a car
- **Mouse + click** — aim and shoot
- **Shift** — sprint
- **P / Esc** — pause
- **M** — mute

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests: static files under `game/`, vanilla JavaScript and Canvas 2D.

## Entry

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the vendored make.fun library.

## License

MIT — see [LICENSE](LICENSE).
