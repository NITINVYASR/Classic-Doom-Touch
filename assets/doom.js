import { WASI, WASIProcExit, File as WasiFile, Directory, PreopenDirectory, ConsoleStdout } from './vendor/index.js';

const byId = id => document.getElementById(id);
const game = byId('game');
const touch = byId('touch');
const stick = byId('stick');
const thumb = byId('thumb');
const canvas = byId('screen');
const view = canvas.getContext('2d', { alpha: false });
const sourceWidth = 320, sourceHeight = 200;
const scaledCanvas = document.createElement('canvas');
scaledCanvas.width = sourceWidth * 2;
scaledCanvas.height = sourceHeight * 2;
const scaledView = scaledCanvas.getContext('2d', { alpha: false });
const scaledFrame = scaledView.createImageData(scaledCanvas.width, scaledCanvas.height);
const scaledPixels = new Uint32Array(scaledFrame.data.buffer);
const nativeFrame = view.createImageData(sourceWidth, sourceHeight);
const nativePixels = new Uint32Array(nativeFrame.data.buffer);
const resolutionChoices = [...document.querySelectorAll('.resolution select')];
const resolutionStorageKey = 'doom-touch/resolution';
let resolution = 'auto', displayScale = 2;
try {
  const savedResolution = localStorage.getItem(resolutionStorageKey);
  if (['1', '2', '3', '4'].includes(savedResolution)) resolution = savedResolution;
} catch {}

function applyResolution() {
  const fitWidth = Math.min(innerWidth, innerHeight * 4 / 3);
  const autoScale = Math.max(1, Math.min(4, Math.ceil(fitWidth * devicePixelRatio / sourceWidth)));
  displayScale = resolution === 'auto' ? autoScale : Number(resolution);
  const width = sourceWidth * displayScale, height = sourceHeight * displayScale;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  view.imageSmoothingEnabled = false;
}

for (const choice of resolutionChoices) {
  choice.value = resolution;
  choice.addEventListener('change', () => {
    resolution = choice.value;
    for (const select of resolutionChoices) select.value = resolution;
    try { localStorage.setItem(resolutionStorageKey, resolution); } catch {}
    applyResolution();
  });
}
window.addEventListener('resize', applyResolution);
applyResolution();
const mapButton = byId('map');
const minimap = byId('minimap');
const mapView = minimap.getContext('2d', { alpha: false });
const lookGain = 6.5;
const key = { left: 0xac, up: 0xad, right: 0xae, down: 0xaf, strafeLeft: 0xa0,
  strafeRight: 0xa1, use: 0xa2, fire: 0xa3, escape: 27, enter: 13, map: 9, swap: 93,
  run: 0xb6, save: 0xbc, load: 0xbd };
const keyboard = { KeyW: key.up, KeyS: key.down, KeyA: key.strafeLeft, KeyD: key.strafeRight,
  ArrowUp: key.up, ArrowDown: key.down, ArrowLeft: key.left, ArrowRight: key.right,
  ControlLeft: key.fire, Space: key.use, ShiftLeft: key.run, Escape: key.escape,
  Enter: key.enter, Tab: key.map, BracketRight: key.swap, F2: key.save, F3: key.load };
const wadNames = ['freedoom1.wad', 'doom.wad', 'doom2.wad', 'doom1.wad', 'freedoom2.wad'];
const stepMs = 1000 / 35;
let wasm, audio, animation, active = false, loading = false, moving, looking, mouseDx = 0;
let mode = 'menu', saves, saveKey, lastSave, lastError = '';
const channels = new Map();
const controls = new Map();
const events = [];
const taps = new Set();
const releases = new Set();

function hold(source, codes) {
  const before = new Set([...controls.values()].flat());
  if (codes.length) controls.set(source, codes);
  else controls.delete(source);
  const after = new Set([...controls.values()].flat());
  for (const code of before) if (!after.has(code)) events.push(code);
  for (const code of after) if (!before.has(code)) events.push(0x100 | code);
}

function tap(code) {
  if (taps.has(code)) return;
  taps.add(code);
  hold('tap' + code, [code]);
}

function resetTouch() {
  for (const source of [...controls.keys()]) hold(source, []);
  taps.clear();
  releases.clear();
  moving = looking = undefined;
  mouseDx = 0;
  thumb.style.transform = '';
}

function setMode(next) {
  if (mode !== next) resetTouch();
  mode = next;
  game.dataset.mode = next;
}

