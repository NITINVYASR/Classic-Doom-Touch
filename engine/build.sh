#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
: "${WASI_CC:=clang-19}"
: "${WASI_SYSROOT:=/usr}"
: "${WASM_LD:=$(command -v wasm-ld-19)}"
read -r -a objects <<< "$(sed -n 's/^SRC_DOOM = //p' upstream/Makefile)"
sources=()
for object in "${objects[@]}"; do
  [[ $object == doomgeneric_xlib.o ]] || sources+=("upstream/${object%.o}.c")
done
"$WASI_CC" --target=wasm32-wasi --sysroot="$WASI_SYSROOT" -fuse-ld="$WASM_LD" \
  -mexec-model=reactor -O2 -fwrapv -Wno-incompatible-pointer-types \
  -Wno-pointer-sign -Wno-int-conversion -Wno-implicit-function-declaration \
  -DBROWSER_SOUND -DNORMALUNIX -D_DEFAULT_SOURCE -DDOOMGENERIC_RESX=320 -DDOOMGENERIC_RESY=200 \
  -Iupstream "${sources[@]}" browser.c -Wl,-z,stack-size=1048576 -o ../assets/doom.wasm
