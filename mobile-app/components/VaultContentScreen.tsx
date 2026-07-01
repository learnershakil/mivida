/**
 * VaultContentScreen
 * 
 * Full screen vault content viewer with:
 * - Grid view of images/videos
 * - Add new media from camera/gallery
 * - Add notes
 * - View/delete media
 */

import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Image,
    TextInput,
    Alert,
    Dimensions,
    FlatList,
} from 'react-native';
import VaultMedia from '../database/models/VaultMedia';
import * as vaultService from '../services/vaultService';

interface VaultContentScreenProps {
    visible: boolean;
    onClose: () => void;
    userId: string;
}

const { width } = Dimensions.get('window');
const ITEM_SIZE = (width - 48) / 3;

export default function VaultContentScreen({ visible, onClose, userId }: VaultContentScreenProps) {
    const [media, setMedia] = useState<VaultMedia[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedMedia, setSelectedMedia] = useState<VaultMedia | null>(null);
    const [showAddNote, setShowAddNote] = useState(false);
    const [noteText, setNoteText] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'images' | 'videos' | 'notes'>('all');

    const loadMedia = async () => {
        setLoading(true);
        try {
            const allMedia = await vaultService.getVaultMedia(userId);
            setMedia(allMedia);
        } catch (error) {
            console.error('[VaultContentScreen] Failed to load media:', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (visible) {
            loadMedia();
        }
    }, [visible, userId]);

    const handleAddFromGallery = async () => {
        Alert.alert(
            'Development Build Required',
            'Adding images from gallery requires a development build. Please run: npx expo prebuild && npx expo run:android',
            [{ text: 'OK' }]
        );
    };

    const handleAddFromCamera = async () => {
        Alert.alert(
            'Development Build Required',
            'Camera functionality requires a development build. Please run: npx expo prebuild && npx expo run:android',
            [{ text: 'OK' }]
        );
    };

    const handleAddNote = async () => {
        if (!noteText.trim()) {
            Alert.alert('Empty Note', 'Please enter some text');
            return;
        }

        try {
            // Notes are stored as media with a special "note" type marker in the note field
            await vaultService.addMedia({
                uri: 'note://',
                mediaType: 'image', // Using image type but URI indicates it's a note
                filename: `note_${Date.now()}`,
                note: noteText.trim(),
                userId,
            });
            setNoteText('');
            setShowAddNote(false);
            loadMedia();
            Alert.alert('Success', 'Note added to vault');
        } catch (error) {
            console.error('[VaultContentScreen] Failed to add note:', error);
            Alert.alert('Error', 'Failed to add note');
        }
    };

    const handleDeleteMedia = async (item: VaultMedia) => {
        Alert.alert(
            'Delete Item',
            'Are you sure you want to delete this item?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await vaultService.removeMedia(item.id, userId);
                            setSelectedMedia(null);
                            loadMedia();
                        } catch (error) {
                            console.error('[VaultContentScreen] Failed to delete:', error);
                            Alert.alert('Error', 'Failed to delete item');
                        }
                    },
                },
            ]
        );
    };

    const filteredMedia = media.filter((item) => {
        if (activeTab === 'all') return true;
        if (activeTab === 'notes') return item.uri.startsWith('note://');
        if (activeTab === 'images') return item.mediaType === 'image' && !item.uri.startsWith('note://');
        if (activeTab === 'videos') return item.mediaType === 'video';
        return true;
    });

    const renderMediaItem = ({ item }: { item: VaultMedia }) => {
        const isNote = item.uri.startsWith('note://');

        return (
            <TouchableOpacity
                onPress={() => setSelectedMedia(item)}
                style={{ width: ITEM_SIZE, height: ITEM_SIZE }}
                className="p-1"
            >
                {isNote ? (
                    <View className="flex-1 bg-yellow-500/20 rounded-lg p-2 justify-center">
                        <Text className="text-yellow-400 text-xs" numberOfLines={4}>
                            📝 {item.note}
                        </Text>
                    </View>
                ) : item.mediaType === 'video' ? (
                    <View className="flex-1 bg-gray-800 rounded-lg justify-center items-center">
                        <Text className="text-4xl">🎬</Text>
                        <Text className="text-gray-400 text-xs mt-1">Video</Text>
                    </View>
                ) : (
                    <Image
                        source={{ uri: item.uri }}
                        className="flex-1 rounded-lg"
                        resizeMode="cover"
                    />
                )}
            </TouchableOpacity>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 bg-black/50">
                <View className="flex-1 bg-gray-900 mt-12 rounded-t-3xl">
                    {/* Header */}
                    <View className="flex-row justify-between items-center p-4 border-b border-gray-800">
                        <Text className="text-xl font-bold text-white">🔐 Vault</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Text className="text-blue-400 text-lg">Lock</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Tab Filters */}
                    <View className="flex-row px-4 py-2">
                        {(['all', 'images', 'videos', 'notes'] as const).map((tab) => (
                            <TouchableOpacity
                                key={tab}
                                className={`px-4 py-2 rounded-full mr-2 ${activeTab === tab ? 'bg-blue-600' : 'bg-gray-800'}`}
                                onPress={() => setActiveTab(tab)}
                            >
                                <Text className="text-white capitalize">{tab}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Add Buttons */}
                    <View className="flex-row px-4 py-2 justify-between">
                        <TouchableOpacity
                            className="bg-green-600 px-4 py-3 rounded-xl flex-1 mr-2"
                            onPress={handleAddFromGallery}
                        >
                            <Text className="text-white text-center font-semibold">📁 Gallery</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className="bg-purple-600 px-4 py-3 rounded-xl flex-1 mr-2"
                            onPress={handleAddFromCamera}
                        >
                            <Text className="text-white text-center font-semibold">📷 Camera</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className="bg-yellow-600 px-4 py-3 rounded-xl flex-1"
                            onPress={() => setShowAddNote(true)}
                        >
                            <Text className="text-white text-center font-semibold">📝 Note</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Media Grid */}
                    {loading ? (
                        <View className="flex-1 justify-center items-center">
                            <Text className="text-gray-400">Loading vault...</Text>
                        </View>
                    ) : filteredMedia.length === 0 ? (
                        <View className="flex-1 justify-center items-center px-8">
                            <Text className="text-6xl mb-4">🔒</Text>
                            <Text className="text-gray-400 text-center text-lg">
                                Your vault is empty. Add photos, videos, or notes to keep them secure.
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={filteredMedia}
                            renderItem={renderMediaItem}
                            keyExtractor={(item) => item.id}
                            numColumns={3}
                            contentContainerStyle={{ padding: 12 }}
                        />
                    )}

                    {/* Add Note Modal */}
                    <Modal visible={showAddNote} animationType="fade" transparent>
                        <View className="flex-1 bg-black/80 justify-center p-6">
                            <View className="bg-gray-900 rounded-2xl p-6">
                                <Text className="text-xl font-bold text-white mb-4">Add Secret Note</Text>
                                <TextInput
                                    className="bg-gray-800 text-white p-4 rounded-xl mb-4"
                                    placeholder="Enter your secret note..."
                                    placeholderTextColor="#6b7280"
                                    value={noteText}
                                    onChangeText={setNoteText}
                                    multiline
                                    numberOfLines={6}
                                    textAlignVertical="top"
                                />
                                <View className="flex-row">
                                    <TouchableOpacity
                                        className="bg-gray-700 px-4 py-3 rounded-xl flex-1 mr-2"
                                        onPress={() => {
                                            setShowAddNote(false);
                                            setNoteText('');
                                        }}
                                    >
                                        <Text className="text-white text-center font-semibold">Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        className="bg-yellow-600 px-4 py-3 rounded-xl flex-1"
                                        onPress={handleAddNote}
                                    >
                                        <Text className="text-white text-center font-semibold">Save Note</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>

                    {/* Selected Media Viewer */}
                    <Modal visible={!!selectedMedia} animationType="fade" transparent>
                        <View className="flex-1 bg-black/95 justify-center">
                            {selectedMedia && (
                                <>
                                    <TouchableOpacity
                                        className="absolute top-12 right-4 z-10"
                                        onPress={() => setSelectedMedia(null)}
                                    >
                                        <Text className="text-white text-lg">✕ Close</Text>
                                    </TouchableOpacity>

                                    <View className="flex-1 justify-center p-4">
                                        {selectedMedia.uri.startsWith('note://') ? (
                                            <View className="bg-yellow-500/20 p-6 rounded-2xl">
                                                <Text className="text-yellow-400 text-lg">
                                                    {selectedMedia.note}
                                                </Text>
                                                <Text className="text-gray-500 text-sm mt-4">
                                                    Created: {new Date(selectedMedia.createdAt).toLocaleString()}
                                                </Text>
                                            </View>
                                        ) : selectedMedia.mediaType === 'video' ? (
                                            <View className="bg-gray-800 p-8 rounded-2xl items-center">
                                                <Text className="text-6xl mb-4">🎬</Text>
                                                <Text className="text-white text-lg">{selectedMedia.filename}</Text>
                                                <Text className="text-gray-400 mt-2">
                                                    Video playback coming soon
                                                </Text>
                                            </View>
                                        ) : (
                                            <Image
                                                source={{ uri: selectedMedia.uri }}
                                                className="w-full h-96 rounded-2xl"
                                                resizeMode="contain"
                                            />
                                        )}

                                        {selectedMedia.note && !selectedMedia.uri.startsWith('note://') && (
                                            <View className="bg-gray-800 p-4 rounded-xl mt-4">
                                                <Text className="text-gray-400 text-sm">Note:</Text>
                                                <Text className="text-white">{selectedMedia.note}</Text>
                                            </View>
                                        )}
                                    </View>

                                    <View className="p-4">
                                        <TouchableOpacity
                                            className="bg-red-600 px-4 py-4 rounded-xl"
                                            onPress={() => handleDeleteMedia(selectedMedia)}
                                        >
                                            <Text className="text-white text-center font-semibold">
                                                🗑️ Delete from Vault
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </View>
                    </Modal>
                </View>
            </View>
        </Modal>
    );
}
