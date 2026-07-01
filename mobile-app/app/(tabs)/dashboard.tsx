import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Modal, TouchableOpacity } from 'react-native';
import { withObservables } from '@nozbe/watermelondb/react';
import { Activity, CheckCircle, XCircle, Music, Moon, Coffee, Lightbulb, Timer, BarChart3, ArrowUpRight, ArrowDownRight, IndianRupee, Flame, TrendingUp, Clock, Brain, Target } from 'lucide-react-native';
import { database } from '../../database';
import Task from '../../database/models/Task';
import MoodLog from '../../database/models/MoodLog';
import EventLog from '../../database/models/EventLog';
import FinanceLog from '../../database/models/FinanceLog';
import User from '../../database/models/User';
import DatabaseBrowser from '../../components/DatabaseBrowser';

interface DashboardScreenProps {
   tasks: Task[];
   moods: MoodLog[];
   events: EventLog[];
   finances: FinanceLog[];
   users: User[];
}

// Helper to format minutes nicely
const formatMinutes = (minutes: number): string => {
   if (minutes < 60) return `${Math.round(minutes)}m`;
   const hours = Math.floor(minutes / 60);
   const mins = Math.round(minutes % 60);
   return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

// Get greeting based on time of day
const getGreeting = (): string => {
   const hour = new Date().getHours();
   if (hour < 12) return 'Good Morning';
   if (hour < 17) return 'Good Afternoon';
   return 'Good Evening';
};

// Format currency in INR
const formatCurrency = (amount: number): string => {
   const absAmount = Math.abs(amount);
   const formatted = absAmount.toLocaleString('en-IN');
   return `${amount >= 0 ? '' : '-'}₹${formatted}`;
};

// Pro tips for productivity
const PRO_TIPS = [
   'Take a 5-min break every 25 minutes of focused work.',
   'Stay hydrated! Water boosts brain function by 14%.',
   'Complete your hardest task first thing in the morning.',
   'Celebrate small wins to maintain motivation.',
   'A 20-min nap can boost alertness by 100%.',
   'Review your goals every morning for better focus.',
   'Break big tasks into smaller, manageable chunks.',
   'Track your mood to identify productivity patterns.',
];

function DashboardScreen({ tasks, moods, events, finances, users }: DashboardScreenProps) {
   const [showDBBrowser, setShowDBBrowser] = useState(false);
   const [detailModal, setDetailModal] = useState<{ type: 'active' | 'completed' | 'cancelled' | 'music' | null; visible: boolean }>({ type: null, visible: false });
   const [tipIndex, setTipIndex] = useState(0);

   // Long press timer ref for greeting
   const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
   const pressStartTimeRef = useRef<number>(0);

   const user = users[0];

   // Cycle through tips
   useEffect(() => {
      const interval = setInterval(() => {
         setTipIndex(prev => (prev + 1) % PRO_TIPS.length);
      }, 8000);
      return () => clearInterval(interval);
   }, []);

   // 72-hour time window (yesterday + today + tomorrow)
   const timeWindow = useMemo(() => {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const dayAfterTomorrow = new Date(now);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      dayAfterTomorrow.setHours(0, 0, 0, 0);

      return { start: yesterday.getTime(), end: dayAfterTomorrow.getTime() };
   }, []);

   // Filter tasks within 72-hour window
   const windowTasks = useMemo(() => {
      return tasks.filter(task => {
         const taskTime = task.startTime || task.createdAt || 0;
         return taskTime >= timeWindow.start && taskTime < timeWindow.end;
      });
   }, [tasks, timeWindow]);

   // Filter events within 72-hour window
   const windowEvents = useMemo(() => {
      return events.filter(event => {
         const eventTime = event.createdAt || 0;
         return eventTime >= timeWindow.start && eventTime < timeWindow.end;
      });
   }, [events, timeWindow]);

   // Calculate time metrics from events
   const timeMetrics = useMemo(() => {
      const stateEvents = windowEvents
         .filter(e => e.eventType === 'STATE_CHANGE')
         .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

      const focusEvents = windowEvents
         .filter(e => e.eventType?.startsWith('FOCUS_LOCK'))
         .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

      const breakEvents = windowEvents
         .filter(e => e.eventType?.startsWith('BREAK_'))
         .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

      let awakeMinutes = 0;
      let sleepMinutes = 0;
      let sleepCount = 0;
      let breakMinutes = 0;
      let breakCount = 0;
      let focusMinutes = 0;
      let focusCount = 0;

      // Calculate awake/sleep time from state changes
      for (let i = 0; i < stateEvents.length; i++) {
         const event = stateEvents[i];
         const payload = event.payload || {};
         const nextEvent = stateEvents[i + 1];
         const currentTime = event.createdAt || 0;
         const nextTime = nextEvent?.createdAt || Date.now();
         const durationMinutes = (nextTime - currentTime) / (1000 * 60);

         if (payload.to === 'sleep') {
            sleepMinutes += durationMinutes;
            sleepCount++;
         } else if (payload.to === 'awake') {
            awakeMinutes += durationMinutes;
         }
      }

      // Calculate focus time
      let focusStart: number | null = null;
      for (const event of focusEvents) {
         const payload = event.payload || {};
         const eventTime = event.createdAt || 0;

         if (event.eventType === 'FOCUS_LOCK_ENABLED' || payload.action === 'start') {
            focusStart = eventTime;
            focusCount++;
         } else if ((event.eventType === 'FOCUS_LOCK_DISABLED' || payload.action === 'end') && focusStart) {
            focusMinutes += (eventTime - focusStart) / (1000 * 60);
            focusStart = null;
         }
      }

      // Calculate break time
      let breakStart: number | null = null;
      for (const event of breakEvents) {
         const payload = event.payload || {};
         const eventTime = event.createdAt || 0;

         if (event.eventType === 'BREAK_START' || payload.action === 'start') {
            breakStart = eventTime;
            breakCount++;
         } else if ((event.eventType === 'BREAK_END' || payload.action === 'end') && breakStart) {
            breakMinutes += (eventTime - breakStart) / (1000 * 60);
            breakStart = null;
         }
      }

      return {
         awakeMinutes,
         sleepMinutes,
         sleepCount,
         breakMinutes,
         breakCount,
         focusMinutes,
         focusCount,
      };
   }, [windowEvents]);

   // Calculate music metrics from events
   const musicMetrics = useMemo(() => {
      const musicEvents = windowEvents
         .filter(e => e.eventType === 'MUSIC_PLAYBACK')
         .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

      let totalMinutes = 0;
      let songsPlayed = 0;
      const history: { title: string; minutes: number; time: Date }[] = [];

      let playStart: number | null = null;
      let currentTitle = '';

      for (const event of musicEvents) {
         const payload = event.payload || {} as Record<string, unknown>;
         const eventTime = event.createdAt || 0;

         if (payload.action === 'play') {
            if (playStart && currentTitle) {
               const minutes = (eventTime - playStart) / (1000 * 60);
               totalMinutes += minutes;
               history.push({ title: currentTitle, minutes, time: new Date(playStart) });
            }
            playStart = eventTime;
            currentTitle = String(payload.trackTitle || 'Unknown');
            songsPlayed++;
         } else if ((payload.action === 'pause' || payload.action === 'stop') && playStart) {
            const minutes = (eventTime - playStart) / (1000 * 60);
            totalMinutes += minutes;
            history.push({ title: currentTitle, minutes, time: new Date(playStart) });
            playStart = null;
         }
      }

      return {
         songsPlayed,
         totalMinutes,
         history: history.slice(-10), // Last 10 songs
      };
   }, [windowEvents]);

   // Calculate task stats for 72-hour window
   const taskStats = useMemo(() => {
      const active = windowTasks.filter(t => t.isActive && !t.isCompleted && !t.isCancelled);
      const completed = windowTasks.filter(t => t.isCompleted);
      const cancelled = windowTasks.filter(t => t.isCancelled);

      return {
         total: windowTasks.length,
         active,
         completed,
         cancelled,
         activeCount: active.length,
         completedCount: completed.length,
         cancelledCount: cancelled.length,
      };
   }, [windowTasks]);

   // Get latest mood
   const latestMood = moods[moods.length - 1];
   const moodValue = latestMood?.mood || 'GOOD';
   const moodNumeric = { 'TERRIBLE': 1, 'BAD': 2, 'MEH': 3, 'GOOD': 4, 'GREAT': 5 }[moodValue] || 3;

   // Recent moods for display (last 5)
   const recentMoods = useMemo(() => {
      return moods.slice(-5).map(m => ({
         id: m.id,
         level: { 'TERRIBLE': 1, 'BAD': 2, 'MEH': 3, 'GOOD': 4, 'GREAT': 5 }[m.mood || 'GOOD'] || 3
      }));
   }, [moods]);

   // Average mood score
   const avgMood = useMemo(() => {
      if (recentMoods.length === 0) return 0;
      const sum = recentMoods.reduce((acc, m) => acc + m.level, 0);
      return sum / recentMoods.length;
   }, [recentMoods]);

   // Calculate balance (total income - total expense)
   const balance = useMemo(() => {
      const totalIncome = finances
         .filter(f => f.type === 'INCOME')
         .reduce((sum, f) => sum + (f.amount || 0), 0);
      const totalExpense = finances
         .filter(f => f.type === 'EXPENSE')
         .reduce((sum, f) => sum + (f.amount || 0), 0);
      return totalIncome - totalExpense;
   }, [finances]);

   // Calculate productivity score based on all factors
   const productivityScore = useMemo(() => {
      // Task completion factor (0-100)
      const taskFactor = taskStats.total > 0
         ? (taskStats.completedCount / taskStats.total) * 100
         : 50;

      // Focus factor (target: 120 min focus per day, so 360 for 3 days)
      const focusFactor = Math.min((timeMetrics.focusMinutes / 360) * 100, 100);

      // Awake/Sleep balance factor (target: 16h awake, 8h sleep per day)
      const totalHours = (timeMetrics.awakeMinutes + timeMetrics.sleepMinutes) / 60;
      const sleepRatio = totalHours > 0 ? timeMetrics.sleepMinutes / 60 / totalHours : 0.33;
      const balanceFactor = sleepRatio >= 0.25 && sleepRatio <= 0.4 ? 100 : (1 - Math.abs(0.33 - sleepRatio) * 3) * 100;

      // Break factor (taking breaks is good)
      const breakFactor = Math.min((timeMetrics.breakCount / 6) * 100, 100); // Target 6 breaks in 72h

      // Mood factor
      const moodFactor = moodNumeric * 20;

      // Weighted average
      const score = (
         taskFactor * 0.35 +
         focusFactor * 0.25 +
         Math.max(balanceFactor, 0) * 0.15 +
         breakFactor * 0.1 +
         moodFactor * 0.15
      );

      return Math.min(Math.max(Math.round(score), 0), 100);
   }, [taskStats, timeMetrics, moodNumeric]);

   // Long press handlers for greeting (3 seconds to open DB browser)
   const handlePressIn = useCallback(() => {
      pressStartTimeRef.current = Date.now();
      longPressTimerRef.current = setTimeout(() => {
         setShowDBBrowser(true);
      }, 3000);
   }, []);

   const handlePressOut = useCallback(() => {
      if (longPressTimerRef.current) {
         clearTimeout(longPressTimerRef.current);
         longPressTimerRef.current = null;
      }
   }, []);

   // Long press handler for progress cards
   const handleCardLongPress = useCallback((type: 'active' | 'completed' | 'cancelled' | 'music') => {
      setDetailModal({ type, visible: true });
   }, []);

   // Get score color
   const getScoreColor = (score: number) => {
      if (score >= 80) return '#C0F67F';
      if (score >= 60) return '#FFD465';
      if (score >= 40) return '#FFA500';
      return '#FF6B6B';
   };

   // Render detail modal content based on type
   const renderDetailModalContent = () => {
      switch (detailModal.type) {
         case 'active':
            return (
               <View className="p-4">
                  <Text className="text-lg font-bold text-[#1E1E1E] mb-4">Active Tasks ({taskStats.activeCount})</Text>
                  {taskStats.active.length === 0 ? (
                     <Text className="text-gray-500">No active tasks in the 72-hour window</Text>
                  ) : (
                     taskStats.active.map((task) => (
                        <View key={task.id} className="bg-gray-50 rounded-xl p-3 mb-2">
                           <Text className="font-semibold text-[#1E1E1E]">{task.title}</Text>
                           <Text className="text-gray-500 text-sm mt-1">
                              {task.priority && `Priority: ${task.priority}`}
                              {task.completionPercent !== undefined && ` • Progress: ${task.completionPercent}%`}
                           </Text>
                           {task.startTime && (
                              <Text className="text-gray-400 text-xs mt-1">
                                 Start: {new Date(task.startTime).toLocaleString()}
                              </Text>
                           )}
                        </View>
                     ))
                  )}
               </View>
            );

         case 'completed':
            return (
               <View className="p-4">
                  <Text className="text-lg font-bold text-[#1E1E1E] mb-4">Completed Tasks ({taskStats.completedCount})</Text>
                  {taskStats.completed.length === 0 ? (
                     <Text className="text-gray-500">No completed tasks in the 72-hour window</Text>
                  ) : (
                     taskStats.completed.map((task) => (
                        <View key={task.id} className="bg-green-50 rounded-xl p-3 mb-2">
                           <Text className="font-semibold text-[#1E1E1E]">{task.title}</Text>
                           <Text className="text-gray-500 text-sm mt-1">
                              Completed {task.completionPercent}%
                           </Text>
                           {task.endTime && (
                              <Text className="text-gray-400 text-xs mt-1">
                                 Completed: {new Date(task.endTime).toLocaleString()}
                              </Text>
                           )}
                        </View>
                     ))
                  )}
               </View>
            );

         case 'cancelled':
            return (
               <View className="p-4">
                  <Text className="text-lg font-bold text-[#1E1E1E] mb-4">Cancelled Tasks ({taskStats.cancelledCount})</Text>
                  {taskStats.cancelled.length === 0 ? (
                     <Text className="text-gray-500">No cancelled tasks in the 72-hour window</Text>
                  ) : (
                     taskStats.cancelled.map((task) => (
                        <View key={task.id} className="bg-red-50 rounded-xl p-3 mb-2">
                           <Text className="font-semibold text-[#1E1E1E]">{task.title}</Text>
                           <Text className="text-gray-500 text-sm mt-1">
                              {task.cancelReason && `Reason: ${task.cancelReason}`}
                           </Text>
                           {task.cancelledAt && (
                              <Text className="text-gray-400 text-xs mt-1">
                                 Cancelled: {new Date(task.cancelledAt).toLocaleString()}
                              </Text>
                           )}
                        </View>
                     ))
                  )}
               </View>
            );

         case 'music':
            return (
               <View className="p-4">
                  <Text className="text-lg font-bold text-[#1E1E1E] mb-2">Music Stats (72h)</Text>
                  <View className="flex-row justify-between mb-4">
                     <View className="items-center">
                        <Text className="text-2xl font-bold text-[#FF2D55]">{musicMetrics.songsPlayed}</Text>
                        <Text className="text-gray-500 text-sm">Songs Played</Text>
                     </View>
                     <View className="items-center">
                        <Text className="text-2xl font-bold text-[#FF2D55]">{formatMinutes(musicMetrics.totalMinutes)}</Text>
                        <Text className="text-gray-500 text-sm">Total Time</Text>
                     </View>
                  </View>
                  <Text className="font-semibold text-[#1E1E1E] mb-2">Recent History</Text>
                  {musicMetrics.history.length === 0 ? (
                     <Text className="text-gray-500">No music played in the 72-hour window</Text>
                  ) : (
                     musicMetrics.history.reverse().map((item, idx) => (
                        <View key={idx} className="bg-pink-50 rounded-xl p-3 mb-2 flex-row justify-between items-center">
                           <View className="flex-1">
                              <Text className="font-medium text-[#1E1E1E]" numberOfLines={1}>{item.title}</Text>
                              <Text className="text-gray-400 text-xs">{item.time.toLocaleTimeString()}</Text>
                           </View>
                           <Text className="text-[#FF2D55] font-semibold">{formatMinutes(item.minutes)}</Text>
                        </View>
                     ))
                  )}
               </View>
            );

         default:
            return null;
      }
   };

   // Show Database Browser if enabled
   if (showDBBrowser) {
      return <DatabaseBrowser onClose={() => setShowDBBrowser(false)} />;
   }

   return (
      <ScrollView className="flex-1 bg-[#FDFCF8]" showsVerticalScrollIndicator={false}>
         <View className="p-5 pt-12">
            {/* Header with Greeting - Long press 3s to open DB Browser */}
            <Pressable
               onPressIn={handlePressIn}
               onPressOut={handlePressOut}
            >
               <View className="mb-6 mt-2">
                  <Text className="text-xl font-bold text-[#1E1E1E]">{getGreeting()},</Text>
                  <Text className="text-3xl font-bold text-[#2c2c2c]">{user?.name || 'Shakil'} 👋</Text>
                  <Text className="text-gray-500 mt-1">
                     {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </Text>
               </View>
            </Pressable>

            {/* --- PRODUCTIVITY SCORE CARD --- */}
            <View className="bg-[#1E1E1E] rounded-[32px] p-6 mb-6 overflow-hidden">
               <View className="flex-row justify-between items-start">
                  <View>
                     <View className="flex-row items-center gap-2 mb-2">
                        <Text className="text-white/60 text-sm font-medium">Productivity Score</Text>
                     </View>
                     <View className="flex-row items-baseline">
                        <Text className="text-6xl font-bold text-white">{productivityScore}</Text>
                        <Text className="text-2xl font-bold text-white/30 ml-1">/100</Text>
                     </View>
                     <Text className="text-sm text-white/50 mt-1">
                        {productivityScore >= 80 ? 'On fire!' : productivityScore >= 60 ? 'Great progress!' : productivityScore >= 40 ? 'Keep going!' : 'Let\'s boost it!'}
                     </Text>
                  </View>

                  <View className="items-end">
                     <View className="bg-white/10 rounded-2xl p-4 mb-3">
                        <View className="flex-row items-center gap-2 mb-2">
                           <Flame size={16} color="#FF6B6B" />
                           <Text className="text-white font-bold">{taskStats.completedCount}</Text>
                        </View>
                        <Text className="text-white/40 text-xs">Tasks Done</Text>
                     </View>
                     <View className="bg-white/10 rounded-2xl px-4 py-2">
                        <View className="flex-row items-center gap-1">
                           <TrendingUp size={14} color="#C0F67F" />
                           <Text className="text-[#C0F67F] font-bold text-sm">
                              {taskStats.total > 0 ? Math.round((taskStats.completedCount / taskStats.total) * 100) : 0}%
                           </Text>
                        </View>
                     </View>
                  </View>
               </View>

               {/* Quick Stats Grid - 2x2 */}
               <View className="mt-6 gap-3">
                  <View className="flex-row gap-3">
                     <View className="flex-1 bg-white/10 rounded-2xl p-4">
                        <Clock size={18} color="#4AC3FF" />
                        <Text className="text-white font-bold text-lg mt-2">
                           {formatMinutes(timeMetrics.awakeMinutes)}
                        </Text>
                        <Text className="text-white/40 text-xs">Awake Time</Text>
                     </View>
                     <View className="flex-1 bg-white/10 rounded-2xl p-4">
                        <Brain size={18} color="#C0F67F" />
                        <Text className="text-white font-bold text-lg mt-2">
                           {formatMinutes(timeMetrics.focusMinutes)}
                        </Text>
                        <Text className="text-white/40 text-xs">Focus Time</Text>
                     </View>
                  </View>
                  <View className="flex-row gap-3">
                     <View className="flex-1 bg-white/10 rounded-2xl p-4">
                        <Coffee size={18} color="#FF9F43" />
                        <Text className="text-white font-bold text-lg mt-2">
                           {formatMinutes(timeMetrics.breakMinutes)}
                        </Text>
                        <Text className="text-white/40 text-xs">{timeMetrics.breakCount} Breaks</Text>
                     </View>
                     <View className="flex-1 bg-white/10 rounded-2xl p-4">
                        <Target size={18} color="#FFD465" />
                        <Text className="text-white font-bold text-lg mt-2">
                           {taskStats.completedCount}/{taskStats.total}
                        </Text>
                        <Text className="text-white/40 text-xs">Tasks Done</Text>
                     </View>
                  </View>
               </View>
            </View>

            {/* Progress Cards - Active, Completed, Cancelled, Music */}
            <Text className="text-lg font-bold text-[#1E1E1E] mb-3">Today&apos;s Progress</Text>
            <View className="flex-row flex-wrap justify-between mb-6">
               {/* Active Tasks Card */}
               <Pressable
                  onLongPress={() => handleCardLongPress('active')}
                  delayLongPress={500}
                  style={{ width: '48%' }}
                  className="mb-3"
               >
                  <View className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                     <View className="w-10 h-10 rounded-full bg-[#FFD465]/20 items-center justify-center mb-2">
                        <Activity size={20} color="#FFD465" />
                     </View>
                     <Text className="text-2xl font-bold text-[#1E1E1E]">{taskStats.activeCount}</Text>
                     <Text className="text-gray-500 text-sm">Active Tasks</Text>
                  </View>
               </Pressable>

               {/* Completed Tasks Card */}
               <Pressable
                  onLongPress={() => handleCardLongPress('completed')}
                  delayLongPress={500}
                  style={{ width: '48%' }}
                  className="mb-3"
               >
                  <View className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                     <View className="w-10 h-10 rounded-full bg-[#C0F67F]/20 items-center justify-center mb-2">
                        <CheckCircle size={20} color="#C0F67F" />
                     </View>
                     <Text className="text-2xl font-bold text-[#1E1E1E]">{taskStats.completedCount}</Text>
                     <Text className="text-gray-500 text-sm">Completed</Text>
                  </View>
               </Pressable>

               {/* Cancelled Tasks Card */}
               <Pressable
                  onLongPress={() => handleCardLongPress('cancelled')}
                  delayLongPress={500}
                  style={{ width: '48%' }}
                  className="mb-3"
               >
                  <View className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                     <View className="w-10 h-10 rounded-full bg-[#FF6B6B]/20 items-center justify-center mb-2">
                        <XCircle size={20} color="#FF6B6B" />
                     </View>
                     <Text className="text-2xl font-bold text-[#1E1E1E]">{taskStats.cancelledCount}</Text>
                     <Text className="text-gray-500 text-sm">Cancelled</Text>
                  </View>
               </Pressable>

               {/* Music Card */}
               <Pressable
                  onLongPress={() => handleCardLongPress('music')}
                  delayLongPress={500}
                  style={{ width: '48%' }}
                  className="mb-3"
               >
                  <View className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                     <View className="w-10 h-10 rounded-full bg-[#FF2D55]/20 items-center justify-center mb-2">
                        <Music size={20} color="#FF2D55" />
                     </View>
                     <Text className="text-2xl font-bold text-[#1E1E1E]">{formatMinutes(musicMetrics.totalMinutes)}</Text>
                     <Text className="text-gray-500 text-sm">{musicMetrics.songsPlayed} songs</Text>
                  </View>
               </Pressable>
            </View>

            {/* --- MOOD & FINANCE ROW --- */}
            <View className="flex-row gap-3 mb-6">
               {/* Mood Card */}
               <View className="flex-1 bg-white rounded-3xl p-5 border border-gray-100">
                  <View className="flex-row items-center justify-between mb-3">
                     <Text className="font-bold text-[#1E1E1E]">Mood</Text>
                     <Activity size={16} color="#8E8E93" />
                  </View>
                  {recentMoods.length > 0 ? (
                     <>
                        <View className="flex-row justify-between mb-2">
                           {recentMoods.slice(0, 5).map((mood) => (
                              <Text key={mood.id} className="text-xl">
                                 {['😢', '😟', '😐', '🙂', '😄'][mood.level - 1]}
                              </Text>
                           ))}
                        </View>
                        <View className="flex-row items-center gap-2 mt-2">
                           <View className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <View
                                 className="h-full rounded-full"
                                 style={{
                                    width: `${(avgMood / 5) * 100}%`,
                                    backgroundColor: avgMood >= 4 ? '#34C759' : avgMood >= 3 ? '#FFD465' : '#FF3B30'
                                 }}
                              />
                           </View>
                           <Text className="text-sm font-bold text-[#1E1E1E]">{avgMood.toFixed(1)}</Text>
                        </View>
                     </>
                  ) : (
                     <Text className="text-gray-400 text-sm">No mood logs yet</Text>
                  )}
               </View>

               {/* Finance Card */}
               <View className="flex-1 bg-white rounded-3xl p-5 border border-gray-100">
                  <View className="flex-row items-center justify-between mb-3">
                     <Text className="font-bold text-[#1E1E1E]">Balance</Text>
                     <IndianRupee size={16} color="#8E8E93" />
                  </View>
                  <Text className={`text-xl font-bold ${balance >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>
                     {formatCurrency(balance)}
                  </Text>
                  <View className="flex-row items-center gap-2 mt-2">
                     <View className="flex-row items-center gap-1">
                        <ArrowUpRight size={12} color="#34C759" />
                        <Text className="text-[#34C759] text-xs font-medium">Income</Text>
                     </View>
                     <View className="flex-row items-center gap-1">
                        <ArrowDownRight size={12} color="#FF3B30" />
                        <Text className="text-[#FF3B30] text-xs font-medium">Expense</Text>
                     </View>
                  </View>
               </View>
            </View>

            {/* Weekly Stats with Bar Chart */}
            <View className="mb-6">
               <View className="flex-row items-center gap-2 mb-4">
                  <BarChart3 size={18} color="#1E1E1E" />
                  <Text className="text-lg font-bold text-[#1E1E1E]">This Week</Text>
               </View>

               <View className="bg-white rounded-3xl p-5 border border-gray-100">
                  {/* Weekly bar chart */}
                  <View className="flex-row justify-between items-end h-24 mb-4">
                     {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => {
                        const isToday = new Date().getDay() === (idx === 6 ? 0 : idx + 1);
                        // Calculate actual task completion for each day
                        const dayOffset = idx - (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
                        const dayDate = new Date();
                        dayDate.setDate(dayDate.getDate() + dayOffset);
                        dayDate.setHours(0, 0, 0, 0);
                        const nextDay = new Date(dayDate);
                        nextDay.setDate(nextDay.getDate() + 1);

                        const dayTasks = tasks.filter(t => {
                           const taskTime = t.createdAt || 0;
                           return taskTime >= dayDate.getTime() && taskTime < nextDay.getTime();
                        });
                        const completed = dayTasks.filter(t => t.isCompleted).length;
                        const total = dayTasks.length || 1;
                        const height = isToday ? 100 : Math.max((completed / total) * 100, 15);

                        return (
                           <View key={day} className="items-center flex-1">
                              <View
                                 className={`w-6 rounded-t-lg ${isToday ? 'bg-[#1E1E1E]' : 'bg-gray-200'}`}
                                 style={{ height: `${height}%` }}
                              />
                           </View>
                        );
                     })}
                  </View>
                  <View className="flex-row justify-between">
                     {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => {
                        const isToday = new Date().getDay() === (idx === 6 ? 0 : idx + 1);
                        return (
                           <Text
                              key={day}
                              className={`text-xs flex-1 text-center ${isToday ? 'font-bold text-[#1E1E1E]' : 'text-gray-400'}`}
                           >
                              {day}
                           </Text>
                        );
                     })}
                  </View>

                  {/* Stats summary */}
                  <View className="flex-row mt-6 pt-4 border-t border-gray-100">
                     <View className="flex-1 items-center">
                        <Text className="text-2xl font-bold text-[#1E1E1E]">{events.length}</Text>
                        <Text className="text-gray-400 text-xs">Events</Text>
                     </View>
                     <View className="w-px bg-gray-100" />
                     <View className="flex-1 items-center">
                        <Text className="text-2xl font-bold text-[#1E1E1E]">{tasks.filter(t => t.isCompleted).length}</Text>
                        <Text className="text-gray-400 text-xs">Completed</Text>
                     </View>
                     <View className="w-px bg-gray-100" />
                     <View className="flex-1 items-center">
                        <Text className="text-2xl font-bold text-[#1E1E1E]">{formatMinutes(timeMetrics.focusMinutes)}</Text>
                        <Text className="text-gray-400 text-xs">Focus</Text>
                     </View>
                  </View>
               </View>
            </View>

            {/* Pro Tips */}
            <View className="bg-[#FFD465]/20 rounded-2xl p-4 mb-24">
               <View className="flex-row items-center mb-2">
                  <Lightbulb size={18} color="#FFD465" />
                  <Text className="text-[#1E1E1E] font-bold ml-2">Pro Tip</Text>
               </View>
               <Text className="text-gray-700">{PRO_TIPS[tipIndex]}</Text>
            </View>
         </View>

         {/* Detail Modal */}
         <Modal
            visible={detailModal.visible}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setDetailModal({ ...detailModal, visible: false })}
         >
            <View className="flex-1 bg-black/50 justify-end">
               <View className="bg-white rounded-t-3xl max-h-[70%]">
                  <View className="items-center py-3">
                     <View className="w-10 h-1 bg-gray-300 rounded-full" />
                  </View>
                  <ScrollView showsVerticalScrollIndicator={false}>
                     {renderDetailModalContent()}
                  </ScrollView>
                  <TouchableOpacity
                     onPress={() => setDetailModal({ ...detailModal, visible: false })}
                     className="bg-[#1E1E1E] mx-4 mb-8 p-4 rounded-2xl items-center"
                  >
                     <Text className="text-white font-semibold">Close</Text>
                  </TouchableOpacity>
               </View>
            </View>
         </Modal>
      </ScrollView>
   );
}

// HOC with WatermelonDB observables
const enhance = withObservables([], () => ({
   tasks: database.get<Task>('tasks').query().observe(),
   moods: database.get<MoodLog>('mood_logs').query().observe(),
   events: database.get<EventLog>('event_logs').query().observe(),
   finances: database.get<FinanceLog>('finance_logs').query().observe(),
   users: database.get<User>('users').query().observe(),
}));

const EnhancedDashboardScreen = enhance(DashboardScreen);

export default function Dashboard() {
   return <EnhancedDashboardScreen />;
}
