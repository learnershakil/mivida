import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Edit2, Heart, Moon, Sun, TrendingUp, Users, BookOpen } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import { withObservables } from '@nozbe/watermelondb/react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../../database';
import User from '../../database/models/User';
import Task from '../../database/models/Task';
import MoodLog from '../../database/models/MoodLog';
import EventLog from '../../database/models/EventLog';
import { MoodLogModal } from '../../components/MoodLogModal';
import { SettingsModal } from '../../components/SettingsModal';
import DelegationModal from '../../components/DelegationModal';
import VaultContentScreen from '../../components/VaultContentScreen';
import DailyReflectionModal from '../../components/DailyReflectionModal';
import { EditProfileModal } from '../../components/EditProfileModal';
import NotificationHistoryModal from '../../components/NotificationHistoryModal';
import VaultAccessModal from '../../components/VaultAccess';
import { getAnalyticsSummary, AnalyticsSummary } from '../../services/analyticsService';
import { initializeUser } from '../../services/userService';
import { appEvents, AppEvents } from '../../services/appEvents';

interface ProfileScreenProps {
   users: User[];
   tasks: Task[];
   moodLogs: MoodLog[];
   events: EventLog[];
}

function ProfileScreen({ users, tasks, moodLogs, events }: ProfileScreenProps) {
   const [showMoodLog, setShowMoodLog] = useState(false);
   const [showSettings, setShowSettings] = useState(false);
   const [showDelegation, setShowDelegation] = useState(false);
   const [showVault, setShowVault] = useState(false);
   const [showVaultAccess, setShowVaultAccess] = useState(false);
   const [showReflection, setShowReflection] = useState(false);
   const [showEditProfile, setShowEditProfile] = useState(false);
   const [showNotifications, setShowNotifications] = useState(false);
   const [isLoading, setIsLoading] = useState(true);
   const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);

   const user = users?.[0];
   const userId = user?.id || 'local_user';

   // Calculate stats
   const completedTasks = tasks?.filter(t => t.isCompleted).length || 0;
   const totalTasks = tasks?.length || 0;
   const recentMood = moodLogs?.[0];

   // Get mood emoji
   const getMoodEmoji = (level: number) => {
      const emojis = ['😢', '😟', '😐', '🙂', '😄'];
      return emojis[level - 1] || '😐';
   };

   useEffect(() => {
      async function loadData() {
         try {
            await initializeUser();
            if (userId && typeof getAnalyticsSummary === 'function') {
               const summary = await getAnalyticsSummary(userId);
               setAnalytics(summary);
            }
         } catch (error) {
            console.error('Error loading profile data:', error);
         } finally {
            setIsLoading(false);
         }
      }
      loadData();
   }, [userId, events?.length]);

   // Listen for mood modal event from notification press
   useEffect(() => {
      const unsubscribe = appEvents.on(AppEvents.SHOW_MOOD_MODAL, () => {
         console.log('[Profile] Showing mood modal from notification');
         setShowMoodLog(true);
      });

      return () => {
         unsubscribe();
      };
   }, []);

   // Show loading if user not loaded yet or still initializing
   if (isLoading || !user) {
      return (
         <View className="flex-1 bg-[#F8F9FC] items-center justify-center">
            <ActivityIndicator size="large" color="#1E1E1E" />
            <Text className="text-gray-500 mt-4">Loading profile...</Text>
         </View>
      );
   }
   return (
      <View className="flex-1 bg-[#F8F9FC]">
         <SafeAreaView className="flex-1">
            <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>

               {/* --- PROFILE INFO --- */}
               <View className="items-center mb-8 mt-2">
                  <TouchableOpacity
                     className="h-28 w-28 bg-white p-2 rounded-full shadow-sm mb-4"
                     delayLongPress={500}
                  >
                     <Image
                        source={{ uri: user?.avatarUrl || 'https://avatars.githubusercontent.com/u/128307325?v=4' }}
                        className="h-full w-full rounded-full"
                     />
                     <TouchableOpacity
                        className="absolute bottom-0 right-0 h-8 w-8 bg-black rounded-full items-center justify-center border-2 border-white"
                        onPress={() => setShowEditProfile(true)}
                     >
                        <Edit2 size={14} color="white" />
                     </TouchableOpacity>
                  </TouchableOpacity>
                  <Text className="text-3xl font-bold text-primary">{user?.name || 'Shakil Ahmad'}</Text>
                  <Text className="text-secondary font-medium">Time Nahi H Tere Pass!!!</Text>
               </View>

               {/* --- MASONRY GRID LAYOUT --- */}
               <View className="px-5 flex-row gap-4">

                  {/* LEFT COLUMN */}
                  <View className="flex-1 gap-4">

                     {/* Blue Card: Task Stats */}
                     <View className="bg-[#4AC3FF] p-5 rounded-[30px] h-64 justify-between">
                        <View className="flex-row justify-between items-center">
                           <Text className="text-white font-bold">Task Stats</Text>
                           <TrendingUp size={20} color="white" />
                        </View>

                        <View>
                           <View className="flex-row items-end mb-2">
                              <Text className="text-white text-6xl font-bold">{completedTasks}</Text>
                              <Text className="text-white/80 font-bold mb-2 ml-1">/ {totalTasks}</Text>
                           </View>
                           <Text className="text-white text-lg font-medium leading-6">Tasks{'\n'}Completed</Text>
                        </View>

                        <View className="flex-row items-center bg-white/20 p-2 rounded-full self-start">
                           <Text className="text-white text-xs font-bold px-2">
                              {analytics ? `${Math.round((analytics.tasksCompleted / Math.max(1, totalTasks)) * 100)}% Complete` : 'Loading...'}
                           </Text>
                        </View>
                     </View>

                     {/* Green Card: Awake Status */}
                     <View className="bg-[#C0F67F] p-5 rounded-[30px] h-48 justify-between">
                        <Text className="text-black/60 font-bold text-xs">Current State</Text>
                        <View className="items-center justify-center flex-1">
                           {user?.isAwake ? (
                              <Sun size={48} color="black" />
                           ) : (
                              <Moon size={48} color="black" />
                           )}
                        </View>
                        <Text className="text-black text-xl font-bold text-center">
                           {user?.isAwake ? 'Awake' : 'Sleeping'}
                        </Text>
                     </View>

                  </View>

                  {/* RIGHT COLUMN */}
                  <View className="flex-1 gap-4">

                     {/* Mood Card: Current Mood */}
                     <TouchableOpacity
                        onPress={() => setShowMoodLog(true)}
                        className="bg-[#FFD465] p-5 rounded-[30px] h-44 justify-between"
                     >
                        <Text className="text-black/60 font-bold text-xs">Current Mood</Text>
                        <View className="items-center justify-center flex-1">
                           <Text className="text-5xl">{recentMood ? getMoodEmoji(recentMood.level) : '😐'}</Text>
                        </View>
                        <Text className="text-black font-bold text-lg text-center">
                           {recentMood ? ['Terrible', 'Bad', 'Okay', 'Good', 'Great'][recentMood.level - 1] : 'Log Mood'}
                        </Text>
                        <View className="h-8 w-8 bg-white/50 rounded-full items-center justify-center absolute top-4 right-4">
                           <Heart size={14} color="black" />
                        </View>
                     </TouchableOpacity>

                     {/* Stats Card: Total Time */}
                     <View className="bg-[#9F7AEA] p-4 rounded-[30px] flex-row items-center justify-center gap-2 h-24">
                        <View className="h-10 w-10 bg-white/20 rounded-full items-center justify-center">
                           <Sun size={20} color="white" />
                        </View>
                        <View>
                           <Text className="text-white font-bold text-xl">
                              {analytics ? `${Math.round(analytics.awakeTimeHours)}h` : '0h'}
                           </Text>
                           <Text className="text-white/70 text-xs">Awake Time</Text>
                        </View>
                     </View>

                     {/* Focus Time Card */}
                     <View className="bg-[#FF8E6E] p-4 rounded-[30px] flex-row items-center justify-center gap-2 h-24">
                        <View className="h-10 w-10 bg-white/20 rounded-full items-center justify-center">
                           <TrendingUp size={20} color="white" />
                        </View>
                        <View>
                           <Text className="text-white font-bold text-xl">
                              {analytics ? `${Math.round(analytics.focusTimeHours)}h` : '0h'}
                           </Text>
                           <Text className="text-white/70 text-xs">Focus Time</Text>
                        </View>
                     </View>
                  </View>

               </View>

            </ScrollView>

            {/* Mood Log Modal */}
            <MoodLogModal
               visible={showMoodLog}
               onClose={() => setShowMoodLog(false)}
               userId={userId}
            />

            {/* Settings Modal */}
            <SettingsModal
               visible={showSettings}
               onClose={() => setShowSettings(false)}
               userId={userId}
            />

            {/* Delegation Modal */}
            <DelegationModal
               visible={showDelegation}
               onClose={() => setShowDelegation(false)}
               userId={userId}
            />

            {/* Vault Access (Passcode Entry) */}
            <VaultAccessModal
               visible={showVaultAccess}
               onClose={() => setShowVaultAccess(false)}
               onSuccess={() => {
                  setShowVaultAccess(false);
                  setShowVault(true);
               }}
               userId={userId}
            />

            {/* Vault Content Screen */}
            <VaultContentScreen
               visible={showVault}
               onClose={() => setShowVault(false)}
               userId={userId}
            />

            {/* Daily Reflection Modal */}
            <DailyReflectionModal
               visible={showReflection}
               onClose={() => setShowReflection(false)}
               userId={userId}
            />

            {/* Edit Profile Modal */}
            <EditProfileModal
               visible={showEditProfile}
               onClose={() => setShowEditProfile(false)}
               userId={userId}
               currentName={user?.name || 'User'}
               currentAvatar={user?.avatarUrl}
            />

            {/* Notification History Modal */}
            <NotificationHistoryModal
               visible={showNotifications}
               onClose={() => setShowNotifications(false)}
               userId={userId}
            />
         </SafeAreaView>
      </View>
   );
}

// Observe data
const enhance = withObservables([], () => ({
   users: database.get<User>('users').query().observe(),
   tasks: database.get<Task>('tasks').query().observe(),
   moodLogs: database.get<MoodLog>('mood_logs').query(
      Q.sortBy('created_at', Q.desc),
      Q.take(1)
   ).observe(),
   events: database.get<EventLog>('event_logs').query().observe(),
}));

const EnhancedProfileScreen = enhance(ProfileScreen);

export default function ProfileScreenWrapper() {
   return <EnhancedProfileScreen users={[]} tasks={[]} moodLogs={[]} events={[]} />;
}