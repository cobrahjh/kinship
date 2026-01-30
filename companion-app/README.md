# Kinship Companion App

Android companion app for Kinship that connects your Samsung Watch to the Kinship voice journal.

## Features

- **Voice Recording Sync**: Automatically uploads voice recordings from your watch to Kinship
- **Activity Data Sync**: Syncs steps, calories, heart rate, and active minutes
- **Background Sync**: Runs every 15 minutes to keep data up to date
- **Context Enrichment**: Voice entries are automatically tagged with your activity data

## Requirements

- Android 9.0 (API 28) or higher
- Samsung Galaxy Watch (Wear OS)
- Kinship server running on your local network

## Setup

1. **Build the app**:
   ```bash
   cd companion-app
   ./gradlew assembleDebug
   ```

2. **Install on your phone**:
   ```bash
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```

3. **Configure server URL**:
   - Open Kinship Companion app
   - Enter your Kinship server URL (e.g., `http://192.168.1.100:8766`)
   - Tap "Save" and "Test" to verify connection

## How It Works

### Voice Recording Flow
1. Record a voice note on your Samsung Watch
2. Watch sends recording to phone via Wear OS Data Layer
3. Companion app receives and uploads to Kinship server
4. Entry appears in your Kinship journal with transcription

### Activity Sync Flow
1. Companion app reads Samsung Health data periodically
2. Steps, calories, distance, active minutes are posted to Kinship
3. When you record a voice note, activity context is attached
4. Daily/weekly digests include activity summaries

## Project Structure

```
companion-app/
├── app/
│   ├── src/main/
│   │   ├── java/com/kinship/companion/
│   │   │   ├── KinshipApp.kt           # Application class
│   │   │   ├── MainActivity.kt          # Main UI
│   │   │   ├── KinshipApi.kt            # API client
│   │   │   ├── WearableListenerService.kt # Watch data receiver
│   │   │   ├── SyncWorker.kt            # Background sync
│   │   │   ├── SyncService.kt           # Foreground service
│   │   │   └── BootReceiver.kt          # Auto-start on boot
│   │   ├── res/
│   │   │   ├── layout/activity_main.xml
│   │   │   ├── values/
│   │   │   └── drawable/
│   │   └── AndroidManifest.xml
│   └── build.gradle.kts
├── build.gradle.kts
├── settings.gradle.kts
└── README.md
```

## API Endpoints Used

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/lifelog/ingest` | Upload voice recording |
| POST | `/api/plugins/wearable/activity` | Post activity data |
| GET | `/api/health` | Check server connectivity |

## Samsung Health Integration

To enable Samsung Health data sync:

1. Register as a Samsung Developer at https://developer.samsung.com
2. Get access to Samsung Health SDK
3. Add the SDK dependency to `build.gradle.kts`
4. Implement health data reading in `SyncWorker.kt`

Alternatively, use Android Health Connect API for a more standard approach.

## Permissions

- `INTERNET`: Connect to Kinship server
- `RECORD_AUDIO`: Capture voice recordings
- `POST_NOTIFICATIONS`: Show sync status notifications
- `RECEIVE_BOOT_COMPLETED`: Auto-start sync on device boot

## Troubleshooting

**"Disconnected" status**:
- Verify your phone and Kinship server are on the same network
- Check the server URL is correct
- Ensure Kinship server is running

**Voice recordings not uploading**:
- Check notification permissions are granted
- Verify watch is connected to phone
- Check Kinship server logs for errors

**Activity data not syncing**:
- Samsung Health permissions may be required
- Ensure background sync is not restricted by battery optimization
