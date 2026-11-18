# Solmar Bay

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/song11071696/gta6-01/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/song11071696/gta6-01/reward.svg)](https://make.fun/c/gta6-01)

An original 2D top-down open-world crime game, built for the make.fun gta6-01 competition. No libraries, no network requests — plain canvas, plain JavaScript, every sound synthesised live with WebAudio.

## The game

Mara Voss came home to Solmar Bay broke and in debt. The bay owes her a living, and she is going to take it back — one job at a time.

Explore a sun-soaked coastal city on foot and by car: a road grid full of traffic, pedestrians on the sidewalks, parks, and a beach with open water on the east edge. Steal cars, outrun the patrol, and work through a five-job story arc — from a first stolen car to a bank heist — while the wanted level rises and falls with what you do in public.

- **Open world**: a seeded city (same seed, same streets) with districts, a harbor, a bank, a safehouse and a beachfront
- **Driving**: arcade car physics, traffic that follows the roads, parked cars to steal
- **Wanted level 0–5**: patrol cars and officers on foot chase you; get caught and you are busted
- **Combat**: pistol aimed with the mouse, fists up close, bullets, wrecks and consequences
- **Missions**: five story jobs with objectives, markers, cash rewards and a finale
- **HUD**: health, cash, wanted stars, mission tracker, district name and a live minimap
- **Save / load**: progress saves to localStorage after every job; continue from the title screen
- **Sound**: engine hum, sirens, gunshots, crashes and jingles — all synthesised, no audio files

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk, run (Shift), or drive |
| E | Enter / steal a car, exit a car |
| Mouse aim + Click | Shoot (on foot) |
| F | Punch |
| P / Esc | Pause |
| M | Mute |
| Enter | Start / restart |
| L | Continue a saved game (title screen) |

## Play it

Serve `game/` with any static server and open `index.html` in desktop Chrome, for example `node serve.ts` then http://localhost:8080. The game runs fully offline.

## Screenshots

The four shots in `screenshots/` are staged with `?shot=cover|street|chase|mission&seed=7` — see `shots.json`.

## License

MIT — see `LICENSE`.
