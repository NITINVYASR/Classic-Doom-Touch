const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createServer } = require('node:http');
const { createReadStream, statSync } = require('node:fs');
const { resolve, extname } = require('node:path');

const assets = resolve(process.argv[2] || 'assets');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.wasm': 'application/wasm', '.wad': 'application/octet-stream' };
const sitePath = '/classic-doom-touch/';
const server = createServer((request, response) => {
  if (!request.url.startsWith(sitePath)) return response.writeHead(404).end();
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = resolve(assets, pathname.slice(sitePath.length) || 'index.html');
  try {
    if (!file.startsWith(assets + '/') || !statSync(file).isFile()) throw Error();
    response.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end();
  }
});

(async () => {
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || '/usr/bin/chromium',
    args: ['--no-sandbox'] });
  try {
    const desktop = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    desktop.setDefaultTimeout(6000);
    await desktop.addInitScript(() => {
      window.shots = 0;
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...args) {
        window.shots++;
        return start.apply(this, args);
      };
    });
    const url = 'http://127.0.0.1:' + server.address().port + sitePath;
    await desktop.goto(url);
    await desktop.locator('#play').click();
    const desktopGame = desktop.locator('#game');
    await desktopGame.waitFor();
    for (let i = 0; i < 4; i++) {
      await desktop.keyboard.press('Enter', { delay: 55 });
      await desktop.waitForTimeout(170);
    }
    await desktop.locator('#game[data-mode="level"]').waitFor();
    assert.equal(await desktop.locator('#stick').isVisible(), false);
    assert.equal(await desktop.locator('#map').isVisible(), true);
    await desktop.mouse.move(500, 320);
    const frame = () => desktop.locator('#minimap').evaluate(canvas => canvas.toDataURL());
    const before = await frame();
    await desktop.mouse.move(660, 320, { steps: 8 });
    await desktop.waitForFunction(old => document.querySelector('#minimap').toDataURL() !== old, before);
    const beforeShot = await desktop.evaluate(() => window.shots);
    await desktop.mouse.click(660, 320, { delay: 90 });
    await desktop.waitForFunction(old => window.shots > old, beforeShot);
    await desktop.waitForFunction(() => document.pointerLockElement?.id === 'touch');
    const locked = await frame();
    // Headless Chromium's absolute mouse driver emits no relative movement under pointer lock.
    await desktop.locator('#touch').dispatchEvent('mousemove', { movementX: 100, bubbles: true });
    await desktop.waitForFunction(old => document.querySelector('#minimap').toDataURL() !== old, locked);
    await desktop.waitForTimeout(350);
    const lockedShot = await desktop.evaluate(() => window.shots);
    await desktop.mouse.click(660, 320);
    await desktop.waitForFunction(old => window.shots > old, lockedShot);
    await desktop.evaluate(() => document.exitPointerLock());
    await desktop.waitForFunction(() => !document.pointerLockElement);
    await desktop.waitForTimeout(400);
    const beforeJump = await desktop.locator('#screen').evaluate(canvas => canvas.toDataURL());
    await desktop.keyboard.press('Space');
    await desktop.waitForFunction(old => document.querySelector('#screen').toDataURL() !== old, beforeJump);
    await desktop.close();

    const page = await browser.newPage({ viewport: { width: 915, height: 412 }, hasTouch: true,
      isMobile: true, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => {
      if (process.env.TEST_LOG && msg.text() !== 'Failed to load resource: the server responded with a status of 404 (Not Found)') console.log(msg.type(), msg.text());
    });
    await page.addInitScript(() => {
      window.soundStarts = 0;
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...args) {
        window.soundStarts++;
        return start.apply(this, args);
      };
    });
    const delay = ms => new Promise(done => setTimeout(done, ms));
    const game = page.locator('#game');
    const press = async key => { await page.keyboard.press(key, { delay: 48 }); await delay(120); };
    const mode = value => page.locator('#game[data-mode="' + value + '"]:visible').waitFor({ timeout: 4000 });
    const pixels = () => page.locator('#screen').evaluate(canvas => canvas.toDataURL());
    await page.goto(url);
    await page.locator('#wad').setInputFiles({ name: 'bad.wad', mimeType: 'application/octet-stream', buffer: Buffer.from('bad') });
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('base-game IWAD'));
    await page.locator('#play').tap();
    await mode('menu');
    assert.equal(await page.locator('#ok').isVisible(), true);
    await page.locator('#ok').tap(); // Opens the main menu from the title screen.
    await delay(160);
    await page.locator('#ok').tap(); // New game.
    await delay(160);
    await page.locator('#ok').tap(); // First episode.
    await delay(160);
    await page.locator('#ok').tap(); // Default skill.
    await mode('level');
    await delay(300);
    assert.equal(await page.locator('#jump').isVisible(), true);
    const beforeTouchJump = await pixels();
    await page.locator('#jump').tap();
    await page.waitForFunction(old => document.querySelector('#screen').toDataURL() !== old, beforeTouchJump);
    const dimensions = () => page.locator('#screen').evaluate(canvas => [canvas.width, canvas.height]);
    const resolution = page.locator('#game-resolution');
    assert.deepEqual(await dimensions(), [640, 400]);
    for (const [value, width, height] of [['1', 320, 200], ['3', 960, 600], ['4', 1280, 800]]) {
      await resolution.selectOption(value);
      assert.deepEqual(await dimensions(), [width, height]);
      await page.waitForFunction(() => {
        const screen = document.querySelector('#screen');
        return screen.getContext('2d').getImageData(0, 0, 16, 16).data.some((byte, i) => i % 4 !== 3 && byte > 0);
      });
    }
    await resolution.selectOption('auto');
    await page.setViewportSize({ width: 1150, height: 700 });
    await page.waitForFunction(() => document.querySelector('#screen').width === 960);
    await page.setViewportSize({ width: 915, height: 412 });
    await page.waitForFunction(() => document.querySelector('#screen').width === 640);
    await resolution.selectOption('2');
    const startView = await pixels();
    const cdp = await page.context().newCDPSession(page);
    const move = await page.locator('#stick').boundingBox();
    const fire = await page.locator('#fire').boundingBox();
    const center = box => ({ x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) });
    const joystick = center(move), trigger = center(fire);
    const multi = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    const player = { ...joystick, y: joystick.y - 29, id: 1 };
    const look = { x: 540, y: 180, id: 2 };
    assert.deepEqual(await page.locator('#screen').evaluate(canvas => [canvas.width, canvas.height]), [640, 400]);
    const minimap = page.locator('#minimap');
    await minimap.waitFor({ state: 'visible' });
    const heading = () => minimap.evaluate(canvas => {
      const size = 32;
      const center = canvas.width / 2;
      const data = canvas.getContext('2d').getImageData(center - size / 2, center - size / 2, size, size).data;
      let dx = 0, dy = 0;
      for (let i = 0; i < size * size; i++) {
        if (data[4 * i] === 255 && data[4 * i + 1] === 243 && data[4 * i + 2] === 168) {
          dx += i % size - size / 2 + 0.5;
          dy += Math.floor(i / size) - size / 2 + 0.5;
        }
      }
      return Math.atan2(dy, dx);
    });
    const beforeLook = await heading();
    await multi('touchStart', [look]);
    await multi('touchMove', [{ ...look, x: 720 }]);
    await delay(180);
    await multi('touchEnd', []);
    const change = await heading() - beforeLook;
    const turnDegrees = Math.abs(Math.atan2(Math.sin(change), Math.cos(change))) * 180 / Math.PI;
    assert.ok(turnDegrees > 30 && turnDegrees < 85, '180 px swipe turns about 50°: ' + turnDegrees);
    await multi('touchStart', [player, look, { ...trigger, id: 3 }]);
    await multi('touchMove', [player, { ...look, x: 608 }, { ...trigger, id: 3 }]);
    await delay(475);
    await multi('touchEnd', []);
    await delay(230);
    assert.notEqual(await pixels(), startView, 'moving and turning changes the view');
    assert.ok(await page.evaluate(() => window.soundStarts > 0), 'sound effect reaches Web Audio');
    const beforeMap = await pixels();
    await page.locator('#map').tap();
    await delay(120);
    assert.notEqual(await pixels(), beforeMap, 'automap changes the frame');
    assert.equal(await minimap.isVisible(), true);
    await page.locator('#map').tap();
    await page.locator('#swap').tap();
    await page.locator('#use').tap();
    await page.locator('#menu').tap();
    await mode('menu');
    assert.equal(await minimap.isVisible(), true);
    await page.locator('#menu').tap();
    await mode('level');
    await press('F2');
    await mode('menu');
    await page.locator('#ok').tap();
    await delay(150);
    await page.locator('#ok').tap();
    await mode('level');
    await page.waitForFunction(() => Object.values(localStorage).some(value => /doomsav0\.dsg/.test(value)));
    await page.reload();
    assert.equal(await page.locator('#launch-resolution').inputValue(), '2');
    await page.locator('#wad').setInputFiles(resolve(assets, 'freedoom1.wad'));
    await mode('menu');
    await press('F3');
    await page.locator('#ok').tap();
    await mode('level');
    assert.equal(await game.isVisible(), true);
    assert.deepEqual(errors, []);
    if (process.env.TEST_SCREENSHOT) await page.screenshot({ path: process.env.TEST_SCREENSHOT });
    console.log('PASS: desktop mouse aiming, firing, pointer lock, keyboard and touch jump, resolution modes, viewport adaptation, saved preference, Pages subpath, invalid WAD, bundled launch, touch menus, three-finger movement/turn/fire, audio, map, pause, save, IWAD import, and reload.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
