// @ts-ignore - no type definitions available
import BackgroundTimer from 'react-native-background-timer';
import { AppState } from 'react-native';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import { database } from '../database';
import User from '../database/models/User';
import { Q } from '@nozbe/watermelondb';

const DEAD_MAN_TIMEOUT = 3 * 60 * 60 * 1000; // 3 Hours
let interactionTimer: number | null = null;
let lastInteraction = Date.now();

export const startDeadManSwitch = () => {
  console.log('Starting Dead Man Switch Monitor');

  // Start background timer
  BackgroundTimer.runBackgroundTimer(
    async () => {
      const isAwake = await checkUserStatus();
      if (!isAwake) return;

      const timeSinceInteraction = Date.now() - lastInteraction;

      if (timeSinceInteraction > DEAD_MAN_TIMEOUT) {
        triggerAlarm();
      }
    },
    15 * 60 * 1000
  ); // Check every 15 mins
};

export const stopDeadManSwitch = () => {
  BackgroundTimer.stopBackgroundTimer();
};

export const registerInteraction = () => {
  lastInteraction = Date.now();
  // Update DB async if needed, or just keep in memory for immediate check
  // Better to persist to DB periodically
};

async function checkUserStatus() {
  const users = await database.get<User>('users').query().fetch();
  const user = users[0];
  return user?.isAwake ?? false;
}

async function triggerAlarm() {
  await notifee.requestPermission();

  const channelId = await notifee.createChannel({
    id: 'dead-man-alarm',
    name: 'Critical Alerts',
    importance: AndroidImportance.HIGH,
    sound: 'default', // Custom sound later
  });

  await notifee.displayNotification({
    title: 'Are you distracted?',
    body: 'You have been awake but inactive for 3 hours. Type "FOCUS" to dismiss.',
    android: {
      channelId,
      importance: AndroidImportance.HIGH,
      actions: [
        {
          title: 'Reply',
          input: true,
          pressAction: { id: 'reply_input' },
        },
      ],
      fullScreenAction: {
        id: 'default',
      },
    },
  });
}
