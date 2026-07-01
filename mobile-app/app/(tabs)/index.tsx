import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Vibration, Alert, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Calendar as CalendarIcon, ArrowLeft, Settings as SettingsIcon, Target, Lock, Coffee, ChevronLeft, ChevronRight, X, Clock, Users } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import { withObservables } from '@nozbe/watermelondb/react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../../database';
import User from '../../database/models/User';
import Task from '../../database/models/Task';
import Settings from '../../database/models/Settings';
import AwakeToggle from '../../components/AwakeToggle';
import VaultAccess from '../../components/VaultAccess';
import { VaultContentModal } from '../../components/VaultContentModal';
import TaskCard from '../../components/TaskCard';
import { CreateTaskModal } from '../../components/CreateTaskModal';
import { FocusLockModal } from '../../components/FocusLockModal';
import { BreakLockModal } from '../../components/BreakLockModal';
import { SettingsModal } from '../../components/SettingsModal';
import { initializeUser } from '../../services/userService';
import { deleteTask } from '../../services/taskService';
import { alertService } from '../../services/alertService';

interface TaskScreenProps {
   users: User[];
   tasks: Task[];
   settings: Settings[];
}

function TaskScreen({ users, tasks, settings }: TaskScreenProps) {
   const [currentScreen, setCurrentScreen] = useState<'home' | 'calendar'>('home');
   const [showCreateTask, setShowCreateTask] = useState(false);
   const [showFocusLock, setShowFocusLock] = useState(false);
   const [showBreakLock, setShowBreakLock] = useState(false);
   const [showSettings, setShowSettings] = useState(false);
   const [isInitializing, setIsInitializing] = useState(true);
   const [taskFilter, setTaskFilter] = useState<'all' | 'custom' | 'fixed' | 'alert'>('all');
   const [selectedCalendarDate, setSelectedCalendarDate] = useState(new Date());

   const [showVaultAccess, setShowVaultAccess] = useState(false);
   const [showVaultContent, setShowVaultContent] = useState(false);
   const [showMonthPicker, setShowMonthPicker] = useState(false);
   const [selectedTaskDetail, setSelectedTaskDetail] = useState<Task | null>(null);

   const user = users?.[0];
   const userId = user?.id || 'local_user';
   const userSettings = settings?.[0];
   const isHolidayMode = userSettings?.taskMode === 'holiday';

   // Calculate 48 hours from now for filtering
   const now = Date.now();
   const fortyEightHoursFromNow = now + (48 * 60 * 60 * 1000);
   const fortyEightHoursAgo = now - (48 * 60 * 60 * 1000);
   const sixteenHoursAgo = now - (16 * 60 * 60 * 1000);

   // Helper to check if task is within next 48 hours (for home screen)
   const isWithin48Hours = (task: Task): boolean => {
      const taskTime = task.startTime || task.scheduledTime;
      if (!taskTime) return true; // Show unscheduled tasks
      const taskTimestamp = new Date(taskTime).getTime();
      return taskTimestamp <= fortyEightHoursFromNow;
   };

   // Helper to check if completed/cancelled task is within last 48 hours
   const isWithinLast48Hours = (task: Task): boolean => {
      const completedAt = (task as any).completedAt || (task as any).cancelledAt || task.updatedAt;
      if (!completedAt) return true; // Show if no timestamp
      return completedAt >= fortyEightHoursAgo;
   };

   // Helper to check if task is within last 16 hours (for completed tasks)
   const isWithinLast16Hours = (task: Task): boolean => {
      const completedAt = (task as any).completedAt || (task as any).cancelledAt || task.updatedAt;
      if (!completedAt) return true; // Show if no timestamp
      return completedAt >= sixteenHoursAgo;
   };

   // Filter tasks by type - hide fixed tasks in holiday mode, only show next 48 hours
   // Also exclude cancelled tasks from main lists
   const customTasks = tasks?.filter(t =>
      t.type === 'custom' &&
      !t.isCompleted &&
      !(t as any).isCancelled &&
      !t.deletedAt &&
      isWithin48Hours(t)
   ) || [];
   const fixedTasks = isHolidayMode ? [] : (tasks?.filter(t =>
      t.type === 'fixed' &&
      !t.isCompleted &&
      !(t as any).isCancelled &&
      !t.deletedAt &&
      isWithin48Hours(t)
   ) || []);
   const alertTasks = tasks?.filter(t => t.type === 'alert' && !t.isCompleted && !(t as any).isCancelled && !t.deletedAt) || [];
   const activeTasks = tasks?.filter(t => t.isActive && !(t as any).isCancelled && !t.deletedAt) || [];
   // Only show completed tasks from last 16 hours, and cancelled from last 48 hours
   const completedTasks = tasks?.filter(t => t.isCompleted && !t.deletedAt && isWithinLast16Hours(t)) || [];
   const cancelledTasks = tasks?.filter(t => (t as any).isCancelled && !t.deletedAt && isWithinLast48Hours(t)) || [];

   // All tasks for calendar view (no 48-hour filter)
   const allTasksForCalendar = tasks?.filter(t => !t.deletedAt && !t.isCompleted && !(t as any).isCancelled) || [];

   // Handle alert task deletion
   const handleDeleteAlert = async (task: Task) => {
      Alert.alert(
         'Delete Alert',
         `Are you sure you want to delete "${task.title}"?`,
         [
            { text: 'Cancel', style: 'cancel' },
            {
               text: 'Delete',
               style: 'destructive',
               onPress: async () => {
                  try {
                     await alertService.cancelAlert(task.id);
                     await deleteTask(task, userId);
                  } catch (error) {
                     console.error('Failed to delete alert:', error);
                     Alert.alert('Error', 'Failed to delete alert');
                  }
               },
            },
         ]
      );
   };

   useEffect(() => {
      async function init() {
         try {
            await initializeUser();
         } catch (error) {
            console.error('Init error:', error);
         } finally {
            setIsInitializing(false);
         }
      }
      init();
   }, []);

   if (isInitializing || !user) {
      return (
         <View className="flex-1 bg-[#F8F9FC] items-center justify-center">
            <ActivityIndicator size="large" color="#1E1E1E" />
            <Text className="mt-4 text-gray-500">Loading...</Text>
         </View>
      );
   }

   // Helper function to get extended dates for scrollable week strip (3 weeks before + 4 weeks after = 7 weeks total)
   const getWeekDates = (date: Date) => {
      const startDate = new Date(date);
      startDate.setDate(startDate.getDate() - 21); // Start 3 weeks before selected date

      return Array.from({ length: 49 }, (_, i) => { // 7 weeks = 49 days
         const d = new Date(startDate);
         d.setDate(d.getDate() + i);
         return d;
      });
   };

   // Helper to check if date is today
   const isToday = (date: Date) => {
      const today = new Date();
      return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear();
   };

   // Helper to check if two dates are the same day
   const isSameDay = (d1: Date, d2: Date) => {
      return d1.getDate() === d2.getDate() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getFullYear() === d2.getFullYear();
   };

   // Get tasks for selected date - uses ALL tasks (no 48-hour filter for calendar)
   const getTasksForDate = (date: Date) => {
      return allTasksForCalendar.filter(task => {
         if (task.scheduledDate) {
            return isSameDay(new Date(task.scheduledDate), date);
         }
         if (task.startTime) {
            return isSameDay(new Date(task.startTime), date);
         }
         // For alert tasks, check if created today or has no specific date
         if (task.type === 'alert' && task.createdAt) {
            return isSameDay(new Date(task.createdAt), date);
         }
         // Show all tasks on today if no date specified
         if (isToday(date) && !task.scheduledDate && !task.startTime) {
            return true;
         }
         return false;
      });
   };

   // Get time slots with tasks - from 12 AM (0) to 11 PM (23)
   const getTimeSlots = () => {
      const slots: { hour: number; tasks: Task[] }[] = [];
      const selectedTasks = getTasksForDate(selectedCalendarDate);

      for (let hour = 0; hour <= 23; hour++) {
         const tasksAtHour = selectedTasks.filter(task => {
            if (task.startTime) {
               const taskHour = new Date(task.startTime).getHours();
               return taskHour === hour;
            }
            if (task.scheduledTime) {
               const taskHour = new Date(task.scheduledTime).getHours();
               return taskHour === hour;
            }
            return false;
         });
         slots.push({ hour, tasks: tasksAtHour });
      }
      return slots;
   };

   const formatHour = (hour: number) => {
      if (hour === 0) return '12 AM';
      if (hour === 12) return '12 PM';
      if (hour > 12) return `${hour - 12} PM`;
      return `${hour} AM`;
   };

   const weekDates = getWeekDates(selectedCalendarDate);
   const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
   const timeSlots = getTimeSlots();
   const unscheduledTasks = getTasksForDate(selectedCalendarDate).filter(t => !t.startTime && !t.scheduledTime);

   const taskColors = ['#D1F098', '#C4B5FD', '#FDE68A', '#A7F3D0', '#FBCFE8', '#BAE6FD'];

   // Get all days in a month for calendar grid
   const getMonthDays = (year: number, month: number) => {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startDayOfWeek = firstDay.getDay();

      const days: (Date | null)[] = [];

      // Add empty slots for days before the 1st
      for (let i = 0; i < startDayOfWeek; i++) {
         days.push(null);
      }

      // Add all days of the month
      for (let day = 1; day <= daysInMonth; day++) {
         days.push(new Date(year, month, day));
      }

      return days;
   };

   const monthPickerDate = new Date(selectedCalendarDate);
   const monthDays = getMonthDays(monthPickerDate.getFullYear(), monthPickerDate.getMonth());
   const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

   const handleMonthNavigation = (direction: 'prev' | 'next') => {
      const newDate = new Date(selectedCalendarDate);
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
      setSelectedCalendarDate(newDate);
   };

   const handleDateSelect = (date: Date) => {
      setSelectedCalendarDate(date);
      setShowMonthPicker(false);
   };

   // --- CALENDAR VIEW (Right Image UI) ---
   if (currentScreen === 'calendar') {
      // Using inline styles to avoid NativeWind navigation context issues
      return (
         <View style={{ flex: 1, backgroundColor: '#F8F9FC' }}>
            <SafeAreaView style={{ flex: 1 }}>
               <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>

                  {/* Header: Back Button & Menu */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 8, marginBottom: 16 }}>
                     <TouchableOpacity
                        onPress={() => setCurrentScreen('home')}
                        style={{ height: 40, width: 40, backgroundColor: 'white', borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F3F4F6' }}
                     >
                        <ArrowLeft size={20} color="black" />
                     </TouchableOpacity>
                     <View style={{ flexDirection: 'row', gap: 12 }}>
                        <TouchableOpacity
                           onPress={() => setShowMonthPicker(true)}
                           style={{ height: 40, width: 40, backgroundColor: '#C0F67F', borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}
                        >
                           <CalendarIcon size={20} color="black" />
                        </TouchableOpacity>
                        <TouchableOpacity
                           onPress={() => setSelectedCalendarDate(new Date())}
                           style={{ height: 40, width: 40, backgroundColor: 'white', borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F3F4F6' }}
                        >
                           <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#1E1E1E' }}>{new Date().getDate()}</Text>
                        </TouchableOpacity>
                     </View>
                  </View>

                  {/* Title & Calendar Pill */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 24, marginBottom: 32 }}>
                     <View>
                        <Text style={{ color: '#9CA3AF', fontWeight: '500', fontSize: 14, marginBottom: 4 }}>Task schedule</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                           {/* Day Selector Pill */}
                           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <TouchableOpacity style={{ height: 32, width: 32, backgroundColor: '#C0F67F', borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
                                 <Text style={{ fontWeight: 'bold', color: 'black' }}>{selectedCalendarDate.getDate()}</Text>
                              </TouchableOpacity>
                              <Text style={{ fontSize: 30, fontWeight: 'bold', color: '#1E1E1E' }}>
                                 {isToday(selectedCalendarDate) ? 'Today' : selectedCalendarDate.toLocaleDateString('en-US', { weekday: 'long' })}
                              </Text>
                           </View>
                        </View>
                     </View>
                     {/* Month Navigation */}
                     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {/* <TouchableOpacity
                           onPress={() => {
                              const newDate = new Date(selectedCalendarDate);
                              newDate.setMonth(newDate.getMonth() - 1);
                              setSelectedCalendarDate(newDate);
                           }}
                           style={{ height: 32, width: 32, backgroundColor: 'white', borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F3F4F6' }}
                        >
                           <Text style={{ fontWeight: 'bold', color: '#1E1E1E' }}>←</Text>
                        </TouchableOpacity> */}
                        <TouchableOpacity
                           onPress={() => {
                              // Cycle through months
                              const newDate = new Date(selectedCalendarDate);
                              newDate.setDate(1);
                              setSelectedCalendarDate(newDate);
                           }}
                           style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, gap: 8, borderWidth: 1, borderColor: '#F3F4F6' }}
                        >
                           <CalendarIcon size={16} color="black" />
                           <Text style={{ fontWeight: 'bold', fontSize: 14 }}>
                              {selectedCalendarDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                           </Text>
                        </TouchableOpacity>
                        {/* <TouchableOpacity
                           onPress={() => {
                              const newDate = new Date(selectedCalendarDate);
                              newDate.setMonth(newDate.getMonth() + 1);
                              setSelectedCalendarDate(newDate);
                           }}
                           style={{ height: 32, width: 32, backgroundColor: 'white', borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F3F4F6' }}
                        >
                           <Text style={{ fontWeight: 'bold', color: '#1E1E1E' }}>→</Text>
                        </TouchableOpacity> */}
                     </View>
                  </View>

                  {/* Week Strip - Scrollable */}
                  <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
                     <View style={{ backgroundColor: 'white', paddingVertical: 16, borderRadius: 24, borderWidth: 1, borderColor: '#F9FAFB' }}>
                        <ScrollView
                           horizontal
                           showsHorizontalScrollIndicator={false}
                           contentContainerStyle={{ paddingHorizontal: 8, gap: 12 }}
                        >
                           {weekDates.map((date, i) => {
                              const isSelected = isSameDay(date, selectedCalendarDate);
                              const isTodayDate = isToday(date);
                              const hasTasksOnDay = getTasksForDate(date).length > 0;
                              const dayIndex = date.getDay(); // 0=Sun, 1=Mon, etc.
                              return (
                                 <TouchableOpacity
                                    key={i}
                                    onPress={() => setSelectedCalendarDate(date)}
                                    style={{ alignItems: 'center', gap: 8, minWidth: 40 }}
                                 >
                                    <Text style={{ color: '#9CA3AF', fontSize: 12, fontWeight: 'bold' }}>{dayNames[dayIndex]}</Text>
                                    <View style={{
                                       height: 32,
                                       width: 32,
                                       alignItems: 'center',
                                       justifyContent: 'center',
                                       borderRadius: 16,
                                       backgroundColor: isSelected ? '#C0F67F' : isTodayDate ? '#E5E7EB' : 'transparent'
                                    }}>
                                       <Text style={{ fontWeight: 'bold', fontSize: 14, color: isSelected ? 'black' : '#4B5563' }}>
                                          {date.getDate()}
                                       </Text>
                                    </View>
                                    {hasTasksOnDay && !isSelected && (
                                       <View style={{ height: 4, width: 4, backgroundColor: '#4AC3FF', borderRadius: 2, marginTop: -4 }} />
                                    )}
                                 </TouchableOpacity>
                              );
                           })}
                        </ScrollView>
                     </View>
                  </View>

                  {/* Unscheduled Tasks for the Day */}
                  {unscheduledTasks.length > 0 && (
                     <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
                        <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 12, marginBottom: 8 }}>📋 Unscheduled Tasks</Text>
                        <View style={{ gap: 8 }}>
                           {unscheduledTasks.map((task, idx) => (
                              <TouchableOpacity
                                 key={task.id}
                                 onPress={() => setSelectedTaskDetail(task)}
                                 activeOpacity={0.8}
                                 style={{
                                    backgroundColor: taskColors[idx % taskColors.length],
                                    padding: 12,
                                    borderRadius: 16
                                 }}
                              >
                                 <Text style={{ fontWeight: 'bold', fontSize: 14 }} numberOfLines={1}>{task.title}</Text>
                                 <Text style={{ fontSize: 10, opacity: 0.6 }}>{task.category || task.type}</Text>
                              </TouchableOpacity>
                           ))}
                        </View>
                     </View>
                  )}

                  {/* Timeline Grid */}
                  <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
                     {timeSlots.map((slot, idx) => (
                        <View key={slot.hour} style={{ flexDirection: 'row', marginBottom: 24 }}>
                           <View style={{ width: 56, paddingTop: slot.tasks.length > 0 ? 8 : 0 }}>
                              <Text style={{ color: '#9CA3AF', fontWeight: '500', fontSize: 12 }}>{formatHour(slot.hour)}</Text>
                           </View>
                           {slot.tasks.length > 0 ? (
                              <View style={{ flex: 1, gap: 8 }}>
                                 {slot.tasks.map((task, taskIdx) => {
                                    const color = taskColors[(idx + taskIdx) % taskColors.length];
                                    const startTime = task.startTime ? new Date(task.startTime) : null;
                                    const endTime = task.endTime ? new Date(task.endTime) : null;
                                    return (
                                       <TouchableOpacity
                                          key={task.id}
                                          onPress={() => setSelectedTaskDetail(task)}
                                          activeOpacity={0.8}
                                          style={{
                                             backgroundColor: color,
                                             padding: 16,
                                             borderRadius: 24,
                                             borderTopLeftRadius: 0
                                          }}
                                       >
                                          <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 4 }} numberOfLines={1}>
                                             {task.title}
                                          </Text>
                                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                             <Text style={{ fontSize: 10, fontWeight: 'bold', opacity: 0.5 }}>
                                                {startTime?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                                {endTime && ` - ${endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                                             </Text>
                                             {task.completionPercent > 0 && (
                                                <View style={{ backgroundColor: 'rgba(0,0,0,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                                   <Text style={{ fontSize: 10, fontWeight: 'bold' }}>{task.completionPercent}%</Text>
                                                </View>
                                             )}
                                          </View>
                                       </TouchableOpacity>
                                    );
                                 })}
                              </View>
                           ) : (
                              <View style={{ flex: 1, height: 1, backgroundColor: '#E5E7EB', marginTop: 8 }} />
                           )}
                        </View>
                     ))}
                  </View>

                  {/* Empty State */}
                  {getTasksForDate(selectedCalendarDate).length === 0 && (
                     <View style={{ paddingHorizontal: 24, alignItems: 'center', paddingVertical: 40 }}>
                        <Text style={{ fontSize: 48, marginBottom: 16 }}>📅</Text>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#374151', marginBottom: 8 }}>No tasks scheduled</Text>
                        <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center' }}>
                           {isToday(selectedCalendarDate) ? 'Create a task with a scheduled time to see it here' : 'No tasks on this day'}
                        </Text>
                     </View>
                  )}

               </ScrollView>

               {/* Month Picker Modal */}
               <Modal
                  visible={showMonthPicker}
                  transparent
                  animationType="fade"
                  onRequestClose={() => setShowMonthPicker(false)}
               >
                  <View style={styles.modalOverlay}>
                     <View style={styles.monthPickerContainer}>
                        {/* Month Header */}
                        <View style={styles.monthPickerHeader}>
                           <TouchableOpacity onPress={() => handleMonthNavigation('prev')} style={styles.monthNavButton}>
                              <ChevronLeft size={24} color="#374151" />
                           </TouchableOpacity>
                           <Text style={styles.monthPickerTitle}>
                              {monthNames[monthPickerDate.getMonth()]} {monthPickerDate.getFullYear()}
                           </Text>
                           <TouchableOpacity onPress={() => handleMonthNavigation('next')} style={styles.monthNavButton}>
                              <ChevronRight size={24} color="#374151" />
                           </TouchableOpacity>
                        </View>

                        {/* Weekday Headers */}
                        <View style={styles.weekdayHeader}>
                           {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                              <Text key={day} style={styles.weekdayText}>{day}</Text>
                           ))}
                        </View>

                        {/* Calendar Grid */}
                        <View style={styles.calendarGrid}>
                           {monthDays.map((day, index) => {
                              const isCurrentMonth = day && day.getMonth() === monthPickerDate.getMonth();
                              const isSelected = day && day.toDateString() === selectedCalendarDate.toDateString();
                              const isTodayDate = day && day.toDateString() === new Date().toDateString();

                              return (
                                 <TouchableOpacity
                                    key={index}
                                    onPress={() => day && isCurrentMonth && handleDateSelect(day)}
                                    disabled={!day || !isCurrentMonth}
                                    style={[
                                       styles.dayCell,
                                       isSelected && styles.selectedDayCell,
                                       isTodayDate && !isSelected && styles.todayCell
                                    ]}
                                 >
                                    {day && (
                                       <Text style={[
                                          styles.dayText,
                                          !isCurrentMonth && styles.otherMonthText,
                                          isSelected && styles.selectedDayText,
                                          isTodayDate && !isSelected && styles.todayText
                                       ]}>
                                          {day.getDate()}
                                       </Text>
                                    )}
                                 </TouchableOpacity>
                              );
                           })}
                        </View>

                        {/* Today Button */}
                        <TouchableOpacity
                           onPress={() => handleDateSelect(new Date())}
                           style={styles.todayButton}
                        >
                           <Text style={styles.todayButtonText}>Go to Today</Text>
                        </TouchableOpacity>
                     </View>
                  </View>
               </Modal>

               {/* Task Detail Modal */}
               <Modal
                  visible={!!selectedTaskDetail}
                  transparent
                  animationType="slide"
                  onRequestClose={() => setSelectedTaskDetail(null)}
               >
                  <View style={styles.modalOverlay}>
                     <View style={styles.taskDetailContainer}>
                        {selectedTaskDetail && (
                           <>
                              {/* Header */}
                              <View style={styles.taskDetailHeader}>
                                 <Text style={styles.taskDetailTitle}>{selectedTaskDetail.title}</Text>
                                 <TouchableOpacity onPress={() => setSelectedTaskDetail(null)}>
                                    <X size={24} color="#6B7280" />
                                 </TouchableOpacity>
                              </View>

                              {/* Category & Priority */}
                              <View style={styles.taskDetailRow}>
                                 <View style={[styles.taskDetailBadge, { backgroundColor: '#E0E7FF' }]}>
                                    <Text style={{ color: '#4338CA', fontWeight: '600', fontSize: 12 }}>
                                       {selectedTaskDetail.category || 'General'}
                                    </Text>
                                 </View>
                                 <View style={[styles.taskDetailBadge, {
                                    backgroundColor: selectedTaskDetail.priority === 'urgent' ? '#FEE2E2' :
                                       selectedTaskDetail.priority === 'important' ? '#FEF3C7' : '#D1FAE5'
                                 }]}>
                                    <Text style={{
                                       color: selectedTaskDetail.priority === 'urgent' ? '#DC2626' :
                                          selectedTaskDetail.priority === 'important' ? '#D97706' : '#059669',
                                       fontWeight: '600', fontSize: 12, textTransform: 'capitalize'
                                    }}>
                                       {selectedTaskDetail.priority || 'Normal'} Priority
                                    </Text>
                                 </View>
                              </View>

                              {/* Time Info */}
                              {(selectedTaskDetail.startTime || selectedTaskDetail.endTime) && (
                                 <View style={styles.taskDetailInfoRow}>
                                    <Clock size={18} color="#6B7280" />
                                    <Text style={styles.taskDetailInfoText}>
                                       {selectedTaskDetail.startTime && new Date(selectedTaskDetail.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                       {selectedTaskDetail.endTime && ` - ${new Date(selectedTaskDetail.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                                    </Text>
                                 </View>
                              )}

                              {/* Assigned Persons */}
                              {selectedTaskDetail.assignedPersons && selectedTaskDetail.assignedPersons.length > 0 && (
                                 <View style={styles.taskDetailInfoRow}>
                                    <Users size={18} color="#6B7280" />
                                    <Text style={styles.taskDetailInfoText}>
                                       {selectedTaskDetail.assignedPersons.join(', ')}
                                    </Text>
                                 </View>
                              )}

                              {/* Progress */}
                              <View style={styles.progressSection}>
                                 <View style={styles.progressHeader}>
                                    <Text style={styles.progressLabel}>Progress</Text>
                                    <Text style={styles.progressValue}>{selectedTaskDetail.completionPercent}%</Text>
                                 </View>
                                 <View style={styles.progressBar}>
                                    <View style={[styles.progressFill, { width: `${selectedTaskDetail.completionPercent}%` }]} />
                                 </View>
                              </View>

                              {/* Description */}
                              {selectedTaskDetail.description && (
                                 <View style={styles.descriptionSection}>
                                    <Text style={styles.descriptionLabel}>Description</Text>
                                    <Text style={styles.descriptionText}>{selectedTaskDetail.description}</Text>
                                 </View>
                              )}
                           </>
                        )}
                     </View>
                  </View>
               </Modal>

            </SafeAreaView>
         </View>
      );
   }

   // --- 🏠 HOME VIEW (Left Image UI) ---
   return (
      <View className="flex-1 bg-[#F8F9FC]">
         <SafeAreaView className="flex-1">
            <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>


               {/* Header */}
               <View className="flex-row justify-between items-center px-6 pt-4 mb-6">
                  <TouchableOpacity
                     onLongPress={() => {
                        Vibration.vibrate(500);
                        setShowVaultAccess(true);
                     }}
                     delayLongPress={500}
                     activeOpacity={0.8}
                  >
                     <View className="h-12 w-12 rounded-full border-2 border-white shadow-sm overflow-hidden">
                        <Image source={{ uri: user?.avatarUrl || 'https://avatars.githubusercontent.com/u/128307325?v=4' }} className="h-full w-full" />
                     </View>
                  </TouchableOpacity>

                  {/* Awake Toggle */}
                  <AwakeToggle />

                  <View className="flex-row gap-1 items-center ml-0">
                     {/* Calendar */}
                     <TouchableOpacity
                        onPress={() => setCurrentScreen('calendar')}
                        className="h-12 w-12 bg-white rounded-full items-center justify-center border border-gray-100 shadow-sm"
                     >
                        <CalendarIcon size={22} color="black" />
                     </TouchableOpacity>

                     {/* Add Task */}
                     <TouchableOpacity
                        onPress={() => setShowCreateTask(true)}
                        className="h-12 w-12 bg-[#1E1E1E] rounded-full items-center justify-center shadow-lg shadow-black/30"
                     >
                        <Plus size={24} color="white" />
                     </TouchableOpacity>

                     {/* Break Mode */}
                     <TouchableOpacity
                        onPress={() => setShowBreakLock(true)}
                        className="h-12 w-12 bg-green-100 rounded-full items-center justify-center border border-green-200 shadow-sm"
                     >
                        <Coffee size={22} color="#166534" />
                     </TouchableOpacity>

                     {/* Focus Lock */}
                     <TouchableOpacity
                        onPress={() => setShowFocusLock(true)}
                        className="h-12 w-12 bg-white rounded-full items-center justify-center border border-gray-100 shadow-sm"
                     >
                        <Lock size={22} color="black" />
                     </TouchableOpacity>
                  </View>
               </View>

               {/* Quick Actions Bar */}
               <View className="px-6 flex-row gap-3 mb-8">
                  <TouchableOpacity
                     onPress={() => setShowSettings(true)}
                     className="h-14 w-14 bg-white rounded-full items-center justify-center border border-gray-100 shadow-sm"
                  >
                     <SettingsIcon size={22} color="black" />
                  </TouchableOpacity>

                  <View className="flex-1 bg-white rounded-full p-1 flex-row shadow-sm border border-gray-50 h-12 items-center">
                     <TouchableOpacity
                        onPress={() => setTaskFilter(taskFilter === 'custom' ? 'all' : 'custom')}
                        style={{
                           flex: 1,
                           height: '100%',
                           borderRadius: 999,
                           flexDirection: 'row',
                           alignItems: 'center',
                           justifyContent: 'center',
                           gap: 4,
                           backgroundColor: taskFilter === 'custom' ? '#4AC3FF' : 'transparent',
                        }}
                     >
                        <Text style={{
                           fontWeight: taskFilter === 'custom' ? 'bold' : '600',
                           color: taskFilter === 'custom' ? 'white' : '#4B5563',
                           fontSize: 12,
                        }}>Custom</Text>
                        <View style={{
                           paddingHorizontal: 6,
                           paddingVertical: 1,
                           borderRadius: 999,
                           backgroundColor: taskFilter === 'custom' ? 'rgba(255,255,255,0.3)' : '#F3F4F6',
                        }}>
                           <Text style={{
                              fontSize: 10,
                              fontWeight: 'bold',
                              color: taskFilter === 'custom' ? 'white' : '#4B5563',
                           }}>{customTasks.length}</Text>
                        </View>
                     </TouchableOpacity>
                     <TouchableOpacity
                        onPress={() => setTaskFilter(taskFilter === 'fixed' ? 'all' : 'fixed')}
                        style={{
                           flex: 1,
                           height: '100%',
                           borderRadius: 999,
                           flexDirection: 'row',
                           alignItems: 'center',
                           justifyContent: 'center',
                           gap: 4,
                           backgroundColor: taskFilter === 'fixed' ? '#D1F098' : 'transparent',
                        }}
                     >
                        <Text style={{
                           fontWeight: 'bold',
                           color: taskFilter === 'fixed' ? 'black' : '#4B5563',
                           fontSize: 12,
                        }}>Fixed</Text>
                        <View style={{
                           paddingHorizontal: 6,
                           paddingVertical: 1,
                           borderRadius: 999,
                           backgroundColor: taskFilter === 'fixed' ? 'rgba(255,255,255,0.4)' : '#F3F4F6',
                        }}>
                           <Text style={{
                              fontSize: 10,
                              fontWeight: 'bold',
                              color: taskFilter === 'fixed' ? 'black' : '#4B5563',
                           }}>{fixedTasks.length}</Text>
                        </View>
                     </TouchableOpacity>
                     <TouchableOpacity
                        onPress={() => setTaskFilter(taskFilter === 'alert' ? 'all' : 'alert')}
                        style={{
                           flex: 1,
                           height: '100%',
                           borderRadius: 999,
                           flexDirection: 'row',
                           alignItems: 'center',
                           justifyContent: 'center',
                           gap: 4,
                           backgroundColor: taskFilter === 'alert' ? '#FEF3C7' : 'transparent',
                        }}
                     >
                        <Text style={{
                           fontWeight: 'bold',
                           color: taskFilter === 'alert' ? '#92400E' : '#4B5563',
                           fontSize: 12,
                        }}>Alerts</Text>
                        <View style={{
                           paddingHorizontal: 6,
                           paddingVertical: 1,
                           borderRadius: 999,
                           backgroundColor: taskFilter === 'alert' ? 'rgba(146,64,14,0.2)' : '#F3F4F6',
                        }}>
                           <Text style={{
                              fontSize: 10,
                              fontWeight: 'bold',
                              color: taskFilter === 'alert' ? '#92400E' : '#4B5563',
                           }}>{alertTasks.length}</Text>
                        </View>
                     </TouchableOpacity>
                  </View>
               </View>

               {/* Active Tasks */}
               {activeTasks.length > 0 && (
                  <View className="px-6 mb-6">
                     <Text className="text-lg font-bold mb-4">🔥 Active Now</Text>
                     <View className="gap-4">
                        {activeTasks.map((task) => (
                           <TaskCard
                              key={task.id}
                              task={task}
                              userId={userId}
                              variant="dark"
                           />
                        ))}
                     </View>
                  </View>
               )}

               {/* Fixed Tasks (Routine) - Show when filter is 'all' or 'fixed' */}
               {fixedTasks.length > 0 && (taskFilter === 'all' || taskFilter === 'fixed') && (
                  <View className="px-6 mb-6">
                     <Text className="text-lg font-bold mb-4">🔄 Fixed (Routine)</Text>
                     <View className="gap-4">
                        {fixedTasks.map((task, index) => (
                           <TaskCard
                              key={task.id}
                              task={task}
                              userId={userId}
                              variant={index % 2 === 0 ? 'green' : 'purple'}
                           />
                        ))}
                     </View>
                  </View>
               )}

               {/* Alert Tasks - Only show when filter is 'alert' */}
               {alertTasks.length > 0 && taskFilter === 'alert' && (
                  <View className="px-6 mb-6">
                     <Text className="text-lg font-bold mb-4">🔔 Alerts</Text>
                     <View className="gap-4">
                        {alertTasks.map((task) => (
                           <View key={task.id} className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
                              <View className="flex-row items-center justify-between mb-2">
                                 <View className="flex-row items-center gap-2">
                                    <View className={`px-2 py-1 rounded ${task.alertType === 'interval' ? 'bg-amber-200' : 'bg-orange-200'}`}>
                                       <Text className="text-xs font-bold text-amber-800">
                                          {task.alertType === 'interval' ? '🔄 INTERVAL' : '⏱️ TIMEOUT'}
                                       </Text>
                                    </View>
                                    <View className={`px-2 py-1 rounded ${task.priority === 'urgent' ? 'bg-red-100' : task.priority === 'important' ? 'bg-yellow-100' : 'bg-gray-100'}`}>
                                       <Text className="text-xs font-bold" style={{ color: task.priority === 'urgent' ? '#991B1B' : task.priority === 'important' ? '#92400E' : '#4B5563' }}>
                                          {task.priority?.toUpperCase()}
                                       </Text>
                                    </View>
                                 </View>
                                 <TouchableOpacity
                                    onPress={() => handleDeleteAlert(task)}
                                    className="h-8 w-8 bg-red-100 rounded-full items-center justify-center"
                                 >
                                    <Text className="text-red-600">✕</Text>
                                 </TouchableOpacity>
                              </View>
                              <Text className="text-lg font-bold text-gray-800 mb-1">{task.title}</Text>
                              <Text className="text-sm text-gray-600 mb-2">{task.category}</Text>
                              <View className="flex-row items-center gap-2">
                                 <Text className="text-sm text-amber-700 font-medium">
                                    {task.alertType === 'interval'
                                       ? `Every ${task.alertIntervalMinutes} min`
                                       : `In ${task.alertIntervalMinutes} min`
                                    }
                                 </Text>
                                 {task.assignedPersons && task.assignedPersons.length > 0 && (
                                    <Text className="text-xs text-gray-500">
                                       • {task.assignedPersons.join(', ')}
                                    </Text>
                                 )}
                              </View>
                           </View>
                        ))}
                     </View>
                  </View>
               )}

               {/* Custom Tasks - Show when filter is 'all' or 'custom' */}
               {(taskFilter === 'all' || taskFilter === 'custom') && (
                  <View className="px-6 mb-6">
                     <Text className="text-lg font-bold mb-4">📋 Custom Tasks</Text>

                     {customTasks.length === 0 && fixedTasks.length === 0 && alertTasks.length === 0 && activeTasks.length === 0 && taskFilter === 'all' ? (
                        <View className="bg-gray-50 rounded-[32px] p-8 items-center">
                           <Text className="text-6xl mb-4">🎯</Text>
                           <Text className="text-lg font-bold text-gray-800 mb-2">No tasks yet</Text>
                           <Text className="text-gray-500 text-center mb-4">
                              Tap the + button to create your first task
                           </Text>
                           <TouchableOpacity
                              onPress={() => setShowCreateTask(true)}
                              className="bg-[#1E1E1E] px-6 py-3 rounded-full flex-row items-center gap-2"
                           >
                              <Plus size={18} color="white" />
                              <Text className="text-white font-bold">Add Task</Text>
                           </TouchableOpacity>
                        </View>
                     ) : customTasks.length === 0 ? (
                        <View className="bg-gray-50 rounded-2xl p-6 items-center">
                           <Text className="text-gray-500">No custom tasks</Text>
                        </View>
                     ) : (
                        <View className="gap-4">
                           {customTasks.map((task, index) => (
                              <TaskCard
                                 key={task.id}
                                 task={task}
                                 userId={userId}
                                 variant={index % 3 === 0 ? 'default' : index % 3 === 1 ? 'green' : 'purple'}
                              />
                           ))}
                        </View>
                     )}
                  </View>
               )}

               {/* Completed Tasks Preview */}
               {completedTasks.length > 0 && (
                  <View className="px-6 mb-6">
                     <Text className="text-lg font-bold mb-4">✅ Completed Today ({completedTasks.length})</Text>
                     <View className="gap-3">
                        {completedTasks.slice(0, 3).map((task) => (
                           <View key={task.id} className="bg-gray-100 p-4 rounded-2xl flex-row items-center gap-3">
                              <View className="h-8 w-8 bg-green-100 rounded-full items-center justify-center">
                                 <Text>✓</Text>
                              </View>
                              <Text className="flex-1 font-medium text-gray-600 line-through">{task.title}</Text>
                           </View>
                        ))}
                     </View>
                  </View>
               )}

               {/* Cancelled Tasks Preview */}
               {cancelledTasks.length > 0 && (
                  <View className="px-6 mb-6">
                     <Text className="text-lg font-bold mb-4">❌ Cancelled ({cancelledTasks.length})</Text>
                     <View className="gap-3">
                        {cancelledTasks.slice(0, 3).map((task) => (
                           <View key={task.id} className="bg-red-50 p-4 rounded-2xl flex-row items-center gap-3">
                              <View className="h-8 w-8 bg-red-100 rounded-full items-center justify-center">
                                 <Text>✕</Text>
                              </View>
                              <View className="flex-1">
                                 <Text className="font-medium text-gray-600 line-through">{task.title}</Text>
                                 {(task as any).cancelReason && (
                                    <Text className="text-xs text-gray-400 mt-1">{(task as any).cancelReason}</Text>
                                 )}
                              </View>
                           </View>
                        ))}
                     </View>
                  </View>
               )}

               {/* Focus Lock Quick Action */}
               <View className="px-6 mb-6">
                  <TouchableOpacity
                     onPress={() => setShowFocusLock(true)}
                     className="bg-[#1E1E1E] p-6 rounded-[32px] flex-row items-center justify-between"
                  >
                     <View className="flex-row items-center gap-4">
                        <View className="h-14 w-14 bg-white/10 rounded-full items-center justify-center">
                           <Target size={28} color="#C0F67F" />
                        </View>
                        <View>
                           <Text className="text-white text-lg font-bold">Focus Mode</Text>
                           <Text className="text-white/60">Block distractions</Text>
                        </View>
                     </View>
                     <View className="bg-[#C0F67F] px-4 py-2 rounded-full">
                        <Text className="font-bold text-black">Start</Text>
                     </View>
                  </TouchableOpacity>
               </View>
            </ScrollView>

            {/* Modals */}
            <CreateTaskModal
               visible={showCreateTask}
               onClose={() => setShowCreateTask(false)}
               userId={userId}
            />
            <FocusLockModal
               visible={showFocusLock}
               onClose={() => setShowFocusLock(false)}
               userId={userId}
            />
            <BreakLockModal
               visible={showBreakLock}
               onClose={() => setShowBreakLock(false)}
               userId={userId}
            />
            <SettingsModal
               visible={showSettings}
               onClose={() => setShowSettings(false)}
               userId={userId}
            />
            <VaultAccess
               visible={showVaultAccess}
               onClose={() => setShowVaultAccess(false)}
               onSuccess={() => {
                  setShowVaultAccess(false);
                  setShowVaultContent(true);
               }}
               userId={userId}
            />
            <VaultContentModal
               visible={showVaultContent}
               onClose={() => setShowVaultContent(false)}
               userId={userId}
            />
         </SafeAreaView>
      </View>
   );
}

// Observe users, tasks, and settings
const enhance = withObservables([], () => ({
   users: database.get<User>('users').query().observe(),
   tasks: database.get<Task>('tasks').query(
      Q.where('deleted_at', null)
   ).observe(),
   settings: database.get<Settings>('settings').query().observe(),
}));

const EnhancedTaskScreen = enhance(TaskScreen);

export default function TaskScreenWrapper() {
   return <EnhancedTaskScreen users={[]} tasks={[]} settings={[]} />;
}

const styles = StyleSheet.create({
   modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
   },
   monthPickerContainer: {
      backgroundColor: 'white',
      borderRadius: 24,
      padding: 20,
      width: '100%',
      maxWidth: 360,
   },
   monthPickerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20,
   },
   monthNavButton: {
      padding: 8,
      borderRadius: 12,
      backgroundColor: '#F3F4F6',
   },
   monthPickerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#1F2937',
   },
   weekdayHeader: {
      flexDirection: 'row',
      marginBottom: 10,
   },
   weekdayText: {
      flex: 1,
      textAlign: 'center',
      fontSize: 12,
      fontWeight: '600',
      color: '#9CA3AF',
   },
   calendarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
   },
   dayCell: {
      width: '14.28%',
      aspectRatio: 1,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 12,
   },
   selectedDayCell: {
      backgroundColor: '#1E1E1E',
   },
   todayCell: {
      backgroundColor: '#E5E7EB',
   },
   dayText: {
      fontSize: 14,
      fontWeight: '500',
      color: '#374151',
   },
   otherMonthText: {
      color: '#D1D5DB',
   },
   selectedDayText: {
      color: 'white',
      fontWeight: 'bold',
   },
   todayText: {
      color: '#374151',
      fontWeight: 'bold',
   },
   todayButton: {
      marginTop: 16,
      backgroundColor: '#C0F67F',
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
   },
   todayButtonText: {
      fontWeight: 'bold',
      color: '#1E1E1E',
      fontSize: 14,
   },
   taskDetailContainer: {
      backgroundColor: 'white',
      borderRadius: 24,
      padding: 24,
      width: '100%',
      maxWidth: 400,
   },
   taskDetailHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
   },
   taskDetailTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#1F2937',
      flex: 1,
      marginRight: 12,
   },
   taskDetailRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
   },
   taskDetailBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
   },
   taskDetailInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
   },
   taskDetailInfoText: {
      fontSize: 14,
      color: '#374151',
   },
   progressSection: {
      marginTop: 8,
      marginBottom: 16,
   },
   progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
   },
   progressLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: '#374151',
   },
   progressValue: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#1E1E1E',
   },
   progressBar: {
      height: 8,
      backgroundColor: '#E5E7EB',
      borderRadius: 4,
      overflow: 'hidden',
   },
   progressFill: {
      height: '100%',
      backgroundColor: '#C0F67F',
      borderRadius: 4,
   },
   descriptionSection: {
      marginTop: 8,
   },
   descriptionLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: '#374151',
      marginBottom: 8,
   },
   descriptionText: {
      fontSize: 14,
      color: '#6B7280',
      lineHeight: 20,
   },
});