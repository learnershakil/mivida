/**
 * TaskCard Component
 * 
 * Displays a single task with timer controls.
 * Features:
 * - Start/pause/resume/complete actions
 * - Long-press for partial completion with remark OR delete
 * - Single tap to view full task details
 * - Countdown timer with 80% and 100% notifications
 * - Negative timer after expected duration
 * - Awake state check before starting/resuming
 * - Mandatory remark when pausing
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, Modal, StyleSheet, AppState, AppStateStatus, TextInput, ScrollView, GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import { withObservables } from '@nozbe/watermelondb/react';
import { Play, Pause, CheckCircle2, Clock, ArrowUpRight, X, Trash2, Users, AlertCircle, Calendar, FileText, Pencil, XCircle } from 'lucide-react-native';
import Task from '../database/models/Task';
import { startTask, pauseTask, updateTaskProgress, deleteTask, cancelTask } from '../services/taskService';
import { notificationService } from '../services/notifications';
import { getCurrentUser } from '../services/userService';
import { getEventsForEntity } from '../services/eventLogger';
import { lockdownService } from '../services/lockdown';
import { EditTaskModal } from './EditTaskModal';

interface TaskCardProps {
    task: Task;
    userId: string;
    variant?: 'dark' | 'green' | 'purple' | 'default';
}

const VARIANTS = {
    dark: {
        bg: 'bg-[#1E1E1E]',
        text: 'text-white',
        subtext: 'text-white/60',
        progressBg: 'bg-white/10',
        progressFill: 'bg-[#D1F098]',
        iconBg: 'bg-white/20',
    },
    green: {
        bg: 'bg-[#D1F098]',
        text: 'text-black',
        subtext: 'text-black/60',
        progressBg: 'bg-black/10',
        progressFill: 'bg-black',
        iconBg: 'bg-white/40',
    },
    purple: {
        bg: 'bg-[#C4B5FD]',
        text: 'text-black',
        subtext: 'text-black/60',
        progressBg: 'bg-black/10',
        progressFill: 'bg-black',
        iconBg: 'bg-white/40',
    },
    default: {
        bg: 'bg-white border border-gray-100',
        text: 'text-black',
        subtext: 'text-gray-500',
        progressBg: 'bg-gray-100',
        progressFill: 'bg-[#4AC3FF]',
        iconBg: 'bg-gray-100',
    },
};

const TaskCard = ({ task, userId, variant = 'default' }: TaskCardProps) => {
    const [currentElapsed, setCurrentElapsed] = useState(0);
    const [showPartialModal, setShowPartialModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showPauseRemarkModal, setShowPauseRemarkModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showCompleteRemarkModal, setShowCompleteRemarkModal] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [completeRemark, setCompleteRemark] = useState('');
    const [partialPercent, setPartialPercent] = useState(task.completionPercent || 0);
    const [partialRemark, setPartialRemark] = useState('');
    const [pauseRemark, setPauseRemark] = useState('');
    const [partialHistory, setPartialHistory] = useState<any[]>([]);
    const [has80Notified, setHas80Notified] = useState(false);
    const [has100Notified, setHas100Notified] = useState(false);
    const startTimeRef = useRef<number | null>(null);
    const styles = VARIANTS[variant];
    const [sliderWidth, setSliderWidth] = useState(0);

    // Calculate current session time with notifications
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;

        if (task.isActive) {
            if (!startTimeRef.current && task.timerStartedAt) {
                startTimeRef.current = task.timerStartedAt;
            }

            interval = setInterval(() => {
                if (startTimeRef.current) {
                    const sessionSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
                    setCurrentElapsed(sessionSeconds);

                    // Check for 80% and 100% notifications
                    if (task.expectedDurationMinutes) {
                        const expectedSeconds = task.expectedDurationMinutes * 60;
                        const totalSeconds = (task.totalElapsedSeconds || 0) + sessionSeconds;
                        const percentComplete = (totalSeconds / expectedSeconds) * 100;

                        if (percentComplete >= 80 && percentComplete < 100 && !has80Notified) {
                            setHas80Notified(true);
                            notificationService.sendNotification(
                                '⏰ 80% Time Used!',
                                `${task.title} - Only 20% time remaining!`,
                                'warning'
                            ).catch(console.log);
                        }

                        if (percentComplete >= 100 && !has100Notified) {
                            setHas100Notified(true);
                            notificationService.sendNotification(
                                '🔴 Time\'s Up!',
                                `${task.title} - Expected duration exceeded!`,
                                'mandatory'
                            ).catch(console.log);
                        }
                    }
                }
            }, 1000);
        } else {
            startTimeRef.current = null;
            setCurrentElapsed(0);
            setHas80Notified(false);
            setHas100Notified(false);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [task.isActive, task.timerStartedAt, task.expectedDurationMinutes, task.totalElapsedSeconds, has80Notified, has100Notified, task.title]);

    // Handle app state changes
    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active' && task.isActive && task.timerStartedAt) {
                startTimeRef.current = task.timerStartedAt;
                const sessionSeconds = Math.floor((Date.now() - task.timerStartedAt) / 1000);
                setCurrentElapsed(sessionSeconds);
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => subscription?.remove();
    }, [task.isActive]);

    // Load partial completion history when detail modal opens
    useEffect(() => {
        if (showDetailModal) {
            loadPartialHistory();
        }
    }, [showDetailModal, task.id]);

    const loadPartialHistory = async () => {
        try {
            const events = await getEventsForEntity('task', task.id, userId);
            // Include all progress-related events: pauses, partial completions, and updates
            const historyEvents = events.filter(e =>
                e.eventType === 'TASK_PARTIAL_COMPLETION' ||
                e.eventType === 'TASK_PAUSED' ||
                e.eventType === 'TASK_UPDATED' ||
                e.eventType === 'TASK_STARTED' ||
                e.eventType === 'TASK_COMPLETED' ||
                e.eventType === 'TASK_RESUMED'
            );
            // Sort by createdAt (newest first for display)
            historyEvents.sort((a, b) => b.createdAt - a.createdAt);
            setPartialHistory(historyEvents);
        } catch (error) {
            console.error('Failed to load partial history:', error);
        }
    };

    // Check if user is awake
    const checkAwakeState = async (): Promise<boolean> => {
        try {
            const user = await getCurrentUser();
            if (user && !user.isAwake) {
                Alert.alert(
                    'Not Awake',
                    'You must be in "Awake" mode to start or resume tasks. Please toggle your Awake status first.',
                    [{ text: 'OK' }]
                );
                return false;
            }
            return true;
        } catch (error) {
            console.error('Failed to check awake state:', error);
            return true; // Allow if check fails
        }
    };

    const handlePlayPause = async () => {
        try {
            if (task.isActive) {
                // Show pause remark modal (mandatory)
                setPauseRemark('');
                setShowPauseRemarkModal(true);
            } else if (task.isCompleted) {
                Alert.alert('Task Completed', 'This task is already completed.');
            } else {
                // Check awake state before starting
                const isAwake = await checkAwakeState();
                if (!isAwake) return;

                await startTask(task, userId);
                startTimeRef.current = Date.now();
                setCurrentElapsed(0);
                try {
                    await notificationService.sendNotification(
                        'Timer Started ⏱️',
                        `${task.title} - Timer is now running`,
                        'informational'
                    );
                } catch (e) {
                    console.log('[TaskCard] Notification error:', e);
                }
            }
        } catch (error) {
            console.error('Failed to toggle task:', error);
        }
    };

    const handlePauseWithRemark = async () => {
        if (!pauseRemark.trim()) {
            Alert.alert('Remark Required', 'Please enter a remark explaining why you are pausing.');
            return;
        }

        try {
            const totalSeconds = (task.totalElapsedSeconds || 0) + currentElapsed;
            await pauseTask(task, userId, pauseRemark.trim());
            setShowPauseRemarkModal(false);
            try {
                await notificationService.sendNotification(
                    'Task Paused ⏸️',
                    `${task.title} - Total time: ${formatTime(totalSeconds)}`,
                    'informational'
                );
            } catch (e) {
                console.log('[TaskCard] Notification error:', e);
            }
        } catch (error) {
            console.error('Failed to pause task:', error);
            Alert.alert('Error', 'Failed to pause task');
        }
    };

    const handleComplete = async () => {
        if (task.type === 'custom') {
            setCompleteRemark('');
            setShowCompleteRemarkModal(true);
            return;
        }

        // Fixed routines complete directly
        Alert.alert(
            'Complete Task',
            'Mark this task as 100% complete?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Complete',
                    onPress: async () => {
                        try {
                            await updateTaskProgress(task, 100, userId, 'Task completed');
                            try {
                                await notificationService.sendNotification(
                                    'Task Completed! 🎉',
                                    `${task.title} - Great job!`,
                                    'informational'
                                );
                            } catch (e) {
                                console.log('[TaskCard] Notification error:', e);
                            }
                        } catch (error) {
                            console.error('Failed to complete task:', error);
                        }
                    },
                },
            ]
        );
    };

    const handleCustomCompleteWithRemark = async () => {
        if (!completeRemark.trim()) {
            Alert.alert('Remark Required', 'Please enter a completion remark to finish this custom task.');
            return;
        }
        
        try {
            await updateTaskProgress(task, 100, userId, completeRemark.trim());
            setShowCompleteRemarkModal(false);
            try {
                await notificationService.sendNotification(
                    'Task Completed! 🎉',
                    `${task.title} - Great job!`,
                    'informational'
                );
            } catch (e) {
                console.log('[TaskCard] Notification error:', e);
            }
        } catch (error) {
            console.error('Failed to complete custom task:', error);
            Alert.alert('Error', 'Failed to complete task');
        }
    };

    // Single tap - show detail modal
    const handlePress = () => {
        setShowDetailModal(true);
    };

    // Long press - show partial completion/delete modal
    const handleLongPress = () => {
        if (task.isCompleted) return;
        setPartialPercent(task.completionPercent || 0);
        setPartialRemark('');
        setShowPartialModal(true);
    };

    const handlePartialComplete = async () => {
        if (!partialRemark.trim()) {
            Alert.alert('Remark Required', 'Please enter a remark for this progress update.');
            return;
        }

        try {
            await updateTaskProgress(task, partialPercent, userId, partialRemark.trim());
            setShowPartialModal(false);
            setPartialRemark('');
        } catch (error) {
            console.error('Failed to update progress:', error);
            Alert.alert('Error', 'Failed to update task progress');
        }
    };

    const handleDeleteTask = async () => {
        Alert.alert(
            'Delete Task',
            `Are you sure you want to delete "${task.title}"? This action cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteTask(task, userId);
                            setShowPartialModal(false);
                        } catch (error) {
                            console.error('Failed to delete task:', error);
                            Alert.alert('Error', 'Failed to delete task');
                        }
                    },
                },
            ]
        );
    };

    const handleCancel = async () => {
        if (lockdownService.isStrictLockdownActive()) {
            Alert.alert('Action Disabled', 'You cannot skip tasks during a strict focus session.');
            return;
        }
        setCancelReason('');
        setShowCancelModal(true);
    };

    const handleConfirmCancelTask = async () => {
        try {
            await cancelTask(task, userId, cancelReason || 'No reason provided');
            setShowCancelModal(false);
            setShowPartialModal(false);
            setCancelReason('');
            try {
                await notificationService.sendNotification(
                    'Task Cancelled ❌',
                    `${task.title} has been cancelled`,
                    'informational'
                );
            } catch (e) {
                console.log('[TaskCard] Notification error:', e);
            }
        } catch (error) {
            console.error('Failed to cancel task:', error);
            Alert.alert('Error', 'Failed to cancel task');
        }
    };

    const handleSliderLayout = (event: LayoutChangeEvent) => {
        setSliderWidth(event.nativeEvent.layout.width);
    };

    const handleSliderPress = (event: GestureResponderEvent) => {
        if (sliderWidth > 0) {
            const x = event.nativeEvent.locationX;
            const percent = Math.max(0, Math.min(100, Math.round((x / sliderWidth) * 100)));
            setPartialPercent(percent);
        }
    };

    // Format time, supports negative (overtime)
    const formatTime = (seconds: number) => {
        const isNegative = seconds < 0;
        const absSeconds = Math.abs(seconds);
        const hrs = Math.floor(absSeconds / 3600);
        const mins = Math.floor((absSeconds % 3600) / 60);
        const secs = absSeconds % 60;
        const prefix = isNegative ? '-' : '';
        if (hrs > 0) {
            return `${prefix}${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${prefix}${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatDate = (date: Date | null | undefined) => {
        if (!date) return 'Not set';
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Calculate remaining time (countdown) or overtime (negative)
    const calculateRemainingTime = () => {
        if (!task.expectedDurationMinutes) {
            // No expected duration, show elapsed time
            const totalElapsed = (task.totalElapsedSeconds || 0) + currentElapsed;
            return { display: formatTime(totalElapsed), isOvertime: false };
        }

        const expectedSeconds = task.expectedDurationMinutes * 60;
        const totalElapsed = (task.totalElapsedSeconds || 0) + currentElapsed;
        const remaining = expectedSeconds - totalElapsed;

        return {
            display: formatTime(remaining),
            isOvertime: remaining < 0,
        };
    };

    const timeInfo = calculateRemainingTime();

    // Priority badge colors
    const getPriorityColor = () => {
        switch (task.priority) {
            case 'urgent': return { bg: '#EF4444', text: '#FFFFFF' };
            case 'important': return { bg: '#F59E0B', text: '#000000' };
            default: return { bg: '#9CA3AF', text: '#FFFFFF' };
        }
    };

    const priorityColors = getPriorityColor();

    return (
        <>
            {/* Main Card - Single tap opens detail, long press opens options */}
            <TouchableOpacity
                onPress={handlePress}
                onLongPress={handleLongPress}
                delayLongPress={500}
                activeOpacity={0.9}
            >
                <View className={`${styles.bg} p-6 rounded-[40px] shadow-lg`}>
                    {/* Header with Priority Badge */}
                    <View className="flex-row justify-between items-start mb-2">
                        <View className="flex-1 mr-2">
                            <View className="flex-row items-center gap-2 mb-1">
                                <Text className={`${styles.text} text-2xl font-bold leading-8`}>
                                    {task.title}
                                </Text>
                            </View>
                            {/* Priority Badge */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ backgroundColor: priorityColors.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                                    <Text style={{ color: priorityColors.text, fontSize: 10, fontWeight: '600' }}>
                                        {(task.priority || 'normal').toUpperCase()}
                                    </Text>
                                </View>
                                {task.type === 'fixed' && (
                                    <View style={{ backgroundColor: '#3B82F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                                        <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '600' }}>FIXED</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={handleComplete}
                            className={`${styles.iconBg} rounded-full h-10 w-10 items-center justify-center`}
                        >
                            {task.isCompleted ? (
                                <CheckCircle2 size={20} color={variant === 'dark' ? 'white' : 'black'} />
                            ) : (
                                <ArrowUpRight size={20} color={variant === 'dark' ? 'white' : 'black'} style={{ transform: [{ rotate: '45deg' }] }} />
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Category/Type */}
                    <Text className={`${styles.subtext} font-semibold mb-4`}>
                        {task.category || task.type}
                        {task.isCompleted && ' • Completed'}
                    </Text>

                    {/* Assigned Persons */}
                    {task.assignedPersons && task.assignedPersons.length > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                            <Users size={12} color={variant === 'dark' ? '#FFFFFF99' : '#6B7280'} />
                            <Text className={`${styles.subtext} text-xs ml-1`}>
                                {task.assignedPersons.join(', ')}
                            </Text>
                        </View>
                    )}

                    {/* Timer & Controls */}
                    <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2">
                            <Clock size={16} color={timeInfo.isOvertime ? '#EF4444' : (variant === 'dark' ? 'white' : 'black')} />
                            <Text style={{
                                color: timeInfo.isOvertime ? '#EF4444' : (variant === 'dark' ? 'white' : 'black'),
                                fontSize: 14,
                                fontWeight: '600'
                            }}>
                                {task.expectedDurationMinutes ? (timeInfo.isOvertime ? 'OVERTIME ' : '') : ''}
                                {timeInfo.display}
                            </Text>
                            {task.expectedDurationMinutes && (
                                <Text className={`${styles.subtext} text-xs`}>
                                    / {task.expectedDurationMinutes}m
                                </Text>
                            )}
                        </View>

                        {!task.isCompleted && (
                            <TouchableOpacity
                                onPress={handlePlayPause}
                                className={`${task.isActive ? 'bg-red-500' : 'bg-[#C0F67F]'} px-4 py-2 rounded-full flex-row items-center gap-2`}
                            >
                                {task.isActive ? (
                                    <>
                                        <Pause size={14} color="white" />
                                        <Text className="text-white text-xs font-bold">Pause</Text>
                                    </>
                                ) : (
                                    <>
                                        <Play size={14} color="black" />
                                        <Text className="text-black text-xs font-bold">{task.totalElapsedSeconds ? 'Resume' : 'Start'}</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Progress Bar */}
                    {!task.isCompleted && task.completionPercent > 0 && (
                        <View className={`mt-4 ${styles.progressBg} h-2 rounded-full overflow-hidden`}>
                            <View
                                className={`${styles.progressFill} h-full rounded-full`}
                                style={{ width: `${task.completionPercent}%` }}
                            />
                        </View>
                    )}

                    {/* Hints */}
                    {!task.isCompleted && (
                        <Text className={`${styles.subtext} text-xs text-center mt-3`}>
                            Tap for details • Long press for options
                        </Text>
                    )}
                </View>
            </TouchableOpacity>

            {/* ===== TASK DETAIL MODAL (Single Tap) ===== */}
            <Modal
                visible={showDetailModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDetailModal(false)}
            >
                <View style={modalStyles.overlay}>
                    <View style={[modalStyles.container, { maxHeight: '80%' }]}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Header */}
                            <View style={modalStyles.header}>
                                <Text style={modalStyles.title}>Task Details</Text>
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <TouchableOpacity
                                        onPress={() => {
                                            if (lockdownService.isStrictLockdownActive()) {
                                                Alert.alert('Action Disabled', 'You cannot edit tasks during a strict focus session.');
                                                return;
                                            }
                                            setShowEditModal(true);
                                        }}
                                        className="h-10 w-10 bg-gray-100 rounded-full items-center justify-center"
                                    >
                                        <Pencil size={20} color="black" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setShowDetailModal(false)}
                                        style={modalStyles.closeButton}
                                    >
                                        <X size={20} color="black" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Task Title & Priority */}
                            <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>{task.title}</Text>
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                                <View style={{ backgroundColor: priorityColors.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                                    <Text style={{ color: priorityColors.text, fontSize: 12, fontWeight: '600' }}>
                                        {(task.priority || 'normal').toUpperCase()}
                                    </Text>
                                </View>
                                <View style={{ backgroundColor: task.type === 'fixed' ? '#3B82F6' : '#10B981', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>
                                        {task.type.toUpperCase()}
                                    </Text>
                                </View>
                            </View>

                            {/* Description */}
                            {task.description && (
                                <View style={modalStyles.detailSection}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                        <FileText size={14} color="#6B7280" />
                                        <Text style={modalStyles.detailLabel}> Description</Text>
                                    </View>
                                    <Text style={modalStyles.detailValue}>{task.description}</Text>
                                </View>
                            )}

                            {/* Category */}
                            <View style={modalStyles.detailSection}>
                                <Text style={modalStyles.detailLabel}>Category</Text>
                                <Text style={modalStyles.detailValue}>{task.category || 'Uncategorized'}</Text>
                            </View>

                            {/* Expected Duration */}
                            {task.expectedDurationMinutes && (
                                <View style={modalStyles.detailSection}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                        <Clock size={14} color="#6B7280" />
                                        <Text style={modalStyles.detailLabel}> Expected Duration</Text>
                                    </View>
                                    <Text style={modalStyles.detailValue}>{task.expectedDurationMinutes} minutes</Text>
                                </View>
                            )}

                            {/* Scheduled Times */}
                            {(task.startTime || task.endTime) && (
                                <View style={modalStyles.detailSection}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                        <Calendar size={14} color="#6B7280" />
                                        <Text style={modalStyles.detailLabel}> Schedule</Text>
                                    </View>
                                    <Text style={modalStyles.detailValue}>
                                        {formatDate(task.startTime)} - {formatDate(task.endTime)}
                                    </Text>
                                </View>
                            )}

                            {/* Assigned Persons */}
                            {task.assignedPersons && task.assignedPersons.length > 0 && (
                                <View style={modalStyles.detailSection}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                        <Users size={14} color="#6B7280" />
                                        <Text style={modalStyles.detailLabel}> Assigned To</Text>
                                    </View>
                                    <Text style={modalStyles.detailValue}>{task.assignedPersons.join(', ')}</Text>
                                </View>
                            )}

                            {/* Current Progress - Clickable to show history */}
                            <TouchableOpacity
                                onPress={() => {
                                    if (partialHistory.length > 0) {
                                        setShowHistoryModal(true);
                                    }
                                }}
                                style={modalStyles.detailSection}
                                activeOpacity={partialHistory.length > 0 ? 0.7 : 1}
                            >
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={modalStyles.detailLabel}>Current Progress</Text>
                                    {partialHistory.length > 0 && (
                                        <Text style={{ fontSize: 12, color: '#3B82F6' }}>
                                            Tap for full history →
                                        </Text>
                                    )}
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                    <View style={{ flex: 1, height: 8, backgroundColor: '#E5E7EB', borderRadius: 4 }}>
                                        <View style={{
                                            height: '100%',
                                            width: `${task.completionPercent || 0}%`,
                                            backgroundColor: '#4AC3FF',
                                            borderRadius: 4
                                        }} />
                                    </View>
                                    <Text style={{ fontWeight: '600' }}>{task.completionPercent || 0}%</Text>
                                </View>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ===== FULL HISTORY MODAL ===== */}
            <Modal
                visible={showHistoryModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowHistoryModal(false)}
            >
                <View style={modalStyles.overlay}>
                    <View style={[modalStyles.container, { maxHeight: '80%' }]}>
                        {/* Header */}
                        <View style={modalStyles.header}>
                            <Text style={modalStyles.title}>📜 Task History</Text>
                            <TouchableOpacity
                                onPress={() => setShowHistoryModal(false)}
                                style={modalStyles.closeButton}
                            >
                                <X size={20} color="black" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: '#6B7280', marginBottom: 16 }}>
                            All progress updates, pauses, and status changes for "{task.title}"
                        </Text>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {partialHistory.length === 0 ? (
                                <View style={{ padding: 20, alignItems: 'center' }}>
                                    <Text style={{ color: '#9CA3AF' }}>No history available</Text>
                                </View>
                            ) : (
                                partialHistory.map((event, index) => {
                                    // Determine event styling based on type
                                    const getEventStyle = () => {
                                        switch (event.eventType) {
                                            case 'TASK_STARTED':
                                                return { bg: '#D1FAE5', color: '#065F46', icon: '▶️' };
                                            case 'TASK_PAUSED':
                                                return { bg: '#FEF3C7', color: '#92400E', icon: '⏸️' };
                                            case 'TASK_RESUMED':
                                                return { bg: '#DBEAFE', color: '#1E40AF', icon: '⏯️' };
                                            case 'TASK_COMPLETED':
                                                return { bg: '#D1FAE5', color: '#065F46', icon: '✅' };
                                            case 'TASK_PARTIAL_COMPLETION':
                                                return { bg: '#E0E7FF', color: '#3730A3', icon: '📊' };
                                            case 'TASK_UPDATED':
                                                return { bg: '#F3E8FF', color: '#7C3AED', icon: '✏️' };
                                            default:
                                                return { bg: '#F3F4F6', color: '#374151', icon: '📝' };
                                        }
                                    };

                                    const style = getEventStyle();
                                    const payload = event.payload ? (typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload) : {};

                                    return (
                                        <View
                                            key={event.id || index}
                                            style={{
                                                backgroundColor: style.bg,
                                                padding: 14,
                                                borderRadius: 12,
                                                marginBottom: 10,
                                            }}
                                        >
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <Text style={{ fontSize: 12, fontWeight: '600', color: style.color }}>
                                                    {style.icon} {event.eventType.replace('TASK_', '').replace(/_/g, ' ')}
                                                </Text>
                                                <Text style={{ fontSize: 11, color: '#6B7280' }}>
                                                    {new Date(event.createdAt).toLocaleString()}
                                                </Text>
                                            </View>

                                            {/* Show remark if available */}
                                            {payload.remark && (
                                                <View style={{ marginTop: 8, backgroundColor: 'rgba(255,255,255,0.5)', padding: 10, borderRadius: 8 }}>
                                                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 2 }}>Remark:</Text>
                                                    <Text style={{ fontSize: 13, color: '#1F2937' }}>{payload.remark}</Text>
                                                </View>
                                            )}

                                            {/* Show progress info if available */}
                                            {payload.completionPercent !== undefined && (
                                                <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    <Text style={{ fontSize: 12, color: style.color }}>Progress:</Text>
                                                    <Text style={{ fontSize: 12, fontWeight: '600', color: style.color }}>
                                                        {payload.previousPercent !== undefined
                                                            ? `${payload.previousPercent}% → ${payload.completionPercent}%`
                                                            : `${payload.completionPercent}%`
                                                        }
                                                    </Text>
                                                </View>
                                            )}

                                            {/* Show session duration for pause events */}
                                            {payload.sessionDurationSeconds !== undefined && (
                                                <Text style={{ marginTop: 4, fontSize: 12, color: style.color }}>
                                                    Session: {Math.floor(payload.sessionDurationSeconds / 60)}m {payload.sessionDurationSeconds % 60}s
                                                </Text>
                                            )}

                                            {/* Show total elapsed for pause events */}
                                            {payload.totalElapsedSeconds !== undefined && (
                                                <Text style={{ fontSize: 12, color: style.color }}>
                                                    Total elapsed: {Math.floor(payload.totalElapsedSeconds / 60)}m {payload.totalElapsedSeconds % 60}s
                                                </Text>
                                            )}
                                        </View>
                                    );
                                })
                            )}
                        </ScrollView>

                        {/* Close Button */}
                        <TouchableOpacity
                            onPress={() => setShowHistoryModal(false)}
                            style={[modalStyles.saveButton, { marginTop: 16 }]}
                        >
                            <Text style={modalStyles.saveButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ===== PARTIAL COMPLETION / DELETE MODAL (Long Press) ===== */}
            <Modal
                visible={showPartialModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowPartialModal(false)}
            >
                <View style={modalStyles.overlay}>
                    <View style={modalStyles.container}>
                        {/* Header with Edit and Delete Buttons */}
                        <View style={modalStyles.header}>
                            <Text style={modalStyles.title}>Update Progress</Text>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity
                                    onPress={() => {
                                        setShowPartialModal(false);
                                        setShowEditModal(true);
                                    }}
                                    style={[modalStyles.closeButton, { backgroundColor: '#DBEAFE' }]}
                                >
                                    <Pencil size={18} color="#3B82F6" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleDeleteTask}
                                    style={[modalStyles.closeButton, { backgroundColor: '#FEE2E2' }]}
                                >
                                    <Trash2 size={18} color="#EF4444" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setShowPartialModal(false)}
                                    style={modalStyles.closeButton}
                                >
                                    <X size={20} color="black" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Task Title */}
                        <Text style={modalStyles.taskTitle}>{task.title}</Text>

                        {/* Percentage Display */}
                        <Text style={modalStyles.percentText}>{Math.round(partialPercent)}%</Text>

                        {/* Custom Slider */}
                        <View
                            style={modalStyles.sliderContainer}
                            onLayout={handleSliderLayout}
                            onStartShouldSetResponder={() => true}
                            onMoveShouldSetResponder={() => true}
                            onResponderGrant={handleSliderPress}
                            onResponderMove={handleSliderPress}
                        >
                            <View style={modalStyles.sliderTrack}>
                                <View style={[modalStyles.sliderFill, { width: `${partialPercent}%` }]} />
                            </View>
                            <View style={[modalStyles.sliderThumb, { left: `${partialPercent}%` }]} />
                        </View>

                        {/* Quick Buttons */}
                        <View style={modalStyles.quickButtons}>
                            {[0, 25, 50, 75, 100].map((percent) => (
                                <TouchableOpacity
                                    key={percent}
                                    onPress={() => setPartialPercent(percent)}
                                    style={[
                                        modalStyles.quickButton,
                                        partialPercent === percent && modalStyles.quickButtonActive,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            modalStyles.quickButtonText,
                                            partialPercent === percent && modalStyles.quickButtonTextActive,
                                        ]}
                                    >
                                        {percent}%
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Remark Input (Required) */}
                        <View style={{ marginBottom: 16 }}>
                            <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#374151' }}>
                                Remark (Required)
                            </Text>
                            <TextInput
                                style={modalStyles.remarkInput}
                                placeholder="Enter remark for this update..."
                                placeholderTextColor="#9CA3AF"
                                value={partialRemark}
                                onChangeText={setPartialRemark}
                                multiline
                                numberOfLines={3}
                            />
                        </View>

                        {/* Save Button */}
                        <TouchableOpacity
                            onPress={handlePartialComplete}
                            style={modalStyles.saveButton}
                        >
                            <Text style={modalStyles.saveButtonText}>
                                {partialPercent === 100 ? 'Mark Complete' : 'Save Progress'}
                            </Text>
                        </TouchableOpacity>

                        {/* Cancel Task Button */}
                        <TouchableOpacity
                            onPress={handleCancelTask}
                            style={[modalStyles.saveButton, { backgroundColor: '#FEE2E2', marginTop: 12 }]}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <XCircle size={18} color="#EF4444" />
                                <Text style={[modalStyles.saveButtonText, { color: '#EF4444' }]}>
                                    Cancel Task
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ===== PAUSE REMARK MODAL (Mandatory) ===== */}
            <Modal
                visible={showPauseRemarkModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowPauseRemarkModal(false)}
            >
                <View style={modalStyles.overlay}>
                    <View style={modalStyles.container}>
                        {/* Header */}
                        <View style={modalStyles.header}>
                            <Text style={modalStyles.title}>Pause Task</Text>
                            <TouchableOpacity
                                onPress={() => setShowPauseRemarkModal(false)}
                                style={modalStyles.closeButton}
                            >
                                <X size={20} color="black" />
                            </TouchableOpacity>
                        </View>

                        {/* Warning */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', padding: 12, borderRadius: 12, marginBottom: 16 }}>
                            <AlertCircle size={20} color="#D97706" />
                            <Text style={{ marginLeft: 8, color: '#92400E', flex: 1, fontSize: 14 }}>
                                A remark is required when pausing a task.
                            </Text>
                        </View>

                        {/* Task Info */}
                        <Text style={modalStyles.taskTitle}>{task.title}</Text>
                        <Text style={{ color: '#6B7280', marginBottom: 16 }}>
                            Time elapsed this session: {formatTime(currentElapsed)}
                        </Text>

                        {/* Remark Input */}
                        <View style={{ marginBottom: 16 }}>
                            <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#374151' }}>
                                Why are you pausing?
                            </Text>
                            <TextInput
                                style={modalStyles.remarkInput}
                                placeholder="Enter reason for pausing..."
                                placeholderTextColor="#9CA3AF"
                                value={pauseRemark}
                                onChangeText={setPauseRemark}
                                multiline
                                numberOfLines={3}
                                autoFocus
                            />
                        </View>

                        {/* Buttons */}
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity
                                onPress={() => setShowPauseRemarkModal(false)}
                                style={[modalStyles.saveButton, { flex: 1, backgroundColor: '#E5E7EB' }]}
                            >
                                <Text style={[modalStyles.saveButtonText, { color: '#374151' }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handlePauseWithRemark}
                                style={[modalStyles.saveButton, { flex: 1 }]}
                            >
                                <Text style={modalStyles.saveButtonText}>Pause Task</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ===== EDIT TASK MODAL ===== */}
            <EditTaskModal
                visible={showEditModal}
                onClose={() => setShowEditModal(false)}
                task={task}
                userId={userId}
            />

            {/* ===== CANCEL TASK MODAL ===== */}
            <Modal
                visible={showCancelModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowCancelModal(false)}
            >
                <View style={modalStyles.overlay}>
                    <View style={modalStyles.container}>
                        {/* Header */}
                        <View style={modalStyles.header}>
                            <Text style={modalStyles.title}>Cancel Task</Text>
                            <TouchableOpacity
                                onPress={() => setShowCancelModal(false)}
                                style={modalStyles.closeButton}
                            >
                                <X size={20} color="black" />
                            </TouchableOpacity>
                        </View>

                        {/* Warning */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', padding: 12, borderRadius: 12, marginBottom: 16 }}>
                            <AlertCircle size={20} color="#DC2626" />
                            <Text style={{ marginLeft: 8, color: '#991B1B', flex: 1, fontSize: 14 }}>
                                This action cannot be undone. The task will be marked as cancelled.
                            </Text>
                        </View>

                        {/* Task Info */}
                        <Text style={modalStyles.taskTitle}>{task.title}</Text>
                        <Text style={{ color: '#6B7280', marginBottom: 16 }}>
                            Progress: {task.completionPercent}% complete
                        </Text>

                        {/* Reason Input */}
                        <View style={{ marginBottom: 16 }}>
                            <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#374151' }}>
                                Reason for cancellation (optional)
                            </Text>
                            <TextInput
                                style={modalStyles.remarkInput}
                                placeholder="Enter reason for cancelling..."
                                placeholderTextColor="#9CA3AF"
                                value={cancelReason}
                                onChangeText={setCancelReason}
                                multiline
                                numberOfLines={3}
                                autoFocus
                            />
                        </View>

                        {/* Buttons */}
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TouchableOpacity
                                onPress={() => setShowCancelModal(false)}
                                style={[modalStyles.saveButton, { flex: 1, backgroundColor: '#E5E7EB' }]}
                            >
                                <Text style={[modalStyles.saveButtonText, { color: '#374151' }]}>Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleConfirmCancelTask}
                                style={[modalStyles.saveButton, { flex: 1, backgroundColor: '#EF4444' }]}
                            >
                                <Text style={modalStyles.saveButtonText}>Cancel Task</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
};

const modalStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: {
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 24,
        width: '100%',
        maxWidth: 400,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    closeButton: {
        height: 36,
        width: 36,
        backgroundColor: '#F3F4F6',
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    taskTitle: {
        fontSize: 16,
        color: '#6B7280',
        marginBottom: 24,
    },
    percentText: {
        fontSize: 48,
        fontWeight: 'bold',
        textAlign: 'center',
        color: '#4AC3FF',
        marginBottom: 16,
    },
    sliderContainer: {
        height: 40,
        justifyContent: 'center',
        marginBottom: 20,
        paddingHorizontal: 12,
    },
    sliderTrack: {
        height: 8,
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
        overflow: 'hidden',
    },
    sliderFill: {
        height: '100%',
        backgroundColor: '#4AC3FF',
        borderRadius: 4,
    },
    sliderThumb: {
        position: 'absolute',
        top: 8,
        width: 24,
        height: 24,
        backgroundColor: '#4AC3FF',
        borderRadius: 12,
        marginLeft: -12,
        borderWidth: 3,
        borderColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    quickButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    quickButton: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
    },
    quickButtonActive: {
        backgroundColor: '#4AC3FF',
    },
    quickButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    quickButtonTextActive: {
        color: 'white',
    },
    saveButton: {
        backgroundColor: '#1E1E1E',
        paddingVertical: 16,
        borderRadius: 999,
        alignItems: 'center',
    },
    saveButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    remarkInput: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 12,
        fontSize: 14,
        color: '#111827',
        textAlignVertical: 'top',
        minHeight: 80,
    },
    detailSection: {
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    detailLabel: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '600',
        marginBottom: 4,
    },
    detailValue: {
        fontSize: 16,
        color: '#111827',
    },
});

// Observe the task record for changes
const enhance = withObservables(['task'], ({ task }: { task: Task }) => ({
    task: task.observe(),
}));

export default enhance(TaskCard);
