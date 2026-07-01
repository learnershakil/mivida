import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Home, Wallet, LayoutDashboard, Music, User } from 'lucide-react-native'; 

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 25,
          left: 20,
          right: 20,
          backgroundColor: '#1E1E1E', // Dark Bar
          borderRadius: 30,
          height: 70,
          marginLeft: 15,
          marginRight: 15,
          borderTopWidth: 0,
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 10,
          elevation: 10,
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <View className={`p-3 mt-7 rounded-full ${focused ? 'bg-white/20' : ''}`}>
              <Home size={24} color={focused ? "#4AC3FF" : "#8E8E93"} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          tabBarIcon: ({ focused }) => (
            <View className={`p-3 mt-7 rounded-full ${focused ? 'bg-white/20' : ''}`}>
              <Wallet size={24} color={focused ? "#C0F67F" : "#8E8E93"} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarIcon: ({ focused }) => (
            <View className={`p-3 mt-7 rounded-full ${focused ? 'bg-white/20' : ''}`}>
              <LayoutDashboard size={24} color={focused ? "#FFD465" : "#8E8E93"} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="music"
        options={{
          tabBarIcon: ({ focused }) => (
            <View className={`p-3 mt-7 rounded-full ${focused ? 'bg-white/20' : ''}`}>
              <Music size={24} color={focused ? "#FF8E6E" : "#8E8E93"} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <View className={`p-3 mt-7 rounded-full ${focused ? 'bg-white/20' : ''}`}>
              <User size={24} color={focused ? "#D8C8FE" : "#8E8E93"} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}