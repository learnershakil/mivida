/**
 * SettingsModal Component
 * 
 * Modal for configuring app settings including:
 * - Dead Man's Switch threshold
 * - Notification intensity
 * - Lockdown strictness
 * - Weekday/Holiday Mode
 * - Export/Import preferences
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Modal,
    ScrollView,
    Switch,
    Alert,
    StyleSheet,
} from 'react-native';
import { X, Bell, Lock, Clock, Download, ChevronRight, Calendar, Sun, Briefcase, Volume2, Play, Music, Heart, Brain } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { withObservables } from '@nozbe/watermelondb/react';
import { database } from '../database';
import Settings from '../database/models/Settings';
import { updateSettings } from '../services/userService';
import { exportEventsAsJsonl, shareExport, generateExportFilename, saveExportToDevice } from '../services/exportService';
import { soundService, NOTIFICATION_SOUNDS, NotificationSoundId } from '../services/soundService';
import { alertService } from '../services/alertService';
import { notificationService } from '../services/notifications';
import { startMoodTracker, stopMoodTracker } from '../services/moodService';

interface SettingsModalProps {
    visible: boolean;
    onClose: () => void;
    settings: Settings | null;
    userId: string;
}

const NOTIFICATION_LEVELS = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
];

const LOCKDOWN_LEVELS = [
    { value: 'normal', label: 'Normal' },
    { value: 'strict', label: 'Strict' },
    { value: 'extreme', label: 'Extreme' },
];

const DAY_MODES = [
    { value: 'weekday', label: 'Weekday', icon: Briefcase, description: 'Work/Study mode' },
    { value: 'holiday', label: 'Holiday', icon: Sun, description: 'Relaxed mode' },
];

function SettingsModalBase({ visible, onClose, settings, userId }: SettingsModalProps) {
    const [deadManThreshold, setDeadManThreshold] = useState('180');
    const [deadManEnabled, setDeadManEnabled] = useState(true);
    const [notificationIntensity, setNotificationIntensity] = useState('medium');
    const [notificationSound, setNotificationSound] = useState(true);
    const [notificationVibration, setNotificationVibration] = useState(true);
    const [selectedSoundType, setSelectedSoundType] = useState<NotificationSoundId>('default');
    const [customSoundUri, setCustomSoundUri] = useState<string | null>(null);
    const [customSoundName, setCustomSoundName] = useState<string | null>(null);
    const [lockdownStrictness, setLockdownStrictness] = useState('normal');
    const [lockdownAllowCalls, setLockdownAllowCalls] = useState(true);
    const [dayMode, setDayMode] = useState<'weekday' | 'holiday'>('weekday');
    const [isExporting, setIsExporting] = useState(false);
    const [isPreviewingSound, setIsPreviewingSound] = useState<string | null>(null);
    const [moodTrackerEnabled, setMoodTrackerEnabled] = useState(false);
    const [moodTrackerInterval, setMoodTrackerInterval] = useState('45');
    const [fatigueScreenTimeHours, setFatigueScreenTimeHours] = useState('6');
    const [fatigueSteps, setFatigueSteps] = useState('1000');

    useEffect(() => {
        if (settings) {
            setDeadManThreshold(settings.deadManThresholdMinutes.toString());
            setDeadManEnabled(settings.deadManEnabled);
            setNotificationIntensity(settings.notificationIntensity);
            setNotificationSound(settings.notificationSoundEnabled);
            setNotificationVibration(settings.notificationVibrationEnabled);
            setSelectedSoundType((settings.notificationSound as NotificationSoundId) || 'default');
            setCustomSoundUri(settings.customNotificationSoundUri || null);
            setCustomSoundName(settings.customNotificationSoundName || null);
            setLockdownStrictness(settings.lockdownStrictness);
            setLockdownAllowCalls(settings.lockdownAllowCalls);
            setDayMode((settings.taskMode as 'weekday' | 'holiday') || 'weekday');
            setMoodTrackerEnabled(settings.moodTrackerEnabled ?? false);
            setMoodTrackerInterval((settings.moodTrackerIntervalMinutes ?? 45).toString());
            setFatigueScreenTimeHours((settings.fatigueScreenTimeThresholdHours ?? 6).toString());
            setFatigueSteps((settings.fatigueStepsThreshold ?? 1000).toString());
        }
    }, [settings]);

    const handlePreviewSound = async (soundId: NotificationSoundId) => {
        if (soundId === 'custom') {
            if (customSoundUri && customSoundName) {
                setIsPreviewingSound('custom');
                try {
                    await soundService.previewCustomSound(customSoundUri, customSoundName);
                } finally {
                    setTimeout(() => setIsPreviewingSound(null), 1000);
                }
            }
            return;
        }
        setIsPreviewingSound(soundId);
        try {
            await soundService.previewSound(soundId);
        } finally {
            setTimeout(() => setIsPreviewingSound(null), 1000);
        }
    };

    const handleSelectCustomSound = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'audio/*',
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                const uri = asset.uri;
                const name = asset.name || 'Custom Sound';

                setCustomSoundUri(uri);
                setCustomSoundName(name);
                setSelectedSoundType('custom');

                // Preview the selected sound
                await soundService.previewCustomSound(uri, name);
            }
        } catch (error) {
            console.error('Failed to pick audio file:', error);
            Alert.alert('Error', 'Failed to select audio file. Please try again.');
        }
    };

    const handleSave = async () => {
        if (!settings) return;

        try {
            const moodIntervalValue = parseInt(moodTrackerInterval, 10) || 45;

            await updateSettings(settings, {
                deadManThresholdMinutes: parseInt(deadManThreshold, 10) || 180,
                deadManEnabled,
                notificationIntensity,
                notificationSoundEnabled: notificationSound,
                notificationVibrationEnabled: notificationVibration,
                notificationSound: selectedSoundType,
                lockdownStrictness,
                lockdownAllowCalls,
                taskMode: dayMode,
                moodTrackerEnabled,
                moodTrackerIntervalMinutes: moodIntervalValue,
                fatigueScreenTimeThresholdHours: parseFloat(fatigueScreenTimeHours) || 6,
                fatigueStepsThreshold: parseInt(fatigueSteps, 10) || 1000,
            });

            // Start or stop mood tracker based on setting
            if (moodTrackerEnabled) {
                startMoodTracker(moodIntervalValue, userId);
            } else {
                stopMoodTracker();
            }

            // Update the sound service and notification channel
            if (selectedSoundType === 'custom' && customSoundUri && customSoundName) {
                await soundService.setCustomSound(customSoundUri, customSoundName);
            } else {
                await soundService.setSound(selectedSoundType);
            }
            // Refresh alert channel and notification channels with new sound
            await alertService.refreshChannel();
            await notificationService.refreshChannels();

            Alert.alert('Success', 'Settings saved successfully');
            onClose();
        } catch (error) {
            console.error('Failed to save settings:', error);
            Alert.alert('Error', 'Failed to save settings');
        }
    };

    const handleExport = async () => {
        Alert.alert(
            'Export Logs',
            'Choose how to export your data:',
            [
                {
                    text: 'Share',
                    onPress: async () => {
                        setIsExporting(true);
                        try {
                            const content = await exportEventsAsJsonl({ userId });
                            const filename = generateExportFilename();
                            await shareExport(content, filename);
                        } catch (error) {
                            console.error('Export failed:', error);
                            Alert.alert('Export Failed', 'Could not export data. Please try again.');
                        } finally {
                            setIsExporting(false);
                        }
                    },
                },
                {
                    text: 'Save to Device',
                    onPress: async () => {
                        setIsExporting(true);
                        try {
                            const content = await exportEventsAsJsonl({ userId });
                            const filename = generateExportFilename();
                            await saveExportToDevice(content, filename);
                        } catch (error) {
                            console.error('Export failed:', error);
                            Alert.alert('Export Failed', 'Could not save data. Please try again.');
                        } finally {
                            setIsExporting(false);
                        }
                    },
                },
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    };

    // Import removed per spec (§8.3): export-only.

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/50">
                <View className="flex-1 bg-white rounded-t-[40px] mt-20">
                    {/* Header */}
                    <View className="flex-row justify-between items-center p-6 border-b border-gray-100">
                        <Text className="text-2xl font-bold">Settings</Text>
                        <TouchableOpacity
                            onPress={onClose}
                            className="h-10 w-10 bg-gray-100 rounded-full items-center justify-center"
                        >
                            <X size={20} color="black" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
                        {/* Dead Man's Switch Section */}
                        <View className="mb-8">
                            <View className="flex-row items-center gap-2 mb-4">
                                <Clock size={20} color="#6366F1" />
                                <Text className="text-lg font-bold">Dead Man&apos;s Switch</Text>
                            </View>

                            <View className="bg-gray-50 rounded-2xl p-4 mb-3">
                                <View className="flex-row justify-between items-center">
                                    <Text className="font-medium">Enable</Text>
                                    <Switch
                                        value={deadManEnabled}
                                        onValueChange={setDeadManEnabled}
                                        trackColor={{ false: '#D1D5DB', true: '#6366F1' }}
                                    />
                                </View>
                            </View>

                            {deadManEnabled && (
                                <View className="bg-gray-50 rounded-2xl p-4">
                                    <Text className="text-gray-500 text-sm mb-2">
                                        Inactivity threshold (minutes)
                                    </Text>
                                    <TextInput
                                        className="bg-white border border-gray-200 rounded-xl p-3 text-lg font-bold"
                                        value={deadManThreshold}
                                        onChangeText={setDeadManThreshold}
                                        keyboardType="numeric"
                                        placeholder="180"
                                    />
                                    <Text className="text-gray-400 text-xs mt-2">
                                        Default: 180 minutes (3 hours)
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Notifications Section */}
                        <View className="mb-8">
                            <View className="flex-row items-center gap-2 mb-4">
                                <Bell size={20} color="#F59E0B" />
                                <Text className="text-lg font-bold">Notifications</Text>
                            </View>

                            <View className="bg-gray-50 rounded-2xl p-4 mb-3">
                                <Text className="text-gray-500 text-sm mb-3">Intensity</Text>
                                <View className="flex-row gap-2">
                                    {NOTIFICATION_LEVELS.map((level) => (
                                        <TouchableOpacity
                                            key={level.value}
                                            onPress={() => setNotificationIntensity(level.value)}
                                            className={`flex-1 py-3 rounded-full items-center ${notificationIntensity === level.value
                                                ? 'bg-[#1E1E1E]'
                                                : 'bg-white border border-gray-200'
                                                }`}
                                        >
                                            <Text className={`font-bold ${notificationIntensity === level.value
                                                ? 'text-white'
                                                : 'text-gray-600'
                                                }`}>
                                                {level.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View className="bg-gray-50 rounded-2xl p-4 mb-3">
                                <View className="flex-row justify-between items-center mb-3">
                                    <Text className="font-medium">Sound</Text>
                                    <Switch
                                        value={notificationSound}
                                        onValueChange={setNotificationSound}
                                        trackColor={{ false: '#D1D5DB', true: '#F59E0B' }}
                                    />
                                </View>

                                {/* Sound Type Selection - Only Default or Custom */}
                                {notificationSound && (
                                    <View className="mb-3">
                                        <Text className="text-gray-500 text-sm mb-2">Sound Type</Text>
                                        <View className="flex-row gap-2 mb-3">
                                            {/* Default Sound Option */}
                                            <TouchableOpacity
                                                onPress={() => setSelectedSoundType('default')}
                                                className={`flex-1 flex-row items-center justify-center py-3 rounded-full ${selectedSoundType === 'default'
                                                    ? 'bg-[#1E1E1E]'
                                                    : 'bg-white border border-gray-200'
                                                    }`}
                                            >
                                                <Text className={`font-medium ${selectedSoundType === 'default'
                                                    ? 'text-white'
                                                    : 'text-gray-600'
                                                    }`}>
                                                    Default
                                                </Text>
                                            </TouchableOpacity>

                                            {/* Custom Sound Option */}
                                            <TouchableOpacity
                                                onPress={() => {
                                                    if (customSoundUri) {
                                                        setSelectedSoundType('custom');
                                                    } else {
                                                        handleSelectCustomSound();
                                                    }
                                                }}
                                                className={`flex-1 flex-row items-center justify-center py-3 rounded-full ${selectedSoundType === 'custom'
                                                    ? 'bg-[#1E1E1E]'
                                                    : 'bg-white border border-gray-200'
                                                    }`}
                                            >
                                                <Text className={`font-medium ${selectedSoundType === 'custom'
                                                    ? 'text-white'
                                                    : 'text-gray-600'
                                                    }`}>
                                                    Custom
                                                </Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Custom Sound Selection (shown when custom is selected) */}
                                        {selectedSoundType === 'custom' && (
                                            <TouchableOpacity
                                                onPress={handleSelectCustomSound}
                                                className="flex-row items-center py-3 px-4 rounded-xl bg-gray-50 border border-gray-200"
                                            >
                                                <Music size={18} color="#F59E0B" />
                                                <View className="flex-1 ml-3">
                                                    <Text className="text-sm font-medium text-gray-700">
                                                        {customSoundName || 'Tap to select audio file...'}
                                                    </Text>
                                                    {customSoundUri && (
                                                        <Text className="text-xs text-gray-400 mt-0.5">
                                                            Tap to change
                                                        </Text>
                                                    )}
                                                </View>
                                                {customSoundUri && (
                                                    <TouchableOpacity
                                                        onPress={() => handlePreviewSound('custom')}
                                                        className="ml-2 p-2"
                                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                    >
                                                        <Play
                                                            size={16}
                                                            color="#F59E0B"
                                                            fill={isPreviewingSound === 'custom' ? '#F59E0B' : 'transparent'}
                                                        />
                                                    </TouchableOpacity>
                                                )}
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}

                                <View className="flex-row justify-between items-center">
                                    <Text className="font-medium">Vibration</Text>
                                    <Switch
                                        value={notificationVibration}
                                        onValueChange={setNotificationVibration}
                                        trackColor={{ false: '#D1D5DB', true: '#F59E0B' }}
                                    />
                                </View>
                            </View>
                        </View>

                        {/* Focus Lockdown Section */}
                        <View className="mb-8">
                            <View className="flex-row items-center gap-2 mb-4">
                                <Lock size={20} color="#EF4444" />
                                <Text className="text-lg font-bold">Focus Lockdown</Text>
                            </View>

                            <View className="bg-gray-50 rounded-2xl p-4 mb-3">
                                <Text className="text-gray-500 text-sm mb-3">Strictness</Text>
                                <View className="flex-row gap-2">
                                    {LOCKDOWN_LEVELS.map((level) => (
                                        <TouchableOpacity
                                            key={level.value}
                                            onPress={() => setLockdownStrictness(level.value)}
                                            className={`flex-1 py-3 rounded-full items-center ${lockdownStrictness === level.value
                                                ? 'bg-[#1E1E1E]'
                                                : 'bg-white border border-gray-200'
                                                }`}
                                        >
                                            <Text className={`font-bold ${lockdownStrictness === level.value
                                                ? 'text-white'
                                                : 'text-gray-600'
                                                }`}>
                                                {level.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View className="bg-gray-50 rounded-2xl p-4">
                                <View className="flex-row justify-between items-center">
                                    <Text className="font-medium">Allow incoming calls</Text>
                                    <Switch
                                        value={lockdownAllowCalls}
                                        onValueChange={setLockdownAllowCalls}
                                        trackColor={{ false: '#D1D5DB', true: '#22C55E' }}
                                    />
                                </View>
                            </View>
                        </View>

                        {/* Day Mode Section */}
                        <View className="mb-8">
                            <View className="flex-row items-center gap-2 mb-4">
                                <Calendar size={20} color="#8B5CF6" />
                                <Text className="text-lg font-bold">Day Mode</Text>
                            </View>

                            <View className="bg-gray-50 rounded-2xl p-4">
                                <Text className="text-gray-500 text-sm mb-3">
                                    Switch between work and relaxation modes
                                </Text>
                                <View className="flex-row gap-2">
                                    {DAY_MODES.map((mode) => {
                                        const Icon = mode.icon;
                                        return (
                                            <TouchableOpacity
                                                key={mode.value}
                                                onPress={() => setDayMode(mode.value as 'weekday' | 'holiday')}
                                                className={`flex-1 py-4 rounded-xl items-center ${dayMode === mode.value
                                                    ? 'bg-purple-600'
                                                    : 'bg-white border border-gray-200'
                                                    }`}
                                            >
                                                <Icon
                                                    size={24}
                                                    color={dayMode === mode.value ? 'white' : '#6B7280'}
                                                />
                                                <Text className={`font-bold mt-1 ${dayMode === mode.value ? 'text-white' : 'text-gray-600'
                                                    }`}>
                                                    {mode.label}
                                                </Text>
                                                <Text className={`text-xs mt-0.5 ${dayMode === mode.value ? 'text-purple-200' : 'text-gray-400'
                                                    }`}>
                                                    {mode.description}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                                <Text className="text-gray-400 text-xs mt-3">
                                    Holiday mode: Less strict deadlines, relaxed notifications
                                </Text>
                            </View>
                        </View>

                        {/* Mood Tracker Section */}
                        <View className="mb-8">
                            <View className="flex-row items-center gap-2 mb-4">
                                <Heart size={20} color="#EC4899" />
                                <Text className="text-lg font-bold">Mood Tracker</Text>
                            </View>

                            <View className="bg-gray-50 rounded-2xl p-4 mb-3">
                                <View className="flex-row justify-between items-center">
                                    <Text className="font-medium">Enable mood check-ins</Text>
                                    <Switch
                                        value={moodTrackerEnabled}
                                        onValueChange={setMoodTrackerEnabled}
                                        trackColor={{ false: '#D1D5DB', true: '#EC4899' }}
                                    />
                                </View>
                            </View>

                            {moodTrackerEnabled && (
                                <View className="bg-gray-50 rounded-2xl p-4">
                                    <Text className="text-gray-500 text-sm mb-2">
                                        Check-in interval (minutes)
                                    </Text>
                                    <TextInput
                                        className="bg-white border border-gray-200 rounded-xl p-3 text-lg font-bold"
                                        value={moodTrackerInterval}
                                        onChangeText={setMoodTrackerInterval}
                                        keyboardType="numeric"
                                        placeholder="45"
                                    />
                                    <Text className="text-gray-400 text-xs mt-2">
                                        How often to ask about your mood (default: 45 mins)
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Insights Section — fatigue thresholds feed the auto physical-activity trigger */}
                        <View className="mb-8">
                            <View className="flex-row items-center gap-2 mb-4">
                                <Brain size={20} color="#4AC3FF" />
                                <Text className="text-lg font-bold">Insights</Text>
                            </View>

                            <View className="bg-gray-50 rounded-2xl p-4 mb-3">
                                <Text className="text-gray-500 text-sm mb-2">
                                    Fatigue: screen-time threshold (hours)
                                </Text>
                                <TextInput
                                    className="bg-white border border-gray-200 rounded-xl p-3 text-lg font-bold"
                                    value={fatigueScreenTimeHours}
                                    onChangeText={setFatigueScreenTimeHours}
                                    keyboardType="numeric"
                                    placeholder="6"
                                />
                            </View>

                            <View className="bg-gray-50 rounded-2xl p-4">
                                <Text className="text-gray-500 text-sm mb-2">
                                    Fatigue: daily steps threshold
                                </Text>
                                <TextInput
                                    className="bg-white border border-gray-200 rounded-xl p-3 text-lg font-bold"
                                    value={fatigueSteps}
                                    onChangeText={setFatigueSteps}
                                    keyboardType="numeric"
                                    placeholder="1000"
                                />
                                <Text className="text-gray-400 text-xs mt-2">
                                    When screen time exceeds the hours above and steps stay below this count, a physical-activity task is suggested.
                                </Text>
                            </View>
                        </View>

                        {/* Export Section */}
                        <View className="mb-8">
                            <View className="flex-row items-center gap-2 mb-4">
                                <Download size={20} color="#10B981" />
                                <Text className="text-lg font-bold">Data Management</Text>
                            </View>

                            <TouchableOpacity
                                onPress={handleExport}
                                disabled={isExporting}
                                className="bg-gray-50 rounded-2xl p-4 flex-row justify-between items-center mb-3"
                            >
                                <View className="flex-row items-center gap-3">
                                    <Download size={20} color="#10B981" />
                                    <View>
                                        <Text className="font-medium">Export as JSONL</Text>
                                        <Text className="text-gray-400 text-xs">
                                            {isExporting ? 'Exporting...' : 'All events with schema version'}
                                        </Text>
                                    </View>
                                </View>
                                <ChevronRight size={20} color="#9CA3AF" />
                            </TouchableOpacity>
                        </View>

                        {/* Save Button */}
                        <TouchableOpacity
                            onPress={handleSave}
                            className="bg-[#1E1E1E] py-5 rounded-full items-center mb-10"
                        >
                            <Text className="text-white font-bold text-lg">Save Settings</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

// Container to fetch settings
interface SettingsModalContainerProps {
    visible: boolean;
    onClose: () => void;
    userId: string;
}

function SettingsModalContainer(props: SettingsModalContainerProps & { settingsList: Settings[] }) {
    const settings = props.settingsList.find(s => s.userId === props.userId) || null;
    return <SettingsModalBase {...props} settings={settings} />;
}

const enhance = withObservables([], () => ({
    settingsList: database.get<Settings>('settings').query().observe(),
}));

export const SettingsModal = enhance(SettingsModalContainer);
