import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { WASI, PreopenDirectory, Directory, ConsoleStdout, File, WASIProcExit } from '../assets/vendor/index.js';

const assets = resolve(process.argv[2] || 'assets');
const program = readFileSync(resolve(assets, 'doom.wasm'));
const freedoom = readFileSync(resolve(assets, 'freedoom1.wad'));
const log = process.env.TEST_LOG ? console.log : () => {};

async function makeGame(wad, type, saves = new Directory([])) {
  const filename = type === 4 ? 'freedoom2.wad' : 'freedoom1.wad';
  const stdout = ConsoleStdout.lineBuffered(log);
  const wasi = new WASI([], [], [
    new File([]).path_open(0, 0n, 0).fd_obj,
    stdout,
    ConsoleStdout.lineBuffered(console.error),
    new PreopenDirectory('/', new Map([[filename, new File(wad, { readonly: true })], ['saves', saves]])),
  ]);
  const keys = [], sounds = [];
  let wasm, frame, turn = 0;
  const { instance } = await WebAssembly.instantiate(program, {
    wasi_snapshot_preview1: wasi.wasiImport,
    browser: {
      draw: pointer => { frame = Buffer.from(new Uint8Array(wasm.memory.buffer, pointer, 320 * 200 * 4)); },
      take_key: () => keys.shift() || 0,
      take_mouse: () => { const amount = turn; turn = 0; return amount; },
      sound_play: (channel, pointer, length) => {
        const bytes = new Uint8Array(wasm.memory.buffer, pointer, length);
        assert.equal(bytes[0], 3);
        assert.ok(length >= 40);
        sounds.push(createHash('sha256').update(bytes).digest('hex'));
      },
      sound_stop() {}, sound_playing: () => 0, sound_params() {},
    },
  });
  wasm = instance.exports;
  wasi.initialize(instance);
  wasm.start_doom(type);
  const tick = count => { for (let i = 0; i < count; i++) wasm.step_doom(); };
  const hold = (key, down) => keys.push(down ? key | 256 : key);
  const press = key => { hold(key, true); tick(3); hold(key, false); tick(3); };
  return { tick, hold, press, saves, sounds, inLevel: wasm.in_level, frame: () => frame,
    turn: dx => { turn += dx; } };
}

const game = await makeGame(freedoom, 0);
game.tick(30);
assert.ok(game.frame().some(byte => byte !== 0), 'title frame renders');
assert.equal(game.inLevel(), 0);
for (let i = 0; i < 4; i++) game.press(13);
game.tick(25);
assert.equal(game.inLevel(), 1, 'new game starts the first episode');
const first = game.frame();
game.hold(0xad, true);
game.tick(8);
game.hold(0xad, false);
game.tick(3);
assert.notDeepEqual(game.frame(), first, 'forward changes the frame');
const beforeTurn = game.frame();
game.turn(145);
game.tick(5);
assert.notDeepEqual(game.frame(), beforeTurn, 'mouse delta changes the view');
const beforeShot = game.sounds.length;
game.hold(0xa3, true);
game.tick(22);
game.hold(0xa3, false);
game.tick(8);
assert.ok(game.sounds.length > beforeShot, 'firing decodes a sound effect');
const beforeMap = game.frame();
game.press(9);
assert.notDeepEqual(game.frame(), beforeMap, 'automap changes the frame');
game.press(9);
game.press(93); // Next weapon.
game.press(0xa2); // Use.
game.press(27);
assert.equal(game.inLevel(), 0, 'escape opens the menu');
game.press(27);
assert.equal(game.inLevel(), 1, 'escape resumes the game');
game.press(0xbc); // F2.
assert.equal(game.inLevel(), 0, 'save menu opens');
game.press(13);
game.press(13);
game.tick(8);
const slot = game.saves.contents.get('.savegame')?.contents.get('doomsav0.dsg');
assert.ok(slot?.data.length > 30, 'save slot has data');
const reloaded = await makeGame(freedoom, 0, game.saves);
reloaded.tick(30);
reloaded.press(0xbd); // F3.
reloaded.press(13);
reloaded.tick(15);
assert.equal(reloaded.inLevel(), 1, 'saved level loads in a fresh instance');
reloaded.press(27);
for (let i = 0; i < 5; i++) reloaded.press(0xaf);
reloaded.press(13);
assert.throws(() => reloaded.press(13), error => error instanceof WASIProcExit && error.code === 0);

if (process.argv[3]) {
  const game2 = await makeGame(readFileSync(process.argv[3]), 4);
  game2.tick(30);
  for (let i = 0; i < 3; i++) game2.press(13);
  game2.tick(25);
  assert.equal(game2.inLevel(), 1, 'Doom II-format WAD starts MAP01');
}
console.log('PASS: Doom rendering, menus, movement, horizontal look, firing audio, automap, save/load and quit.');