function joystick(x, y) {
  const box = stick.getBoundingClientRect();
  let dx = x - box.left - box.width / 2;
  let dy = y - box.top - box.height / 2;
  const radius = box.width * 0.34;
  const scale = Math.max(1, Math.hypot(dx, dy) / radius);
  dx /= scale;
  dy /= scale;
  thumb.style.transform = `translate(${dx}px,${dy}px)`;
  const codes = [];
  if (dy < -radius * 0.36) codes.push(key.up);
  if (dy > radius * 0.36) codes.push(key.down);
  if (dx < -radius * 0.36) codes.push(mode === 'level' ? key.strafeLeft : key.left);
  if (dx > radius * 0.36) codes.push(mode === 'level' ? key.strafeRight : key.right);
  if (mode === 'level' && Math.hypot(dx, dy) > radius * 0.94) codes.push(key.run);
  hold('stick', codes);
}

touch.addEventListener('pointerdown', event => {
  if (!active || event.button !== 0) return;
  event.preventDefault();
  if (document.activeElement instanceof HTMLSelectElement) document.activeElement.blur();
  const id = event.pointerId;
  releases.delete(id);
  const button = event.target.closest('button');
  if (button?.dataset.tap) tap(key[button.dataset.tap]);
  else if (button?.dataset.hold) hold(id, [key[button.dataset.hold]]);
  else if (event.clientX < innerWidth * 0.42 && moving === undefined) {
    moving = id;
    joystick(event.clientX, event.clientY);
  } else if (mode === 'level' && event.clientX >= innerWidth * 0.42 && looking === undefined) {
    looking = { id, x: event.clientX };
  }
  touch.setPointerCapture(id);
});

touch.addEventListener('pointermove', event => {
  if (event.pointerId === moving) joystick(event.clientX, event.clientY);
  if (looking?.id === event.pointerId) {
    mouseDx += (event.clientX - looking.x) * lookGain * 900 / innerWidth;
    looking.x = event.clientX;
  }
});

for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  touch.addEventListener(type, event => {
    if (event.pointerId === moving) {
      moving = undefined;
      thumb.style.transform = '';
      hold('stick', []);
    }
    if (event.pointerId === looking?.id) looking = undefined;
    if (controls.has(event.pointerId)) releases.add(event.pointerId);
  });
}

for (const type of ['keydown', 'keyup']) {
  window.addEventListener(type, event => {
    if (!active) return;
    if (event.target instanceof HTMLSelectElement && (type === 'keydown' || !controls.has(event.code))) return;
    const code = keyboard[event.code] || (event.key.length === 1 ? event.key.toLowerCase().charCodeAt(0) : 0);
    if (!code || code > 255) return;
    event.preventDefault();
    if (!event.repeat) hold(event.code, type === 'keydown' ? [code] : []);
  });
}

function stopSound(channel) {
  const current = channels.get(channel);
  if (!current) return;
  channels.delete(channel);
  current.source.stop();
}

function soundParams(channel, volume, separation) {
  const current = channels.get(channel);
  if (!current) return;
  current.gain.gain.value = volume / 127 * 0.56;
  if (current.pan) current.pan.pan.value = (separation - 128) / 128;
}

