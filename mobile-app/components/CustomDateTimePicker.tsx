/**
 * CustomDateTimePicker Component
 * 
 * A pure React Native date/time picker that works with Expo Go.
 * No native modules required.
 */

import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { X, ChevronLeft, ChevronRight } from 'lucide-react-native';

interface CustomDateTimePickerProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (date: Date) => void;
    initialDate?: Date;
    mode: 'date' | 'time' | 'datetime';
    title?: string;
}

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CustomDateTimePicker({
    visible,
    onClose,
    onConfirm,
    initialDate,
    mode,
    title = 'Select Date & Time',
}: CustomDateTimePickerProps) {
    const [currentStep, setCurrentStep] = useState<'date' | 'time'>(mode === 'time' ? 'time' : 'date');
    const [viewDate, setViewDate] = useState(() => initialDate || new Date());
    const [selectedDate, setSelectedDate] = useState(() => initialDate || new Date());
    const [selectedHour, setSelectedHour] = useState(() => (initialDate || new Date()).getHours());
    const [selectedMinute, setSelectedMinute] = useState(() => (initialDate || new Date()).getMinutes());

    // Reset state when modal opens
    React.useEffect(() => {
        if (visible) {
            const date = initialDate || new Date();
            setViewDate(date);
            setSelectedDate(date);
            setSelectedHour(date.getHours());
            setSelectedMinute(date.getMinutes());
            setCurrentStep(mode === 'time' ? 'time' : 'date');
        }
    }, [visible, initialDate, mode]);

    // Generate calendar days for current month view
    const calendarDays = useMemo(() => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay();

        const days: (number | null)[] = [];

        // Add empty slots for days before the first day
        for (let i = 0; i < startDayOfWeek; i++) {
            days.push(null);
        }

        // Add days of the month
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(i);
        }

        return days;
    }, [viewDate]);

    const goToPreviousMonth = () => {
        setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const goToNextMonth = () => {
        setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    const selectDay = (day: number) => {
        const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        setSelectedDate(newDate);
    };

    const handleNext = () => {
        if (mode === 'date') {
            handleConfirm();
        } else {
            setCurrentStep('time');
        }
    };

    const handleConfirm = () => {
        const finalDate = new Date(selectedDate);
        if (mode !== 'date') {
            finalDate.setHours(selectedHour, selectedMinute, 0, 0);
        }
        onConfirm(finalDate);
        onClose();
    };

    const isSelectedDay = (day: number) => {
        return (
            selectedDate.getDate() === day &&
            selectedDate.getMonth() === viewDate.getMonth() &&
            selectedDate.getFullYear() === viewDate.getFullYear()
        );
    };

    const isToday = (day: number) => {
        const today = new Date();
        return (
            today.getDate() === day &&
            today.getMonth() === viewDate.getMonth() &&
            today.getFullYear() === viewDate.getFullYear()
        );
    };

    // Generate hours and minutes for time picker
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const minutes = Array.from({ length: 60 }, (_, i) => i);

    const formatHour = (h: number) => {
        const period = h >= 12 ? 'PM' : 'AM';
        const hour12 = h % 12 || 12;
        return `${hour12} ${period}`;
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>
                            {currentStep === 'date' ? 'Select Date' : 'Select Time'}
                        </Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <X size={20} color="#374151" />
                        </TouchableOpacity>
                    </View>

                    {currentStep === 'date' ? (
                        /* Date Picker */
                        <View style={styles.datePickerContainer}>
                            {/* Month/Year Navigation */}
                            <View style={styles.monthNav}>
                                <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton}>
                                    <ChevronLeft size={24} color="#374151" />
                                </TouchableOpacity>
                                <Text style={styles.monthYearText}>
                                    {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
                                </Text>
                                <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
                                    <ChevronRight size={24} color="#374151" />
                                </TouchableOpacity>
                            </View>

                            {/* Day Headers */}
                            <View style={styles.dayHeaders}>
                                {DAYS.map(day => (
                                    <Text key={day} style={styles.dayHeader}>{day}</Text>
                                ))}
                            </View>

                            {/* Calendar Grid */}
                            <View style={styles.calendarGrid}>
                                {calendarDays.map((day, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.dayCell,
                                            day !== null && isSelectedDay(day) ? styles.selectedDay : undefined,
                                            day !== null && isToday(day) && !isSelectedDay(day) ? styles.todayDay : undefined,
                                        ]}
                                        onPress={() => day !== null && selectDay(day)}
                                        disabled={day === null}
                                    >
                                        {day !== null && (
                                            <Text style={[
                                                styles.dayText,
                                                isSelectedDay(day) ? styles.selectedDayText : undefined,
                                                isToday(day) && !isSelectedDay(day) ? styles.todayDayText : undefined,
                                            ]}>
                                                {day}
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    ) : (
                        /* Time Picker */
                        <View style={styles.timePickerContainer}>
                            <Text style={styles.timePreview}>
                                {String(selectedHour).padStart(2, '0')}:{String(selectedMinute).padStart(2, '0')}
                            </Text>

                            <View style={styles.timeScrollContainer}>
                                {/* Hour Picker */}
                                <View style={styles.timeColumn}>
                                    <Text style={styles.timeColumnLabel}>Hour</Text>
                                    <ScrollView
                                        style={styles.timeScroll}
                                        showsVerticalScrollIndicator={false}
                                        contentContainerStyle={styles.timeScrollContent}
                                    >
                                        {hours.map(h => (
                                            <TouchableOpacity
                                                key={h}
                                                style={[
                                                    styles.timeItem,
                                                    selectedHour === h && styles.selectedTimeItem,
                                                ]}
                                                onPress={() => setSelectedHour(h)}
                                            >
                                                <Text style={[
                                                    styles.timeItemText,
                                                    selectedHour === h && styles.selectedTimeItemText,
                                                ]}>
                                                    {formatHour(h)}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>

                                {/* Minute Picker */}
                                <View style={styles.timeColumn}>
                                    <Text style={styles.timeColumnLabel}>Minute</Text>
                                    <ScrollView
                                        style={styles.timeScroll}
                                        showsVerticalScrollIndicator={false}
                                        contentContainerStyle={styles.timeScrollContent}
                                    >
                                        {minutes.map(m => (
                                            <TouchableOpacity
                                                key={m}
                                                style={[
                                                    styles.timeItem,
                                                    selectedMinute === m && styles.selectedTimeItem,
                                                ]}
                                                onPress={() => setSelectedMinute(m)}
                                            >
                                                <Text style={[
                                                    styles.timeItemText,
                                                    selectedMinute === m && styles.selectedTimeItemText,
                                                ]}>
                                                    {String(m).padStart(2, '0')}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Footer Buttons */}
                    <View style={styles.footer}>
                        {currentStep === 'time' && mode === 'datetime' && (
                            <TouchableOpacity
                                style={styles.backButton}
                                onPress={() => setCurrentStep('date')}
                            >
                                <Text style={styles.backButtonText}>Back</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[styles.confirmButton, currentStep === 'time' && mode === 'datetime' && { flex: 1, marginLeft: 12 }]}
                            onPress={currentStep === 'date' && mode !== 'date' ? handleNext : handleConfirm}
                        >
                            <Text style={styles.confirmButtonText}>
                                {currentStep === 'date' && mode !== 'date' ? 'Next' : 'Confirm'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 30,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
    },
    closeButton: {
        padding: 4,
    },
    datePickerContainer: {
        padding: 20,
    },
    monthNav: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    navButton: {
        padding: 8,
    },
    monthYearText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    dayHeaders: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    dayHeader: {
        flex: 1,
        textAlign: 'center',
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    calendarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: '14.28%',
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 999,
    },
    dayText: {
        fontSize: 16,
        color: '#111827',
    },
    selectedDay: {
        backgroundColor: '#3B82F6',
    },
    selectedDayText: {
        color: 'white',
        fontWeight: 'bold',
    },
    todayDay: {
        backgroundColor: '#DBEAFE',
    },
    todayDayText: {
        color: '#3B82F6',
        fontWeight: '600',
    },
    timePickerContainer: {
        padding: 20,
        alignItems: 'center',
    },
    timePreview: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#3B82F6',
        marginBottom: 20,
    },
    timeScrollContainer: {
        flexDirection: 'row',
        gap: 20,
    },
    timeColumn: {
        alignItems: 'center',
    },
    timeColumnLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 10,
    },
    timeScroll: {
        height: 200,
        width: 100,
    },
    timeScrollContent: {
        paddingVertical: 10,
    },
    timeItem: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginVertical: 2,
        alignItems: 'center',
    },
    selectedTimeItem: {
        backgroundColor: '#3B82F6',
    },
    timeItemText: {
        fontSize: 16,
        color: '#374151',
    },
    selectedTimeItemText: {
        color: 'white',
        fontWeight: 'bold',
    },
    footer: {
        flexDirection: 'row',
        padding: 20,
        gap: 12,
    },
    backButton: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 999,
        backgroundColor: '#E5E7EB',
        alignItems: 'center',
    },
    backButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    confirmButton: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 999,
        backgroundColor: '#1E1E1E',
        alignItems: 'center',
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: 'white',
    },
});
