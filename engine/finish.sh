#!/usr/bin/env bash
# Encode frames + mix -> mp4, then QA.   bash finish.sh "Title Of Short"
set -e; T="${1:-short}"; F="out/${T// /-}.mp4"
# Fallback: a project may ship its audio as base64 text (binary files cannot be pushed via the API).
# Only triggers when no mix_raw.wav was downloaded AND the manifest's project has a .b64 file.
if [ ! -f mix_raw.wav ] && [ -f render.json ]; then
  P=$(python3 -c "import json;print(json.load(open('render.json'))['project'])" 2>/dev/null || true)
  if [ -n "$P" ] && [ -f "projects/$P/audio/mix.ogg.b64" ]; then
    base64 -d "projects/$P/audio/mix.ogg.b64" > mix_src.ogg
    echo "decoded projects/$P/audio/mix.ogg.b64 -> mix_src.ogg ($(stat -c%s mix_src.ogg) bytes)"
  elif [ -n "$P" ] && [ -f "projects/$P/audio/mix_raw.b64" ]; then
    base64 -d "projects/$P/audio/mix_raw.b64" > mix_raw.wav
    echo "decoded projects/$P/audio/mix_raw.b64 -> mix_raw.wav ($(stat -c%s mix_raw.wav) bytes)"
  elif [ -n "$P" ] && ls projects/$P/audio/mix_raw.b64.part* >/dev/null 2>&1; then
    cat projects/$P/audio/mix_raw.b64.part* | base64 -d > mix_raw.wav
    echo "decoded projects/$P/audio/mix_raw.b64.part* -> mix_raw.wav ($(stat -c%s mix_raw.wav) bytes)"
  fi
fi
# CI bootstrap: GitHub runners may lack ffmpeg/ffprobe — install via apt (fast mirror), fallback to static build.
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found - installing via apt..."
  sudo apt-get update -qq && sudo apt-get install -y -qq ffmpeg || true
fi
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "apt failed - downloading static build..."
  curl -sL --retry 3 -o /tmp/ffmpeg-static.tar.xz "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"
  tar -xJf /tmp/ffmpeg-static.tar.xz -C /tmp
  export PATH="$(ls -d /tmp/ffmpeg-*-amd64-static | head -1):$PATH"
fi
ffmpeg -version | head -1
# Opus-shipped audio (mix.ogg.b64 route) converts to WAV here, once ffmpeg exists.
if [ ! -f mix_raw.wav ] && [ -f mix_src.ogg ]; then
  ffmpeg -v error -y -i mix_src.ogg -ac 1 -ar 48000 mix_raw.wav
  echo "converted mix_src.ogg -> mix_raw.wav ($(stat -c%s mix_raw.wav) bytes)"
fi
ffmpeg -v error -y -i mix_raw.wav -af "loudnorm=I=-14:TP=-1.5:LRA=7" -ar 48000 -ac 2 mix.wav
ffmpeg -v error -y -framerate 30 -i frames/f%04d.jpg -i mix.wav -map 0:v:0 -map 1:a:0 -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart "$F"
ffprobe -v error -show_entries format=duration -show_entries stream=width,height,r_frame_rate -of compact "$F"
echo "--- QA (empty = no black/frozen spans)"; ffmpeg -i "$F" -vf "freezedetect=n=0.0005:d=0.4,blackdetect=d=0.05" -an -f null - 2>&1 | grep -E "freeze_start|black_start" || true
ffmpeg -i "$F" -af ebur128 -f null - 2>&1 | grep -E "^\s+I:" | tail -1
ffmpeg -v error -y -i "$F" -vf "fps=2,scale=180:-1,tile=10x4" -frames:v 1 out/qa_sheet.jpg; echo "$F"
