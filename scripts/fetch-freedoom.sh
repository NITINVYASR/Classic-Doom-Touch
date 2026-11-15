#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

wad=assets/freedoom1.wad
sha=eacb07ab47aabb14a225d7084acfea1be6fb6a11172b20f0a1a10e4ef9cbf76d
if printf '%s  %s\n' "$sha" "$wad" | sha256sum --check --status; then
  exit 0
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
curl --fail --silent --show-error --location --retry 3 \
  https://deb.debian.org/debian/pool/main/f/freedoom/freedoom_0.13.0-2_all.deb \
  --output "$work/freedoom.deb"
printf '%s  %s\n' 2671a19ec2b917e81031ccb067e317d46ea4f3d4591fd8b533248bed7facc4c6 \
  "$work/freedoom.deb" | sha256sum --check
dpkg-deb --extract "$work/freedoom.deb" "$work/extracted"
source="$work/extracted/usr/share/games/doom/freedoom1.wad"
printf '%s  %s\n' "$sha" "$source" | sha256sum --check
install -m 644 "$source" "$wad"
