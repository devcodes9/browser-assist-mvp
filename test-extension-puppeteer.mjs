import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.join(__dirname, 'packages/extension/dist');
const outputDir = path.join(__dirname, 'test-output');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function testExtension() {
    console.log('Starting extension test...');
    console.log('Extension path:', extensionPath);

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

    // Wait for the extension to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get extension ID by looking at service workers
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

    // First, visit extensions page to verify extension is loaded
    await page.goto('chrome://extensions/', { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.screenshot({ path: path.join(outputDir, 'pup-1-extensions-page.png'), fullPage: false });

    // Navigate to a test page
    await page.goto('https://example.com', { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.screenshot({ path: path.join(outputDir, 'pup-2-example-page.png'), fullPage: false });

    // Try to open side panel by navigating to the extension page directly
    if (extensionId) {
        // Open the sidepanel HTML directly in a new page to preview the UI
        const sidepanelPage = await browser.newPage();
        await sidepanelPage.setViewport({ width: 400, height: 700 });
        
        const sidepanelUrl = `chrome-extension://${extensionId}/sidepanel.html`;
        console.log('Opening sidepanel at:', sidepanelUrl);
        
        try {
            await sidepanelPage.goto(sidepanelUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
            await new Promise(resolve => setTimeout(resolve, 3000));
            await sidepanelPage.screenshot({ path: path.join(outputDir, 'pup-3-sidepanel-ui.png'), fullPage: false });
            console.log('Sidepanel screenshot captured!');
        } catch (e) {
            console.log('Could not open sidepanel directly:', e.message);
        }
    }

    // Keep browser open for a moment to capture final state
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Test complete!');
    console.log('Screenshots saved to:', outputDir);
    
    await browser.close();
}

testExtension().catch(console.error);
