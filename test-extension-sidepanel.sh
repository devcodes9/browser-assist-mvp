#!/bin/bash

# Test extension side panel UI with screen recording

EXTENSION_PATH="/workspace/packages/extension/dist"
OUTPUT_DIR="/workspace/test-output"
DISPLAY_NUM=99

# Clean up any existing processes
pkill -9 Xvfb 2>/dev/null || true
pkill -9 chrome 2>/dev/null || true
pkill -9 ffmpeg 2>/dev/null || true
sleep 1

# Start virtual frame buffer  
Xvfb :$DISPLAY_NUM -screen 0 1280x800x24 &
XVFB_PID=$!
sleep 2

export DISPLAY=:$DISPLAY_NUM

# Create Chrome profile directory
PROFILE_DIR="/tmp/chrome-test-profile2"
rm -rf "$PROFILE_DIR"
mkdir -p "$PROFILE_DIR"

# Function to take screenshot with ffmpeg
take_screenshot() {
    ffmpeg -y -f x11grab -video_size 1280x800 -i :$DISPLAY_NUM -frames:v 1 "$1" 2>/dev/null
}

# Start screen recording
ffmpeg -y -f x11grab -video_size 1280x800 -framerate 15 -i :$DISPLAY_NUM \
    -c:v libx264 -preset ultrafast -crf 25 \
    "$OUTPUT_DIR/sidepanel-ui-test.mp4" &
FFMPEG_PID=$!
sleep 1

echo "Starting Chrome with extension..."

# Launch Chrome with the extension - go to extensions page first
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
    --disable-popup-blocking \
    "chrome://extensions/" &
CHROME_PID=$!

sleep 5
take_screenshot "$OUTPUT_DIR/sp-1-extensions-page.png"

# Click somewhere to close any popups
xdotool mousemove 640 400 click 1
sleep 1

# Navigate to example.com
xdotool key --clearmodifiers ctrl+l
sleep 0.5
xdotool type "https://example.com"
xdotool key Return
sleep 4

take_screenshot "$OUTPUT_DIR/sp-2-example-page.png"

# Look for the extension puzzle icon in toolbar (usually at ~1185, 50 based on typical Chrome layout)
# First, let's click on the extensions puzzle piece icon
xdotool mousemove 1185 50 click 1
sleep 2

take_screenshot "$OUTPUT_DIR/sp-3-extensions-menu.png"

# Now click on "Browser Assist AI" extension in the dropdown
# The first extension would typically be around y=110 in the popup
xdotool mousemove 1100 140 click 1  
sleep 2

take_screenshot "$OUTPUT_DIR/sp-4-after-extension-click.png"

# Try to interact with side panel if open
sleep 2
take_screenshot "$OUTPUT_DIR/sp-5-final-state.png"

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
