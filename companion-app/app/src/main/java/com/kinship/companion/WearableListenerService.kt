package com.kinship.companion

import android.content.Intent
import android.util.Log
import com.google.android.gms.wearable.*
import kotlinx.coroutines.*
import kotlinx.coroutines.tasks.await

/**
 * Service that receives data from the Samsung/Wear OS watch
 * Handles audio recordings and activity data sent from watch
 */
class WearableListenerService : com.google.android.gms.wearable.WearableListenerService() {

    companion object {
        private const val TAG = "WearableListener"
        private const val AUDIO_PATH = "/kinship/audio"
        private const val ACTIVITY_PATH = "/kinship/activity"
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private lateinit var api: KinshipApi

    override fun onCreate() {
        super.onCreate()
        api = KinshipApi(applicationContext)
        Log.d(TAG, "WearableListenerService created")
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }

    /**
     * Handle messages from the watch
     */
    override fun onMessageReceived(messageEvent: MessageEvent) {
        Log.d(TAG, "Message received: ${messageEvent.path}")

        when {
            messageEvent.path.startsWith(AUDIO_PATH) -> {
                handleAudioMessage(messageEvent)
            }
            messageEvent.path.startsWith(ACTIVITY_PATH) -> {
                handleActivityMessage(messageEvent)
            }
        }
    }

    /**
     * Handle data items changed (for larger data like audio files)
     */
    override fun onDataChanged(dataEvents: DataEventBuffer) {
        dataEvents.forEach { event ->
            if (event.type == DataEvent.TYPE_CHANGED) {
                val dataItem = event.dataItem
                Log.d(TAG, "Data changed: ${dataItem.uri.path}")

                when {
                    dataItem.uri.path?.startsWith(AUDIO_PATH) == true -> {
                        handleAudioDataItem(dataItem)
                    }
                }
            }
        }
    }

    private fun handleAudioMessage(messageEvent: MessageEvent) {
        val audioData = messageEvent.data

        if (audioData.isNotEmpty()) {
            scope.launch {
                try {
                    Log.d(TAG, "Uploading audio: ${audioData.size} bytes")

                    val result = api.uploadAudioBytes(
                        audioData = audioData,
                        filename = "watch_${System.currentTimeMillis()}.wav",
                        context = "auto"
                    )

                    result.onSuccess {
                        Log.d(TAG, "Audio uploaded successfully: entryId=${it.entryId}")
                        showNotification("Voice note uploaded", "Entry saved to Kinship")
                    }.onFailure {
                        Log.e(TAG, "Audio upload failed", it)
                        showNotification("Upload failed", it.message ?: "Unknown error")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error uploading audio", e)
                }
            }
        }
    }

    private fun handleAudioDataItem(dataItem: DataItem) {
        val dataMap = DataMapItem.fromDataItem(dataItem).dataMap
        val audioAsset = dataMap.getAsset("audio")

        if (audioAsset != null) {
            scope.launch {
                try {
                    val client = Wearable.getDataClient(applicationContext)
                    val inputStream = client.getFdForAsset(audioAsset).await().inputStream
                    val audioData = inputStream.readBytes()
                    inputStream.close()

                    Log.d(TAG, "Received audio asset: ${audioData.size} bytes")

                    val result = api.uploadAudioBytes(
                        audioData = audioData,
                        filename = "watch_${System.currentTimeMillis()}.wav",
                        context = dataMap.getString("context", "auto")
                    )

                    result.onSuccess {
                        Log.d(TAG, "Audio uploaded from asset: entryId=${it.entryId}")
                        showNotification("Voice note uploaded", "Entry saved to Kinship")
                    }.onFailure {
                        Log.e(TAG, "Audio asset upload failed", it)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error processing audio asset", e)
                }
            }
        }
    }

    private fun handleActivityMessage(messageEvent: MessageEvent) {
        val json = String(messageEvent.data)

        scope.launch {
            try {
                val activity = com.google.gson.Gson().fromJson(
                    json,
                    KinshipApi.ActivityData::class.java
                )

                val result = api.postActivity(activity)

                result.onSuccess {
                    Log.d(TAG, "Activity synced: ${activity.steps} steps")
                }.onFailure {
                    Log.e(TAG, "Activity sync failed", it)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error parsing activity data", e)
            }
        }
    }

    private fun showNotification(title: String, message: String) {
        val notificationManager = getSystemService(NOTIFICATION_SERVICE) as android.app.NotificationManager

        val notification = android.app.Notification.Builder(this, KinshipApp.CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(message)
            .setSmallIcon(android.R.drawable.ic_menu_upload)
            .setAutoCancel(true)
            .build()

        notificationManager.notify(System.currentTimeMillis().toInt(), notification)
    }
}

// Use kotlinx.coroutines.tasks.await imported above
