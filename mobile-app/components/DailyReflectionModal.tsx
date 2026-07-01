/**
 * DailyReflectionModal
 * 
 * Nightly review prompt for capturing daily reflections.
 * Logs to event system for analytics.
 */

import React, { useState } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
} from 'react-native';
import { emitEvent, EventTypes } from '../services/eventLogger';

interface DailyReflectionModalProps {
    visible: boolean;
    onClose: () => void;
    userId: string;
}

interface ReflectionData {
    gratitude: string;
    accomplishment: string;
    learned: string;
    improvement: string;
    moodRating: number;
    overallThoughts: string;
}

export default function DailyReflectionModal({
    visible,
    onClose,
    userId,
}: DailyReflectionModalProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [reflection, setReflection] = useState<ReflectionData>({
        gratitude: '',
        accomplishment: '',
        learned: '',
        improvement: '',
        moodRating: 7,
        overallThoughts: '',
    });

    const steps = [
        {
            key: 'gratitude',
            question: "What are you grateful for today? 🙏",
            placeholder: "I'm grateful for...",
        },
        {
            key: 'accomplishment',
            question: "What did you accomplish today? 🏆",
            placeholder: "Today I accomplished...",
        },
        {
            key: 'learned',
            question: "What did you learn today? 📚",
            placeholder: "I learned that...",
        },
        {
            key: 'improvement',
            question: "What could you improve tomorrow? 🎯",
            placeholder: "Tomorrow I will...",
        },
        {
            key: 'moodRating',
            question: "How would you rate today overall? 🌟",
            isMoodRating: true,
        },
        {
            key: 'overallThoughts',
            question: "Any other thoughts to capture? 💭",
            placeholder: "Additional thoughts...",
        },
    ];

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleSubmit();
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleSubmit = async () => {
        try {
            await emitEvent({
                eventType: EventTypes.DAILY_REFLECTION_ADDED,
                entityType: 'mood',
                entityId: `reflection_${Date.now()}`,
                payload: {
                    gratitude: reflection.gratitude,
                    accomplishment: reflection.accomplishment,
                    learned: reflection.learned,
                    improvement: reflection.improvement,
                    moodRating: reflection.moodRating,
                    overallThoughts: reflection.overallThoughts,
                    date: new Date().toISOString().split('T')[0],
                },
                userId,
            });

            Alert.alert(
                'Reflection Saved ✨',
                'Your daily reflection has been recorded. Great job taking time to reflect!',
                [{ text: 'Done', onPress: handleClose }]
            );
        } catch (error) {
            console.error('[DailyReflectionModal] Failed to save:', error);
            Alert.alert('Error', 'Failed to save reflection. Please try again.');
        }
    };

    const handleClose = () => {
        setCurrentStep(0);
        setReflection({
            gratitude: '',
            accomplishment: '',
            learned: '',
            improvement: '',
            moodRating: 7,
            overallThoughts: '',
        });
        onClose();
    };

    const currentStepData = steps[currentStep];
    const progress = ((currentStep + 1) / steps.length) * 100;

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 bg-black/70 justify-end">
                <View className="bg-gray-900 rounded-t-3xl h-[75%]">
                    {/* Header */}
                    <View className="p-4 border-b border-gray-800">
                        <View className="flex-row justify-between items-center mb-3">
                            <Text className="text-xl font-bold text-white">
                                🌙 Daily Reflection
                            </Text>
                            <TouchableOpacity onPress={handleClose}>
                                <Text className="text-gray-400 text-lg">✕</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Progress Bar */}
                        <View className="bg-gray-700 rounded-full h-2">
                            <View
                                className="bg-purple-500 rounded-full h-2"
                                style={{ width: `${progress}%` }}
                            />
                        </View>
                        <Text className="text-gray-400 text-xs mt-1 text-right">
                            Step {currentStep + 1} of {steps.length}
                        </Text>
                    </View>

                    {/* Content */}
                    <ScrollView className="flex-1 p-6">
                        <Text className="text-2xl text-white font-bold mb-6">
                            {currentStepData.question}
                        </Text>

                        {currentStepData.isMoodRating ? (
                            <View>
                                <View className="flex-row justify-center items-center mb-4">
                                    <Text className="text-6xl">
                                        {reflection.moodRating >= 8
                                            ? '😊'
                                            : reflection.moodRating >= 6
                                                ? '🙂'
                                                : reflection.moodRating >= 4
                                                    ? '😐'
                                                    : '😔'}
                                    </Text>
                                </View>
                                <Text className="text-white text-center text-3xl font-bold mb-4">
                                    {reflection.moodRating}/10
                                </Text>
                                <View className="flex-row justify-center flex-wrap">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                                        <TouchableOpacity
                                            key={rating}
                                            className={`w-12 h-12 rounded-full m-1 justify-center items-center ${reflection.moodRating === rating
                                                ? 'bg-purple-600'
                                                : 'bg-gray-800'
                                                }`}
                                            onPress={() =>
                                                setReflection({ ...reflection, moodRating: rating })
                                            }
                                        >
                                            <Text className="text-white font-bold">{rating}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        ) : (
                            <TextInput
                                className="bg-gray-800 text-white p-4 rounded-xl text-lg"
                                placeholder={currentStepData.placeholder}
                                placeholderTextColor="#6b7280"
                                value={reflection[currentStepData.key as keyof ReflectionData] as string}
                                onChangeText={(text) =>
                                    setReflection({
                                        ...reflection,
                                        [currentStepData.key]: text,
                                    })
                                }
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                                style={{ minHeight: 120 }}
                            />
                        )}
                    </ScrollView>

                    {/* Navigation Buttons */}
                    <View className="flex-row p-4 border-t border-gray-800">
                        {currentStep > 0 && (
                            <TouchableOpacity
                                className="bg-gray-700 px-6 py-4 rounded-xl mr-2"
                                onPress={handleBack}
                            >
                                <Text className="text-white font-semibold">← Back</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            className="bg-purple-600 px-6 py-4 rounded-xl flex-1"
                            onPress={handleNext}
                        >
                            <Text className="text-white text-center font-bold text-lg">
                                {currentStep === steps.length - 1 ? '✨ Save Reflection' : 'Next →'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
