package com.mivida.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.CountDownTimer
import android.os.IBinder
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.TextView

/**
 * Foreground service that draws a full-screen TYPE_APPLICATION_OVERLAY lockdown window with a countdown
 * and (unless strictness=extreme) an emergency Dialer button. Survives leaving the app; a foreground
 * service keeps it alive. Best-effort on stock non-rooted Android (documented in AUDIT §5.4).
 */
class LockdownOverlayService : Service() {
    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private var timer: CountDownTimer? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val durationMs = intent?.getLongExtra("durationMs", 600_000L) ?: 600_000L
        val strictness = intent?.getStringExtra("strictness") ?: "normal"
        startForegroundNotification()
        showOverlay(durationMs, strictness)
        return START_STICKY
    }

    private fun startForegroundNotification() {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Focus Lockdown", NotificationManager.IMPORTANCE_LOW),
            )
        }
        val notif = Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Focus Mode active")
            .setContentText("Stay focused.")
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setOngoing(true)
            .build()
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIF_ID, notif)
        }
    }

    private fun showOverlay(durationMs: Long, strictness: String) {
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager

        val root = FrameLayout(this).apply { setBackgroundColor(Color.parseColor("#000000")) }

        val title = TextView(this).apply {
            setTextColor(Color.parseColor("#FF453A"))
            textSize = 16f
            text = "FOCUS MODE"
            gravity = Gravity.CENTER
        }
        root.addView(title, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT,
        ).apply { gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL; topMargin = 220 })

        val countdown = TextView(this).apply {
            setTextColor(Color.parseColor("#C0F67F"))
            textSize = 56f
            gravity = Gravity.CENTER
        }
        root.addView(countdown, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT,
        ))

        // Dialer button — shown for normal/strict, hidden for extreme.
        if (strictness != "extreme") {
            val dialer = Button(this).apply {
                text = "Open Dialer"
                setOnClickListener {
                    startActivity(Intent(Intent.ACTION_DIAL).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                }
            }
            root.addView(dialer, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT,
            ).apply { gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL; bottomMargin = 180 })
        }

        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        else @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            type,
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
            PixelFormat.OPAQUE,
        )

        overlayView = root
        windowManager?.addView(root, params)

        timer = object : CountDownTimer(durationMs, 1000) {
            override fun onTick(ms: Long) {
                val s = ms / 1000
                countdown.text = String.format("%02d:%02d", s / 60, s % 60)
            }
            override fun onFinish() { stopSelf() }
        }.start()
    }

    override fun onDestroy() {
        timer?.cancel()
        overlayView?.let { runCatching { windowManager?.removeView(it) } }
        overlayView = null
        super.onDestroy()
    }

    companion object {
        private const val CHANNEL_ID = "focus_lockdown_fg"
        private const val NOTIF_ID = 4711
    }
}
