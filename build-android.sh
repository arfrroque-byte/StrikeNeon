#!/usr/bin/env bash
# Strike Neon Android build. Requires npm dependencies, JDK 17 and Android SDK 36.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-debug}"
cd "$ROOT_DIR"

npm run build
cd "$ROOT_DIR/android"
if [[ "$MODE" == "release" ]]; then
  ./gradlew bundleRelease
  echo "AAB: app/build/outputs/bundle/release/"
else
  ./gradlew assembleDebug
  echo "APK: app/build/outputs/apk/debug/"
fi
