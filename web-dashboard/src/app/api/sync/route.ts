import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// In a real app, this would be highly complex mapping WatermelonDB tables to Prisma tables
// For this single-user "mi vida" app, we map the incoming changes to Prisma creates/updates/deletes.

export async function POST(req: NextRequest) {
  try {
    const httpKey = req.headers.get('x-http-key');
    
    if (!httpKey) {
      return NextResponse.json({ error: 'Unauthorized: Missing x-http-key' }, { status: 401 });
    }

    const user = await prisma.user.upsert({
      where: { xHttpKey: httpKey },
      update: {
        wakatimeUsername: process.env.WAKATIME_USERNAME || undefined,
        wakatimePassword: process.env.WAKATIME_PASSWORD || undefined,
      },
      create: {
        xHttpKey: httpKey,
        name: 'My Dashboard User',
        wakatimeUsername: process.env.WAKATIME_USERNAME || undefined,
        wakatimePassword: process.env.WAKATIME_PASSWORD || undefined,
      },
    });

    const body = await req.json();
    const { changes, lastPulledAt } = body;

    if (!changes) {
      return NextResponse.json({ error: 'Bad Request: Missing changes payload' }, { status: 400 });
    }

    // Delta Sync Processing (Pseudo-implementation for WatermelonDB sync)
    // WatermelonDB sends { table: { created: [...], updated: [...], deleted: [...] } }
    
    await prisma.$transaction(async (tx) => {
      // 1. Process Tasks
      if (changes.tasks) {
        for (const task of changes.tasks.created || []) {
          await tx.task.create({
            data: {
              id: task.id,
              userId: user.id,
              title: task.title,
              description: task.description,
              category: task.category,
              type: task.type,
              startDate: task.start_date,
              endDate: task.end_date,
              startTime: task.start_time,
              endTime: task.end_time,
              isCompleted: task.is_completed,
              completionRemark: task.completion_remark,
              contactId: task.contact_id,
            }
          });
        }
        for (const task of changes.tasks.updated || []) {
          await tx.task.update({
            where: { id: task.id },
            data: {
              title: task.title,
              description: task.description,
              category: task.category,
              type: task.type,
              startDate: task.start_date,
              endDate: task.end_date,
              startTime: task.start_time,
              endTime: task.end_time,
              isCompleted: task.is_completed,
              completionRemark: task.completion_remark,
              contactId: task.contact_id,
            }
          });
        }
        for (const id of changes.tasks.deleted || []) {
          await tx.task.update({
            where: { id },
            data: { deletedAt: new Date() } // Soft delete
          });
        }
      }

      // 2. Process Contacts
      if (changes.contacts) {
         for (const contact of changes.contacts.created || []) {
           await tx.contact.create({
             data: {
               id: contact.id,
               userId: user.id,
               name: contact.name,
               email: contact.email,
               phone: contact.phone,
               socials: contact.socials,
             }
           });
         }
         // ... Similar logic for updated and deleted
      }

      // 3. Process Settings (Since there's only one Settings row per user usually)
      if (changes.settings) {
         for (const setting of changes.settings.updated || []) {
           await tx.setting.upsert({
             where: { userId: user.id },
             update: {
                focusLockdownMode: setting.focus_lockdown_mode,
                focusAllowIncomingCalls: setting.focus_allow_incoming_calls,
                dayMode: setting.day_mode,
                fatigueScreenTimeThresholdHours: setting.fatigue_screen_time_threshold_hours,
                fatigueStepsThreshold: setting.fatigue_steps_threshold,
                lastSyncTimestamp: setting.last_sync_timestamp,
             },
             create: {
                userId: user.id,
                focusLockdownMode: setting.focus_lockdown_mode,
                focusAllowIncomingCalls: setting.focus_allow_incoming_calls,
                dayMode: setting.day_mode,
                fatigueScreenTimeThresholdHours: setting.fatigue_screen_time_threshold_hours,
                fatigueStepsThreshold: setting.fatigue_steps_threshold,
                lastSyncTimestamp: setting.last_sync_timestamp,
             }
           });
         }
      }
    });

    const currentTimestamp = Date.now();

    return NextResponse.json({
      success: true,
      timestamp: currentTimestamp
    });
  } catch (error) {
    console.error('Sync Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const httpKey = req.headers.get('x-http-key');
    
    if (!httpKey) {
      return NextResponse.json({ error: 'Unauthorized: Missing x-http-key' }, { status: 401 });
    }

    const user = await prisma.user.upsert({
      where: { xHttpKey: httpKey },
      update: {
        wakatimeUsername: process.env.WAKATIME_USERNAME || undefined,
        wakatimePassword: process.env.WAKATIME_PASSWORD || undefined,
      },
      create: {
        xHttpKey: httpKey,
        name: 'My Dashboard User',
        wakatimeUsername: process.env.WAKATIME_USERNAME || undefined,
        wakatimePassword: process.env.WAKATIME_PASSWORD || undefined,
      },
    });

    const { searchParams } = new URL(req.url);
    const lastPulledAt = searchParams.get('lastPulledAt');
    const lastPulledDate = lastPulledAt && lastPulledAt !== '0' ? new Date(parseInt(lastPulledAt)) : new Date(0);

    const newCodingLogs = await prisma.codingLog.findMany({
      where: {
        userId: user.id,
        updatedAt: { gt: lastPulledDate }
      }
    });

    const formattedCodingLogs = newCodingLogs.map(log => ({
      id: log.id,
      user_id: log.userId,
      date: Number(log.date),
      duration: log.duration,
      project: log.project,
      language: log.language,
      created_at: log.createdAt.getTime(),
      updated_at: log.updatedAt.getTime(),
    }));

    const serverChanges = {
      tasks: { created: [], updated: [], deleted: [] },
      contacts: { created: [], updated: [], deleted: [] },
      settings: { created: [], updated: [], deleted: [] },
      coding_logs: { created: formattedCodingLogs, updated: [], deleted: [] }
    };

    const currentTimestamp = Date.now();

    return NextResponse.json({
      changes: serverChanges,
      timestamp: currentTimestamp
    });
  } catch (error) {
    console.error('Sync Pull Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

