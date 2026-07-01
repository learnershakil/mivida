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
} from 'react-native';
import { X, Lock, Target, Clock } from 'lucide-react-native';
import { lockdownService } from '../services/lockdown';

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

    const handleStartLockdown = async () => {
        const duration = showCustom ? parseInt(customDuration, 10) : selectedDuration;

        if (!duration || duration <= 0) {
            Alert.alert('Error', 'Please select or enter a valid duration');
            return;
        }

        try {
            await lockdownService.startLockdown(duration, userId);
            onClose();
        } catch (error) {
            console.error('Failed to start lockdown:', error);
            Alert.alert('Error', 'Failed to start focus session');
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

                    {/* Start Button */}
                    <TouchableOpacity
                        onPress={handleStartLockdown}
                        className="bg-[#1E1E1E] py-5 rounded-full flex-row items-center justify-center gap-2"
                    >
                        <Target size={20} color="#C0F67F" />
                        <Text className="text-white font-bold text-lg">Start Focus Session</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}
