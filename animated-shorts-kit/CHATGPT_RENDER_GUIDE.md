# How ChatGPT renders with the animated-shorts-kit (via the MCP bridge)

The kit lives in this repo at `animated-shorts-kit/code/` (Three.js + React Three
Fiber + Remotion 4, TypeScript). Rendering runs on GitHub Actions — never inside
ChatGPT's own sandbox (npm install alone needs ~1 minute and ~1 GB; the sandbox
kills it at 90 s). Use the bridge tools in this exact order:

## Render one frame (still)

1. `workflow_dispatch`
   - workflow: `kit-render.yml`
   - ref: `main`
   - inputs: `video` = scene folder under `animated-shorts-kit/code/src/videos/`
     (e.g. `01_example`), `frame` = frame number (e.g. `60`),
     `comp` = `Preview` (540x960) or `Video` (1080x1920), `mode` = `still`
2. `workflow_runs_list` → find the newest `kit-render.yml` run; poll
   `workflow_run_view` every minute or so until `status` is `completed`
   (a still usually takes ~4-8 minutes including dependency install).
3. `release_list` → the newest release is tagged `kit-<video>-run<run number>`.
   Its asset `frame.png` has a `download_url` — open it to see the real frame.

For a full video instead: same steps with `mode` = `video`; the release asset
is `video.mp4`.

## Making or editing a scene

- A scene is a folder `animated-shorts-kit/code/src/videos/<name>/` containing
  `timeline.ts` (words + shots), `stage.ts` (blocking), `takes.ts` (camera),
  `set.tsx` (sets/props from `src/engine/kits/*`), `look.ts` (mood).
- Start from `01_example`: read its files with `file_read`, then write the new
  folder's files with `file_create_or_update` (branch + PR, or `allow_main`
  when told). Characters: `src/engine/chars/` (20 rigs). Sets:
  `src/engine/kits/downtown/` (1930s street) and `src/engine/kits/grocery/`.
- The `video` dispatch input must exactly match the scene folder name.

## If a run fails

Do not guess. Report the run URL from `workflow_run_view` — the failing step's
log is visible on that page, and Muse can read it and fix the scene code.
