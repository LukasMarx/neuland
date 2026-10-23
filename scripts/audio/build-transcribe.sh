#!/bin/sh
# Baut scripts/audio/transcribe.swift als kleines App-Paket nach /tmp/Transcribe.app.
# Ein App-Paket braucht macOS, damit es nach der Spracherkennung fragen darf.
set -e
dir=$(cd "$(dirname "$0")" && pwd)
app=/tmp/Transcribe.app
rm -rf "$app"
mkdir -p "$app/Contents/MacOS"
swiftc -O "$dir/transcribe.swift" -o "$app/Contents/MacOS/transcribe"
cat > "$app/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>local.neuland.transcribe</string>
<key>CFBundleExecutable</key><string>transcribe</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleName</key><string>transcribe</string>
<key>NSSpeechRecognitionUsageDescription</key><string>Sprachclips für das Spiel Neuland abschreiben</string>
</dict></plist>
PLIST
codesign -s - --force "$app" >/dev/null
echo "$app"
