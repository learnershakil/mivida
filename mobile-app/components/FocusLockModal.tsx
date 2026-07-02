/**
 * FocusLockModal Component
 * 
 * Modal for starting a Focus Lockdown session.
 * Allows selection of duration (15m, 30m, 1h, custom).
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
    Platform,
} from 'react-native';
import { X, Lock, Target, Clock, Calendar as CalendarIcon } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { lockdownService } from '../services/lockdown';
import { createTask } from '../services/taskService';
import { focusSchedule } from '../services/focusSchedule';

interface FocusLockModalProps {
    visible: boolean;
    onClose: () => void;
    userId: string;
}

const PRESET_DURATIONS = [
    { label: '15 min', value: 15 },
    { label: '30 min', value: 30 },
    { label: '1 hour', value: 60 },
    { label: '2 hours', value: 120 },
];

export function FocusLockModal({ visible, onClose, userId }: FocusLockModalProps) {
    const [selectedDuration, setSelectedDuration] = useState<number | null>(30);
    const [customDuration, setCustomDuration] = useState('');
    const [showCustom, setShowCustom] = useState(false);
    const [isScheduling, setIsScheduling] = useState(false);
    const [scheduleDate, setScheduleDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    const handleStartLockdown = async () => {
        const duration = showCustom ? parseInt(customDuration, 10) : selectedDuration;

        if (!duration || duration <= 0) {
            Alert.alert('Error', 'Please select or enter a valid duration');
            return;
        }

        try {
            if (isScheduling) {
                // Log a reminder task for visibility...
                await createTask({
                    title: `Scheduled Focus (${duration}m)`,
                    description: `Focus lockdown session for ${duration} minutes.`,
                    type: 'alert',
                    startTime: scheduleDate,
                    userId,
                });
                // ...and arm a native exact alarm so the lockdown auto-STARTS at that time even if the
                // app is closed (§5.3). Falls back to just the reminder if the native module is absent.
                const armed = await focusSchedule.schedule(scheduleDate.getTime(), duration, 'normal');
                Alert.alert(
                    'Scheduled',
                    armed
                        ? `Focus will auto-start at ${scheduleDate.toLocaleTimeString()}.`
                        : `Reminder set for ${scheduleDate.toLocaleTimeString()} (auto-start needs a device build).`,
                );
            } else {
                await lockdownService.startLockdown(duration, userId);
            }
            onClose();
        } catch (error) {
            console.error('Failed to start/schedule lockdown:', error);
            Alert.alert('Error', 'Failed to start/schedule focus session');
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/50 justify-center items-center px-6">
                <View className="bg-white rounded-[32px] p-6 w-full max-w-md">
                    {/* Header */}
                    <View className="flex-row justify-between items-center mb-6">
                        <View className="flex-row items-center gap-3">
                            <View className="h-12 w-12 bg-[#1E1E1E] rounded-full items-center justify-center">
                                <Lock size={24} color="white" />
                            </View>
                            <View>
                                <Text className="text-xl font-bold">Focus Lock</Text>
                                <Text className="text-gray-500 text-sm">Block distractions</Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={onClose}
                            className="h-10 w-10 bg-gray-100 rounded-full items-center justify-center"
                        >
                            <X size={20} color="black" />
                        </TouchableOpacity>
                    </View>

                    {/* Description */}
                    <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
                        <Text className="text-amber-800 text-sm font-medium">
                            ⚠️ During focus mode, you won't be able to exit the app or use other apps.
                            Only incoming calls will be allowed for emergencies.
                        </Text>
                    </View>

                    {/* Duration Selection */}
                    <Text className="text-gray-500 font-medium mb-3">Select Duration</Text>
                    <View className="flex-row flex-wrap gap-3 mb-4">
                        {PRESET_DURATIONS.map((preset) => (
                            <TouchableOpacity
                                key={preset.value}
                                onPress={() => {
                                    setSelectedDuration(preset.value);
                                    setShowCustom(false);
                                }}
                                className={`px-5 py-3 rounded-full border ${!showCustom && selectedDuration === preset.value
                                        ? 'bg-[#1E1E1E] border-[#1E1E1E]'
                                        : 'bg-white border-gray-200'
                                    }`}
                            >
                                <Text
                                    className={`font-bold ${!showCustom && selectedDuration === preset.value
                                            ? 'text-white'
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
                                    ? 'bg-[#1E1E1E] border-[#1E1E1E]'
                                    : 'bg-white border-gray-200'
                                }`}
                        >
                            <Text className={`font-bold ${showCustom ? 'text-white' : 'text-gray-700'}`}>
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

                    {/* Scheduling Toggle */}
                    <TouchableOpacity
                        onPress={() => setIsScheduling(!isScheduling)}
                        className="flex-row items-center gap-2 mb-4 p-3 bg-gray-50 rounded-xl"
                    >
                        <CalendarIcon size={20} color={isScheduling ? '#1E1E1E' : '#6B7280'} />
                        <Text className={`font-medium ${isScheduling ? 'text-[#1E1E1E]' : 'text-gray-500'}`}>
                            {isScheduling ? 'Schedule for later' : 'Start immediately'}
                        </Text>
                    </TouchableOpacity>

                    {isScheduling && (
                        <View className="mb-6">
                            <Text className="text-gray-500 font-medium mb-3">Start Time</Text>
                            {Platform.OS === 'ios' ? (
                                <DateTimePicker
                                    value={scheduleDate}
                                    mode="time"
                                    display="spinner"
                                    onChange={(_, date) => date && setScheduleDate(date)}
                                />
                            ) : (
                                <TouchableOpacity
                                    onPress={() => setShowDatePicker(true)}
                                    className="bg-gray-100 p-4 rounded-xl flex-row justify-between items-center"
                                >
                                    <Text className="text-base font-medium">{scheduleDate.toLocaleTimeString()}</Text>
                                    <Clock size={20} color="#6B7280" />
                                </TouchableOpacity>
                            )}
                            
                            {showDatePicker && Platform.OS === 'android' && (
                                <DateTimePicker
                                    value={scheduleDate}
                                    mode="time"
                                    display="default"
                                    onChange={(_, date) => {
                                        setShowDatePicker(false);
                                        if (date) setScheduleDate(date);
                                    }}
                                />
                            )}
                        </View>
                    )}

                    {/* Start Button */}
                    <TouchableOpacity
                        onPress={handleStartLockdown}
                        className="bg-[#1E1E1E] py-5 rounded-full flex-row items-center justify-center gap-2"
                    >
                        <Target size={20} color="#C0F67F" />
                        <Text className="text-white font-bold text-lg">
                            {isScheduling ? 'Schedule Focus' : 'Start Focus Session'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}
