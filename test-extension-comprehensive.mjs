import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.join(__dirname, 'packages/extension/dist');
const outputDir = path.join(__dirname, 'test-output');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testExtension() {
    console.log('Starting comprehensive extension UI test...');
    console.log('Extension path:', extensionPath);

    // Start screen recording with ffmpeg
    const recordingPath = path.join(outputDir, 'extension-ui-demo.mp4');
    const ffmpegProc = spawn('ffmpeg', [
        '-y',
        '-f', 'x11grab',
        '-video_size', '1280x800',
        '-framerate', '15',
        '-i', ':99',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '25',
        recordingPath
    ], { stdio: 'ignore' });

    await sleep(1000);

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--window-size=1280,800',
            '--display=:99'
        ],
    });

    await sleep(3000);

    // Get extension ID
    const targets = await browser.targets();
    const extensionTarget = targets.find(target => 
        target.type() === 'service_worker' && 
        target.url().includes('chrome-extension://')
    );

    let extensionId = null;
    if (extensionTarget) {
        const match = extensionTarget.url().match(/chrome-extension:\/\/([^/]+)/);
        if (match) {
            extensionId = match[1];
            console.log('Extension ID:', extensionId);
        }
    }

    const pages = await browser.pages();
    let page = pages[0] || await browser.newPage();
    
    // 1. Show extensions page with our extension loaded
    console.log('Step 1: Showing extensions page...');
    await page.goto('chrome://extensions/', { waitUntil: 'networkidle2' });
    await sleep(3000);
    await page.screenshot({ path: path.join(outputDir, 'ui-1-extensions-page.png') });

    // 2. Navigate to example.com
    console.log('Step 2: Navigating to example.com...');
    await page.goto('https://example.com', { waitUntil: 'networkidle2' });
    await sleep(2000);
    await page.screenshot({ path: path.join(outputDir, 'ui-2-example-page.png') });

    // 3. Open sidepanel in a separate window (simulating side panel view)
    if (extensionId) {
        console.log('Step 3: Opening sidepanel UI...');
        const sidepanelPage = await browser.newPage();
        await sidepanelPage.setViewport({ width: 400, height: 700 });
        
        const sidepanelUrl = `chrome-extension://${extensionId}/sidepanel.html`;
        await sidepanelPage.goto(sidepanelUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await sleep(3000);
        
        // Screenshot of disconnected state
        await sidepanelPage.screenshot({ path: path.join(outputDir, 'ui-3-sidepanel-disconnected.png') });

        // 4. Try to interact with the UI
        console.log('Step 4: Testing UI interactions...');
        
        // Click reconnect button if available
        try {
            const reconnectBtn = await sidepanelPage.$('.reconnect-button');
            if (reconnectBtn) {
                console.log('Clicking reconnect button...');
                await reconnectBtn.click();
                await sleep(2000);
                await sidepanelPage.screenshot({ path: path.join(outputDir, 'ui-4-after-reconnect.png') });
            }
        } catch (e) {
            console.log('Reconnect button interaction:', e.message);
        }

        // 5. Show input interaction
        console.log('Step 5: Testing input field...');
        try {
            const input = await sidepanelPage.$('.message-input');
            if (input) {
                await input.click();
                await sleep(500);
                
                // Type a sample message
                await sidepanelPage.keyboard.type('Navigate to google.com');
                await sleep(1000);
                await sidepanelPage.screenshot({ path: path.join(outputDir, 'ui-5-typing-message.png') });
            }
        } catch (e) {
            console.log('Input interaction:', e.message);
        }

        // 6. Full page view with both browser and sidepanel concept
        console.log('Step 6: Final overview...');
        await sleep(2000);
        await sidepanelPage.screenshot({ path: path.join(outputDir, 'ui-6-final-sidepanel.png') });
    }

    // Wait a moment before cleanup
    await sleep(3000);

    console.log('Stopping recording...');
    ffmpegProc.kill('SIGINT');
    await sleep(2000);

    console.log('Test complete!');
    console.log('Screenshots and video saved to:', outputDir);
    
    // List output files
    const files = fs.readdirSync(outputDir);
    console.log('\nGenerated files:');
    files.forEach(f => {
        const stats = fs.statSync(path.join(outputDir, f));
        console.log(`  - ${f} (${Math.round(stats.size / 1024)}KB)`);
    });

    await browser.close();
}

testExtension().catch(console.error);
