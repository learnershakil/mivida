/**
 * DeadManPrompt Component
 * 
 * Full-screen modal that appears when Dead Man's Switch triggers.
 * User CANNOT dismiss without entering a response.
 * 
 * Features:
 * - Mandatory text input or predefined options
 * - Cannot dismiss with back button
 * - Logs all responses
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    BackHandler,
    StyleSheet,
    Modal,
    KeyboardAvoidingView,
    Platform,
    Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, Send, Coffee, Laptop, Moon, HelpCircle } from 'lucide-react-native';
import { deadManService } from '../services/deadMan';

interface DeadManPromptProps {
    userId: string;
}

const QUICK_RESPONSES = [
    { id: 'working', label: 'Deep in work', icon: Laptop },
    { id: 'break', label: 'Taking a break', icon: Coffee },
    { id: 'rest', label: 'Resting', icon: Moon },
    { id: 'other', label: 'Other...', icon: HelpCircle },
];

export function DeadManPrompt({ userId }: DeadManPromptProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [response, setResponse] = useState('');
    const [showTextInput, setShowTextInput] = useState(false);
    const [promptId, setPromptId] = useState<string | null>(null);

    useEffect(() => {
        // Subscribe to nudge prompts
        const unsubscribe = deadManService.subscribeToNudgePrompt((id) => {
            setPromptId(id);
            setIsVisible(true);
            setResponse('');
            setShowTextInput(false);
            // Vibrate to get attention
            Vibration.vibrate([0, 200, 100, 200, 100, 200]);
        });

        // Prevent back button from dismissing
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (isVisible) {
                Vibration.vibrate(100);
                return true; // Prevent default
            }
            return false;
        });

        return () => {
            unsubscribe();
            backHandler.remove();
        };
    }, [isVisible]);

    const handleQuickResponse = async (responseId: string, label: string) => {
        if (responseId === 'other') {
            setShowTextInput(true);
            return;
        }

        await submitResponse(label);
    };

    const handleTextSubmit = async () => {
        if (response.trim().length === 0) return;
        await submitResponse(response.trim());
    };

    const submitResponse = async (responseText: string) => {
        try {
            await deadManService.respondToNudge(responseText, userId);
            setIsVisible(false);
            setPromptId(null);
            setResponse('');
            setShowTextInput(false);
        } catch (error) {
            console.error('[DeadManPrompt] Failed to submit response:', error);
        }
    };

    if (!isVisible) return null;

    return (
        <Modal visible={isVisible} animationType="fade" transparent={false}>
            <View style={styles.container}>
                <SafeAreaView style={styles.safeArea}>
                    <KeyboardAvoidingView
                        style={styles.keyboardView}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    >
                        <View style={styles.content}>
                            {/* Warning Icon */}
                            <View style={styles.iconContainer}>
                                <AlertTriangle size={48} color="#FFD465" />
                            </View>

                            {/* Title */}
                            <Text style={styles.title}>Hey, are you still there?</Text>
                            <Text style={styles.subtitle}>
                                You've been inactive for a while.{'\n'}
                                What have you been doing?
                            </Text>

                            {/* Quick Response Buttons */}
                            {!showTextInput ? (
                                <View style={styles.quickResponses}>
                                    {QUICK_RESPONSES.map(({ id, label, icon: Icon }) => (
                                        <TouchableOpacity
                                            key={id}
                                            style={styles.quickButton}
                                            onPress={() => handleQuickResponse(id, label)}
                                            activeOpacity={0.7}
                                        >
                                            <Icon size={20} color="white" />
                                            <Text style={styles.quickButtonText}>{label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ) : (
                                // Text Input Mode
                                <View style={styles.textInputContainer}>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="What were you doing?"
                                        placeholderTextColor="#666"
                                        value={response}
                                        onChangeText={setResponse}
                                        multiline
                                        autoFocus
                                        maxLength={500}
                                    />

                                    <View style={styles.inputActions}>
                                        <TouchableOpacity
                                            style={styles.backButton}
                                            onPress={() => setShowTextInput(false)}
                                        >
                                            <Text style={styles.backButtonText}>← Back</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[
                                                styles.submitButton,
                                                response.trim().length === 0 && styles.submitButtonDisabled
                                            ]}
                                            onPress={handleTextSubmit}
                                            disabled={response.trim().length === 0}
                                        >
                                            <Send size={20} color="black" />
                                            <Text style={styles.submitButtonText}>Submit</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            {/* Disclaimer */}
                            <Text style={styles.disclaimer}>
                                Your response will be logged for self-reflection.
                            </Text>
                        </View>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0A0A',
    },
    safeArea: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    iconContainer: {
        marginBottom: 24,
        padding: 16,
        backgroundColor: 'rgba(255, 212, 101, 0.1)',
        borderRadius: 50,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        color: '#8E8E93',
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 40,
    },
    quickResponses: {
        width: '100%',
        gap: 12,
    },
    quickButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#1C1C1E',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#333',
    },
    quickButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    textInputContainer: {
        width: '100%',
        gap: 16,
    },
    textInput: {
        backgroundColor: '#1C1C1E',
        borderRadius: 16,
        padding: 16,
        color: '#FFFFFF',
        fontSize: 16,
        minHeight: 120,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: '#333',
    },
    inputActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    backButton: {
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    backButtonText: {
        color: '#8E8E93',
        fontSize: 16,
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#C0F67F',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 24,
    },
    submitButtonDisabled: {
        opacity: 0.5,
    },
    submitButtonText: {
        color: '#000000',
        fontSize: 16,
        fontWeight: '600',
    },
    disclaimer: {
        color: '#666',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 40,
    },
});

export default DeadManPrompt;
