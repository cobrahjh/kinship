package com.kinship.companion

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.kinship.companion.databinding.ActivityMainBinding
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var api: KinshipApi

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.values.all { it }
        if (allGranted) {
            Toast.makeText(this, "Permissions granted", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(this, "Some permissions denied", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        api = KinshipApi(this)

        setupUI()
        loadSettings()
        checkPermissions()
    }

    private fun setupUI() {
        // Save server URL
        binding.btnSaveUrl.setOnClickListener {
            val url = binding.editServerUrl.text.toString().trim()
            if (url.isNotEmpty()) {
                lifecycleScope.launch {
                    api.setServerUrl(url)
                    Toast.makeText(this@MainActivity, "Server URL saved", Toast.LENGTH_SHORT).show()
                    testConnection()
                }
            }
        }

        // Test connection
        binding.btnTestConnection.setOnClickListener {
            testConnection()
        }

        // Manual sync
        binding.btnSyncNow.setOnClickListener {
            lifecycleScope.launch {
                binding.btnSyncNow.isEnabled = false
                binding.btnSyncNow.text = "Syncing..."

                val result = api.checkConnection()
                result.onSuccess {
                    updateStatus("Connected", true)
                    Toast.makeText(this@MainActivity, "Sync triggered", Toast.LENGTH_SHORT).show()
                }.onFailure {
                    updateStatus("Disconnected", false)
                    Toast.makeText(this@MainActivity, "Sync failed: ${it.message}", Toast.LENGTH_SHORT).show()
                }

                binding.btnSyncNow.isEnabled = true
                binding.btnSyncNow.text = "Sync Now"
            }
        }
    }

    private fun loadSettings() {
        lifecycleScope.launch {
            val serverUrl = api.getServerUrl()
            binding.editServerUrl.setText(serverUrl)
            testConnection()
        }
    }

    private fun testConnection() {
        lifecycleScope.launch {
            binding.txtStatus.text = "Checking..."
            binding.statusIndicator.setBackgroundColor(
                ContextCompat.getColor(this@MainActivity, android.R.color.darker_gray)
            )

            val result = api.checkConnection()

            result.onSuccess { connected ->
                if (connected) {
                    updateStatus("Connected", true)
                } else {
                    updateStatus("Server error", false)
                }
            }.onFailure {
                updateStatus("Disconnected", false)
            }
        }
    }

    private fun updateStatus(text: String, connected: Boolean) {
        binding.txtStatus.text = text
        binding.statusIndicator.setBackgroundColor(
            ContextCompat.getColor(
                this,
                if (connected) android.R.color.holo_green_dark else android.R.color.holo_red_dark
            )
        )
    }

    private fun checkPermissions() {
        val permissions = mutableListOf<String>()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                permissions.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED
        ) {
            permissions.add(Manifest.permission.RECORD_AUDIO)
        }

        if (permissions.isNotEmpty()) {
            requestPermissionLauncher.launch(permissions.toTypedArray())
        }
    }
}
