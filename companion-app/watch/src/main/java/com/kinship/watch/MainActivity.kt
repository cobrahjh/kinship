package com.kinship.watch

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.Log
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.gms.wearable.Wearable
import com.kinship.watch.databinding.ActivityMainBinding
import kotlinx.coroutines.*
import kotlinx.coroutines.tasks.await
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

class MainActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "KinshipWatch"
        private const val AUDIO_PATH = "/kinship/audio"
        private const val SAMPLE_RATE = 16000
        private const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
        private const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
    }

    private lateinit var binding: ActivityMainBinding
    private var isRecording = false
    private var recordingJob: Job? = null
    private var audioRecord: AudioRecord? = null

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            Toast.makeText(this, "Ready to record", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(this, "Microphone permission required", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupUI()
        checkPermission()
    }

    private fun setupUI() {
        binding.btnRecord.setOnClickListener {
            if (isRecording) {
                stopRecording()
            } else {
                startRecording()
            }
        }

        updateUI()
    }

    private fun checkPermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    private fun startRecording() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
            return
        }

        isRecording = true
        updateUI()
        vibrate()

        recordingJob = lifecycleScope.launch(Dispatchers.IO) {
            try {
                val bufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT)

                audioRecord = AudioRecord(
                    MediaRecorder.AudioSource.MIC,
                    SAMPLE_RATE,
                    CHANNEL_CONFIG,
                    AUDIO_FORMAT,
                    bufferSize
                )

                val outputStream = ByteArrayOutputStream()
                val buffer = ByteArray(bufferSize)

                audioRecord?.startRecording()
                Log.d(TAG, "Recording started")

                while (isRecording && isActive) {
                    val read = audioRecord?.read(buffer, 0, bufferSize) ?: 0
                    if (read > 0) {
                        outputStream.write(buffer, 0, read)
                    }
                }

                audioRecord?.stop()
                audioRecord?.release()
                audioRecord = null

                val pcmData = outputStream.toByteArray()
                Log.d(TAG, "Recording stopped: ${pcmData.size} bytes PCM")

                if (pcmData.isNotEmpty()) {
                    val wavData = createWavData(pcmData)
                    Log.d(TAG, "Converted to WAV: ${wavData.size} bytes")
                    sendToPhone(wavData)
                }

            } catch (e: Exception) {
                Log.e(TAG, "Recording error", e)
                withContext(Dispatchers.Main) {
                    Toast.makeText(this@MainActivity, "Recording failed", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun stopRecording() {
        isRecording = false
        updateUI()
        vibrate()
    }

    /**
     * Convert raw PCM data to WAV format by adding a 44-byte header
     */
    private fun createWavData(pcmData: ByteArray): ByteArray {
        val channels = 1 // Mono
        val bitsPerSample = 16
        val byteRate = SAMPLE_RATE * channels * bitsPerSample / 8
        val blockAlign = channels * bitsPerSample / 8
        val dataSize = pcmData.size
        val fileSize = 36 + dataSize

        val header = ByteBuffer.allocate(44).apply {
            order(ByteOrder.LITTLE_ENDIAN)

            // RIFF header
            put("RIFF".toByteArray())
            putInt(fileSize)
            put("WAVE".toByteArray())

            // fmt subchunk
            put("fmt ".toByteArray())
            putInt(16) // Subchunk1Size for PCM
            putShort(1) // AudioFormat: PCM = 1
            putShort(channels.toShort())
            putInt(SAMPLE_RATE)
            putInt(byteRate)
            putShort(blockAlign.toShort())
            putShort(bitsPerSample.toShort())

            // data subchunk
            put("data".toByteArray())
            putInt(dataSize)
        }

        return header.array() + pcmData
    }

    private suspend fun sendToPhone(audioData: ByteArray) {
        try {
            withContext(Dispatchers.Main) {
                binding.txtStatus.text = "Sending..."
            }

            // Get connected nodes (phones)
            val nodeClient = Wearable.getNodeClient(this)
            val nodes = nodeClient.connectedNodes.await()

            if (nodes.isEmpty()) {
                withContext(Dispatchers.Main) {
                    binding.txtStatus.text = "No phone connected"
                    Toast.makeText(this@MainActivity, "Phone not connected", Toast.LENGTH_SHORT).show()
                }
                return
            }

            // Send to each connected node
            val messageClient = Wearable.getMessageClient(this)

            for (node in nodes) {
                try {
                    messageClient.sendMessage(node.id, AUDIO_PATH, audioData).await()
                    Log.d(TAG, "Sent ${audioData.size} bytes to ${node.displayName}")
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to send to ${node.displayName}", e)
                }
            }

            withContext(Dispatchers.Main) {
                binding.txtStatus.text = "Sent!"
                Toast.makeText(this@MainActivity, "Sent to phone", Toast.LENGTH_SHORT).show()

                // Reset status after delay
                delay(2000)
                binding.txtStatus.text = "Tap to record"
            }

        } catch (e: Exception) {
            Log.e(TAG, "Send error", e)
            withContext(Dispatchers.Main) {
                binding.txtStatus.text = "Send failed"
                Toast.makeText(this@MainActivity, "Send failed", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun updateUI() {
        if (isRecording) {
            binding.btnRecord.setImageResource(R.drawable.ic_stop)
            binding.btnRecord.setBackgroundResource(R.drawable.record_button_active)
            binding.txtStatus.text = "Recording..."
        } else {
            binding.btnRecord.setImageResource(R.drawable.ic_mic)
            binding.btnRecord.setBackgroundResource(R.drawable.record_button)
            binding.txtStatus.text = "Tap to record"
        }
    }

    private fun vibrate() {
        val vibrator = getSystemService(Vibrator::class.java)
        vibrator?.vibrate(VibrationEffect.createOneShot(50, VibrationEffect.DEFAULT_AMPLITUDE))
    }

    override fun onDestroy() {
        super.onDestroy()
        isRecording = false
        recordingJob?.cancel()
        audioRecord?.release()
    }
}
