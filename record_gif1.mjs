import { chromium } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';

const OUT = '/root/repos/github/dev-vinicius-andrade/nvim-skill-arcade-challenges/gifs';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync('/tmp/pw_videos/gif1_retry', { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: '/tmp/pw_videos/gif1_retry', size: { width: 1280, height: 720 } }
  });
  const page = await context.newPage();

  console.log('Loading terminal page...');
  await page.goto('https://andradev-io.github.io/nvim-skill-arcade-challenges/#/terminal', {
    waitUntil: 'networkidle',
    timeout: 30000
  });
  await page.waitForTimeout(2500);

  // Fill dotfiles input
  const input = page.getByRole('textbox', { name: /github user/i }).first();
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.click();
  await input.fill('dev-vinicius-andrade/dotfiles');
  await page.waitForTimeout(600);

  // Click Load keymaps
  const loadBtn = page.getByRole('button', { name: /load keymaps/i });
  await loadBtn.click();
  console.log('Clicked Load keymaps, waiting for API response...');

  // Wait for the keymap count text to appear (e.g. "X working")
  try {
    await page.locator('text=/\\d+ working/').waitFor({ state: 'visible', timeout: 15000 });
    console.log('Keymaps loaded successfully!');
  } catch {
    console.log('Warning: keymap count text did not appear within 15s');
  }

  // Extra pause so the viewer can see the loaded keymaps
  await page.waitForTimeout(4000);

  await page.screenshot({ path: `${OUT}/gif1_retry_final.png` });
  console.log('Screenshot saved');

  await context.close();
  await browser.close();

  // Convert video to GIF
  const videoDir = '/tmp/pw_videos/gif1_retry';
  const files = fs.readdirSync(videoDir).filter(f => f.endsWith('.webm'));
  // Pick the largest (valid) file
  let bestFile = null;
  let bestSize = 0;
  for (const f of files) {
    const sz = fs.statSync(`${videoDir}/${f}`).size;
    if (sz > bestSize) { bestSize = sz; bestFile = f; }
  }
  if (!bestFile || bestSize < 1000) {
    console.error('No valid video found');
    process.exit(1);
  }
  console.log(`Using video: ${bestFile} (${(bestSize/1024).toFixed(0)} KB)`);
  const gifPath = `${OUT}/gif1.gif`;
  execSync(`ffmpeg -y -i "${videoDir}/${bestFile}" -vf "fps=12,scale=720:-1:flags=lanczos" -loop 0 "${gifPath}"`, { stdio: 'inherit' });
  const stats = fs.statSync(gifPath);
  console.log(`gif1.gif: ${(stats.size / 1024).toFixed(0)} KB`);
})();