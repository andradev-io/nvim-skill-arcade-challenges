import { chromium } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';

const OUT = '/root/repos/github/dev-vinicius-andrade/nvim-skill-arcade-challenges/gifs';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync('/tmp/pw_videos', { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });

  // === GIF 1: Browser Terminal Loading Dotfiles ===
  console.log('\n=== Recording GIF 1: Terminal + Dotfiles ===');
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: '/tmp/pw_videos/gif1', size: { width: 1280, height: 720 } }
    });
    const page = await context.newPage();
    await page.goto('https://andradev-io.github.io/nvim-skill-arcade-challenges/#/terminal', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2500);

    // The sidebar is open by default at 1280px; find the visible dotfiles input
    // Use getByRole with the label text for reliability across re-renders
    const input = page.getByRole('textbox', { name: /github user/i }).first();
    await input.waitFor({ state: 'visible', timeout: 5000 });
    await input.click();
    await input.fill('dev-vinicius-andrade/dotfiles');
    await page.waitForTimeout(600);

    // Click "Load keymaps"
    const loadBtn = page.getByRole('button', { name: /load keymaps/i });
    await loadBtn.click();
    console.log('Clicked "Load keymaps", waiting for load...');
    await page.waitForTimeout(7000);

    await page.screenshot({ path: `${OUT}/gif1_final.png` });
    console.log('GIF 1 screenshot saved');
    await context.close();
  }

  // === GIF 2: Challenge Creation Flow ===
  console.log('\n=== Recording GIF 2: Challenge Creation ===');
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: '/tmp/pw_videos/gif2', size: { width: 1280, height: 720 } }
    });
    const page = await context.newPage();
    await page.goto('https://andradev-io.github.io/nvim-skill-arcade-challenges/#/create', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Fill title
    const titleInput = page.getByRole('textbox', { name: /title/i }).first();
    if (await titleInput.isVisible().catch(() => false)) {
      await titleInput.fill('Change inside quotes');
      await page.waitForTimeout(400);
    }

    // Fill brief/description
    const briefInput = page.getByRole('textbox', { name: /brief|description/i }).first();
    if (await briefInput.isVisible().catch(() => false)) {
      await briefInput.fill('Replace the text inside the quotes');
      await page.waitForTimeout(400);
    }

    // Scroll down to show more of the form
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(1000);

    await page.screenshot({ path: `${OUT}/gif2_final.png` });
    console.log('GIF 2 screenshot saved');
    await context.close();
  }

  // === GIF 3: Playing a Challenge via Command Palette ===
  console.log('\n=== Recording GIF 3: Playing a Challenge ===');
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: '/tmp/pw_videos/gif3', size: { width: 1280, height: 720 } }
    });
    const page = await context.newPage();
    await page.goto('https://andradev-io.github.io/nvim-skill-arcade-challenges/#/terminal', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Open command palette with Ctrl+K
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(1200);

    // Type to search for a challenge
    const paletteInput = page.locator('[role="dialog"] input, [role="combobox"] input').first();
    if (await paletteInput.isVisible().catch(() => false)) {
      await paletteInput.fill('change');
      await page.waitForTimeout(1200);
      // Select first result
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
    }

    await page.screenshot({ path: `${OUT}/gif3_final.png` });
    console.log('GIF 3 screenshot saved');
    await context.close();
  }

  await browser.close();

  // Convert all videos to GIFs
  console.log('\n=== Converting videos to GIFs ===');
  for (const name of ['gif1', 'gif2', 'gif3']) {
    const videoDir = `/tmp/pw_videos/${name}`;
    if (!fs.existsSync(videoDir)) {
      console.log(`No video dir for ${name}`);
      continue;
    }
    const files = fs.readdirSync(videoDir).filter(f => f.endsWith('.webm'));
    if (files.length === 0) {
      console.log(`No video found for ${name}`);
      continue;
    }
    const videoPath = `${videoDir}/${files[0]}`;
    const gifPath = `${OUT}/${name}.gif`;
    try {
      execSync(`ffmpeg -y -i "${videoPath}" -vf "fps=12,scale=720:-1:flags=lanczos" -loop 0 "${gifPath}"`, { stdio: 'pipe' });
      const stats = fs.statSync(gifPath);
      console.log(`${name}.gif: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
    } catch (e) {
      console.error(`Failed to convert ${name}: ${e.stderr?.toString().slice(-200) || e.message}`);
    }
  }

  console.log('\nDone! GIFs are in:', OUT);
})();