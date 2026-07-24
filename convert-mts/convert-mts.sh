#!/bin/bash

# --- Check for folder argument ---
if [ -z "$1" ]; then
  echo "❌ No folder provided."
  echo "Usage: $0 /path/to/folder"
  exit 1
fi

INPUT_DIR="$1"

# --- Validate folder ---
if [ ! -d "$INPUT_DIR" ]; then
  echo "❌ '$INPUT_DIR' is not a valid directory."
  exit 1
fi

echo "📁 Scanning for MTS files in: $INPUT_DIR"
echo "----------------------------------------"

shopt -s nullglob
FILES=("$INPUT_DIR"/*.MTS "$INPUT_DIR"/*.mts)

if [ ${#FILES[@]} -eq 0 ]; then
  echo "⚠️  No MTS files found."
  exit 0
fi

TOTAL=${#FILES[@]}
COUNT=0

for FILE in "${FILES[@]}"; do
  ((COUNT++))
  BASENAME=$(basename "$FILE" .MTS)
  BASENAME=$(basename "$BASENAME" .mts)
  OUTPUT="$INPUT_DIR/$BASENAME.mp4"

  echo ""
  echo "🎬 [$COUNT/$TOTAL] Converting: $FILE"
  echo "➡️  Output: $OUTPUT"

  ffmpeg -loglevel info -i "$FILE" -c:v libx264 -preset slow -crf 18 -c:a aac -b:a 192k "$OUTPUT"

  if [ $? -eq 0 ]; then
    echo "✅ Finished: $OUTPUT"
  else
    echo "❌ Error converting: $FILE"
  fi
done

echo ""
echo "🎉 All conversions complete."
