# Kinship Companion App Installation Guide

## Prerequisites

1. Android phone (Android 9+)
2. Samsung Galaxy Watch or Wear OS watch (Wear OS 3.0+)
3. ADB installed on your computer
4. USB debugging enabled on phone and watch

## Step 1: Enable Developer Options

### On Phone:
1. Go to **Settings > About Phone**
2. Tap **Build Number** 7 times
3. Go back to **Settings > Developer Options**
4. Enable **USB Debugging**

### On Watch:
1. Go to **Settings > About Watch**
2. Tap **Software Version** 7 times
3. Go back to **Settings > Developer Options**
4. Enable **ADB Debugging**
5. Enable **Debug over WiFi** or connect via USB

## Step 2: Connect Devices

### Phone:
```bash
# Connect phone via USB
adb devices
# Should show your phone listed
```

### Watch (WiFi):
```bash
# On watch, note the IP address shown in Developer Options
adb connect <watch-ip>:5555
adb devices
# Should show both phone and watch
```

## Step 3: Install APKs

### Install Phone App:
```bash
cd C:\kinship
adb install apks/kinship-companion-phone/app-debug.apk
```

### Install Watch App:
```bash
# List devices to find watch ID
adb devices

# Install to watch (use the watch device ID)
adb -s <watch-device-id> install apks/kinship-companion-watch/watch-debug.apk
```

## Step 4: Configure Phone App

1. Open **Kinship Companion** on your phone
2. Enter your Kinship server URL (e.g., `http://192.168.1.100:8766`)
3. Tap **Test Connection** to verify
4. Grant notification permissions when prompted

## Step 5: Use Watch App

1. Open **Kinship** on your watch
2. Grant microphone permission when prompted
3. Tap the microphone button to start recording
4. Tap again to stop and send to phone
5. The phone app will upload to your Kinship server

## Troubleshooting

### Watch not connecting to phone:
- Ensure both devices are on the same Google account
- Check that Wear OS app is installed on phone
- Restart both devices

### Audio not uploading:
- Check phone has internet connection
- Verify server URL is correct in phone app settings
- Check Kinship server is running

### ADB not finding watch:
- Try `adb disconnect` then `adb connect <ip>:5555` again
- Restart ADB: `adb kill-server && adb start-server`
- Re-enable ADB debugging on watch

## File Locations

| File | Location |
|------|----------|
| Phone Debug APK | `apks/kinship-companion-phone/app-debug.apk` |
| Watch Debug APK | `apks/kinship-companion-watch/watch-debug.apk` |
| Phone Release APK | `apks/kinship-companion-release/app/build/outputs/apk/release/app-release-unsigned.apk` |
| Watch Release APK | `apks/kinship-companion-release/watch/build/outputs/apk/release/watch-release-unsigned.apk` |
