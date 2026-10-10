#!/usr/bin/env bash
# Signs a release APK with Waypoint's release key.
#
#   scripts/sign-apk.sh [unsigned.apk] [signed.apk]
#
# Defaults: the unsigned release build in android/app/build/outputs, signed
# to public/downloads/waypoint.apk. The key and its passwords are read from
# ~/.config/waypoint/release-signing.env, which is never in the repository.
# Keep that file and release.keystore backed up: with a different key,
# installed apps cannot be updated in place.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
env_file="${WAYPOINT_SIGNING_ENV:-$HOME/.config/waypoint/release-signing.env}"
in="${1:-$root/android/app/build/outputs/apk/release/app-release-unsigned.apk}"
out="${2:-$root/public/downloads/waypoint.apk}"

[ -f "$env_file" ] || { echo "Missing $env_file" >&2; exit 1; }
[ -f "$in" ] || { echo "Missing $in (build with ./gradlew assembleRelease first)" >&2; exit 1; }
# shellcheck disable=SC1090
set -a; . "$env_file"; set +a

sdk="${ANDROID_HOME:-$HOME/Android/Sdk}"
bt="$(ls -d "$sdk"/build-tools/* | sort -V | tail -1)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# zipalign first, then sign: signing a v2 signature requires aligned input.
"$bt/zipalign" -p -f 4 "$in" "$tmp/aligned.apk"
"$bt/apksigner" sign \
  --ks "$WAYPOINT_KEYSTORE" --ks-key-alias "$WAYPOINT_KEY_ALIAS" \
  --ks-pass env:WAYPOINT_STORE_PASSWORD --key-pass env:WAYPOINT_KEY_PASSWORD \
  --out "$tmp/signed.apk" "$tmp/aligned.apk"
"$bt/apksigner" verify --print-certs "$tmp/signed.apk" | grep -E "SHA-256|Verified"

mkdir -p "$(dirname "$out")"
cp "$tmp/signed.apk" "$out"
echo "Signed APK written to $out"
