import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import Task from '../database/models/Task';

let defaultCalendarId: string | null = null;

export async function initCalendar() {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status === 'granted') {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const defaultCalendars = calendars.filter(each => each.source.name === 'Default' || each.source.type === 'local' || each.title.toLowerCase().includes('google'));
    
    if (defaultCalendars.length > 0) {
      defaultCalendarId = defaultCalendars[0].id;
    } else if (calendars.length > 0) {
      defaultCalendarId = calendars[0].id;
    }
  }
}

export async function syncTaskToCalendar(task: Task) {
  if (task.type !== 'custom' || !task.startTime || !task.endTime) return;
  if (!defaultCalendarId) await initCalendar();
  if (!defaultCalendarId) return;

  try {
    const eventId = await Calendar.createEventAsync(defaultCalendarId, {
      title: task.title,
      startDate: new Date(task.startTime),
      endDate: new Date(task.endTime),
      notes: task.description || '',
    });
    console.log(`[Calendar] Synced task ${task.title} to calendar (event ${eventId})`);
  } catch (error) {
    console.error('[Calendar] Error syncing task:', error);
  }
}
