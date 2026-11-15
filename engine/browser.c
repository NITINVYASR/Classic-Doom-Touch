/* SPDX-License-Identifier: GPL-2.0-or-later */
#include <stdint.h>
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include "doomgeneric.h"
#include "d_event.h"
#include "d_loop.h"
#include "doomstat.h"
#include "doomdata.h"
#include "r_state.h"
#include "z_zone.h"
#include "i_sound.h"
#include "w_wad.h"

#define BROWSER(name) __attribute__((import_module("browser"), import_name(#name)))
extern void draw(uint32_t *) BROWSER(draw);
extern int take_key(void) BROWSER(take_key);
extern int take_mouse(void) BROWSER(take_mouse);
extern void sound_play(int, const unsigned char *, int, int, int) BROWSER(sound_play);
extern void sound_stop(int) BROWSER(sound_stop);
extern int sound_playing(int) BROWSER(sound_playing);
extern void sound_params(int, int, int) BROWSER(sound_params);

static uint32_t milliseconds;
static boolean prefix;
static boolean sample_mouse;

void DG_Init(void) {}
void DG_SleepMs(uint32_t ms) { milliseconds += ms; }
uint32_t DG_GetTicksMs(void) { return milliseconds; }
void DG_DrawFrame(void) { draw(DG_ScreenBuffer); }
void DG_SetWindowTitle(const char *title) { (void) title; }

int DG_GetKey(int *pressed, unsigned char *key)
{
    int dx = sample_mouse ? take_mouse() : 0;
    sample_mouse = false;
    if (dx) {
        event_t mouse = { .type = ev_mouse, .data2 = dx };
        D_PostEvent(&mouse);
    }
    int event = take_key();
    if (!event) return 0;
    *pressed = (event >> 8) & 1;
    *key = event & 255;
    return 1;
}

static boolean sound_init(boolean use_prefix) { prefix = use_prefix; return true; }
static int sound_lump(sfxinfo_t *sfx)
{
    char name[9];
    if (sfx->link) sfx = sfx->link;
    snprintf(name, sizeof(name), "%s%.6s", prefix ? "ds" : "", sfx->name);
    return W_CheckNumForName(name);
}

static int sound_start(sfxinfo_t *sfx, int channel, int volume, int separation)
{
    int lump = sfx->lumpnum;
    if (lump < 0 || W_LumpLength(lump) < 40) return -1;
    const unsigned char *sample = W_CacheLumpNum(lump, PU_STATIC);
    if (sample[0] != 3 || sample[1] != 0) {
        W_ReleaseLumpNum(lump);
        return -1;
    }
    sound_play(channel, sample, W_LumpLength(lump), volume, separation);
    W_ReleaseLumpNum(lump);
    return channel;
}

static void sound_noop(void) {}
static boolean is_playing(int channel) { return sound_playing(channel) != 0; }
static snddevice_t devices[] = { SNDDEVICE_SB };
sound_module_t DG_sound_module = {
    .sound_devices = devices,
    .num_sound_devices = 1,
    .Init = sound_init,
    .Shutdown = sound_noop,
    .Update = sound_noop,
    .GetSfxLumpNum = sound_lump,
    .UpdateSoundParams = sound_params,
    .StartSound = sound_start,
    .StopSound = sound_stop,
    .SoundIsPlaying = is_playing,
};

__attribute__((export_name("start_doom")))
void start_doom(int game)
{
    static char *names[] = {"/freedoom1.wad", "/doom.wad", "/doom2.wad", "/doom1.wad", "/freedoom2.wad"};
    static char *args[] = {"doom", "-iwad", NULL, "-nomusic", "-config", "/saves/default.cfg",
        "-extraconfig", "/saves/doomgeneric.cfg", NULL};
    args[2] = names[game >= 0 && game < 5 ? game : 0];
    singletics = true;
    doomgeneric_Create(8, args);
}

__attribute__((export_name("step_doom")))
void step_doom(void)
{
    milliseconds += 29;
    sample_mouse = true;
    doomgeneric_Tick();
}

__attribute__((export_name("in_level")))
int in_level(void)
{
    return gamestate == GS_LEVEL && !menuactive;
}

// Header: visible line count and player angle in turns, then relative XY endpoints.
__attribute__((export_name("minimap")))
const float *minimap(void)
{
    static float *snapshot;
    static int capacity;
    const player_t *player = &players[consoleplayer];
    if (gamestate != GS_LEVEL || !player->mo || numlines <= 0) return NULL;
    if (capacity < numlines) {
        float *larger = realloc(snapshot, (2u + 4u * numlines) * sizeof(*snapshot));
        if (!larger) return NULL;
        snapshot = larger;
        capacity = numlines;
    }

    const mobj_t *actor = player->mo;
    const float origin_x = (float)actor->x / FRACUNIT;
    const float origin_y = (float)actor->y / FRACUNIT;
    const float radius = 640;
    int count = 0;
    for (int i = 0; i < numlines; ++i) {
        const line_t *line = &lines[i];
        if (line->flags & ML_DONTDRAW) continue;
        if (line->flags & ML_MAPPED) {
            if (line->backsector && !(line->flags & ML_SECRET) && line->special != 39
                && line->frontsector->floorheight == line->backsector->floorheight
                && line->frontsector->ceilingheight == line->backsector->ceilingheight) continue;
        } else if (!player->powers[pw_allmap]) continue;
        const float x1 = (float)line->v1->x / FRACUNIT - origin_x;
        const float y1 = (float)line->v1->y / FRACUNIT - origin_y;
        const float x2 = (float)line->v2->x / FRACUNIT - origin_x;
        const float y2 = (float)line->v2->y / FRACUNIT - origin_y;
        if ((x1 < -radius && x2 < -radius) || (x1 > radius && x2 > radius)
            || (y1 < -radius && y2 < -radius) || (y1 > radius && y2 > radius)) continue;
        float *segment = snapshot + 2 + 4 * count++;
        segment[0] = x1; segment[1] = y1;
        segment[2] = x2; segment[3] = y2;
    }
    snapshot[0] = count;
    snapshot[1] = (double)actor->angle / 4294967296.0;
    return snapshot;
}

/* The offline WASM process has no shell or desktop dialog program. */
int system(const char *command)
{
    if (!command) return 0;
    errno = ENOSYS;
    return -1;
}
