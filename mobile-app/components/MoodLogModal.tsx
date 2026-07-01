/**
 * MoodLogModal Component
 * 
 * Modal for logging mood with score (1-10) and optional note.
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Modal,
    Alert,
    ScrollView,
} from 'react-native';
import { X, Smile, Frown, Meh, Heart } from 'lucide-react-native';
import { logMood, MoodLevel, MoodLevels } from '../services/moodService';

interface MoodLogModalProps {
    visible: boolean;
    onClose: () => void;
    userId: string;
}

// Extended 1-10 scale with emojis
const MOOD_SCALE: { score: number; emoji: string; label: string }[] = [
    { score: 1, emoji: '😭', label: 'Awful' },
    { score: 2, emoji: '😫', label: 'Terrible' },
    { score: 3, emoji: '😢', label: 'Very Bad' },
    { score: 4, emoji: '😞', label: 'Bad' },
    { score: 5, emoji: '😐', label: 'Neutral' },
    { score: 6, emoji: '🙂', label: 'Okay' },
    { score: 7, emoji: '😊', label: 'Good' },
    { score: 8, emoji: '😄', label: 'Great' },
    { score: 9, emoji: '🤩', label: 'Amazing' },
    { score: 10, emoji: '🥳', label: 'Fantastic' },
];

// Map 1-10 score to MoodLevel for backward compatibility
function scoreToMoodLevel(score: number): MoodLevel {
    if (score <= 2) return 'TERRIBLE';
    if (score <= 4) return 'BAD';
    if (score <= 5) return 'MEH';
    if (score <= 7) return 'GOOD';
    return 'GREAT';
}

function getMoodColor(score: number): string {
    if (score <= 2) return '#ef4444'; // red
    if (score <= 4) return '#f97316'; // orange
    if (score <= 5) return '#eab308'; // yellow
    if (score <= 7) return '#22c55e'; // green
    return '#10b981'; // emerald
}

export function MoodLogModal({ visible, onClose, userId }: MoodLogModalProps) {
    const [selectedScore, setSelectedScore] = useState<number | null>(null);
    const [note, setNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const resetForm = () => {
        setSelectedScore(null);
        setNote('');
    };

    const handleSubmit = async () => {
        if (selectedScore === null) {
            Alert.alert('Error', 'Please select a mood');
            return;
        }

        setIsSubmitting(true);

        try {
            // Convert 1-10 score to MoodLevel for service
            const moodLevel = scoreToMoodLevel(selectedScore);

            await logMood({
                mood: moodLevel,
                note: note.trim() ? `[Score: ${selectedScore}/10] ${note.trim()}` : `Score: ${selectedScore}/10`,
                userId,
            });

            resetForm();
            onClose();
            Alert.alert('Mood Logged', 'Your mood has been recorded.');
        } catch (error) {
            console.error('Failed to log mood:', error);
            Alert.alert('Error', 'Failed to log mood');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const selectedMood = selectedScore !== null ? MOOD_SCALE.find(m => m.score === selectedScore) : null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={handleClose}
        >
            <View className="flex-1 bg-black/50 justify-end">
                <View className="bg-white rounded-t-[40px] p-6 max-h-[85%]">
                    {/* Header */}
                    <View className="flex-row justify-between items-center mb-6">
                        <View className="flex-row items-center gap-3">
                            <View className="h-12 w-12 bg-pink-100 rounded-full items-center justify-center">
                                <Heart size={24} color="#EC4899" />
                            </View>
                            <View>
                                <Text className="text-xl font-bold">How are you feeling?</Text>
                                <Text className="text-gray-500 text-sm">Rate your mood 1-10</Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={handleClose}
                            className="h-10 w-10 bg-gray-100 rounded-full items-center justify-center"
                        >
                            <X size={20} color="black" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Mood Score Selection */}
                        <View className="flex-row flex-wrap justify-center mb-4">
                            {MOOD_SCALE.map((mood) => (
                                <TouchableOpacity
                                    key={mood.score}
                                    onPress={() => setSelectedScore(mood.score)}
                                    className={`items-center p-2 m-1 rounded-xl w-16 ${selectedScore === mood.score
                                            ? 'bg-gray-800'
                                            : 'bg-gray-100'
                                        }`}
                                >
                                    <Text className="text-2xl">{mood.emoji}</Text>
                                    <Text className={`text-xs font-bold ${selectedScore === mood.score ? 'text-white' : 'text-gray-500'
                                        }`}>
                                        {mood.score}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Selected Mood Display */}
                        {selectedMood && (
                            <View
                                className="rounded-2xl p-4 mb-4 items-center"
                                style={{ backgroundColor: `${getMoodColor(selectedScore!)}20` }}
                            >
                                <Text className="text-5xl mb-2">{selectedMood.emoji}</Text>
                                <Text
                                    className="text-2xl font-bold"
                                    style={{ color: getMoodColor(selectedScore!) }}
                                >
                                    {selectedMood.label}
                                </Text>
                                <Text className="text-gray-500 text-sm mt-1">
                                    Score: {selectedScore} / 10
                                </Text>
                            </View>
                        )}

                        {/* Note Input */}
                        <View className="mb-6">
                            <Text className="text-gray-500 font-medium mb-2">Add a note (optional)</Text>
                            <TextInput
                                className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-base min-h-[100px]"
                                placeholder="What's on your mind?"
                                value={note}
                                onChangeText={setNote}
                                multiline
                                textAlignVertical="top"
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>

                        {/* Submit Button */}
                        <TouchableOpacity
                            onPress={handleSubmit}
                            disabled={isSubmitting || selectedScore === null}
                            className={`bg-[#1E1E1E] py-5 rounded-full flex-row items-center justify-center gap-2 ${(isSubmitting || selectedScore === null) ? 'opacity-50' : ''
                                }`}
                        >
                            <Heart size={20} color="#EC4899" />
                            <Text className="text-white font-bold text-lg">
                                {isSubmitting ? 'Saving...' : 'Log Mood'}
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}
