#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
: "${AAPT:=aapt}"
: "${ZIPALIGN:=zipalign}"
: "${FRAMEWORK_RES:=/usr/share/android-framework-res/framework-res.apk}"
: "${ANDROID_JARS:=/usr/share/java}"
: "${SIGNING_KEY:=$PWD/../out/debug.keystore}"
: "${KEYSTORE_PASS:=android}"
: "${KEY_ALIAS:=androiddebugkey}"
export KEYSTORE_PASS
out="$PWD/../out"
../scripts/fetch-freedoom.sh
mkdir -p "$out"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
java -cp "$ANDROID_JARS/*" org.jf.smali.Main assemble --api 24 smali -o "$work/classes.dex"
mkdir -p "$work/assets"
cp -a ../assets/. "$work/assets/"
cp -a ../licenses "$work/assets/licenses"
"$AAPT" package -f -M AndroidManifest.xml -I "$FRAMEWORK_RES" -S res -A "$work/assets" -F "$work/raw.apk"
(cd "$work" && "$AAPT" add raw.apk classes.dex)
"$ZIPALIGN" -f 4 "$work/raw.apk" "$work/aligned.apk"
if [[ ! -f "$SIGNING_KEY" ]]; then
  keytool -genkeypair -keystore "$SIGNING_KEY" -storepass:env KEYSTORE_PASS \
    -alias "$KEY_ALIAS" -dname 'CN=Classic Doom Touch test key' -keyalg RSA -keysize 2048 -validity 10000
fi
signer=(java -cp "$ANDROID_JARS/*" com.android.apksigner.ApkSignerTool)
"${signer[@]}" sign --ks "$SIGNING_KEY" --ks-pass env:KEYSTORE_PASS --ks-key-alias "$KEY_ALIAS" \
  --out "$out/Classic_Doom_Touch.apk" "$work/aligned.apk"
"${signer[@]}" verify --verbose "$out/Classic_Doom_Touch.apk"
"$ZIPALIGN" -c 4 "$out/Classic_Doom_Touch.apk"
