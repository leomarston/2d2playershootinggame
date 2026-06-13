# RECOIL RUMBLE

A 2-player **knockout arena shooter** for the browser — a love letter to classic
platform-brawler flash games. There are no health bars: every bullet **shoves**
your opponent, and the only way to score is to blast them clean off the floating
islands. Last fighter standing wins.

Built with **zero dependencies and zero asset files** — every sprite, background,
sound effect and music note is generated procedurally with Canvas 2D and WebAudio.

## ▶ How to run

Just open `index.html` in any modern browser. That's it.

(Or serve it if you prefer: `npx serve .` / `python3 -m http.server` and open
`http://localhost:8000`.)

Want to review the art without playing? Open **`preview.html`** — a gallery that
renders all four fighters and all nine guns at large scale using the real game
drawing code.

## 🪖 Fighters

Chunky chibi troopers in the spirit of the genre — helmets, goggles, face masks,
tactical vests, knee pads and combat boots — each an original design in its own
team color:

- **Player 1 — Trooper:** combat helmet with goggles pushed up on the brim
- **Player 2 — Commando:** helmet + bandana mask, only the eyes showing
- **CPU — Ranger:** beret, glowing tactical goggles and a headset mic
- **CPU — Raider:** menacing full gas-mask with a breathing filter and glowing lenses

## 🎮 Controls

| Action | Player 1 | Player 2 |
| --- | --- | --- |
| Move | `A` / `D` | `←` / `→` |
| Jump / Double jump | `W` (press twice) | `↑` (press twice) |
| Fast fall | `S` | `↓` |
| Shoot (hold for auto) | `F` | `L` or `.` |
| Throw grenade | `G` | `K` or `,` |

Global: `P` or `Esc` — pause · `M` — mute · `Enter` — confirm / rematch

## 🕹 Gameplay

- **Knockback, not damage.** Bullets push enemies; heavier guns push harder.
  Shooting also recoils *you* backwards — use it to recover from a bad fall!
- **Double jump** is your lifeline. Knocked off the edge? Steer back and jump
  mid-air to recover.
- **Crates parachute in** carrying mystery weapons and powerups. Walk into one
  to grab it. Limited ammo — when you run dry you're back to the trusty pistol.
- **Grenades** (3 per life) bounce, blink, and send everyone flying — including
  you, so mind the blast radius. Rocket-jumping is absolutely a strategy.
- Fall off the sides or bottom and you lose a life. Fly off the **top** and
  you're still alive — watch your marker and steer back down.
- Modes: **1P vs CPU** (3 difficulty levels), **2P versus**, plus up to 2 extra
  AI bots for chaotic 4-fighter free-for-alls.

## 🔫 Arsenal

Pistol (infinite) · Dual Uzis · Assault Rifle · Shotgun · Magnum · Sniper ·
Minigun (spin-up!) · Rocket Launcher · Flamethrower

## ⭐ Powerups

Shield · Speed Boost · Mega Punch (knockback ×1.55) · Rapid Fire ·
Infinite Ammo · +3 Grenades

## 🗺 Maps

- **Sky Sanctum** — floating grass islands over a sunset sea of clouds
- **Frost Peak** — icy (slippery!) ledges, falling snow, aurora, and a moving platform
- **Temple Ruins** — torch-lit mossy stone in a firefly-filled night jungle

## 🧪 Tests

A headless smoke test stubs the DOM/canvas and drives hundreds of simulated
frames through menus, combat, every weapon, crates, KOs, victory and all maps:

```
node test/smoke.js
```

## 🏗 Architecture

| File | Role |
| --- | --- |
| `js/utils.js` | math, easing, color & canvas helpers |
| `js/audio.js` | WebAudio-synthesized SFX + chiptune music loop |
| `js/input.js` | keyboard/mouse with edge-triggered presses |
| `js/particles.js` | pooled particle system (sparks, smoke, casings, confetti, KO stars…) |
| `js/level.js` | map data + cached procedural backgrounds & platform art |
| `js/weapons.js` | weapon stats, gun art, bullets, grenades, crates, powerups |
| `js/player.js` | movement (coyote time, jump buffering), knockback, character renderer |
| `js/ai.js` | bot brain: platform navigation, recovery jumps, crate hunting |
| `js/game.js` | match flow, collisions, explosions, HUD, menus |
| `js/main.js` | boot, canvas scaling, main loop |

Game feel details worth stealing: squash & stretch on jump/land, screen-shake
with trauma decay, hit-sparks and shell casings, slow-mo on match point,
parachute respawns with brief invincibility, and an AI-vs-AI attract-mode demo
running behind the main menu.
