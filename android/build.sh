#!/usr/bin/env bash
# Baut juliPod.apk ohne Android Studio und ohne Gradle.
# Braucht: Java (JDK 17 oder neuer), curl, unzip, python3.
#
#   ./android/build.sh
#
# Der Signier-Schlüssel liegt in android/julipod.keystore (wird beim ersten Mal erzeugt).
# Gut aufheben! Updates der App lassen sich nur mit demselben Schlüssel installieren.
set -euo pipefail
cd "$(dirname "$0")"

VERSION_CODE="${VERSION_CODE:-1}"
VERSION_NAME="${VERSION_NAME:-1.0}"
SDK="${ANDROID_SDK:-$PWD/.sdk}"
BT="$SDK/build-tools"
JAR="$SDK/platform/android.jar"
KEYSTORE="${JULIPOD_KEYSTORE:-$PWD/julipod.keystore}"
PASS="${JULIPOD_KEYSTORE_PASS:-julipod-fuer-mama}"
OUT="$PWD/build"

if [ ! -x "$BT/aapt2" ] || [ ! -f "$JAR" ]; then
  echo "Lade Android-Werkzeuge …"
  mkdir -p "$SDK" && tmp="$(mktemp -d)"
  curl -sSfL -o "$tmp/bt.zip" https://dl.google.com/android/repository/build-tools_r35.0.1_linux.zip
  curl -sSfL -o "$tmp/pf.zip" https://dl.google.com/android/repository/platform-35_r02.zip
  unzip -q "$tmp/bt.zip" -d "$tmp/bt" && unzip -q "$tmp/pf.zip" -d "$tmp/pf"
  rm -rf "$BT" "$SDK/platform"
  mv "$tmp/bt/"* "$BT" && mv "$tmp/pf/"* "$SDK/platform"
  rm -rf "$tmp"
fi

rm -rf "$OUT" && mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/dex" "$OUT/assets/web"

echo "Webseite einpacken …"
cp ../index.html ../styles.css ../config.js "$OUT/assets/web/"
cp -r ../js ../fonts ../icons ../songs "$OUT/assets/web/"

echo "Ressourcen …"
"$BT/aapt2" compile --dir res -o "$OUT/res.zip"
"$BT/aapt2" link -o "$OUT/base.apk" -I "$JAR" --manifest AndroidManifest.xml \
  -A "$OUT/assets" --java "$OUT/gen" "$OUT/res.zip" \
  --min-sdk-version 24 --target-sdk-version 34 \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME"

echo "Java …"
javac -source 8 -target 8 -Xlint:-options -encoding UTF-8 \
  -bootclasspath "$JAR" -classpath "$JAR" -d "$OUT/classes" \
  "$OUT/gen/de/julipod/app/R.java" src/de/julipod/app/*.java
"$BT/d8" --release --min-api 24 --lib "$JAR" --output "$OUT/dex" $(find "$OUT/classes" -name '*.class')

echo "APK zusammenbauen …"
python3 - "$OUT/base.apk" "$OUT/dex/classes.dex" "$OUT/unsigned.apk" <<'PY'
import shutil, sys, zipfile
src, dex, dst = sys.argv[1:]
shutil.copy(src, dst)
with zipfile.ZipFile(dst, "a", zipfile.ZIP_DEFLATED) as z:
    z.write(dex, "classes.dex")
PY
"$BT/zipalign" -p -f 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

if [ ! -f "$KEYSTORE" ]; then
  echo "Neuen Signier-Schlüssel erzeugen: $KEYSTORE"
  keytool -genkeypair -keystore "$KEYSTORE" -alias julipod -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$PASS" -keypass "$PASS" -dname "CN=juliPod, O=Familie" >/dev/null
fi
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-key-alias julipod --ks-pass "pass:$PASS" --key-pass "pass:$PASS" \
  --out ../juliPod.apk "$OUT/aligned.apk"
"$BT/apksigner" verify ../juliPod.apk
echo "Fertig: $(cd .. && pwd)/juliPod.apk ($(du -h ../juliPod.apk | cut -f1))"
