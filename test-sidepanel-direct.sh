#!/bin/bash

# Test side panel UI by serving it directly

EXTENSION_PATH="/workspace/packages/extension/dist"
OUTPUT_DIR="/workspace/test-output"
DISPLAY_NUM=99

# Clean up any existing processes
pkill -9 Xvfb 2>/dev/null || true
pkill -9 chrome 2>/dev/null || true
pkill -9 ffmpeg 2>/dev/null || true
pkill -9 python 2>/dev/null || true
sleep 1

# Start virtual frame buffer
Xvfb :$DISPLAY_NUM -screen 0 1280x800x24 &
XVFB_PID=$!
sleep 2

export DISPLAY=:$DISPLAY_NUM

# Start a simple HTTP server to serve the built extension files
cd "$EXTENSION_PATH"
python3 -m http.server 8080 &
HTTP_PID=$!
sleep 2

# Create Chrome profile directory
PROFILE_DIR="/tmp/chrome-test-profile3"
rm -rf "$PROFILE_DIR"
mkdir -p "$PROFILE_DIR"

# Function to take screenshot with ffmpeg
take_screenshot() {
    ffmpeg -y -f x11grab -video_size 1280x800 -i :$DISPLAY_NUM -frames:v 1 "$1" 2>/dev/null
}

# Start screen recording
ffmpeg -y -f x11grab -video_size 1280x800 -framerate 15 -i :$DISPLAY_NUM \
    -c:v libx264 -preset ultrafast -crf 25 \
    "$OUTPUT_DIR/sidepanel-direct-test.mp4" &
FFMPEG_PID=$!
sleep 1

echo "Starting Chrome..."

# Launch Chrome opening the sidepanel HTML directly
# Also load extension so we can see the actual extension behavior
google-chrome \
    --no-sandbox \
    --disable-gpu \
    --disable-dev-shm-usage \
    --user-data-dir="$PROFILE_DIR" \
    --load-extension="$EXTENSION_PATH" \
    --window-size=400,700 \
    --window-position=0,0 \
    --no-first-run \
    --disable-default-apps \
    "http://localhost:8080/sidepanel.html" &
CHROME_PID=$!

sleep 5
take_screenshot "$OUTPUT_DIR/direct-1-sidepanel-view.png"

sleep 2
take_screenshot "$OUTPUT_DIR/direct-2-sidepanel-view.png"

# Cleanup
echo "Stopping recording..."
kill $CHROME_PID 2>/dev/null || true
sleep 1
kill $FFMPEG_PID 2>/dev/null || true
kill $HTTP_PID 2>/dev/null || true
kill $XVFB_PID 2>/dev/null || true

echo "Test complete. Output in $OUTPUT_DIR"
ls -la "$OUTPUT_DIR/"
