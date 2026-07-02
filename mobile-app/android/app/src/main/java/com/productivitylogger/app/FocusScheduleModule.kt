package com.productivitylogger.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Schedules a focus session for a future time via exact alarms (ARCHITECTURE §5.3 / §7). The alarm starts
 * the LockdownOverlayService even if the app is closed; the schedule is persisted so a boot receiver can
 * re-arm it after reboot.
 */
class FocusScheduleModule(private val ctx: ReactApplicationContext) :
    ReactContextBaseJavaModule(ctx) {

    override fun getName() = "FocusSchedule"

    @ReactMethod
    fun schedule(atMs: Double, durationMs: Double, strictness: String, promise: Promise) {
        try {
            val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val pi = buildPendingIntent(ctx, durationMs.toLong(), strictness)
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs.toLong(), pi)
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putLong("atMs", atMs.toLong())
                .putLong("durationMs", durationMs.toLong())
                .putString("strictness", strictness)
                .apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SCHEDULE_FAILED", e)
        }
    }

    @ReactMethod
    fun cancel(promise: Promise) {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.cancel(buildPendingIntent(ctx, 0L, "normal"))
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
        promise.resolve(true)
    }

    companion object {
        private const val PREFS = "focus_schedule"
        private const val REQUEST_CODE = 7788

        private fun buildPendingIntent(context: Context, durationMs: Long, strictness: String): PendingIntent {
            val i = Intent(context, FocusAlarmReceiver::class.java).apply {
                action = "com.productivitylogger.app.FOCUS_ALARM"
                putExtra("durationMs", durationMs)
                putExtra("strictness", strictness)
            }
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            return PendingIntent.getBroadcast(context, REQUEST_CODE, i, flags)
        }

        /** Re-arm a still-future schedule after reboot. */
        fun rearmFromPrefs(context: Context) {
            val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val atMs = p.getLong("atMs", 0L)
            if (atMs <= System.currentTimeMillis()) return
            val durationMs = p.getLong("durationMs", 600_000L)
            val strictness = p.getString("strictness", "normal") ?: "normal"
            val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, buildPendingIntent(context, durationMs, strictness))
        }
    }
}
