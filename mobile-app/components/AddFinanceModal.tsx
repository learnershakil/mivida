/**
 * AddFinanceModal Component
 * 
 * Modal for adding income or expense transactions.
 * Supports immediate or scheduled transactions.
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
    ScrollView,
    StyleSheet,
} from 'react-native';
import { X, Plus, Minus, IndianRupee, Tag, FileText, Calendar, Clock, ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { addIncome, addExpense } from '../services/financeService';

interface AddFinanceModalProps {
    visible: boolean;
    onClose: () => void;
    userId: string;
}

export function AddFinanceModal({ visible, onClose, userId }: AddFinanceModalProps) {
    const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [source, setSource] = useState('');
    const [destination, setDestination] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isScheduled, setIsScheduled] = useState(false);
    const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);

    const resetForm = () => {
        setAmount('');
        setCategory('');
        setDescription('');
        setSource('');
        setDestination('');
        setTransactionType('expense');
        setIsScheduled(false);
        setScheduledDate(null);
    };

    // Handle date change from picker
    const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
        }
        if (event.type === 'set' && selectedDate) {
            setScheduledDate(selectedDate);
        }
    };

    const handleSubmit = async () => {
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            Alert.alert('Error', 'Please enter a valid amount');
            return;
        }

        setIsSubmitting(true);

        try {
            // Use scheduled date as transaction date if scheduled, otherwise use now
            const transactionDate = isScheduled && scheduledDate ? scheduledDate : new Date();

            if (transactionType === 'income') {
                await addIncome({
                    amount: amountNum,
                    category: category.trim() || undefined,
                    source: source.trim() || undefined,
                    destination: destination.trim() || undefined,
                    description: description.trim() || undefined,
                    transactionDate,
                    userId,
                });
            } else {
                await addExpense({
                    amount: amountNum,
                    category: category.trim() || undefined,
                    source: source.trim() || undefined,
                    destination: destination.trim() || undefined,
                    description: description.trim() || undefined,
                    transactionDate,
                    userId,
                });
            }

            if (isScheduled && scheduledDate) {
                Alert.alert(
                    'Transaction Scheduled',
                    `Your ${transactionType} has been scheduled for ${scheduledDate.toLocaleDateString()}`
                );
            }

            resetForm();
            onClose();
        } catch (error) {
            console.error('Failed to add transaction:', error);
            Alert.alert('Error', 'Failed to add transaction');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        resetForm();
        onClose();
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
                    <View style={styles.modalContainer}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Header */}
                            <View style={styles.header}>
                                <Text style={styles.headerTitle}>Add Transaction</Text>
                                <TouchableOpacity
                                    onPress={handleClose}
                                    style={styles.closeButton}
                                >
                                    <X size={20} color="black" />
                                </TouchableOpacity>
                            </View>

                            {/* Transaction Type Toggle */}
                            <View style={styles.toggleContainer}>
                                <TouchableOpacity
                                    onPress={() => setTransactionType('expense')}
                                    style={[
                                        styles.toggleButton,
                                        transactionType === 'expense' && styles.expenseActive
                                    ]}
                                >
                                    <Minus size={16} color={transactionType === 'expense' ? 'white' : '#9CA3AF'} />
                                    <Text style={[
                                        styles.toggleText,
                                        transactionType === 'expense' && styles.activeText
                                    ]}>
                                        Expense
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setTransactionType('income')}
                                    style={[
                                        styles.toggleButton,
                                        transactionType === 'income' && styles.incomeActive
                                    ]}
                                >
                                    <Plus size={16} color={transactionType === 'income' ? 'white' : '#9CA3AF'} />
                                    <Text style={[
                                        styles.toggleText,
                                        transactionType === 'income' && styles.activeText
                                    ]}>
                                        Income
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Timing Toggle (Now / Scheduled) */}
                            <View style={styles.toggleContainer}>
                                <TouchableOpacity
                                    onPress={() => {
                                        setIsScheduled(false);
                                        setScheduledDate(null);
                                    }}
                                    style={[
                                        styles.toggleButton,
                                        !isScheduled && styles.scheduledActive
                                    ]}
                                >
                                    <Clock size={16} color={!isScheduled ? 'white' : '#9CA3AF'} />
                                    <Text style={[
                                        styles.toggleText,
                                        !isScheduled && styles.activeText
                                    ]}>
                                        Now
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => {
                                        setIsScheduled(true);
                                        if (!scheduledDate) setScheduledDate(new Date());
                                    }}
                                    style={[
                                        styles.toggleButton,
                                        isScheduled && styles.scheduledActive
                                    ]}
                                >
                                    <Calendar size={16} color={isScheduled ? 'white' : '#9CA3AF'} />
                                    <Text style={[
                                        styles.toggleText,
                                        isScheduled && styles.activeText
                                    ]}>
                                        Scheduled
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Scheduled Date Selection */}
                            {isScheduled && (
                                <View style={styles.scheduleSection}>
                                    <Text style={styles.scheduleLabel}>Select date:</Text>

                                    {/* Date Picker Trigger Button */}
                                    <TouchableOpacity
                                        onPress={() => setShowDatePicker(true)}
                                        style={styles.datePickerButton}
                                    >
                                        <Calendar size={20} color="#A855F7" />
                                        <Text style={styles.datePickerButtonText}>
                                            {scheduledDate
                                                ? scheduledDate.toLocaleDateString('en-US', {
                                                    weekday: 'short',
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })
                                                : 'Tap to select date'
                                            }
                                        </Text>
                                    </TouchableOpacity>

                                    {/* Date Picker Modal for iOS / Inline for Android */}
                                    {showDatePicker && (
                                        Platform.OS === 'ios' ? (
                                            <Modal
                                                transparent
                                                animationType="fade"
                                                visible={showDatePicker}
                                                onRequestClose={() => setShowDatePicker(false)}
                                            >
                                                <View style={styles.datePickerModal}>
                                                    <View style={styles.datePickerContainer}>
                                                        <View style={styles.datePickerHeader}>
                                                            <Text style={styles.datePickerTitle}>Select Date</Text>
                                                            <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                                                <Text style={styles.datePickerDone}>Done</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                        <DateTimePicker
                                                            value={scheduledDate || new Date()}
                                                            mode="date"
                                                            display="spinner"
                                                            onChange={onDateChange}
                                                            minimumDate={new Date()}
                                                            textColor="#000"
                                                        />
                                                    </View>
                                                </View>
                                            </Modal>
                                        ) : (
                                            <DateTimePicker
                                                value={scheduledDate || new Date()}
                                                mode="date"
                                                display="default"
                                                onChange={onDateChange}
                                                minimumDate={new Date()}
                                            />
                                        )
                                    )}

                                    {/* Selected Date Display */}
                                    {scheduledDate && (
                                        <View style={styles.selectedDateContainer}>
                                            <Text style={styles.selectedDateText}>
                                                📅 Scheduled for {scheduledDate.toLocaleDateString('en-US', {
                                                    weekday: 'long',
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* Amount Input */}
                            <View style={styles.inputContainer}>
                                <View style={styles.inputRow}>
                                    <IndianRupee size={24} color="#6B7280" />
                                    <TextInput
                                        style={styles.amountInput}
                                        placeholder="0.00"
                                        value={amount}
                                        onChangeText={setAmount}
                                        keyboardType="decimal-pad"
                                        placeholderTextColor="#9CA3AF"
                                    />
                                </View>
                            </View>

                            {/* Category Input */}
                            <View style={styles.inputContainer}>
                                <View style={styles.inputRow}>
                                    <Tag size={20} color="#6B7280" />
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="Category (e.g., Food, Transport)"
                                        value={category}
                                        onChangeText={setCategory}
                                        placeholderTextColor="#9CA3AF"
                                    />
                                </View>
                            </View>

                            {/* Source Input - From where */}
                            <View style={styles.inputContainer}>
                                <View style={styles.inputRow}>
                                    <ArrowDownLeft size={20} color="#22C55E" />
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder={transactionType === 'income' ? 'From (e.g., Salary, Dad)' : 'From (e.g., Bank, Cash)'}
                                        value={source}
                                        onChangeText={setSource}
                                        placeholderTextColor="#9CA3AF"
                                    />
                                </View>
                            </View>

                            {/* Destination Input - To where */}
                            <View style={styles.inputContainer}>
                                <View style={styles.inputRow}>
                                    <ArrowUpRight size={20} color="#EF4444" />
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder={transactionType === 'income' ? 'To (e.g., Bank, Cash)' : 'To (e.g., Shop, Restaurant)'}
                                        value={destination}
                                        onChangeText={setDestination}
                                        placeholderTextColor="#9CA3AF"
                                    />
                                </View>
                            </View>

                            {/* Description Input */}
                            <View style={styles.descriptionContainer}>
                                <TextInput
                                    style={styles.descriptionInput}
                                    placeholder="Description (optional)"
                                    value={description}
                                    onChangeText={setDescription}
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>

                            {/* Submit Button */}
                            <TouchableOpacity
                                onPress={handleSubmit}
                                disabled={isSubmitting || (isScheduled && !scheduledDate)}
                                style={[
                                    styles.submitButton,
                                    transactionType === 'income' ? styles.incomeButton : styles.expenseButton,
                                    (isSubmitting || (isScheduled && !scheduledDate)) && styles.disabledButton
                                ]}
                            >
                                {transactionType === 'income' ? (
                                    <Plus size={20} color="white" />
                                ) : (
                                    <Minus size={20} color="white" />
                                )}
                                <Text style={styles.submitText}>
                                    {isSubmitting
                                        ? 'Adding...'
                                        : isScheduled
                                            ? `Schedule ${transactionType === 'income' ? 'Income' : 'Expense'}`
                                            : `Add ${transactionType === 'income' ? 'Income' : 'Expense'}`
                                    }
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
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
    modalContainer: {
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
        borderRadius: 50,
        padding: 4,
        marginBottom: 24,
    },
    toggleButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 50,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    expenseActive: {
        backgroundColor: '#EF4444',
    },
    incomeActive: {
        backgroundColor: '#22C55E',
    },
    scheduledActive: {
        backgroundColor: '#A855F7',
    },
    toggleText: {
        fontWeight: 'bold',
        color: '#9CA3AF',
    },
    activeText: {
        color: 'white',
    },
    scheduleSection: {
        marginBottom: 16,
    },
    scheduleLabel: {
        color: '#6B7280',
        fontSize: 14,
        marginBottom: 12,
    },
    datePickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#F3E8FF',
        borderWidth: 2,
        borderColor: '#A855F7',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
    },
    datePickerButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#7C3AED',
    },
    datePickerModal: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    datePickerContainer: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 40,
    },
    datePickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    datePickerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#000',
    },
    datePickerDone: {
        fontSize: 16,
        fontWeight: '600',
        color: '#A855F7',
    },
    selectedDateContainer: {
        backgroundColor: '#F3E8FF',
        padding: 12,
        borderRadius: 12,
    },
    selectedDateText: {
        color: '#7C3AED',
        fontWeight: '500',
        textAlign: 'center',
    },
    inputContainer: {
        marginBottom: 16,
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
    amountInput: {
        flex: 1,
        fontSize: 24,
        fontWeight: 'bold',
    },
    textInput: {
        flex: 1,
        fontSize: 16,
    },
    descriptionContainer: {
        marginBottom: 24,
    },
    descriptionInput: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 16,
        padding: 16,
        fontSize: 16,
    },
    submitButton: {
        paddingVertical: 20,
        borderRadius: 50,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    incomeButton: {
        backgroundColor: '#22C55E',
    },
    expenseButton: {
        backgroundColor: '#EF4444',
    },
    disabledButton: {
        opacity: 0.5,
    },
    submitText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 18,
    },
});
