package com.productivitylogger.app

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class DeviceAdminModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "DeviceAdminModule"
    }

    @ReactMethod
    fun enableLockTask(promise: Promise) {
        try {
            val activity = getCurrentActivity()
            if (activity != null) {
                val dpm = reactApplicationContext.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
                if (dpm.isDeviceOwnerApp(reactApplicationContext.packageName)) {
                    val adminComponent = ComponentName(reactApplicationContext, AdminReceiver::class.java)
                    dpm.setLockTaskPackages(adminComponent, arrayOf(reactApplicationContext.packageName))
                }
                activity.startLockTask()
                promise.resolve(true)
            } else {
                promise.reject("E_NO_ACTIVITY", "Current activity is null")
            }
        } catch (e: Exception) {
            promise.reject("E_LOCK_TASK_FAILED", e)
        }
    }

    @ReactMethod
    fun disableLockTask(promise: Promise) {
        try {
            val activity = getCurrentActivity()
            if (activity != null) {
                activity.stopLockTask()
                promise.resolve(true)
            } else {
                promise.reject("E_NO_ACTIVITY", "Current activity is null")
            }
        } catch (e: Exception) {
            promise.reject("E_UNLOCK_TASK_FAILED", e)
        }
    }
}
