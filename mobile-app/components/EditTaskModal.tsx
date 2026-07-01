/**
 * EditTaskModal Component
 * 
 * Modal for editing existing tasks.
 * Supports custom, fixed, and alert task types.
 */

import React, { useState, useEffect } from 'react';
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
import { X, Save, Clock, Tag, FileText, Users, Calendar, AlertCircle, Bell, Timer, Repeat } from 'lucide-react-native';
import { updateTask, UpdateTaskParams } from '../services/taskService';
import { CustomDateTimePicker } from './CustomDateTimePicker';
import Task from '../database/models/Task';

interface EditTaskModalProps {
    visible: boolean;
    onClose: () => void;
    task: Task | null;
    userId: string;
}

export function EditTaskModal({ visible, onClose, task, userId }: EditTaskModalProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [duration, setDuration] = useState('');
    const [priority, setPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
    const [assignedPersonsText, setAssignedPersonsText] = useState('');
    const [startTime, setStartTime] = useState<Date | null>(null);
    const [endTime, setEndTime] = useState<Date | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Alert-specific states
    const [alertType, setAlertType] = useState<'timeout' | 'interval'>('timeout');
    const [alertIntervalMinutes, setAlertIntervalMinutes] = useState('');

    // Date/Time picker states
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    // Load task data when modal opens
    useEffect(() => {
        if (task && visible) {
            setTitle(task.title || '');
            setDescription(task.description || '');
            setCategory(task.category || '');
            setDuration(task.expectedDurationMinutes?.toString() || '');
            setPriority(task.priority || 'normal');
            setAssignedPersonsText(task.assignedPersons?.join(', ') || '');
            setStartTime(task.startTime ? new Date(task.startTime) : null);
            setEndTime(task.endTime ? new Date(task.endTime) : null);
            setAlertType(task.alertType || 'timeout');
            setAlertIntervalMinutes(task.alertIntervalMinutes?.toString() || '');
        }
    }, [task, visible]);

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
        if (!task) return;

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
        if (task.type === 'alert') {
            if (!alertIntervalMinutes.trim() || isNaN(parseInt(alertIntervalMinutes, 10)) || parseInt(alertIntervalMinutes, 10) <= 0) {
                Alert.alert('Error', 'Please enter a valid interval in minutes');
                return;
            }
        } else {
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
            const assignedPersons = assignedPersonsText
                .split(',')
                .map(p => p.trim())
                .filter(p => p.length > 0);

            const updateParams: UpdateTaskParams = {
                title: title.trim(),
                description: description.trim(),
                category: category.trim(),
                priority,
                assignedPersons,
            };

            if (task.type !== 'alert') {
                updateParams.expectedDurationMinutes = parseInt(duration, 10);
                updateParams.startTime = startTime || undefined;
                updateParams.endTime = endTime || undefined;
            } else {
                updateParams.alertType = alertType;
                updateParams.alertIntervalMinutes = parseInt(alertIntervalMinutes, 10);
            }

            await updateTask(task, updateParams, userId);
            onClose();
        } catch (error) {
            console.error('Failed to update task:', error);
            Alert.alert('Error', 'Failed to update task');
        } finally {
            setIsSubmitting(false);
        }
    };

    const priorityColors = {
        normal: { bg: '#E5E7EB', text: '#4B5563' },
        important: { bg: '#FEF3C7', text: '#92400E' },
        urgent: { bg: '#FEE2E2', text: '#991B1B' },
    };

    if (!task) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
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
                                <Text style={styles.headerTitle}>Edit Task</Text>
                                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                    <X size={20} color="black" />
                                </TouchableOpacity>
                            </View>

                            {/* Task Type Badge (Read-only) */}
                            <View style={styles.typeBadgeRow}>
                                <View style={[
                                    styles.typeBadge,
                                    { backgroundColor: task.type === 'custom' ? '#DBEAFE' : task.type === 'fixed' ? '#D1FAE5' : '#FEF3C7' }
                                ]}>
                                    <Text style={[
                                        styles.typeBadgeText,
                                        { color: task.type === 'custom' ? '#1D4ED8' : task.type === 'fixed' ? '#065F46' : '#92400E' }
                                    ]}>
                                        {task.type.toUpperCase()} TASK
                                    </Text>
                                </View>
                            </View>

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
                                        placeholder="Category *"
                                        value={category}
                                        onChangeText={setCategory}
                                        placeholderTextColor="#9CA3AF"
                                    />
                                </View>
                            </View>

                            {/* Alert Type Selection (only for Alert tasks) */}
                            {task.type === 'alert' && (
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
                                            </View>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            {/* Alert Interval Input (only for Alert tasks) */}
                            {task.type === 'alert' && (
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
                                </View>
                            )}

                            {/* Duration Input (only for Custom/Fixed tasks) */}
                            {task.type !== 'alert' && (
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
                            {task.type !== 'alert' && (
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
                            {task.type !== 'alert' && (
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
                                <Save size={20} color="white" />
                                <Text style={styles.submitButtonText}>
                                    {isSubmitting ? 'Saving...' : 'Save Changes'}
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
        marginBottom: 16,
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
    typeBadgeRow: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    typeBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    typeBadgeText: {
        fontSize: 12,
        fontWeight: 'bold',
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
});
