/**
 * CreateTaskModal Component
 * 
 * Modal for creating new tasks (custom, fixed, or alert).
 * Includes priority, assigned persons, scheduled times, and more.
 * 
 * Task Types:
 * - Custom: One-time tasks that auto-remove after 48 hours
 * - Fixed: Daily routine tasks that reset at 5 AM
 * - Alert: Notification-based tasks (timeout or interval)
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Modal,
    KeyboardAvoidingView,
    Platform,
    Alert,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { X, Plus, Clock, Tag, FileText, Users, Calendar, AlertCircle, Info, Bell, Timer, Repeat } from 'lucide-react-native';
import { createTask } from '../services/taskService';
import { CustomDateTimePicker } from './CustomDateTimePicker';

interface CreateTaskModalProps {
    visible: boolean;
    onClose: () => void;
    userId: string;
}

export function CreateTaskModal({ visible, onClose, userId }: CreateTaskModalProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [duration, setDuration] = useState('');
    const [taskType, setTaskType] = useState<'fixed' | 'custom' | 'alert'>('custom');
    const [priority, setPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
    const [assignedPersonsText, setAssignedPersonsText] = useState('');
    const [startTime, setStartTime] = useState<Date | null>(null);
    const [endTime, setEndTime] = useState<Date | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showTypeInfo, setShowTypeInfo] = useState(false);

    // Alert-specific states
    const [alertType, setAlertType] = useState<'timeout' | 'interval'>('timeout');
    const [alertIntervalMinutes, setAlertIntervalMinutes] = useState('');

    // Date/Time picker states (simplified for custom picker)
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setCategory('');
        setDuration('');
        setTaskType('custom');
        setPriority('normal');
        setAssignedPersonsText('');
        setStartTime(null);
        setEndTime(null);
        setShowTypeInfo(false);
        setShowStartPicker(false);
        setShowEndPicker(false);
        setAlertType('timeout');
        setAlertIntervalMinutes('');
    };

    const formatDateTime = (date: Date | null): string => {
        if (!date) return 'Tap to select';
        return date.toLocaleString([], {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const handleSubmit = async () => {
        // Validate common required fields
        if (!title.trim()) {
            Alert.alert('Error', 'Please enter a task title');
            return;
        }
        if (!category.trim()) {
            Alert.alert('Error', 'Please enter a category');
            return;
        }
        if (!assignedPersonsText.trim()) {
            Alert.alert('Error', 'Please enter at least one assigned person');
            return;
        }
        if (!description.trim()) {
            Alert.alert('Error', 'Please enter a description');
            return;
        }

        // Validate type-specific fields
        if (taskType === 'alert') {
            // Alert tasks need interval minutes
            if (!alertIntervalMinutes.trim() || isNaN(parseInt(alertIntervalMinutes, 10)) || parseInt(alertIntervalMinutes, 10) <= 0) {
                Alert.alert('Error', 'Please enter a valid interval in minutes (must be greater than 0)');
                return;
            }
        } else {
            // Custom/Fixed tasks need duration and times
            if (!duration.trim() || isNaN(parseInt(duration, 10))) {
                Alert.alert('Error', 'Please enter a valid duration in minutes');
                return;
            }
            if (!startTime) {
                Alert.alert('Error', 'Please select a start time');
                return;
            }
            if (!endTime) {
                Alert.alert('Error', 'Please select an end time');
                return;
            }
            if (endTime <= startTime) {
                Alert.alert('Error', 'End time must be after start time');
                return;
            }
        }

        setIsSubmitting(true);

        try {
            // Parse assigned persons (comma-separated)
            const assignedPersons = assignedPersonsText
                .split(',')
                .map(p => p.trim())
                .filter(p => p.length > 0);

            await createTask({
                title: title.trim(),
                description: description.trim(),
                category: category.trim(),
                expectedDurationMinutes: taskType !== 'alert' ? parseInt(duration, 10) : undefined,
                type: taskType,
                priority,
                assignedPersons,
                startTime: taskType !== 'alert' ? startTime || undefined : undefined,
                endTime: taskType !== 'alert' ? endTime || undefined : undefined,
                // Alert-specific fields
                alertType: taskType === 'alert' ? alertType : undefined,
                alertIntervalMinutes: taskType === 'alert' ? parseInt(alertIntervalMinutes, 10) : undefined,
                userId,
            });

            resetForm();
            onClose();
        } catch (error) {
            console.error('Failed to create task:', error);
            Alert.alert('Error', 'Failed to create task');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const priorityColors = {
        normal: { bg: '#E5E7EB', text: '#4B5563' },
        important: { bg: '#FEF3C7', text: '#92400E' },
        urgent: { bg: '#FEE2E2', text: '#991B1B' },
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={handleClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.flex1}
            >
                <View style={styles.overlay}>
                    <View style={styles.container}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Header */}
                            <View style={styles.header}>
                                <Text style={styles.headerTitle}>New Task</Text>
                                <TouchableOpacity
                                    onPress={handleClose}
                                    style={styles.closeButton}
                                >
                                    <X size={20} color="black" />
                                </TouchableOpacity>
                            </View>

                            {/* Task Type Toggle */}
                            <View style={styles.toggleContainer}>
                                <TouchableOpacity
                                    onPress={() => setTaskType('custom')}
                                    style={[styles.toggleButton, taskType === 'custom' && styles.toggleButtonActiveBlue]}
                                >
                                    <Text style={[styles.toggleText, taskType === 'custom' && styles.toggleTextActiveBlue]}>
                                        Custom
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setTaskType('fixed')}
                                    style={[styles.toggleButton, taskType === 'fixed' && styles.toggleButtonActiveGreen]}
                                >
                                    <Text style={[styles.toggleText, taskType === 'fixed' && styles.toggleTextActiveGreen]}>
                                        Fixed
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setTaskType('alert')}
                                    style={[styles.toggleButton, taskType === 'alert' && styles.toggleButtonActiveOrange]}
                                >
                                    <Text style={[styles.toggleText, taskType === 'alert' && styles.toggleTextActiveOrange]}>
                                        Alert
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Type Info Button */}
                            <TouchableOpacity
                                onPress={() => setShowTypeInfo(!showTypeInfo)}
                                style={styles.infoButton}
                            >
                                <Info size={16} color="#6B7280" />
                                <Text style={styles.infoButtonText}>
                                    {showTypeInfo ? 'Hide' : 'What\'s the difference?'}
                                </Text>
                            </TouchableOpacity>

                            {/* Type Explanation */}
                            {showTypeInfo && (
                                <View style={styles.infoBox}>
                                    <View style={styles.infoItem}>
                                        <View style={[styles.infoBadge, { backgroundColor: '#DBEAFE' }]}>
                                            <Text style={{ color: '#1D4ED8', fontWeight: 'bold' }}>Custom</Text>
                                        </View>
                                        <Text style={styles.infoText}>
                                            One-time task that auto-removes from list after 48 hours (still logged in history)
                                        </Text>
                                    </View>
                                    <View style={styles.infoItem}>
                                        <View style={[styles.infoBadge, { backgroundColor: '#D1FAE5' }]}>
                                            <Text style={{ color: '#065F46', fontWeight: 'bold' }}>Fixed</Text>
                                        </View>
                                        <Text style={styles.infoText}>
                                            Daily routine that resets at 5 AM. Tracks completion history every day.
                                        </Text>
                                    </View>
                                    <View style={styles.infoItem}>
                                        <View style={[styles.infoBadge, { backgroundColor: '#FEF3C7' }]}>
                                            <Text style={{ color: '#92400E', fontWeight: 'bold' }}>Alert</Text>
                                        </View>
                                        <Text style={styles.infoText}>
                                            Notification-based reminders. Timeout (one-time) or Interval (repeating).
                                        </Text>
                                    </View>
                                </View>
                            )}

                            {/* Title Input */}
                            <View style={styles.inputContainer}>
                                <View style={styles.inputRow}>
                                    <FileText size={20} color="#6B7280" />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Task title *"
                                        value={title}
                                        onChangeText={setTitle}
                                        placeholderTextColor="#9CA3AF"
                                    />
                                </View>
                            </View>

                            {/* Category Input */}
                            <View style={styles.inputContainer}>
                                <View style={styles.inputRow}>
                                    <Tag size={20} color="#6B7280" />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Category (e.g., Work, Health) *"
                                        value={category}
                                        onChangeText={setCategory}
                                        placeholderTextColor="#9CA3AF"
                                    />
                                </View>
                            </View>

                            {/* Alert Type Selection (only for Alert tasks) */}
                            {taskType === 'alert' && (
                                <View style={styles.inputContainer}>
                                    <Text style={styles.sectionLabel}>Alert Type</Text>
                                    <View style={styles.alertTypeRow}>
                                        <TouchableOpacity
                                            onPress={() => setAlertType('timeout')}
                                            style={[
                                                styles.alertTypeButton,
                                                alertType === 'timeout' && styles.alertTypeButtonActive,
                                            ]}
                                        >
                                            <Timer size={18} color={alertType === 'timeout' ? '#FFFFFF' : '#6B7280'} />
                                            <View>
                                                <Text style={[
                                                    styles.alertTypeText,
                                                    alertType === 'timeout' && styles.alertTypeTextActive,
                                                ]}>Timeout</Text>
                                                <Text style={[
                                                    styles.alertTypeSubtext,
                                                    alertType === 'timeout' && styles.alertTypeSubtextActive,
                                                ]}>One-time alert</Text>
                                            </View>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => setAlertType('interval')}
                                            style={[
                                                styles.alertTypeButton,
                                                alertType === 'interval' && styles.alertTypeButtonActive,
                                            ]}
                                        >
                                            <Repeat size={18} color={alertType === 'interval' ? '#FFFFFF' : '#6B7280'} />
                                            <View>
                                                <Text style={[
                                                    styles.alertTypeText,
                                                    alertType === 'interval' && styles.alertTypeTextActive,
                                                ]}>Interval</Text>
                                                <Text style={[
                                                    styles.alertTypeSubtext,
                                                    alertType === 'interval' && styles.alertTypeSubtextActive,
                                                ]}>Repeating alert</Text>
                                            </View>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            {/* Alert Interval Input (only for Alert tasks) */}
                            {taskType === 'alert' && (
                                <View style={styles.inputContainer}>
                                    <View style={styles.inputRow}>
                                        <Bell size={20} color="#6B7280" />
                                        <TextInput
                                            style={styles.input}
                                            placeholder={alertType === 'timeout' ? "Alert after (minutes) *" : "Repeat every (minutes) *"}
                                            value={alertIntervalMinutes}
                                            onChangeText={setAlertIntervalMinutes}
                                            keyboardType="numeric"
                                            placeholderTextColor="#9CA3AF"
                                        />
                                    </View>
                                    <Text style={styles.helperText}>
                                        {alertType === 'timeout'
                                            ? '⏱️ You will receive one notification after this time, then the task will be removed.'
                                            : '🔄 You will receive a notification every X minutes until you delete this task.'}
                                    </Text>
                                </View>
                            )}

                            {/* Duration Input (only for Custom/Fixed tasks) */}
                            {taskType !== 'alert' && (
                                <View style={styles.inputContainer}>
                                    <View style={styles.inputRow}>
                                        <Clock size={20} color="#6B7280" />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Expected duration (minutes) *"
                                            value={duration}
                                            onChangeText={setDuration}
                                            keyboardType="numeric"
                                            placeholderTextColor="#9CA3AF"
                                        />
                                    </View>
                                </View>
                            )}

                            {/* Priority Selection */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.sectionLabel}>Priority</Text>
                                <View style={styles.priorityRow}>
                                    {(['normal', 'important', 'urgent'] as const).map((p) => (
                                        <TouchableOpacity
                                            key={p}
                                            onPress={() => setPriority(p)}
                                            style={[
                                                styles.priorityButton,
                                                { backgroundColor: priorityColors[p].bg },
                                                priority === p && styles.priorityButtonActive,
                                            ]}
                                        >
                                            {p === 'urgent' && <AlertCircle size={14} color={priorityColors[p].text} />}
                                            <Text style={[styles.priorityText, { color: priorityColors[p].text }]}>
                                                {p.charAt(0).toUpperCase() + p.slice(1)}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Assigned Persons */}
                            <View style={styles.inputContainer}>
                                <View style={styles.inputRow}>
                                    <Users size={20} color="#6B7280" />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Assigned to (comma-separated) *"
                                        value={assignedPersonsText}
                                        onChangeText={setAssignedPersonsText}
                                        placeholderTextColor="#9CA3AF"
                                    />
                                </View>
                            </View>

                            {/* Start Time (only for Custom/Fixed tasks) */}
                            {taskType !== 'alert' && (
                                <View style={styles.inputContainer}>
                                    <Text style={styles.sectionLabel}>Start Time *</Text>
                                    <TouchableOpacity
                                        onPress={() => setShowStartPicker(true)}
                                        style={styles.datePickerButton}
                                    >
                                        <Calendar size={20} color="#6B7280" />
                                        <Text style={[styles.datePickerText, !startTime && styles.datePickerPlaceholder]}>
                                            {formatDateTime(startTime)}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* End Time (only for Custom/Fixed tasks) */}
                            {taskType !== 'alert' && (
                                <View style={styles.inputContainer}>
                                    <Text style={styles.sectionLabel}>End Time *</Text>
                                    <TouchableOpacity
                                        onPress={() => setShowEndPicker(true)}
                                        style={styles.datePickerButton}
                                    >
                                        <Calendar size={20} color="#6B7280" />
                                        <Text style={[styles.datePickerText, !endTime && styles.datePickerPlaceholder]}>
                                            {formatDateTime(endTime)}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Description Input */}
                            <View style={styles.inputContainerLarge}>
                                <Text style={styles.sectionLabel}>Description *</Text>
                                <TextInput
                                    style={styles.textArea}
                                    placeholder="Enter task description"
                                    value={description}
                                    onChangeText={setDescription}
                                    multiline
                                    textAlignVertical="top"
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>

                            {/* Submit Button */}
                            <TouchableOpacity
                                onPress={handleSubmit}
                                disabled={isSubmitting}
                                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                            >
                                <Plus size={20} color="white" />
                                <Text style={styles.submitButtonText}>
                                    {isSubmitting ? 'Creating...' : taskType === 'alert' ? 'Create Alert' : 'Create Task'}
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>

                {/* Custom Date/Time Pickers */}
                <CustomDateTimePicker
                    visible={showStartPicker}
                    onClose={() => setShowStartPicker(false)}
                    onConfirm={(date) => setStartTime(date)}
                    initialDate={startTime || undefined}
                    mode="datetime"
                    title="Select Start Date & Time"
                />

                <CustomDateTimePicker
                    visible={showEndPicker}
                    onClose={() => setShowEndPicker(false)}
                    onConfirm={(date) => setEndTime(date)}
                    initialDate={endTime || undefined}
                    mode="datetime"
                    title="Select End Date & Time"
                />
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    flex1: {
        flex: 1,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: 'white',
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        padding: 24,
        maxHeight: '90%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    closeButton: {
        height: 40,
        width: 40,
        backgroundColor: '#F3F4F6',
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toggleContainer: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        borderRadius: 999,
        padding: 4,
        marginBottom: 12,
    },
    toggleButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 999,
        alignItems: 'center',
    },
    toggleButtonActive: {
        backgroundColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    toggleButtonActiveBlue: {
        backgroundColor: '#DBEAFE',
    },
    toggleButtonActiveGreen: {
        backgroundColor: '#D1FAE5',
    },
    toggleButtonActiveOrange: {
        backgroundColor: '#FEF3C7',
    },
    toggleText: {
        fontWeight: 'bold',
        color: '#9CA3AF',
    },
    toggleTextActive: {
        color: 'black',
    },
    toggleTextActiveBlue: {
        color: '#1D4ED8',
        fontWeight: 'bold',
    },
    toggleTextActiveGreen: {
        color: '#065F46',
        fontWeight: 'bold',
    },
    toggleTextActiveOrange: {
        color: '#92400E',
        fontWeight: 'bold',
    },
    infoButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 16,
        alignSelf: 'center',
    },
    infoButtonText: {
        color: '#6B7280',
        fontSize: 13,
    },
    infoBox: {
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        gap: 12,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    infoBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    infoText: {
        flex: 1,
        color: '#4B5563',
        fontSize: 13,
        lineHeight: 18,
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4B5563',
        marginBottom: 10,
    },
    priorityRow: {
        flexDirection: 'row',
        gap: 10,
    },
    priorityButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 12,
    },
    priorityButtonActive: {
        borderWidth: 2,
        borderColor: '#1E1E1E',
    },
    priorityText: {
        fontWeight: '600',
        fontSize: 13,
    },
    inputContainer: {
        marginBottom: 16,
    },
    inputContainerLarge: {
        marginBottom: 24,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 16,
        padding: 16,
    },
    input: {
        flex: 1,
        fontSize: 16,
    },
    textArea: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 16,
        padding: 16,
        fontSize: 16,
        minHeight: 100,
    },
    submitButton: {
        backgroundColor: '#1E1E1E',
        paddingVertical: 20,
        borderRadius: 999,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 20,
    },
    submitButtonDisabled: {
        opacity: 0.5,
    },
    submitButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 18,
    },
    datePickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 16,
        padding: 16,
    },
    datePickerText: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
    },
    datePickerPlaceholder: {
        color: '#9CA3AF',
    },
    // Alert type styles
    alertTypeRow: {
        flexDirection: 'row',
        gap: 12,
    },
    alertTypeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 16,
        padding: 16,
    },
    alertTypeButtonActive: {
        backgroundColor: '#F59E0B',
        borderColor: '#F59E0B',
    },
    alertTypeText: {
        fontWeight: '600',
        fontSize: 14,
        color: '#111827',
    },
    alertTypeTextActive: {
        color: '#FFFFFF',
    },
    alertTypeSubtext: {
        fontSize: 11,
        color: '#6B7280',
    },
    alertTypeSubtextActive: {
        color: 'rgba(255,255,255,0.8)',
    },
    helperText: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 8,
        paddingHorizontal: 4,
    },
});
