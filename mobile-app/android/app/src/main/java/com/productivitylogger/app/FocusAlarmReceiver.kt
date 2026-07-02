package com.productivitylogger.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Fires a scheduled focus session at its exact time (even if the app is closed) by starting the
 * LockdownOverlayService. Also re-arms a pending schedule after device reboot (BOOT_COMPLETED).
 */
class FocusAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action == Intent.ACTION_BOOT_COMPLETED) {
            FocusScheduleModule.rearmFromPrefs(context)
            return
        }
        val durationMs = intent?.getLongExtra("durationMs", 600_000L) ?: 600_000L
        val strictness = intent?.getStringExtra("strictness") ?: "normal"
        val svc = Intent(context, LockdownOverlayService::class.java).apply {
            putExtra("durationMs", durationMs)
            putExtra("strictness", strictness)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(svc)
        else context.startService(svc)
        // one-shot: clear the persisted schedule so it doesn't re-arm on next boot
        context.getSharedPreferences("focus_schedule", Context.MODE_PRIVATE).edit().clear().apply()
    }
}
