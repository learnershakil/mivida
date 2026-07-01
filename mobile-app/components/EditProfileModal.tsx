/**
 * EditProfileModal
 * 
 * Allows editing user profile: name and photo
 */

import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Image,
    Alert,
    ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { database } from '../database';
import User from '../database/models/User';
import { Q } from '@nozbe/watermelondb';
import { emitEvent, EventTypes } from '../services/eventLogger';

interface EditProfileModalProps {
    visible: boolean;
    onClose: () => void;
    userId: string;
    currentName: string;
    currentAvatar?: string;
}

export function EditProfileModal({
    visible,
    onClose,
    userId,
    currentName,
    currentAvatar,
}: EditProfileModalProps) {
    const [name, setName] = useState(currentName);
    const [avatar, setAvatar] = useState(currentAvatar || '');
    const [saving, setSaving] = useState(false);
    const [pickingImage, setPickingImage] = useState(false);

    useEffect(() => {
        setName(currentName);
        setAvatar(currentAvatar || '');
    }, [currentName, currentAvatar, visible]);

    // Request permissions and pick image from gallery
    const handlePickImage = async () => {
        try {
            setPickingImage(true);

            // Request permission
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (!permissionResult.granted) {
                Alert.alert(
                    'Permission Required',
                    'Please allow access to your photo library to select a profile picture.',
                    [{ text: 'OK' }]
                );
                setPickingImage(false);
                return;
            }

            // Launch image picker
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                const selectedUri = result.assets[0].uri;
                // Copy to app's document directory for persistence
                const fileName = `profile_${userId}_${Date.now()}.jpg`;
                const newPath = `${FileSystem.documentDirectory}${fileName}`;

                await FileSystem.copyAsync({
                    from: selectedUri,
                    to: newPath,
                });

                setAvatar(newPath);
            }
        } catch (error) {
            console.error('[EditProfileModal] Image pick failed:', error);
            Alert.alert('Error', 'Failed to select image. Please try again.');
        } finally {
            setPickingImage(false);
        }
    };

    // Request permissions and take photo with camera
    const handleTakePhoto = async () => {
        try {
            setPickingImage(true);

            // Request camera permission
            const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

            if (!permissionResult.granted) {
                Alert.alert(
                    'Permission Required',
                    'Please allow access to your camera to take a profile picture.',
                    [{ text: 'OK' }]
                );
                setPickingImage(false);
                return;
            }

            // Launch camera
            const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                const selectedUri = result.assets[0].uri;
                // Copy to app's document directory for persistence
                const fileName = `profile_${userId}_${Date.now()}.jpg`;
                const newPath = `${FileSystem.documentDirectory}${fileName}`;

                await FileSystem.copyAsync({
                    from: selectedUri,
                    to: newPath,
                });

                setAvatar(newPath);
            }
        } catch (error) {
            console.error('[EditProfileModal] Camera capture failed:', error);
            Alert.alert('Error', 'Failed to take photo. Please try again.');
        } finally {
            setPickingImage(false);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert('Name Required', 'Please enter your name');
            return;
        }

        setSaving(true);
        try {
            const usersCollection = database.get<User>('users');
            const users = await usersCollection.query(Q.where('id', userId)).fetch();

            if (users.length > 0) {
                const user = users[0];
                await database.write(async () => {
                    await user.update((record) => {
                        record.name = name.trim();
                        if (avatar) {
                            record.avatarUrl = avatar;
                        }
                    });
                });
            }

            await emitEvent({
                eventType: EventTypes.SETTINGS_UPDATED,
                entityType: 'user',
                entityId: userId,
                payload: { name: name.trim(), avatarUpdated: !!avatar },
                userId,
            });

            onClose();
        } catch (error) {
            console.error('[EditProfileModal] Save failed:', error);
            Alert.alert('Error', 'Failed to save profile');
        }
        setSaving(false);
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 bg-black/50 justify-end">
                <View className="bg-[#FDFCF8] rounded-t-3xl">
                    {/* Header */}
                    <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
                        <Text className="text-xl font-bold text-[#1E1E1E]">Edit Profile</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Text className="text-gray-500 text-lg">Cancel</Text>
                        </TouchableOpacity>
                    </View>

                    <View className="p-6">
                        {/* Avatar Section */}
                        <View className="items-center mb-6">
                            <TouchableOpacity onPress={handlePickImage} disabled={pickingImage}>
                                <View className="relative">
                                    {avatar ? (
                                        <Image
                                            source={{ uri: avatar }}
                                            className="w-28 h-28 rounded-full bg-gray-200"
                                        />
                                    ) : (
                                        <View className="w-28 h-28 rounded-full bg-[#4AC3FF] justify-center items-center">
                                            <Text className="text-white text-5xl font-bold">
                                                {name.charAt(0).toUpperCase() || 'U'}
                                            </Text>
                                        </View>
                                    )}
                                    {pickingImage && (
                                        <View className="absolute inset-0 bg-black/50 rounded-full items-center justify-center">
                                            <ActivityIndicator color="white" />
                                        </View>
                                    )}
                                </View>
                            </TouchableOpacity>

                            <View className="flex-row mt-4 gap-2">
                                <TouchableOpacity
                                    className="bg-[#1E1E1E] px-5 py-3 rounded-xl flex-row items-center gap-2"
                                    onPress={handlePickImage}
                                    disabled={pickingImage}
                                >
                                    <Text className="text-lg">📁</Text>
                                    <Text className="text-white font-medium">Gallery</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    className="bg-[#1E1E1E] px-5 py-3 rounded-xl flex-row items-center gap-2"
                                    onPress={handleTakePhoto}
                                    disabled={pickingImage}
                                >
                                    <Text className="text-lg">📷</Text>
                                    <Text className="text-white font-medium">Camera</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Name Input */}
                        <Text className="text-gray-500 mb-2 font-medium">Display Name</Text>
                        <TextInput
                            className="bg-white text-[#1E1E1E] p-4 rounded-xl mb-6 text-lg border border-gray-200"
                            placeholder="Your name"
                            placeholderTextColor="#9CA3AF"
                            value={name}
                            onChangeText={setName}
                            autoCapitalize="words"
                        />

                        {/* Save Button */}
                        <TouchableOpacity
                            className={`p-4 rounded-xl ${saving ? 'bg-gray-400' : 'bg-[#34C759]'}`}
                            onPress={handleSave}
                            disabled={saving || pickingImage}
                        >
                            <Text className="text-white text-center font-bold text-lg">
                                {saving ? 'Saving...' : 'Save Changes'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

export default EditProfileModal;