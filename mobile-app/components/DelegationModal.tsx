/**
 * DelegationModal
 * 
 * UI for managing delegated tasks - create new, view list, update status
 */

import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
} from 'react-native';
import { X } from 'lucide-react-native';
import Task from '../database/models/Task';
import delegationService from '../services/delegationService';

interface DelegationModalProps {
    visible: boolean;
    onClose: () => void;
    userId: string;
}

type TabType = 'list' | 'create';
type StatusFilter = 'all' | 'assigned' | 'partial' | 'completed';

export default function DelegationModal({ visible, onClose, userId }: DelegationModalProps) {
    const [activeTab, setActiveTab] = useState<TabType>('list');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [delegatedTasks, setDelegatedTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(false);

    // Create form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [delegatedTo, setDelegatedTo] = useState('');
    const [category, setCategory] = useState('');

    // Load delegated tasks
    const loadTasks = async () => {
        setLoading(true);
        try {
            const tasks = await delegationService.getAll(userId);
            setDelegatedTasks(tasks);
        } catch (error) {
            console.error('[DelegationModal] Failed to load tasks:', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (visible) {
            loadTasks();
        }
    }, [visible, userId]);

    const handleCreate = async () => {
        if (!title.trim() || !delegatedTo.trim()) {
            Alert.alert('Missing Info', 'Please enter task title and delegatee name');
            return;
        }

        try {
            await delegationService.create({
                title: title.trim(),
                description: description.trim(),
                delegatedTo: delegatedTo.trim(),
                category: category.trim() || 'delegated',
                userId,
            });

            setTitle('');
            setDescription('');
            setDelegatedTo('');
            setCategory('');
            setActiveTab('list');
            loadTasks();
            Alert.alert('Success', 'Task delegated successfully!');
        } catch (error) {
            console.error('[DelegationModal] Failed to create:', error);
            Alert.alert('Error', 'Failed to create delegated task');
        }
    };

    const handleStatusUpdate = async (task: Task, newStatus: 'assigned' | 'partial' | 'completed') => {
        try {
            await delegationService.updateStatus(
                task.id,
                { status: newStatus },
                userId
            );
            loadTasks();
        } catch (error) {
            console.error('[DelegationModal] Failed to update status:', error);
            Alert.alert('Error', 'Failed to update task status');
        }
    };

    const handleDelete = async (task: Task) => {
        Alert.alert(
            'Delete Task',
            `Are you sure you want to delete "${task.title}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await delegationService.delete(task.id);
                            loadTasks();
                        } catch (error) {
                            console.error('[DelegationModal] Failed to delete:', error);
                        }
                    },
                },
            ]
        );
    };

    const filteredTasks = delegatedTasks.filter((task) => {
        if (statusFilter === 'all') return true;
        return task.delegatedStatus === statusFilter;
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'assigned':
                return '#f59e0b'; // amber
            case 'partial':
                return '#3b82f6'; // blue
            case 'completed':
                return '#10b981'; // green
            default:
                return '#6b7280'; // gray
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View className="flex-1 bg-black/50">
                <View className="flex-1 bg-white rounded-t-[40px] mt-20">
                    {/* Header */}
                    <View className="flex-row justify-between items-center p-6 border-b border-gray-100">
                        <Text className="text-2xl font-bold">Delegation Center</Text>
                        <TouchableOpacity
                            onPress={onClose}
                            className="h-10 w-10 bg-gray-100 rounded-full items-center justify-center"
                        >
                            <X size={20} color="black" />
                        </TouchableOpacity>
                    </View>

                    {/* Tab Buttons */}
                    <View className="flex-row px-6 pt-4 gap-3">
                        <TouchableOpacity
                            className={`flex-1 py-3 rounded-full items-center ${activeTab === 'list' ? 'bg-[#1E1E1E]' : 'bg-gray-100'}`}
                            onPress={() => setActiveTab('list')}
                        >
                            <Text className={`font-bold ${activeTab === 'list' ? 'text-white' : 'text-gray-500'}`}>
                                Delegated ({delegatedTasks.length})
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className={`flex-1 py-3 rounded-full items-center ${activeTab === 'create' ? 'bg-[#1E1E1E]' : 'bg-gray-100'}`}
                            onPress={() => setActiveTab('create')}
                        >
                            <Text className={`font-bold ${activeTab === 'create' ? 'text-white' : 'text-gray-500'}`}>
                                + Delegate New
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {activeTab === 'list' ? (
                        <>
                            {/* Status Filter */}
                            <View className="flex-row px-6 py-4">
                                {(['all', 'assigned', 'partial', 'completed'] as StatusFilter[]).map((status) => (
                                    <TouchableOpacity
                                        key={status}
                                        className={`px-3 py-1.5 rounded-full mr-2 ${statusFilter === status ? 'bg-[#1E1E1E]' : 'bg-gray-100'}`}
                                        onPress={() => setStatusFilter(status)}
                                    >
                                        <Text className={`capitalize text-sm font-medium ${statusFilter === status ? 'text-white' : 'text-gray-500'}`}>{status}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Task List */}
                            <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
                                {loading ? (
                                    <Text className="text-gray-400 text-center py-8">Loading...</Text>
                                ) : filteredTasks.length === 0 ? (
                                    <Text className="text-gray-400 text-center py-8">
                                        No delegated tasks yet. Tap &quot;+ Delegate New&quot; to add one.
                                    </Text>
                                ) : (
                                    filteredTasks.map((task) => (
                                        <View
                                            key={task.id}
                                            className="bg-gray-50 rounded-2xl p-4 mb-3"
                                        >
                                            <View className="flex-row justify-between items-start">
                                                <View className="flex-1 pr-2">
                                                    <Text className="text-[#1E1E1E] font-bold text-lg">
                                                        {task.title}
                                                    </Text>
                                                    <Text className="text-gray-500 text-sm mt-1">
                                                        Assigned to: {task.delegatedTo}
                                                    </Text>
                                                    {task.description ? (
                                                        <Text className="text-gray-400 text-sm mt-1">
                                                            {task.description}
                                                        </Text>
                                                    ) : null}
                                                </View>
                                                <View
                                                    style={{ backgroundColor: getStatusColor(task.delegatedStatus || 'assigned') }}
                                                    className="px-3 py-1 rounded-full"
                                                >
                                                    <Text className="text-white text-xs font-medium capitalize">
                                                        {task.delegatedStatus || 'assigned'}
                                                    </Text>
                                                </View>
                                            </View>

                                            {/* Progress Bar */}
                                            <View className="mt-3">
                                                <View className="bg-gray-200 rounded-full h-2">
                                                    <View
                                                        className="bg-[#4AC3FF] rounded-full h-2"
                                                        style={{ width: `${task.completionPercent || 0}%` }}
                                                    />
                                                </View>
                                                <Text className="text-gray-400 text-xs mt-1">
                                                    {task.completionPercent || 0}% complete
                                                </Text>
                                            </View>

                                            {/* Action Buttons */}
                                            <View className="flex-row mt-3 pt-3 border-t border-gray-200">
                                                {task.delegatedStatus !== 'completed' && (
                                                    <>
                                                        {task.delegatedStatus === 'assigned' && (
                                                            <TouchableOpacity
                                                                className="bg-[#4AC3FF] px-4 py-2 rounded-xl mr-2"
                                                                onPress={() => handleStatusUpdate(task, 'partial')}
                                                            >
                                                                <Text className="text-white text-sm font-medium">Mark Partial</Text>
                                                            </TouchableOpacity>
                                                        )}
                                                        <TouchableOpacity
                                                            className="bg-[#C0F67F] px-4 py-2 rounded-xl mr-2"
                                                            onPress={() => handleStatusUpdate(task, 'completed')}
                                                        >
                                                            <Text className="text-black text-sm font-medium">Complete</Text>
                                                        </TouchableOpacity>
                                                    </>
                                                )}
                                                <TouchableOpacity
                                                    className="bg-[#FF6B6B]/10 px-4 py-2 rounded-xl"
                                                    onPress={() => handleDelete(task)}
                                                >
                                                    <Text className="text-[#FF6B6B] text-sm font-medium">Delete</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))
                                )}
                                <View className="h-10" />
                            </ScrollView>
                        </>
                    ) : (
                        /* Create Form */
                        <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false}>
                            <Text className="text-gray-500 font-medium mb-2">Task Title *</Text>
                            <TextInput
                                className="bg-gray-50 border border-gray-200 text-[#1E1E1E] p-4 rounded-xl mb-4"
                                placeholder="What needs to be done?"
                                placeholderTextColor="#9CA3AF"
                                value={title}
                                onChangeText={setTitle}
                            />

                            <Text className="text-gray-500 font-medium mb-2">Delegate To *</Text>
                            <TextInput
                                className="bg-gray-50 border border-gray-200 text-[#1E1E1E] p-4 rounded-xl mb-4"
                                placeholder="Person's name"
                                placeholderTextColor="#9CA3AF"
                                value={delegatedTo}
                                onChangeText={setDelegatedTo}
                            />

                            <Text className="text-gray-500 font-medium mb-2">Description</Text>
                            <TextInput
                                className="bg-gray-50 border border-gray-200 text-[#1E1E1E] p-4 rounded-xl mb-4"
                                placeholder="Optional details..."
                                placeholderTextColor="#9CA3AF"
                                value={description}
                                onChangeText={setDescription}
                                multiline
                                numberOfLines={3}
                            />

                            <Text className="text-gray-500 font-medium mb-2">Category</Text>
                            <TextInput
                                className="bg-gray-50 border border-gray-200 text-[#1E1E1E] p-4 rounded-xl mb-6"
                                placeholder="e.g., work, home, errands"
                                placeholderTextColor="#9CA3AF"
                                value={category}
                                onChangeText={setCategory}
                            />

                            <TouchableOpacity
                                className="bg-[#1E1E1E] py-5 rounded-full items-center mb-10"
                                onPress={handleCreate}
                            >
                                <Text className="text-white text-center font-bold text-lg">
                                    Delegate Task
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
}
