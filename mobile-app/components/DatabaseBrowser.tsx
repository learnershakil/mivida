import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, FlatList, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useMemo } from 'react';
import {
    ArrowLeft, Search, Filter, Database, Trash2, Edit3, Save,
    X, ChevronRight, RefreshCw, Clock,
    CheckCircle2, XCircle, AlertCircle, Eye
} from 'lucide-react-native';
import { database } from '../database';
import { Q, Model } from '@nozbe/watermelondb';

// Table configurations
const TABLES = [
    { name: 'users', label: 'Users', icon: '👤', color: '#4AC3FF' },
    { name: 'tasks', label: 'Tasks', icon: '📋', color: '#34C759' },
    { name: 'event_logs', label: 'Event Logs', icon: '📊', color: '#FFD465' },
    { name: 'finance_logs', label: 'Finance', icon: '💰', color: '#FF9500' },
    { name: 'mood_logs', label: 'Moods', icon: '😊', color: '#FF2D55' },
    { name: 'notification_logs', label: 'Notifications', icon: '🔔', color: '#5856D6' },
    { name: 'settings', label: 'Settings', icon: '⚙️', color: '#8E8E93' },
    { name: 'vault_media', label: 'Vault Media', icon: '🔒', color: '#007AFF' },
    { name: 'music_tracks', label: 'Music Tracks', icon: '🎵', color: '#FF2D55' },
    { name: 'music_categories', label: 'Music Categories', icon: '🎼', color: '#AF52DE' },
];

// Event type filters
const EVENT_TYPE_FILTERS = [
    'All',
    'STATE_CHANGE',
    'TASK_CREATED',
    'TASK_STARTED',
    'TASK_COMPLETED',
    'TASK_CANCELLED',
    'FOCUS_LOCK_STARTED',
    'FOCUS_LOCK_ENDED',
    'MUSIC_PLAY_STARTED',
    'MUSIC_PLAYBACK',
    'FINANCE_CREDIT_ADDED',
    'FINANCE_DEBIT_ADDED',
    'MOOD_LOGGED',
    'VAULT_OPENED',
];

interface DatabaseBrowserProps {
    onClose: () => void;
}

