package com.kinship.companion

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.io.IOException

val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "kinship_settings")

class KinshipApi(private val context: Context) {

    companion object {
        private val SERVER_URL = stringPreferencesKey("server_url")
        private const val DEFAULT_URL = "http://192.168.1.100:8766"
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
        .writeTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
        .readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
        .build()

    private val gson = Gson()

    suspend fun getServerUrl(): String {
        return context.dataStore.data.map { preferences ->
            preferences[SERVER_URL] ?: DEFAULT_URL
        }.first()
    }

    suspend fun setServerUrl(url: String) {
        context.dataStore.edit { preferences ->
            preferences[SERVER_URL] = url
        }
    }

    /**
     * Upload audio recording to Kinship server
     */
    suspend fun uploadAudio(
        audioFile: File,
        context: String = "auto",
        device: String = "watch"
    ): Result<UploadResponse> = withContext(Dispatchers.IO) {
        try {
            val serverUrl = getServerUrl()

            val requestBody = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart(
                    "audio",
                    audioFile.name,
                    audioFile.readBytes().toRequestBody("audio/webm".toMediaType())
                )
                .addFormDataPart("device", device)
                .addFormDataPart("context", context)
                .addFormDataPart("timestamp", java.time.Instant.now().toString())
                .build()

            val request = Request.Builder()
                .url("$serverUrl/api/lifelog/ingest")
                .post(requestBody)
                .build()

            val response = client.newCall(request).execute()

            if (response.isSuccessful) {
                val body = response.body?.string() ?: "{}"
                val uploadResponse = gson.fromJson(body, UploadResponse::class.java)
                Result.success(uploadResponse)
            } else {
                Result.failure(IOException("Upload failed: ${response.code}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Upload audio from byte array (for watch recordings)
     */
    suspend fun uploadAudioBytes(
        audioData: ByteArray,
        filename: String = "watch_recording.wav",
        context: String = "auto"
    ): Result<UploadResponse> = withContext(Dispatchers.IO) {
        try {
            val serverUrl = getServerUrl()

            val requestBody = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart(
                    "audio",
                    filename,
                    audioData.toRequestBody("audio/wav".toMediaType())
                )
                .addFormDataPart("device", "watch")
                .addFormDataPart("context", context)
                .addFormDataPart("timestamp", java.time.Instant.now().toString())
                .build()

            val request = Request.Builder()
                .url("$serverUrl/api/lifelog/ingest")
                .post(requestBody)
                .build()

            val response = client.newCall(request).execute()

            if (response.isSuccessful) {
                val body = response.body?.string() ?: "{}"
                val uploadResponse = gson.fromJson(body, UploadResponse::class.java)
                Result.success(uploadResponse)
            } else {
                Result.failure(IOException("Upload failed: ${response.code}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Post activity data to wearable plugin
     */
    suspend fun postActivity(activity: ActivityData): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val serverUrl = getServerUrl()

            val json = gson.toJson(activity)
            val requestBody = json.toRequestBody("application/json".toMediaType())

            val request = Request.Builder()
                .url("$serverUrl/api/plugins/wearable/activity")
                .post(requestBody)
                .build()

            val response = client.newCall(request).execute()

            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(IOException("Activity post failed: ${response.code}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Check server connectivity
     */
    suspend fun checkConnection(): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val serverUrl = getServerUrl()

            val request = Request.Builder()
                .url("$serverUrl/api/health")
                .get()
                .build()

            val response = client.newCall(request).execute()
            Result.success(response.isSuccessful)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    data class UploadResponse(
        val success: Boolean,
        val entryId: Long?
    )

    data class ActivityData(
        val sourceId: String = "samsung-watch",
        val date: String,
        val steps: Int,
        val calories: Int,
        val distance: Double,
        val activeMinutes: Int,
        val heartRate: HeartRateData? = null
    )

    data class HeartRateData(
        val current: Int?,
        val avg: Int?,
        val min: Int?,
        val max: Int?
    )
}
