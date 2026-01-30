package com.kinship.companion

import android.app.Notification
import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log

/**
 * Foreground service for active sync operations
 */
class SyncService : Service() {

    companion object {
        private const val TAG = "SyncService"
        private const val NOTIFICATION_ID = 1001
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "SyncService started")

        val notification = createNotification()
        startForeground(NOTIFICATION_ID, notification)

        // Service will be stopped after sync completes
        return START_NOT_STICKY
    }

    private fun createNotification(): Notification {
        return Notification.Builder(this, KinshipApp.CHANNEL_ID)
            .setContentTitle("Kinship Sync")
            .setContentText("Syncing with Kinship server...")
            .setSmallIcon(android.R.drawable.ic_popup_sync)
            .setOngoing(true)
            .build()
    }
}
