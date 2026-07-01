import React from 'react';
import { View, Text, Switch, ActivityIndicator } from 'react-native';
import { withObservables } from '@nozbe/watermelondb/react';
import { database } from '../database';
import User from '../database/models/User';
import { toggleAwakeState } from '../services/userService';
import { deadManService } from '../services/deadMan';
import { Moon, Sun } from 'lucide-react-native';

interface UserObserverProps {
    user: User;
}

/**
 * Inner component that observes a single user record
 * This receives the user as a prop and observes its changes
 */
const UserAwakeToggle = ({ user }: UserObserverProps) => {
    const handleToggle = async () => {
        try {
            const newState = await toggleAwakeState(user);

            // Start or stop Dead Man service based on new state
            if (newState) {
                // User is now awake - start monitoring
                await deadManService.start(user.id);
                console.log('[AwakeToggle] Dead Man service started');
            } else {
                // User is now sleeping - stop monitoring
                deadManService.stop();
                console.log('[AwakeToggle] Dead Man service stopped');
            }
        } catch (error) {
            console.error('[AwakeToggle] Failed to toggle state:', error);
        }
    };

    return (
        <View className={`flex-row items-center bg-white rounded-full px-4 py-2 border border-gray-100 shadow-sm gap-3 ${!user.isAwake ? 'bg-indigo-50 border-indigo-200' : ''}`}>
            <View className="flex-row items-center gap-2">
                {user.isAwake ? <Sun size={18} color="#F59E0B" /> : <Moon size={18} color="#6366F1" />}
                <Text className={`text-sm font-bold ${user.isAwake ? 'text-black' : 'text-indigo-600'}`}>
                    {user.isAwake ? 'Awake' : 'Sleeping'}
                </Text>
            </View>
            <Switch
                trackColor={{ false: "#6366F1", true: "#C0F67F" }}
                thumbColor={user.isAwake ? "#fff" : "#f4f3f4"}
                ios_backgroundColor="#6366F1"
                onValueChange={handleToggle}
                value={user.isAwake}
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
        </View>
    );
};

// Enhance to observe the user record directly for field changes
const EnhancedUserToggle = withObservables(['user'], ({ user }: { user: User }) => ({
    user: user.observe(),
}))(UserAwakeToggle);

interface AwakeToggleContainerProps {
    users: User[];
}

/**
 * Container component that gets the user list
 * Then passes the first user to the inner component for observation
 */
const AwakeToggleContainer = ({ users }: AwakeToggleContainerProps) => {
    const user = users[0];
    if (!user) {
        return (
            <View className="flex-row items-center bg-gray-100 rounded-full px-4 py-2">
                <ActivityIndicator size="small" color="#6366F1" />
            </View>
        );
    }

    return <EnhancedUserToggle user={user} />;
};

// Enhance to observe the users collection
const enhance = withObservables([], () => ({
    users: database.get<User>('users').query().observe(),
}));

export default enhance(AwakeToggleContainer);
