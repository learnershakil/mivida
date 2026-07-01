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
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 bg-black/50 justify-end">
                <View className="bg-gray-900 rounded-t-3xl h-[85%]">
                    {/* Header */}
                    <View className="flex-row justify-between items-center p-4 border-b border-gray-800">
                        <Text className="text-xl font-bold text-white">Delegation Center</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Text className="text-blue-400 text-lg">Close</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Tab Buttons */}
                    <View className="flex-row p-2">
                        <TouchableOpacity
                            className={`flex-1 py-3 rounded-lg mr-1 ${activeTab === 'list' ? 'bg-blue-600' : 'bg-gray-800'}`}
                            onPress={() => setActiveTab('list')}
                        >
                            <Text className="text-white text-center font-semibold">
                                Delegated Tasks ({delegatedTasks.length})
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className={`flex-1 py-3 rounded-lg ml-1 ${activeTab === 'create' ? 'bg-blue-600' : 'bg-gray-800'}`}
                            onPress={() => setActiveTab('create')}
                        >
                            <Text className="text-white text-center font-semibold">+ Delegate New</Text>
                        </TouchableOpacity>
                    </View>

                    {activeTab === 'list' ? (
                        <>
                            {/* Status Filter */}
                            <View className="flex-row px-4 py-2">
                                {(['all', 'assigned', 'partial', 'completed'] as StatusFilter[]).map((status) => (
                                    <TouchableOpacity
                                        key={status}
                                        className={`px-3 py-1 rounded-full mr-2 ${statusFilter === status ? 'bg-blue-600' : 'bg-gray-800'}`}
                                        onPress={() => setStatusFilter(status)}
                                    >
                                        <Text className="text-white capitalize text-sm">{status}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Task List */}
                            <ScrollView className="flex-1 px-4">
                                {loading ? (
                                    <Text className="text-gray-400 text-center py-8">Loading...</Text>
                                ) : filteredTasks.length === 0 ? (
                                    <Text className="text-gray-400 text-center py-8">
                                        No delegated tasks yet. Tap "+ Delegate New" to add one.
                                    </Text>
                                ) : (
                                    filteredTasks.map((task) => (
                                        <View
                                            key={task.id}
                                            className="bg-gray-800 rounded-xl p-4 mb-3"
                                        >
                                            <View className="flex-row justify-between items-start">
                                                <View className="flex-1">
                                                    <Text className="text-white font-semibold text-lg">
                                                        {task.title}
                                                    </Text>
                                                    <Text className="text-gray-400 text-sm mt-1">
                                                        Assigned to: {task.delegatedTo}
                                                    </Text>
                                                    {task.description ? (
                                                        <Text className="text-gray-500 text-sm mt-1">
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
                                                <View className="bg-gray-700 rounded-full h-2">
                                                    <View
                                                        className="bg-blue-500 rounded-full h-2"
                                                        style={{ width: `${task.completionPercent || 0}%` }}
                                                    />
                                                </View>
                                                <Text className="text-gray-400 text-xs mt-1">
                                                    {task.completionPercent || 0}% complete
                                                </Text>
                                            </View>

                                            {/* Action Buttons */}
                                            <View className="flex-row mt-3 pt-3 border-t border-gray-700">
                                                {task.delegatedStatus !== 'completed' && (
                                                    <>
                                                        {task.delegatedStatus === 'assigned' && (
                                                            <TouchableOpacity
                                                                className="bg-blue-600 px-3 py-2 rounded-lg mr-2"
                                                                onPress={() => handleStatusUpdate(task, 'partial')}
                                                            >
                                                                <Text className="text-white text-sm">Mark Partial</Text>
                                                            </TouchableOpacity>
                                                        )}
                                                        <TouchableOpacity
                                                            className="bg-green-600 px-3 py-2 rounded-lg mr-2"
                                                            onPress={() => handleStatusUpdate(task, 'completed')}
                                                        >
                                                            <Text className="text-white text-sm">Complete</Text>
                                                        </TouchableOpacity>
                                                    </>
                                                )}
                                                <TouchableOpacity
                                                    className="bg-red-600/20 px-3 py-2 rounded-lg"
                                                    onPress={() => handleDelete(task)}
                                                >
                                                    <Text className="text-red-400 text-sm">Delete</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))
                                )}
                            </ScrollView>
                        </>
                    ) : (
                        /* Create Form */
                        <ScrollView className="flex-1 px-4 pt-4">
                            <Text className="text-gray-400 mb-1">Task Title *</Text>
                            <TextInput
                                className="bg-gray-800 text-white p-4 rounded-xl mb-4"
                                placeholder="What needs to be done?"
                                placeholderTextColor="#6b7280"
                                value={title}
                                onChangeText={setTitle}
                            />

                            <Text className="text-gray-400 mb-1">Delegate To *</Text>
                            <TextInput
                                className="bg-gray-800 text-white p-4 rounded-xl mb-4"
                                placeholder="Person's name"
                                placeholderTextColor="#6b7280"
                                value={delegatedTo}
                                onChangeText={setDelegatedTo}
                            />

                            <Text className="text-gray-400 mb-1">Description</Text>
                            <TextInput
                                className="bg-gray-800 text-white p-4 rounded-xl mb-4"
                                placeholder="Optional details..."
                                placeholderTextColor="#6b7280"
                                value={description}
                                onChangeText={setDescription}
                                multiline
                                numberOfLines={3}
                            />

                            <Text className="text-gray-400 mb-1">Category</Text>
                            <TextInput
                                className="bg-gray-800 text-white p-4 rounded-xl mb-6"
                                placeholder="e.g., work, home, errands"
                                placeholderTextColor="#6b7280"
                                value={category}
                                onChangeText={setCategory}
                            />

                            <TouchableOpacity
                                className="bg-blue-600 p-4 rounded-xl"
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
