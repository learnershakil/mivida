/**
 * BreakLockModal Component
 * 
 * Modal for starting a Break session.
 * When break time is over:
 * 1. Plays notification sound for 5 seconds
 * 2. Starts a forced 10-minute Focus Lock (POST_BREAK_LOCK_MINUTES)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
} from 'react-native';
import { X, Coffee, Clock, Play } from 'lucide-react-native';
import notifee, { AndroidImportance, TriggerType } from '@notifee/react-native';
import { lockdownService } from '../services/lockdown';

interface BreakLockModalProps {
    visible: boolean;
    onClose: () => void;
    userId: string;
}

const PRESET_DURATIONS = [
    { label: '5 min', value: 5 },
    { label: '10 min', value: 10 },
    { label: '15 min', value: 15 },
    { label: '30 min', value: 30 },
];

const POST_BREAK_LOCK_MINUTES = 10; // Lock for 10 minutes after break

export function BreakLockModal({ visible, onClose, userId }: BreakLockModalProps) {
    const [selectedDuration, setSelectedDuration] = useState<number | null>(10);
    const [customDuration, setCustomDuration] = useState('');
    const [showCustom, setShowCustom] = useState(false);
    const [isBreakActive, setIsBreakActive] = useState(false);
    const [remainingSeconds, setRemainingSeconds] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const breakEndTimeRef = useRef<number | null>(null);

    // Handle break end - defined before useEffect that uses it
    const handleBreakEnd = useCallback(async () => {
        setIsBreakActive(false);
        setRemainingSeconds(0);
        breakEndTimeRef.current = null;

        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        // Play notification sound for 5 seconds
        try {
            await notifee.displayNotification({
                title: '🔔 Break Over!',
                body: 'Focus mode activating now...',
                android: {
                    channelId: 'break-alerts',
                    importance: AndroidImportance.HIGH,
                    sound: 'default',
                    ongoing: true,
                },
            });

            // Wait 5 seconds then start focus lock
            setTimeout(async () => {
                try {
                    // Cancel the ongoing notification
                    await notifee.cancelAllNotifications();

                    // Start focus lockdown for 10 minutes
                    await lockdownService.startLockdown(POST_BREAK_LOCK_MINUTES, userId);
                    onClose();
                } catch (error) {
                    console.error('Failed to start post-break lockdown:', error);
                }
            }, 5000);
        } catch (error) {
            console.error('Failed to play break end notification:', error);
        }
    }, [userId, onClose]);

    // Clean up timer on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, []);

    // Timer countdown
    useEffect(() => {
        if (isBreakActive && remainingSeconds > 0) {
            timerRef.current = setInterval(() => {
                if (breakEndTimeRef.current) {
                    const remaining = Math.max(0, Math.ceil((breakEndTimeRef.current - Date.now()) / 1000));
                    setRemainingSeconds(remaining);

                    if (remaining <= 0) {
                        handleBreakEnd();
                    }
                }
            }, 1000);

            return () => {
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                }
            };
        }
    }, [isBreakActive, remainingSeconds, handleBreakEnd]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleStartBreak = async () => {
        const duration = showCustom ? parseInt(customDuration, 10) : selectedDuration;

        if (!duration || duration <= 0) {
            Alert.alert('Error', 'Please select or enter a valid duration');
            return;
        }

        try {
            // Calculate end time
            const durationMs = duration * 60 * 1000;
            breakEndTimeRef.current = Date.now() + durationMs;
            setRemainingSeconds(duration * 60);
            setIsBreakActive(true);

            // Schedule notification for when break ends
            await scheduleBreakEndNotification(duration);

            console.log('[BreakLock] Break started for', duration, 'minutes');
        } catch (error) {
            console.error('Failed to start break:', error);
            Alert.alert('Error', 'Failed to start break session');
        }
    };

    const scheduleBreakEndNotification = async (minutes: number) => {
        try {
            // Create channel for break alerts
            await notifee.createChannel({
                id: 'break-alerts',
                name: 'Break Alerts',
                importance: AndroidImportance.HIGH,
                sound: 'default',
                vibration: true,
            });

            // Schedule notification
            const trigger = {
                type: TriggerType.TIMESTAMP,
                timestamp: Date.now() + minutes * 60 * 1000,
            };

            await notifee.createTriggerNotification(
                {
                    id: `break_end_${Date.now()}`,
                    title: '⏰ Break Time Over!',
                    body: 'Time to get back to work! Focus lock will activate in 5 seconds...',
                    android: {
                        channelId: 'break-alerts',
                        importance: AndroidImportance.HIGH,
                        sound: 'default',
                        pressAction: { id: 'default' },
                    },
                },
                trigger as any
            );
        } catch (error) {
            console.error('Failed to schedule break end notification:', error);
        }
    };

    const handleCancelBreak = () => {
        Alert.alert(
            'Cancel Break',
            'Are you sure you want to cancel your break?',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes, Cancel',
                    onPress: () => {
                        setIsBreakActive(false);
                        setRemainingSeconds(0);
                        breakEndTimeRef.current = null;
                        if (timerRef.current) {
                            clearInterval(timerRef.current);
                        }
                    },
                },
            ]
        );
    };

    const handleClose = () => {
        if (isBreakActive) {
            Alert.alert(
                'Break in Progress',
                'You have an active break. Are you sure you want to close?',
                [
                    { text: 'Stay', style: 'cancel' },
                    { text: 'Close', onPress: onClose },
                ]
            );
        } else {
            onClose();
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={handleClose}
        >
            <View className="flex-1 bg-black/50 justify-center items-center px-6">
                <View className="bg-white rounded-[32px] p-6 w-full max-w-md">
                    {/* Header */}
                    <View className="flex-row justify-between items-center mb-6">
                        <View className="flex-row items-center gap-3">
                            <View className="h-12 w-12 bg-[#86EFAC] rounded-full items-center justify-center">
                                <Coffee size={24} color="#166534" />
                            </View>
                            <View>
                                <Text className="text-xl font-bold">Break Time</Text>
                                <Text className="text-gray-500 text-sm">Rest and recharge</Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={handleClose}
                            className="h-10 w-10 bg-gray-100 rounded-full items-center justify-center"
                        >
                            <X size={20} color="black" />
                        </TouchableOpacity>
                    </View>

                    {isBreakActive ? (
                        /* Active Break View */
                        <View>
                            {/* Timer Display */}
                            <View className="bg-green-50 rounded-3xl p-8 mb-6 items-center">
                                <Text className="text-green-600 text-sm font-medium mb-2">Break Time Remaining</Text>
                                <Text className="text-6xl font-bold text-green-700">
                                    {formatTime(remainingSeconds)}
                                </Text>
                                <Text className="text-green-600 text-sm mt-4 text-center">
                                    Enjoy your break! Focus lock will activate {'\n'}
                                    for {POST_BREAK_LOCK_MINUTES} minutes when break ends.
                                </Text>
                            </View>

                            {/* Cancel Button */}
                            <TouchableOpacity
                                onPress={handleCancelBreak}
                                className="bg-gray-100 py-4 rounded-full items-center"
                            >
                                <Text className="text-gray-700 font-bold">Cancel Break</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        /* Setup View */
                        <View>
                            {/* Description */}
                            <View className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6">
                                <Text className="text-green-800 text-sm font-medium">
                                    ☕ Take a well-deserved break! When your break time is over,
                                    a notification will sound for 5 seconds, then Focus Lock
                                    will activate for {POST_BREAK_LOCK_MINUTES} minutes to help you get back on track.
                                </Text>
                            </View>

                            {/* Duration Selection */}
                            <Text className="text-gray-500 font-medium mb-3">Select Break Duration</Text>
                            <View className="flex-row flex-wrap gap-3 mb-4">
                                {PRESET_DURATIONS.map((preset) => (
                                    <TouchableOpacity
                                        key={preset.value}
                                        onPress={() => {
                                            setSelectedDuration(preset.value);
                                            setShowCustom(false);
                                        }}
                                        className={`px-5 py-3 rounded-full border ${!showCustom && selectedDuration === preset.value
                                            ? 'bg-[#86EFAC] border-[#86EFAC]'
                                            : 'bg-white border-gray-200'
                                            }`}
                                    >
                                        <Text
                                            className={`font-bold ${!showCustom && selectedDuration === preset.value
                                                ? 'text-green-800'
                                                : 'text-gray-700'
                                                }`}
                                        >
                                            {preset.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                                <TouchableOpacity
                                    onPress={() => setShowCustom(true)}
                                    className={`px-5 py-3 rounded-full border ${showCustom
                                        ? 'bg-[#86EFAC] border-[#86EFAC]'
                                        : 'bg-white border-gray-200'
                                        }`}
                                >
                                    <Text className={`font-bold ${showCustom ? 'text-green-800' : 'text-gray-700'}`}>
                                        Custom
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Custom Duration Input */}
                            {showCustom && (
                                <View className="flex-row items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-6">
                                    <Clock size={20} color="#6B7280" />
                                    <TextInput
                                        className="flex-1 text-base"
                                        placeholder="Enter minutes"
                                        value={customDuration}
                                        onChangeText={setCustomDuration}
                                        keyboardType="numeric"
                                        placeholderTextColor="#9CA3AF"
                                    />
                                </View>
                            )}

                            {/* Start Button */}
                            <TouchableOpacity
                                onPress={handleStartBreak}
                                className="bg-[#86EFAC] py-5 rounded-full flex-row items-center justify-center gap-2"
                            >
                                <Play size={20} color="#166534" fill="#166534" />
                                <Text className="text-green-800 font-bold text-lg">Start Break</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}