function playSound(channel, pointer, length, volume, separation) {
  if (!audio || audio.state !== 'running') return;
  const memory = wasm.exports.memory.buffer;
  const data = new Uint8Array(memory, pointer, length);
  const header = new DataView(memory, pointer, 8);
  const rate = header.getUint16(2, true);
  const count = Math.min(header.getUint32(4, true), length - 8);
  if (count <= 32 || rate < 3000 || rate > 96000) return;
  stopSound(channel);
  const buffer = audio.createBuffer(1, count - 32, rate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = (data[i + 24] - 128) / 128;
  const source = audio.createBufferSource();
  const gain = audio.createGain();
  const pan = audio.createStereoPanner?.();
  source.buffer = buffer;
  source.connect(gain);
  if (pan) gain.connect(pan).connect(audio.destination);
  else gain.connect(audio.destination);
  channels.set(channel, { source, gain, pan });
  soundParams(channel, volume, separation);
  source.onended = () => {
    if (channels.get(channel)?.source === source) channels.delete(channel);
    source.disconnect();
    gain.disconnect();
    pan?.disconnect();
  };
  source.start();
}

function rgbaPixel(bgr) {
  return 0xff000000 | ((bgr & 255) << 16) | (bgr & 0xff00) | ((bgr >>> 16) & 255);
}

function draw(pointer) {
  const pixels = new Uint32Array(wasm.exports.memory.buffer, pointer, sourceWidth * sourceHeight);
  if (displayScale === 1) {
    for (let i = 0; i < pixels.length; i++) nativePixels[i] = rgbaPixel(pixels[i]);
    view.putImageData(nativeFrame, 0, 0);
    return;
  }

  const stride = scaledCanvas.width;
  // Scale2x rounds pixel stair-steps using neighboring colors without blurring text and sprites.
  for (let y = 0; y < sourceHeight; y++) {
    const row = y * sourceWidth;
    const top = y > 0 ? row - sourceWidth : row;
    const bottom = y + 1 < sourceHeight ? row + sourceWidth : row;
    let dest = y * 2 * stride;
    for (let x = 0; x < sourceWidth; x++, dest += 2) {
      const center = pixels[row + x], above = pixels[top + x], below = pixels[bottom + x];
      const left = pixels[row + Math.max(0, x - 1)], right = pixels[row + Math.min(sourceWidth - 1, x + 1)];
      const edge = above !== below && left !== right;
      scaledPixels[dest] = rgbaPixel(edge && left === above ? left : center);
      scaledPixels[dest + 1] = rgbaPixel(edge && above === right ? right : center);
      scaledPixels[dest + stride] = rgbaPixel(edge && left === below ? left : center);
      scaledPixels[dest + stride + 1] = rgbaPixel(edge && below === right ? right : center);
    }
  }
  if (displayScale === 2) view.putImageData(scaledFrame, 0, 0);
  else {
    scaledView.putImageData(scaledFrame, 0, 0);
    view.drawImage(scaledCanvas, 0, 0, canvas.width, canvas.height);
  }
}

function drawMinimap() {
  const pointer = wasm.exports.minimap();
  mapButton.hidden = !pointer;
  if (!pointer) return;

  const memory = wasm.exports.memory.buffer;
  const [count, angle] = new Float32Array(memory, pointer, 2);
  const lines = new Float32Array(memory, pointer + 8, count * 4);
  const center = minimap.width / 2;
  const scale = center / 640;
  mapView.fillStyle = '#191311';
  mapView.fillRect(0, 0, minimap.width, minimap.height);
  mapView.strokeStyle = '#352924';
  mapView.lineWidth = 1;
  mapView.beginPath();
  mapView.moveTo(center, 0);
  mapView.lineTo(center, minimap.height);
  mapView.moveTo(0, center);
  mapView.lineTo(minimap.width, center);
  mapView.stroke();

  mapView.beginPath();
  for (let i = 0; i < lines.length; i += 4) {
    mapView.moveTo(center + lines[i] * scale, center - lines[i + 1] * scale);
    mapView.lineTo(center + lines[i + 2] * scale, center - lines[i + 3] * scale);
  }
  mapView.strokeStyle = '#e1a783';
  mapView.lineWidth = 2;
  mapView.stroke();

  mapView.save();
  mapView.translate(center, center);
  mapView.rotate(-angle * 2 * Math.PI);
  mapView.beginPath();
  mapView.moveTo(12, 0);
  mapView.lineTo(-7, 7);
  mapView.lineTo(-4, 0);
  mapView.lineTo(-7, -7);
  mapView.closePath();
  mapView.fillStyle = '#fff3a8';
  mapView.fill();
  mapView.restore();
}

function wadType(bytes, filename) {
  if (bytes.length < 12 || String.fromCharCode(...bytes.subarray(0, 4)) !== 'IWAD') {
    throw new Error('Choose a base-game IWAD such as DOOM.WAD or DOOM2.WAD.');
  }
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = header.getUint32(4, true), offset = header.getUint32(8, true);
  if (offset < 12 || count > (bytes.length - offset) / 16) throw new Error('The WAD directory is damaged.');
  const maps = new Set();
  for (let i = 0; i < count; i++) {
    const position = offset + i * 16;
    if (header.getUint32(position, true) + header.getUint32(position + 4, true) > bytes.length) {
      throw new Error('The WAD contains a damaged entry.');
    }
    maps.add(String.fromCharCode(...bytes.subarray(position + 8, position + 16)).replace(/\0+$/, ''));
  }
  if (maps.has('MAP01')) return filename.toLowerCase() === 'freedoom2.wad' ? 4 : 2;
  if (!maps.has('E1M1')) throw new Error('This IWAD has no compatible Doom starting map.');
  if (filename.toLowerCase() === 'freedoom1.wad') return 0;
  return maps.has('E2M1') ? 1 : 3;
}

function decodeDirectory(entries) {
  return new Directory(new Map(Object.entries(entries).map(([name, value]) => [
    name, typeof value === 'string' ? new WasiFile(Uint8Array.from(atob(value), char => char.charCodeAt(0)))
      : decodeDirectory(value),
  ])));
}

function encodeDirectory(directory) {
  const entries = {};
  for (const [name, entry] of directory.contents) {
    if (entry instanceof Directory) entries[name] = encodeDirectory(entry);
    else if (entry instanceof WasiFile) {
      let bytes = '';
      for (let i = 0; i < entry.data.length; i += 8192) {
        bytes += String.fromCharCode(...entry.data.subarray(i, i + 8192));
      }
      entries[name] = btoa(bytes);
    }
  }
  return entries;
}

function persist() {
  if (!saves) return;
  try {
    const current = JSON.stringify(encodeDirectory(saves));
    if (current !== lastSave) {
      localStorage.setItem(saveKey, current);
      lastSave = current;
    }
  } catch (error) {
    console.warn('Doom save storage unavailable:', error.message);
  }
}

function suspend() {
  resetTouch();
  persist();
  for (const channel of channels.keys()) stopSound(channel);
}

function end(message = '') {
  suspend();
  active = false;
  cancelAnimationFrame(animation);
  game.hidden = true;
  byId('launcher').hidden = false;
  byId('status').textContent = message;
  wasm = saves = undefined;
}

window.doomSuspend = suspend;
document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });
window.addEventListener('pagehide', suspend);
window.addEventListener('blur', resetTouch);

