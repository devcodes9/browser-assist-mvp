#!/bin/bash

# Test extension UI with screen recording

EXTENSION_PATH="/workspace/packages/extension/dist"
OUTPUT_DIR="/workspace/test-output"
DISPLAY_NUM=99

# Clean up any existing processes
pkill -9 Xvfb 2>/dev/null || true
pkill -9 chrome 2>/dev/null || true
sleep 1

# Start virtual frame buffer
Xvfb :$DISPLAY_NUM -screen 0 1280x800x24 &
XVFB_PID=$!
sleep 2

export DISPLAY=:$DISPLAY_NUM

# Create Chrome profile directory
PROFILE_DIR="/tmp/chrome-test-profile"
rm -rf "$PROFILE_DIR"
mkdir -p "$PROFILE_DIR"

# Function to take screenshot with ffmpeg
take_screenshot() {
    ffmpeg -y -f x11grab -video_size 1280x800 -i :$DISPLAY_NUM -frames:v 1 "$1" 2>/dev/null
}

# Start screen recording
ffmpeg -y -f x11grab -video_size 1280x800 -framerate 15 -i :$DISPLAY_NUM \
    -c:v libx264 -preset ultrafast -crf 25 \
    "$OUTPUT_DIR/extension-ui-test.mp4" &
FFMPEG_PID=$!
sleep 1

echo "Starting Chrome with extension..."

# Launch Chrome with the extension
google-chrome \
    --no-sandbox \
    --disable-gpu \
    --disable-dev-shm-usage \
    --user-data-dir="$PROFILE_DIR" \
    --load-extension="$EXTENSION_PATH" \
    --window-size=1280,800 \
    --window-position=0,0 \
    --no-first-run \
    --disable-default-apps \
    "chrome://extensions/" &
CHROME_PID=$!

sleep 5

# Take a screenshot of extensions page
take_screenshot "$OUTPUT_DIR/screenshot-1-extensions.png"

# Navigate to a test page
xdotool key --clearmodifiers ctrl+l
sleep 0.5
xdotool type "https://example.com"
xdotool key Return
sleep 4

# Take screenshot
take_screenshot "$OUTPUT_DIR/screenshot-2-example.png"

# Try clicking the extension button in toolbar (approximate position)
# Extensions toolbar button is usually at top right
xdotool mousemove 1200 65 click 1
sleep 2

take_screenshot "$OUTPUT_DIR/screenshot-3-after-click.png"

# Try keyboard shortcut to trigger extension or side panel
xdotool key --clearmodifiers ctrl+shift+e
sleep 2

take_screenshot "$OUTPUT_DIR/screenshot-4-sidepanel.png"

sleep 3

# Cleanup
echo "Stopping recording..."
kill $CHROME_PID 2>/dev/null || true
sleep 1
kill $FFMPEG_PID 2>/dev/null || true
sleep 1
kill $XVFB_PID 2>/dev/null || true

echo "Test complete. Output in $OUTPUT_DIR"
ls -la "$OUTPUT_DIR/"
