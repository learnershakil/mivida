package com.productivitylogger.app

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Bridge for the extreme-focus system overlay (best-effort lockdown that survives leaving the app).
 * Requires the "display over other apps" permission (SYSTEM_ALERT_WINDOW).
 */
class LockdownOverlayModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "LockdownOverlay"

    @ReactMethod
    fun canDrawOverlays(promise: Promise) {
        promise.resolve(Settings.canDrawOverlays(reactContext))
    }

    /** Open the system "display over other apps" settings screen for this app. */
    @ReactMethod
    fun requestOverlayPermission(promise: Promise) {
        if (!Settings.canDrawOverlays(reactContext)) {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${reactContext.packageName}"),
            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
        }
        promise.resolve(Settings.canDrawOverlays(reactContext))
    }

    @ReactMethod
    fun startLockdown(durationMs: Double, strictness: String, promise: Promise) {
        if (!Settings.canDrawOverlays(reactContext)) {
            promise.reject("NO_OVERLAY_PERMISSION", "Display-over-other-apps permission not granted")
            return
        }
        val intent = Intent(reactContext, LockdownOverlayService::class.java).apply {
            putExtra("durationMs", durationMs.toLong())
            putExtra("strictness", strictness)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) reactContext.startForegroundService(intent)
        else reactContext.startService(intent)
        promise.resolve(true)
    }

    @ReactMethod
    fun stopLockdown(promise: Promise) {
        reactContext.stopService(Intent(reactContext, LockdownOverlayService::class.java))
        promise.resolve(true)
    }
}