async function launch(file) {
  if (loading || active) return;
  loading = true;
  lastError = '';
  byId('status').textContent = 'Loading engine and game data…';
  byId('play').disabled = byId('import').disabled = true;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (Audio) {
      try {
        audio ||= new Audio();
        audio.resume().catch(() => {});
      } catch (error) {
        console.warn('Doom audio unavailable:', error.message);
      }
    }
    if (file?.size > 64 * 1024 * 1024) throw new Error('Choose a WAD smaller than 64 MB.');
    const load = async name => {
      const response = await fetch(name);
      if (!response.ok) throw new Error('Could not load ' + name);
      return response.arrayBuffer();
    };
    const [program, wad] = await Promise.all([load('doom.wasm'),
      file ? file.arrayBuffer() : load('freedoom1.wad')]);
    const bytes = new Uint8Array(wad);
    const type = file ? wadType(bytes, file.name) : 0;
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', wad));
    saveKey = 'doom-touch/' + [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
    try {
      lastSave = localStorage.getItem(saveKey);
      saves = decodeDirectory(JSON.parse(lastSave || '{}'));
    } catch {
      saves = new Directory([]);
    }

    events.length = 0;
    const wasi = new WASI([], [], [
      new WasiFile([]).path_open(0, 0n, 0).fd_obj,
      ConsoleStdout.lineBuffered(line => console.debug(line)),
      ConsoleStdout.lineBuffered(line => { lastError = line; console.error(line); }),
      new PreopenDirectory('/', new Map([
        [wadNames[type], new WasiFile(bytes, { readonly: true })],
        ['saves', saves],
      ])),
    ]);
    const { instance } = await WebAssembly.instantiate(program, {
      wasi_snapshot_preview1: wasi.wasiImport,
      browser: {
        draw, take_key: () => events.shift() || 0,
        take_mouse: () => {
          const dx = Math.max(-2048, Math.min(2048, Math.trunc(mouseDx)));
          mouseDx -= dx;
          return dx;
        },
        sound_play: playSound, sound_stop: stopSound,
        sound_playing: channel => Number(channels.has(channel)), sound_params: soundParams,
      },
    });
    wasm = instance;
    wasi.initialize(wasm);
    wasm.exports.start_doom(type);
    setMode('menu');
    mapButton.hidden = true;
    byId('launcher').hidden = true;
    game.hidden = false;
    active = true;
    let previous = performance.now(), lag = 0, saveClock = previous, mapClock = -Infinity;
    const loop = now => {
      try {
        lag += Math.min(now - previous, stepMs * 3);
        previous = now;
        while (lag >= stepMs) {
          wasm.exports.step_doom();
          for (const code of taps) hold('tap' + code, []);
          taps.clear();
          for (const source of releases) hold(source, []);
          releases.clear();
          setMode(wasm.exports.in_level() ? 'level' : 'menu');
          lag -= stepMs;
        }
        if (now - mapClock >= 65) { drawMinimap(); mapClock = now; }
        if (now - saveClock > 1000) { persist(); saveClock = now; }
        animation = requestAnimationFrame(loop);
      } catch (error) {
        end(error instanceof WASIProcExit && error.code === 0 ? '' : lastError || error.message);
      }
    };
    animation = requestAnimationFrame(loop);
  } catch (error) {
    end(lastError || error.message);
  } finally {
    loading = false;
    byId('play').disabled = byId('import').disabled = false;
  }
}

byId('play').addEventListener('click', () => launch());
byId('import').addEventListener('click', () => byId('wad').click());
byId('wad').addEventListener('change', event => {
  const file = event.target.files[0];
  event.target.value = '';
  if (file) launch(file);
});
