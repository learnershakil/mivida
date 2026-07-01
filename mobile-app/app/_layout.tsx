import { useEffect, useState } from 'react';
import { Stack } from "expo-router";
import { LogBox } from 'react-native';
import { DatabaseProvider } from '@nozbe/watermelondb/DatabaseProvider'
import notifee, { EventType } from '@notifee/react-native';
import { database } from '../database'
import { LockdownOverlay } from '../components/LockdownOverlay'
import DeadManPrompt from '../components/DeadManPrompt'
import { initializeUser } from '../services/userService'
import { notificationService } from '../services/notifications'
import { deadManService } from '../services/deadMan'
import { alertService } from '../services/alertService'
import { soundService } from '../services/soundService'
import { appEvents, AppEvents } from '../services/appEvents'
import '../global.css'

// Suppress known non-critical warnings
LogBox.ignoreLogs([
  'Unable to activate keep awake',
  'SafeAreaView has been deprecated',
  '[expo-av]: Expo AV has been deprecated',
]);

// Handle unhandled promise rejections for non-critical errors
const originalHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
  // Suppress expo-keep-awake errors (non-critical on some devices/emulators)
  if (error?.message?.includes('Unable to activate keep awake')) {
    console.warn('[App] Keep awake not supported on this device, continuing...');
    return;
  }
  // Pass other errors to the original handler
  originalHandler(error, isFatal);
});

// Register background event handler for notifee (outside of component)
notifee.onBackgroundEvent(async ({ type, detail }) => {
  const { notification, pressAction } = detail;

  console.log('[Notifee Background] Event:', type, notification?.id);

  // Handle mood check-in notification
  if (notification?.data?.action === 'mood_check') {
    if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
      console.log('[Notifee Background] Mood check-in pressed');
      appEvents.emit(AppEvents.SHOW_MOOD_MODAL);
      return;
    }
  }

  // Handle alert task notifications
  if (notification?.id?.startsWith('alert_')) {
    const taskId = notification.data?.taskId as string;

    if (type === EventType.DELIVERED) {
      // Notification was delivered - alert triggered
      console.log('[Notifee Background] Alert delivered for task:', taskId);
      // Note: handleAlertTriggered will be called when user interacts
    }

    if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
      // User tapped notification or action button
      console.log('[Notifee Background] Alert pressed for task:', taskId);
      if (taskId) {
        await alertService.handleAlertTriggered(taskId);
      }
    }
  }
});

export default function Layout() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    async function initialize() {
      try {
        // Initialize user and settings
        const { user } = await initializeUser();
        setUserId(user.id);

        // Initialize notification service
        await notificationService.init(user.id);

        // Initialize sound service
        await soundService.init(user.id);

        // Initialize alert service and reschedule any active alerts
        await alertService.init(user.id);
        await alertService.rescheduleActiveAlerts();

        // Start Dead Man's Switch monitoring if user is awake
        if (user.isAwake) {
          await deadManService.start(user.id);
        }

        setIsInitialized(true);
        console.log('[App] Initialized successfully');
      } catch (error) {
        console.error('[App] Initialization failed:', error);
        setIsInitialized(true); // Continue anyway
      }
    }

    initialize();

    // Setup foreground event listener for alert notifications
    const unsubscribe = notifee.onForegroundEvent(async ({ type, detail }) => {
      const { notification } = detail;

      // Handle mood check-in notification
      if (notification?.data?.action === 'mood_check') {
        if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
          console.log('[Notifee Foreground] Mood check-in pressed');
          appEvents.emit(AppEvents.SHOW_MOOD_MODAL);
          return;
        }
      }

      if (notification?.id?.startsWith('alert_')) {
        const taskId = notification.data?.taskId as string;

        if (type === EventType.DELIVERED) {
          console.log('[Notifee Foreground] Alert delivered for task:', taskId);
        }

        if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
          console.log('[Notifee Foreground] Alert pressed for task:', taskId);
          if (taskId) {
            await alertService.handleAlertTriggered(taskId);
          }
        }
      }
    });

    return () => {
      deadManService.stop();
      unsubscribe();
    };
  }, []);

  return (
    <DatabaseProvider database={database}>
      {/* Full-screen overlays */}
      <LockdownOverlay />
      {userId && <DeadManPrompt userId={userId} />}

      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </DatabaseProvider>
  );
}