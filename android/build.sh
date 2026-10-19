#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
: "${ANDROID_SDK_ROOT:?Set ANDROID_SDK_ROOT to the Android SDK directory}"
: "${ALUNORTE_KEYSTORE:?Set ALUNORTE_KEYSTORE to the private signing keystore}"
: "${ALUNORTE_STORE_PASSWORD:?Set ALUNORTE_STORE_PASSWORD}"
BUILD_TOOLS="$ANDROID_SDK_ROOT/build-tools/35.0.0"
PLATFORM="$ANDROID_SDK_ROOT/platforms/android-35/android.jar"
mkdir -p build/classes build/dex build/generated
"$BUILD_TOOLS/aapt2" compile --dir app/src/main/res -o build/resources.zip
"$BUILD_TOOLS/aapt2" link -o build/base.apk -I "$PLATFORM" --manifest app/src/main/AndroidManifest.xml --java build/generated build/resources.zip
find app/src/main/java build/generated -name '*.java' >build/sources.txt
java -m jdk.compiler/com.sun.tools.javac.Main --release 8 -classpath "$PLATFORM" -d build/classes @build/sources.txt
find build/classes -name '*.class' >build/classes.txt
"$BUILD_TOOLS/d8" --release --min-api 26 --lib "$PLATFORM" --output build/dex @build/classes.txt
cp build/base.apk build/unsigned.apk
(cd build/dex && zip -q ../unsigned.apk classes.dex)
"$BUILD_TOOLS/zipalign" -f -p 4 build/unsigned.apk build/aligned.apk
"$BUILD_TOOLS/apksigner" sign --ks "$ALUNORTE_KEYSTORE" --ks-key-alias alunorte --ks-pass env:ALUNORTE_STORE_PASSWORD --key-pass env:ALUNORTE_STORE_PASSWORD --out build/Mapa-Alunorte-0.2.0.apk build/aligned.apk
"$BUILD_TOOLS/apksigner" verify --verbose build/Mapa-Alunorte-0.2.0.apk
"$BUILD_TOOLS/zipalign" -c -v 4 build/Mapa-Alunorte-0.2.0.apk

