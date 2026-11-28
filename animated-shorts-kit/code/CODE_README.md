# Reference code — a working mini studio (Three.js + @react-three/fiber + Remotion, TypeScript)
Tested: installs, type-checks, passes the checkers and renders the example video.

## Run it
1. Install Node.js (LTS) from nodejs.org.
2. Mac: double-click `render.command` (installs once, runs the checks, renders to `out/`).
   Any OS: `npm install` → `npm run gates` → `npm run still` (one frame) → `npm run preview` (video).
3. Edit live: `npm run studio`.
Rendering happens on your own computer (fast). Don't render on a cloud machine.

## Make your own video
Copy `src/videos/01_example` to `src/videos/02_my_story`, then edit:
timeline.ts (words + shots; generated from your voice with `src/engine/tools/timeline.py`), stage.ts (who stands where),
takes.ts (camera), set.tsx (which sets/props), look.ts (story mood). Then run render.command and pick it.

| path | what |
|---|---|
| src/engine/chars/charparts.ts | 20 characters (LOOKS, SHAPES), body parts, faces, 16 expressions |
| src/engine/chars/rig.tsx | character rig: poses, walk, grips (cart handle), carrying, gaze, mouth |
| src/engine/kits/grocery/store.tsx | grocery interior + shop front + shopping cart + extras |
| src/engine/kits/downtown/* | 1930s street block (28 shops), cars, parking meters, street clock |
| src/engine/look/draw.ts | procedural textures (brick, tiles, wallpaper, signs, labels, coins, clock…) |
| src/engine/look/look.ts | BASIC look: flat toon ramp, one light rig, plain sky |
| src/engine/render/Video.tsx | BASIC render: lights + set + characters + captions |
| src/engine/core/* | clock (shots/words → frames), staging (paths, cars, seats, auto-gaze) |
| src/engine/camera/* | framing solver + continuous camera "takes" |
| src/engine/check/* | logic checker, framing checker, hard gates |
| src/engine/tools/* | timeline.py (voice words → timeline), sheet.py (contact sheets), align.py, sbs.py |

Not included: the premium look (ink outlines on sets, grading, AO, bloom, depth of field) — that is a separate kit.