export default function DatabaseBrowser({ onClose }: DatabaseBrowserProps) {
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [tableData, setTableData] = useState<Model[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [eventTypeFilter, setEventTypeFilter] = useState('All');
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<Model | null>(null);
    const [showRecordModal, setShowRecordModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState<Model | null>(null);
    const [tableCounts, setTableCounts] = useState<Record<string, number>>({});
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingRecord, setEditingRecord] = useState<Model | null>(null);
    const [editFormData, setEditFormData] = useState<Record<string, any>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Load table counts on mount
    useEffect(() => {
        loadTableCounts();
    }, []);

    const loadTableCounts = async () => {
        const counts: Record<string, number> = {};
        for (const table of TABLES) {
            try {
                const count = await database.get(table.name).query().fetchCount();
                counts[table.name] = count;
            } catch {
                counts[table.name] = 0;
            }
        }
        setTableCounts(counts);
    };

    // Load table data
    const loadTableData = async (tableName: string) => {
        setIsLoading(true);
        try {
            let query = database.get(tableName).query();

            // Sort by created_at if available
            if (['event_logs', 'tasks', 'finance_logs', 'mood_logs', 'notification_logs', 'music_tracks'].includes(tableName)) {
                query = database.get(tableName).query(Q.sortBy('created_at', Q.desc));
            }

            const data = await query.fetch();
            setTableData(data);
        } catch (error) {
            console.error('Error loading table:', error);
            Alert.alert('Error', 'Failed to load table data');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectTable = (tableName: string) => {
        setSelectedTable(tableName);
        setSearchQuery('');
        setEventTypeFilter('All');
        loadTableData(tableName);
    };

    const handleRefresh = () => {
        if (selectedTable) {
            loadTableData(selectedTable);
        }
        loadTableCounts();
    };

    // Filter data based on search and event type
    const filteredData = useMemo(() => {
        let data = tableData;

        // Event type filter (only for event_logs)
        if (selectedTable === 'event_logs' && eventTypeFilter !== 'All') {
            data = data.filter((record: any) => record.eventType === eventTypeFilter);
        }

        // Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            data = data.filter((record: any) => {
                const raw = record._raw || {};
                return Object.values(raw).some(val =>
                    String(val).toLowerCase().includes(query)
                );
            });
        }

        return data;
    }, [tableData, searchQuery, eventTypeFilter, selectedTable]);

    // Delete record
    const handleDeleteRecord = async () => {
        if (!recordToDelete) return;

        try {
            await database.write(async () => {
                await recordToDelete.destroyPermanently();
            });
            setShowDeleteConfirm(false);
            setRecordToDelete(null);
            handleRefresh();
            Alert.alert('Success', 'Record deleted successfully');
        } catch (error) {
            console.error('Error deleting record:', error);
            Alert.alert('Error', 'Failed to delete record');
        }
    };

    // Delete all records in selected table
    const handleDeleteAllInTable = () => {
        if (!selectedTable) return;

        Alert.alert(
            'Delete All Records',
            `Are you sure you want to delete ALL ${tableCounts[selectedTable] || 0} records from ${selectedTable}? This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete All',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setIsLoading(true);
                            await database.write(async () => {
                                const records = await database.get(selectedTable).query().fetch();
                                for (const record of records) {
                                    await record.destroyPermanently();
                                }
                            });
                            handleRefresh();
                            Alert.alert('Success', 'All records deleted');
                        } catch (error) {
                            console.error('Error deleting all:', error);
                            Alert.alert('Error', 'Failed to delete records');
                        } finally {
                            setIsLoading(false);
                        }
                    }
                }
            ]
        );
    };

    // Get display value for a field
    const getDisplayValue = (value: any): string => {
        if (value === null || value === undefined) return '—';
        if (typeof value === 'boolean') return value ? '✓' : '✗';
        if (typeof value === 'number') {
            // Check if it's a timestamp
            if (value > 1000000000000 && value < 2000000000000) {
                return new Date(value).toLocaleString();
            }
            return value.toString();
        }
        if (typeof value === 'object') return JSON.stringify(value, null, 2);
        return String(value);
    };

    // Open edit modal
    const handleOpenEdit = (record: Model) => {
        const raw = (record as any)._raw || {};
        // Clone the raw data for editing, excluding internal fields
        const editableData: Record<string, any> = {};
        Object.entries(raw).forEach(([key, value]) => {
            // Skip internal WatermelonDB fields
            if (!['_status', '_changed'].includes(key)) {
                editableData[key] = value;
            }
        });
        setEditFormData(editableData);
        setEditingRecord(record);
        setShowEditModal(true);
    };

    // Readonly fields that should not be edited
    const READONLY_FIELDS = ['id', 'created_at', 'updated_at', 'createdAt', 'updatedAt', '_status', '_changed'];

    // Save edited record
    const handleSaveEdit = async () => {
        if (!editingRecord || !selectedTable) return;

        setIsSaving(true);
        try {
            await database.write(async () => {
                await editingRecord.update((record: any) => {
                    // Update all editable fields
                    Object.entries(editFormData).forEach(([key, value]) => {
                        // Skip readonly fields
                        if (READONLY_FIELDS.includes(key)) return;
                        // Convert snake_case to camelCase for the model property
                        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
                        // Skip if camelCase version is readonly
                        if (READONLY_FIELDS.includes(camelKey)) return;
                        // Try both snake_case and camelCase
                        if (camelKey in record) {
                            record[camelKey] = value;
                        }
                    });
                });
            });

            setShowEditModal(false);
            setEditingRecord(null);
            setEditFormData({});
            handleRefresh();
            Alert.alert('Success', 'Record updated successfully');
        } catch (error) {
            console.error('Error updating record:', error);
            Alert.alert('Error', `Failed to update record: ${error}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Update a field in edit form
    const updateEditField = (key: string, value: any) => {
        setEditFormData(prev => ({ ...prev, [key]: value }));
    };

    // Get field input type
    const getFieldType = (key: string, value: any): 'text' | 'number' | 'boolean' | 'timestamp' | 'json' => {
        if (typeof value === 'boolean') return 'boolean';
        if (typeof value === 'number') {
            if (key.includes('_at') || key.includes('time') || key.includes('date')) return 'timestamp';
            return 'number';
        }
        if (typeof value === 'object' && value !== null) return 'json';
        return 'text';
    };

    // Format timestamp
    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Render table list (home view)
    const renderTableList = () => (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
            <View className="px-6 pt-4">
                <Text className="text-2xl font-bold text-[#1E1E1E] mb-2">Database Browser</Text>
                <Text className="text-gray-400 mb-6">View and manage your local WatermelonDB</Text>

                {/* Table Cards */}
                <View className="gap-3">
                    {TABLES.map((table) => (
                        <TouchableOpacity
                            key={table.name}
                            onPress={() => handleSelectTable(table.name)}
                            className="bg-white rounded-2xl p-4 flex-row items-center border border-gray-100"
                            activeOpacity={0.7}
                        >
                            <View
                                className="h-12 w-12 rounded-xl items-center justify-center mr-4"
                                style={{ backgroundColor: table.color + '20' }}
                            >
                                <Text className="text-2xl">{table.icon}</Text>
                            </View>
                            <View className="flex-1">
                                <Text className="font-bold text-[#1E1E1E]">{table.label}</Text>
                                <Text className="text-gray-400 text-sm">{table.name}</Text>
                            </View>
                            <View className="bg-gray-100 px-3 py-1 rounded-full mr-2">
                                <Text className="font-bold text-[#1E1E1E]">{tableCounts[table.name] || 0}</Text>
                            </View>
                            <ChevronRight size={20} color="#8E8E93" />
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Quick Stats */}
                <View className="mt-6 bg-[#1E1E1E] rounded-2xl p-5">
                    <Text className="text-white font-bold mb-3">Database Summary</Text>
                    <View className="flex-row flex-wrap gap-3">
                        <View className="bg-white/10 rounded-xl px-4 py-3 flex-1 min-w-[45%]">
                            <Text className="text-white/60 text-xs">Total Records</Text>
                            <Text className="text-white font-bold text-xl">
                                {Object.values(tableCounts).reduce((a, b) => a + b, 0)}
                            </Text>
                        </View>
                        <View className="bg-white/10 rounded-xl px-4 py-3 flex-1 min-w-[45%]">
                            <Text className="text-white/60 text-xs">Tables</Text>
                            <Text className="text-white font-bold text-xl">{TABLES.length}</Text>
                        </View>
                    </View>
                </View>
            </View>
        </ScrollView>
    );

    // Render record card
    const renderRecordCard = ({ item, index }: { item: Model; index: number }) => {
        const raw = (item as any)._raw || {};
        const isEventLog = selectedTable === 'event_logs';

        // Get primary display info based on table
        let primaryText = raw.id?.substring(0, 8) + '...';
        let secondaryText = '';
        let statusColor = '#8E8E93';
        let statusIcon = null;

        if (selectedTable === 'tasks') {
            primaryText = raw.title || 'Untitled Task';
            secondaryText = raw.type || 'custom';
            if (raw.is_completed) {
                statusColor = '#34C759';
                statusIcon = <CheckCircle2 size={16} color={statusColor} />;
            } else if (raw.is_cancelled) {
                statusColor = '#FF3B30';
                statusIcon = <XCircle size={16} color={statusColor} />;
            } else if (raw.is_active) {
                statusColor = '#4AC3FF';
                statusIcon = <Clock size={16} color={statusColor} />;
            }
        } else if (isEventLog) {
            primaryText = raw.event_type || 'Unknown Event';
            secondaryText = formatTime(raw.created_at);
            statusColor = '#FFD465';
        } else if (selectedTable === 'finance_logs') {
            primaryText = `${raw.type === 'INCOME' ? '+' : '-'}₹${raw.amount}`;
            secondaryText = raw.category || 'Uncategorized';
            statusColor = raw.type === 'INCOME' ? '#34C759' : '#FF3B30';
        } else if (selectedTable === 'mood_logs') {
            const emojis = ['😢', '😟', '😐', '🙂', '😄'];
            primaryText = emojis[raw.mood - 1] || '😐';
            secondaryText = formatTime(raw.created_at);
        } else if (selectedTable === 'music_tracks') {
            primaryText = raw.title || 'Unknown Track';
            secondaryText = raw.artist || 'Unknown Artist';
            statusColor = '#FF2D55';
        } else if (selectedTable === 'users') {
            primaryText = raw.name || 'Unnamed User';
            secondaryText = raw.is_awake ? 'Awake' : 'Sleeping';
            statusColor = raw.is_awake ? '#C0F67F' : '#5856D6';
        }

        return (
            <TouchableOpacity
                onPress={() => {
                    setSelectedRecord(item);
                    setShowRecordModal(true);
                }}
                className="bg-white rounded-2xl p-4 mb-2 border border-gray-100"
                activeOpacity={0.7}
            >
                <View className="flex-row items-center">
                    <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                            {statusIcon}
                            <Text className="font-bold text-[#1E1E1E]" numberOfLines={1}>{primaryText}</Text>
                        </View>
                        <Text className="text-gray-400 text-sm mt-1">{secondaryText}</Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                        <TouchableOpacity
                            onPress={() => handleOpenEdit(item)}
                            className="p-2"
                        >
                            <Edit3 size={18} color="#4AC3FF" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => {
                                setRecordToDelete(item);
                                setShowDeleteConfirm(true);
                            }}
                            className="p-2"
                        >
                            <Trash2 size={18} color="#FF3B30" />
                        </TouchableOpacity>
                        <Eye size={18} color="#8E8E93" />
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    // Render table data view
    const renderTableData = () => (
        <View className="flex-1">
            {/* Header */}
            <View className="px-6 pt-4 pb-3 border-b border-gray-100">
                <View className="flex-row items-center justify-between mb-4">
                    <View className="flex-row items-center gap-3">
                        <TouchableOpacity onPress={() => setSelectedTable(null)}>
                            <ArrowLeft size={24} color="#1E1E1E" />
                        </TouchableOpacity>
                        <View>
                            <Text className="text-xl font-bold text-[#1E1E1E]">
                                {TABLES.find(t => t.name === selectedTable)?.label}
                            </Text>
                            <Text className="text-gray-400 text-sm">{filteredData.length} records</Text>
                        </View>
                    </View>
                    <View className="flex-row gap-2">
                        <TouchableOpacity
                            onPress={handleRefresh}
                            className="h-10 w-10 bg-gray-100 rounded-full items-center justify-center"
                        >
                            <RefreshCw size={18} color="#1E1E1E" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleDeleteAllInTable}
                            className="h-10 w-10 bg-[#FF3B30]/10 rounded-full items-center justify-center"
                        >
                            <Trash2 size={18} color="#FF3B30" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Search */}
                <View className="flex-row gap-2">
                    <View className="flex-1 flex-row items-center bg-gray-100 rounded-xl px-4 py-3">
                        <Search size={18} color="#8E8E93" />
                        <TextInput
                            className="flex-1 ml-2 text-[#1E1E1E]"
                            placeholder="Search records..."
                            placeholderTextColor="#8E8E93"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <X size={18} color="#8E8E93" />
                            </TouchableOpacity>
                        )}
                    </View>
                    {selectedTable === 'event_logs' && (
                        <TouchableOpacity
                            onPress={() => setShowFilterModal(true)}
                            className={`h-12 w-12 rounded-xl items-center justify-center ${eventTypeFilter !== 'All' ? 'bg-[#FFD465]' : 'bg-gray-100'}`}
                        >
                            <Filter size={18} color={eventTypeFilter !== 'All' ? '#1E1E1E' : '#8E8E93'} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Data List */}
            {isLoading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#1E1E1E" />
                </View>
            ) : (
                <FlatList
                    data={filteredData}
                    renderItem={renderRecordCard}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                    ListEmptyComponent={
                        <View className="items-center py-12">
                            <Text className="text-6xl mb-4">📭</Text>
                            <Text className="text-gray-400 text-lg">No records found</Text>
                        </View>
                    }
                />
            )}
        </View>
    );

    // Record Detail Modal
    const renderRecordModal = () => {
        if (!selectedRecord) return null;
        const raw = (selectedRecord as any)._raw || {};

        return (
            <Modal visible={showRecordModal} animationType="slide" transparent>
                <View className="flex-1 bg-black/50">
                    <View className="flex-1 mt-20 bg-[#FDFCF8] rounded-t-3xl">
                        <View className="flex-row items-center justify-between p-6 border-b border-gray-100">
                            <Text className="text-xl font-bold text-[#1E1E1E]">Record Details</Text>
                            <TouchableOpacity onPress={() => setShowRecordModal(false)}>
                                <X size={24} color="#1E1E1E" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 40 }}>
                            {Object.entries(raw).map(([key, value]) => (
                                <View key={key} className="mb-4 bg-white rounded-xl p-4 border border-gray-100">
                                    <Text className="text-xs text-gray-400 font-medium mb-1">{key}</Text>
                                    <Text className="text-[#1E1E1E] font-medium" selectable>
                                        {getDisplayValue(value)}
                                    </Text>
                                </View>
                            ))}
                        </ScrollView>
                        <View className="p-6 border-t border-gray-100 gap-3">
                            <TouchableOpacity
                                onPress={() => {
                                    setShowRecordModal(false);
                                    handleOpenEdit(selectedRecord);
                                }}
                                className="bg-[#4AC3FF] rounded-xl py-4 items-center flex-row justify-center gap-2"
                            >
                                <Edit3 size={18} color="white" />
                                <Text className="text-white font-bold">Edit Record</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    setShowRecordModal(false);
                                    setRecordToDelete(selectedRecord);
                                    setShowDeleteConfirm(true);
                                }}
                                className="bg-[#FF3B30] rounded-xl py-4 items-center"
                            >
                                <Text className="text-white font-bold">Delete Record</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    };

    // Event Type Filter Modal
    const renderFilterModal = () => (
        <Modal visible={showFilterModal} animationType="slide" transparent>
            <View className="flex-1 bg-black/50 justify-end">
                <View className="bg-[#FDFCF8] rounded-t-3xl max-h-[70%]">
                    <View className="flex-row items-center justify-between p-6 border-b border-gray-100">
                        <Text className="text-xl font-bold text-[#1E1E1E]">Filter by Event Type</Text>
                        <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                            <X size={24} color="#1E1E1E" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView className="p-6">
                        {EVENT_TYPE_FILTERS.map((type) => (
                            <TouchableOpacity
                                key={type}
                                onPress={() => {
                                    setEventTypeFilter(type);
                                    setShowFilterModal(false);
                                }}
                                className={`p-4 rounded-xl mb-2 flex-row items-center justify-between ${eventTypeFilter === type ? 'bg-[#FFD465]' : 'bg-white border border-gray-100'}`}
                            >
                                <Text className={`font-medium ${eventTypeFilter === type ? 'text-[#1E1E1E]' : 'text-gray-600'}`}>
                                    {type}
                                </Text>
                                {eventTypeFilter === type && <CheckCircle2 size={20} color="#1E1E1E" />}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );

    // Delete Confirmation Modal
    const renderDeleteConfirmModal = () => (
        <Modal visible={showDeleteConfirm} animationType="fade" transparent>
            <View className="flex-1 bg-black/50 items-center justify-center p-6">
                <View className="bg-white rounded-3xl p-6 w-full max-w-sm">
                    <View className="items-center mb-4">
                        <View className="h-16 w-16 bg-[#FF3B30]/10 rounded-full items-center justify-center mb-4">
                            <AlertCircle size={32} color="#FF3B30" />
                        </View>
                        <Text className="text-xl font-bold text-[#1E1E1E] text-center">Delete Record?</Text>
                        <Text className="text-gray-400 text-center mt-2">
                            This action cannot be undone. The record will be permanently deleted.
                        </Text>
                    </View>
                    <View className="flex-row gap-3">
                        <TouchableOpacity
                            onPress={() => {
                                setShowDeleteConfirm(false);
                                setRecordToDelete(null);
                            }}
                            className="flex-1 bg-gray-100 rounded-xl py-4 items-center"
                        >
                            <Text className="font-bold text-[#1E1E1E]">Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleDeleteRecord}
                            className="flex-1 bg-[#FF3B30] rounded-xl py-4 items-center"
                        >
                            <Text className="font-bold text-white">Delete</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    // Edit Record Modal
    const renderEditModal = () => {
        if (!editingRecord) return null;

        const renderFieldInput = (key: string, value: any) => {
            const fieldType = getFieldType(key, value);
            const isReadOnly = key === 'id';

            if (isReadOnly) {
                return (
                    <View className="bg-gray-100 rounded-xl p-3">
                        <Text className="text-gray-400 font-medium" selectable>{String(value)}</Text>
                    </View>
                );
            }

            switch (fieldType) {
                case 'boolean':
                    return (
                        <View className="flex-row gap-2">
                            <TouchableOpacity
                                onPress={() => updateEditField(key, true)}
                                className={`flex-1 py-3 rounded-xl items-center ${editFormData[key] ? 'bg-[#34C759]' : 'bg-gray-100'}`}
                            >
                                <Text className={editFormData[key] ? 'text-white font-bold' : 'text-gray-600'}>True</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => updateEditField(key, false)}
                                className={`flex-1 py-3 rounded-xl items-center ${!editFormData[key] ? 'bg-[#FF3B30]' : 'bg-gray-100'}`}
                            >
                                <Text className={!editFormData[key] ? 'text-white font-bold' : 'text-gray-600'}>False</Text>
                            </TouchableOpacity>
                        </View>
                    );

                case 'number':
                    return (
                        <TextInput
                            className="bg-gray-100 rounded-xl p-3 text-[#1E1E1E]"
                            value={String(editFormData[key] ?? '')}
                            onChangeText={(text) => updateEditField(key, text ? parseFloat(text) || 0 : 0)}
                            keyboardType="numeric"
                            placeholderTextColor="#8E8E93"
                        />
                    );

                case 'timestamp':
                    return (
                        <View>
                            <TextInput
                                className="bg-gray-100 rounded-xl p-3 text-[#1E1E1E]"
                                value={String(editFormData[key] ?? '')}
                                onChangeText={(text) => updateEditField(key, text ? parseInt(text) || 0 : 0)}
                                keyboardType="numeric"
                                placeholderTextColor="#8E8E93"
                            />
                            <Text className="text-gray-400 text-xs mt-1">
                                {editFormData[key] ? new Date(editFormData[key]).toLocaleString() : 'Invalid date'}
                            </Text>
                            <TouchableOpacity
                                onPress={() => updateEditField(key, Date.now())}
                                className="bg-[#FFD465] rounded-lg py-2 px-3 mt-2 self-start"
                            >
                                <Text className="text-[#1E1E1E] font-medium text-sm">Set to Now</Text>
                            </TouchableOpacity>
                        </View>
                    );

                case 'json':
                    return (
                        <TextInput
                            className="bg-gray-100 rounded-xl p-3 text-[#1E1E1E] min-h-[100px]"
                            value={typeof editFormData[key] === 'object' ? JSON.stringify(editFormData[key], null, 2) : String(editFormData[key] ?? '')}
                            onChangeText={(text) => {
                                try {
                                    updateEditField(key, JSON.parse(text));
                                } catch {
                                    // Keep as string if not valid JSON
                                }
                            }}
                            multiline
                            textAlignVertical="top"
                            placeholderTextColor="#8E8E93"
                        />
                    );

                default:
                    return (
                        <TextInput
                            className="bg-gray-100 rounded-xl p-3 text-[#1E1E1E]"
                            value={String(editFormData[key] ?? '')}
                            onChangeText={(text) => updateEditField(key, text)}
                            placeholder="Enter value..."
                            placeholderTextColor="#8E8E93"
                            multiline={String(value).length > 50}
                        />
                    );
            }
        };

        return (
            <Modal visible={showEditModal} animationType="slide" transparent>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    className="flex-1"
                >
                    <View className="flex-1 bg-black/50">
                        <View className="flex-1 mt-12 bg-[#FDFCF8] rounded-t-3xl">
                            {/* Header */}
                            <View className="flex-row items-center justify-between p-6 border-b border-gray-100">
                                <View className="flex-row items-center gap-3">
                                    <Edit3 size={24} color="#4AC3FF" />
                                    <Text className="text-xl font-bold text-[#1E1E1E]">Edit Record</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => {
                                        setShowEditModal(false);
                                        setEditingRecord(null);
                                        setEditFormData({});
                                    }}
                                >
                                    <X size={24} color="#1E1E1E" />
                                </TouchableOpacity>
                            </View>

                            {/* Form Fields */}
                            <ScrollView
                                className="flex-1 p-6"
                                contentContainerStyle={{ paddingBottom: 40 }}
                                keyboardShouldPersistTaps="handled"
                            >
                                {Object.entries(editFormData).map(([key, value]) => (
                                    <View key={key} className="mb-4">
                                        <View className="flex-row items-center justify-between mb-2">
                                            <Text className="text-sm font-bold text-[#1E1E1E]">{key}</Text>
                                            <Text className="text-xs text-gray-400 capitalize">{getFieldType(key, value)}</Text>
                                        </View>
                                        {renderFieldInput(key, value)}
                                    </View>
                                ))}
                            </ScrollView>

                            {/* Save Button */}
                            <View className="p-6 border-t border-gray-100 gap-3">
                                <TouchableOpacity
                                    onPress={handleSaveEdit}
                                    disabled={isSaving}
                                    className="bg-[#34C759] rounded-xl py-4 items-center flex-row justify-center gap-2"
                                >
                                    {isSaving ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <>
                                            <Save size={18} color="white" />
                                            <Text className="text-white font-bold">Save Changes</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => {
                                        setShowEditModal(false);
                                        setEditingRecord(null);
                                        setEditFormData({});
                                    }}
                                    className="bg-gray-100 rounded-xl py-4 items-center"
                                >
                                    <Text className="font-bold text-[#1E1E1E]">Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        );
    };

    return (
        <View className="flex-1 bg-[#FDFCF8]">
            <SafeAreaView className="flex-1">
                {/* Header with back button */}
                {!selectedTable && (
                    <View className="flex-row items-center px-6 pt-4 pb-2">
                        <TouchableOpacity onPress={onClose} className="mr-4">
                            <ArrowLeft size={24} color="#1E1E1E" />
                        </TouchableOpacity>
                        <Database size={24} color="#1E1E1E" />
                    </View>
                )}

                {/* Main Content */}
                {selectedTable ? renderTableData() : renderTableList()}

                {/* Modals */}
                {renderRecordModal()}
                {renderFilterModal()}
                {renderDeleteConfirmModal()}
                {renderEditModal()}
            </SafeAreaView>
        </View>
    );
}
