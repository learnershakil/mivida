/**
 * NotificationHistoryModal
 * 
 * Shows history of all notifications from event logs
 */

import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    FlatList,
} from 'react-native';
import { database } from '../database';
import NotificationLog from '../database/models/NotificationLog';
import { Q } from '@nozbe/watermelondb';

interface NotificationHistoryModalProps {
    visible: boolean;
    onClose: () => void;
    userId: string;
}

interface NotificationItem {
    id: string;
    title: string;
    body: string;
    type: string;
    createdAt: Date;
    wasRead: boolean;
}

export default function NotificationHistoryModal({
    visible,
    onClose,
    userId,
}: NotificationHistoryModalProps) {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');

    const loadNotifications = async () => {
        setLoading(true);
        try {
            const logsCollection = database.get<NotificationLog>('notification_logs');
            const logs = await logsCollection
                .query(
                    Q.where('user_id', userId),
                    Q.sortBy('created_at', Q.desc),
                    Q.take(100)
                )
                .fetch();

            const items: NotificationItem[] = logs.map((log) => ({
                id: log.id,
                title: log.title,
                body: log.body || '',
                type: log.type,
                createdAt: new Date(log.createdAt),
                wasRead: log.status === 'viewed' || log.status === 'responded' || log.status === 'dismissed',
            }));

            setNotifications(items);
        } catch (error) {
            console.error('[NotificationHistoryModal] Failed to load:', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (visible) {
            loadNotifications();
        }
    }, [visible, userId]);

    const markAsRead = async (notificationId: string) => {
        try {
            const logsCollection = database.get<NotificationLog>('notification_logs');
            const log = await logsCollection.find(notificationId);

            await database.write(async () => {
                await log.update((record) => {
                    record.status = 'viewed';
                    record.viewedAt = Date.now();
                });
            });

            // Refresh list
            loadNotifications();
        } catch (error) {
            console.error('[NotificationHistoryModal] Failed to mark as read:', error);
        }
    };

    const getNotificationIcon = (type: string): string => {
        switch (type) {
            case 'mandatory':
                return '⚠️';
            case 'warning':
                return '📋';
            case 'informational':
                return '💡';
            case 'system':
                return '⚙️';
            default:
                return '🔔';
        }
    };

    const formatTime = (date: Date): string => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };

    const filteredNotifications = notifications.filter((n) => {
        if (filter === 'unread') return !n.wasRead;
        return true;
    });

    const unreadCount = notifications.filter((n) => !n.wasRead).length;

    const renderNotification = ({ item }: { item: NotificationItem }) => (
        <TouchableOpacity
            className={`p-4 border-b border-gray-800 ${!item.wasRead ? 'bg-blue-900/20' : ''}`}
            onPress={() => !item.wasRead && markAsRead(item.id)}
        >
            <View className="flex-row">
                <Text className="text-2xl mr-3">{getNotificationIcon(item.type)}</Text>
                <View className="flex-1">
                    <View className="flex-row justify-between items-start">
                        <Text className={`font-semibold flex-1 ${!item.wasRead ? 'text-white' : 'text-gray-300'}`}>
                            {item.title}
                        </Text>
                        <Text className="text-gray-500 text-xs ml-2">
                            {formatTime(item.createdAt)}
                        </Text>
                    </View>
                    {item.body ? (
                        <Text className="text-gray-400 mt-1" numberOfLines={2}>
                            {item.body}
                        </Text>
                    ) : null}
                    {!item.wasRead && (
                        <View className="bg-blue-600 px-2 py-0.5 rounded-full self-start mt-2">
                            <Text className="text-white text-xs">Tap to mark read</Text>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 bg-black/50 justify-end">
                <View className="bg-gray-900 rounded-t-3xl h-[80%]">
                    {/* Header */}
                    <View className="flex-row justify-between items-center p-4 border-b border-gray-800">
                        <View className="flex-row items-center">
                            <Text className="text-xl font-bold text-white">Notifications</Text>
                            {unreadCount > 0 && (
                                <View className="bg-red-600 px-2 py-0.5 rounded-full ml-2">
                                    <Text className="text-white text-xs font-bold">{unreadCount}</Text>
                                </View>
                            )}
                        </View>
                        <TouchableOpacity onPress={onClose}>
                            <Text className="text-blue-400 text-lg">Close</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Filter Tabs */}
                    <View className="flex-row p-2 border-b border-gray-800">
                        <TouchableOpacity
                            className={`flex-1 py-2 rounded-lg mr-1 ${filter === 'all' ? 'bg-blue-600' : 'bg-gray-800'}`}
                            onPress={() => setFilter('all')}
                        >
                            <Text className="text-white text-center">
                                All ({notifications.length})
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className={`flex-1 py-2 rounded-lg ml-1 ${filter === 'unread' ? 'bg-blue-600' : 'bg-gray-800'}`}
                            onPress={() => setFilter('unread')}
                        >
                            <Text className="text-white text-center">
                                Unread ({unreadCount})
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Notification List */}
                    {loading ? (
                        <View className="flex-1 justify-center items-center">
                            <Text className="text-gray-400">Loading...</Text>
                        </View>
                    ) : filteredNotifications.length === 0 ? (
                        <View className="flex-1 justify-center items-center px-8">
                            <Text className="text-5xl mb-4">🔔</Text>
                            <Text className="text-gray-400 text-center text-lg">
                                {filter === 'unread'
                                    ? 'All caught up! No unread notifications.'
                                    : 'No notifications yet.'}
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={filteredNotifications}
                            renderItem={renderNotification}
                            keyExtractor={(item) => item.id}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
}
