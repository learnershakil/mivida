/**
 * VaultContentModal Component
 * 
 * Secure vault with three tabs: Notes, Media (images/videos), Audio (voice notes).
 * - Notes: Create and edit text notes
 * - Media: Add images and videos from gallery
 * - Audio: Record voice notes or add audio files, with playback controls
 * 
 * Privacy: Vault data is NOT logged. Only access attempts are logged.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    ScrollView,
    Image,
    Alert,
    StyleSheet,
    TextInput,
    Dimensions,
    FlatList,
} from 'react-native';
import {
    X, Plus, Trash2, Lock, Image as ImageIcon, Video, FileText,
    Mic, Play, Pause, Square, Edit2, ChevronLeft, ChevronRight,
    Music, Volume2, Download
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Audio, Video as ExpoVideo, ResizeMode } from 'expo-av';
import vaultService from '../services/vaultService';
import VaultMedia from '../database/models/VaultMedia';

interface VaultContentModalProps {
    visible: boolean;
    onClose: () => void;
    userId: string;
}

type TabType = 'notes' | 'media' | 'audio';

const { width } = Dimensions.get('window');
const imageSize = (width - 64) / 3;

export function VaultContentModal({ visible, onClose, userId }: VaultContentModalProps) {
    const [activeTab, setActiveTab] = useState<TabType>('notes');
    const [isLoading, setIsLoading] = useState(true);

    // Data states
    const [notes, setNotes] = useState<VaultMedia[]>([]);
    const [media, setMedia] = useState<VaultMedia[]>([]);
    const [audioFiles, setAudioFiles] = useState<VaultMedia[]>([]);

    // Note editor states
    const [showNoteEditor, setShowNoteEditor] = useState(false);
    const [editingNote, setEditingNote] = useState<VaultMedia | null>(null);
    const [noteTitle, setNoteTitle] = useState('');
    const [noteContent, setNoteContent] = useState('');
    // Decrypted title/content keyed by note id (notes are stored encrypted).
    const [noteText, setNoteText] = useState<Record<string, { title: string; content: string }>>({});

    // Media preview states
    const [selectedMedia, setSelectedMedia] = useState<VaultMedia | null>(null);

    // Long press context menu states
    const [contextMenuItem, setContextMenuItem] = useState<VaultMedia | null>(null);
    const [showContextMenu, setShowContextMenu] = useState(false);
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [renameValue, setRenameValue] = useState('');

    // Audio states
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
    const [playbackPosition, setPlaybackPosition] = useState(0);
    const [playbackDuration, setPlaybackDuration] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

    const recordingInterval = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (visible) {
            loadAllData();
        }
        return () => {
            if (sound) {
                sound.unloadAsync();
            }
            if (recording) {
                recording.stopAndUnloadAsync();
            }
        };
    }, [visible]);

    const loadAllData = async () => {
        setIsLoading(true);
        try {
            const [notesData, mediaData, audioData] = await Promise.all([
                vaultService.getNotes(userId),
                vaultService.getMedia(userId),
                vaultService.getAudio(userId),
            ]);
            // Decrypt note title/content for display (they are stored as AES ciphertext).
            const decrypted: Record<string, { title: string; content: string }> = {};
            await Promise.all(
                notesData.map(async (n) => {
                    decrypted[n.id] = {
                        title: await vaultService.decryptText(n.title),
                        content: await vaultService.decryptText(n.content),
                    };
                })
            );
            setNoteText(decrypted);
            setNotes(notesData);
            setMedia(mediaData);
            setAudioFiles(audioData);
        } catch (error) {
            console.error('Failed to load vault data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // ============================================
    // NOTES FUNCTIONS
    // ============================================

    const handleCreateNote = () => {
        setEditingNote(null);
        setNoteTitle('');
        setNoteContent('');
        setShowNoteEditor(true);
    };

    const handleEditNote = (note: VaultMedia) => {
        const decrypted = noteText[note.id] || { title: '', content: '' };
        setEditingNote(note);
        setNoteTitle(decrypted.title);
        setNoteContent(decrypted.content);
        setShowNoteEditor(true);
    };

    const handleSaveNote = async () => {
        if (!noteContent.trim()) {
            Alert.alert('Error', 'Note content cannot be empty');
            return;
        }

        try {
            if (editingNote) {
                await vaultService.updateNote(editingNote.id, noteTitle || undefined, noteContent, userId);
            } else {
                await vaultService.addNote({ title: noteTitle || undefined, content: noteContent, userId });
            }
            setShowNoteEditor(false);
            loadAllData();
        } catch (error) {
            console.error('Failed to save note:', error);
            Alert.alert('Error', 'Failed to save note');
        }
    };

    const handleDeleteNote = (note: VaultMedia) => {
        Alert.alert(
            'Delete Note',
            'This will permanently delete this note. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await vaultService.deleteItem(note.id, userId);
                            loadAllData();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete note');
                        }
                    },
                },
            ]
        );
    };

    // ============================================
    // LONG PRESS CONTEXT MENU FUNCTIONS
    // ============================================

    const handleLongPress = (item: VaultMedia) => {
        setContextMenuItem(item);
        setShowContextMenu(true);
    };

    const handleRenamePress = () => {
        if (!contextMenuItem) return;
        const currentName = contextMenuItem.title || contextMenuItem.filename || '';
        setRenameValue(currentName);
        setShowContextMenu(false);
        setShowRenameModal(true);
    };

    const handleRenameConfirm = async () => {
        if (!contextMenuItem || !renameValue.trim()) {
            Alert.alert('Error', 'Name cannot be empty');
            return;
        }

        try {
            await vaultService.renameItem(contextMenuItem.id, renameValue.trim(), userId);
            setShowRenameModal(false);
            setContextMenuItem(null);
            setRenameValue('');
            loadAllData();
        } catch (error) {
            console.error('Failed to rename item:', error);
            Alert.alert('Error', 'Failed to rename item');
        }
    };

    const handleDeleteFromContext = () => {
        if (!contextMenuItem) return;
        setShowContextMenu(false);

        const itemType = contextMenuItem.mediaType === 'note' ? 'note' :
            contextMenuItem.mediaType === 'audio' ? 'audio' : 'media';

        Alert.alert(
            `Delete ${itemType}`,
            `This will permanently delete this ${itemType}. Continue?`,
            [
                { text: 'Cancel', style: 'cancel', onPress: () => setContextMenuItem(null) },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            if (playingAudioId === contextMenuItem.id && sound) {
                                await sound.unloadAsync();
                                setPlayingAudioId(null);
                            }
                            await vaultService.deleteItem(contextMenuItem.id, userId);
                            setContextMenuItem(null);
                            loadAllData();
                        } catch (error) {
                            Alert.alert('Error', `Failed to delete ${itemType}`);
                        }
                    },
                },
            ]
        );
    };

    const handleSaveToDevice = async () => {
        if (!contextMenuItem) return;
        setShowContextMenu(false);

        try {
            const uri = contextMenuItem.uri;
            if (!uri) {
                Alert.alert('Error', 'File not found');
                return;
            }

            // Check if file exists
            const fileInfo = await FileSystem.getInfoAsync(uri);
            if (!fileInfo.exists) {
                Alert.alert('Error', 'File not found on device');
                return;
            }

            // Check if sharing is available
            const isAvailable = await Sharing.isAvailableAsync();
            if (!isAvailable) {
                Alert.alert('Error', 'Sharing is not available on this device');
                return;
            }

            // Use share dialog to let user save to their desired location
            await Sharing.shareAsync(uri, {
                dialogTitle: 'Save to Device',
            });

            setContextMenuItem(null);
        } catch (error) {
            console.error('Failed to save to device:', error);
            Alert.alert('Error', 'Failed to save file to device');
            setContextMenuItem(null);
        }
    };

    // ============================================
    // MEDIA FUNCTIONS
    // ============================================

    const handleAddMedia = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Please grant access to your photo library.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images', 'videos'],
                allowsEditing: false,
                quality: 1,
            });

            if (!result.canceled && result.assets?.[0]) {
                const asset = result.assets[0];
                await vaultService.addMedia({
                    uri: asset.uri,
                    mediaType: asset.type === 'video' ? 'video' : 'image',
                    filename: asset.fileName || `vault_${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
                    userId,
                });
                loadAllData();
            }
        } catch (error) {
            console.error('Failed to add media:', error);
            Alert.alert('Error', 'Failed to add media');
        }
    };

    const handleDeleteMedia = (item: VaultMedia) => {
        Alert.alert(
            'Delete Media',
            'This will permanently delete this file. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await vaultService.deleteItem(item.id, userId);
                            setSelectedMedia(null);
                            loadAllData();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete media');
                        }
                    },
                },
            ]
        );
    };

    // ============================================
    // AUDIO FUNCTIONS
    // ============================================

    const startRecording = async () => {
        try {
            const { status } = await Audio.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Please grant microphone access.');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording: newRecording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            setRecording(newRecording);
            setIsRecording(true);
            setRecordingDuration(0);

            recordingInterval.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } catch (error) {
            console.error('Failed to start recording:', error);
            Alert.alert('Error', 'Failed to start recording');
        }
    };

    const stopRecording = async () => {
        if (!recording) return;

        try {
            if (recordingInterval.current) {
                clearInterval(recordingInterval.current);
            }

            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();

            setRecording(null);
            setIsRecording(false);

            if (uri) {
                await vaultService.addAudio({
                    uri,
                    filename: `recording_${Date.now()}.m4a`,
                    title: `Voice Note ${new Date().toLocaleDateString()}`,
                    duration: recordingDuration * 1000,
                    userId,
                });
                loadAllData();
            }
        } catch (error) {
            console.error('Failed to stop recording:', error);
            Alert.alert('Error', 'Failed to save recording');
        }
    };

    const handleAddAudioFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'audio/*',
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets?.[0]) {
                const asset = result.assets[0];
                await vaultService.addAudio({
                    uri: asset.uri,
                    filename: asset.name,
                    title: asset.name.replace(/\.[^/.]+$/, ''),
                    userId,
                });
                loadAllData();
            }
        } catch (error) {
            console.error('Failed to add audio file:', error);
            Alert.alert('Error', 'Failed to add audio file');
        }
    };

    const playAudio = async (audio: VaultMedia) => {
        try {
            if (sound) {
                await sound.unloadAsync();
            }

            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: audio.uri! },
                { shouldPlay: true, rate: playbackSpeed },
                onPlaybackStatusUpdate
            );

            setSound(newSound);
            setPlayingAudioId(audio.id);
        } catch (error) {
            console.error('Failed to play audio:', error);
            Alert.alert('Error', 'Failed to play audio');
        }
    };

    const onPlaybackStatusUpdate = (status: any) => {
        if (status.isLoaded) {
            setPlaybackPosition(status.positionMillis || 0);
            setPlaybackDuration(status.durationMillis || 0);

            if (status.didJustFinish) {
                setPlayingAudioId(null);
                setPlaybackPosition(0);
            }
        }
    };

    const pauseAudio = async () => {
        if (sound) {
            await sound.pauseAsync();
            setPlayingAudioId(null);
        }
    };

    const changePlaybackSpeed = async () => {
        const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
        const currentIndex = speeds.indexOf(playbackSpeed);
        const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
        setPlaybackSpeed(nextSpeed);

        if (sound) {
            await sound.setRateAsync(nextSpeed, true);
        }
    };

    const handleDeleteAudio = (audio: VaultMedia) => {
        Alert.alert(
            'Delete Audio',
            'This will permanently delete this recording. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            if (playingAudioId === audio.id && sound) {
                                await sound.unloadAsync();
                                setPlayingAudioId(null);
                            }
                            await vaultService.deleteItem(audio.id, userId);
                            loadAllData();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete audio');
                        }
                    },
                },
            ]
        );
    };

    const formatDuration = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    // ============================================
    // RENDER FUNCTIONS
    // ============================================

    const renderNotesTab = () => (
        <View style={styles.tabContent}>
            <TouchableOpacity onPress={handleCreateNote} style={styles.addButton}>
                <Plus size={20} color="white" />
                <Text style={styles.addButtonText}>New Note</Text>
            </TouchableOpacity>

            {notes.length === 0 ? (
                <View style={styles.emptyState}>
                    <FileText size={48} color="#9CA3AF" />
                    <Text style={styles.emptyTitle}>No Notes Yet</Text>
                    <Text style={styles.emptySubtitle}>Tap the button above to create your first private note</Text>
                </View>
            ) : (
                <ScrollView style={styles.notesList} showsVerticalScrollIndicator={false}>
                    {notes.map(note => (
                        <TouchableOpacity
                            key={note.id}
                            style={styles.noteCard}
                            onPress={() => handleEditNote(note)}
                            onLongPress={() => handleLongPress(note)}
                            delayLongPress={500}
                        >
                            <View style={styles.noteHeader}>
                                <Text style={styles.noteTitle} numberOfLines={1}>
                                    {noteText[note.id]?.title || 'Untitled Note'}
                                </Text>
                                <TouchableOpacity onPress={() => handleDeleteNote(note)}>
                                    <Trash2 size={18} color="#EF4444" />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.notePreview} numberOfLines={3}>{noteText[note.id]?.content || ''}</Text>
                            <Text style={styles.noteDate}>
                                {new Date(note.createdAt).toLocaleDateString()}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}
        </View>
    );

    const renderMediaTab = () => (
        <View style={styles.tabContent}>
            <TouchableOpacity onPress={handleAddMedia} style={styles.addButton}>
                <Plus size={20} color="white" />
                <Text style={styles.addButtonText}>Add Photo/Video</Text>
            </TouchableOpacity>

            {media.length === 0 ? (
                <View style={styles.emptyState}>
                    <ImageIcon size={48} color="#9CA3AF" />
                    <Text style={styles.emptyTitle}>No Media Yet</Text>
                    <Text style={styles.emptySubtitle}>Add photos and videos from your gallery</Text>
                </View>
            ) : (
                <View style={styles.mediaGrid}>
                    {media.map(item => (
                        <TouchableOpacity
                            key={item.id}
                            style={styles.mediaItemContainer}
                            onPress={() => setSelectedMedia(item)}
                            onLongPress={() => handleLongPress(item)}
                            delayLongPress={500}
                        >
                            <View style={styles.mediaItem}>
                                {item.mediaType === 'image' ? (
                                    <Image source={{ uri: item.uri }} style={styles.mediaThumbnail} />
                                ) : (
                                    <View style={[styles.mediaThumbnail, styles.videoThumbnail]}>
                                        <Video size={32} color="white" />
                                    </View>
                                )}
                                {/* Media type badge */}
                                {item.mediaType === 'video' && (
                                    <View style={styles.mediaTypeBadge}>
                                        <Video size={12} color="white" />
                                    </View>
                                )}
                            </View>
                            <Text style={styles.mediaItemName} numberOfLines={1}>
                                {item.title || item.filename || 'Untitled'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );

    const renderAudioTab = () => (
        <View style={styles.tabContent}>
            <View style={styles.audioActions}>
                <TouchableOpacity
                    onPress={isRecording ? stopRecording : startRecording}
                    style={[styles.recordButton, isRecording && styles.recordingActive]}
                >
                    {isRecording ? (
                        <>
                            <Square size={20} color="white" />
                            <Text style={styles.recordButtonText}>
                                Stop ({formatDuration(recordingDuration * 1000)})
                            </Text>
                        </>
                    ) : (
                        <>
                            <Mic size={20} color="white" />
                            <Text style={styles.recordButtonText}>Record</Text>
                        </>
                    )}
                </TouchableOpacity>
                <TouchableOpacity onPress={handleAddAudioFile} style={styles.addAudioButton}>
                    <Music size={20} color="#1E1E1E" />
                    <Text style={styles.addAudioButtonText}>Add File</Text>
                </TouchableOpacity>
            </View>

            {audioFiles.length === 0 ? (
                <View style={styles.emptyState}>
                    <Mic size={48} color="#9CA3AF" />
                    <Text style={styles.emptyTitle}>No Voice Notes</Text>
                    <Text style={styles.emptySubtitle}>Record or add audio files</Text>
                </View>
            ) : (
                <ScrollView style={styles.audioList} showsVerticalScrollIndicator={false}>
                    {audioFiles.map(audio => {
                        const isPlaying = playingAudioId === audio.id;
                        return (
                            <TouchableOpacity
                                key={audio.id}
                                style={styles.audioCard}
                                onLongPress={() => handleLongPress(audio)}
                                delayLongPress={500}
                                activeOpacity={0.8}
                            >
                                <TouchableOpacity
                                    onPress={() => isPlaying ? pauseAudio() : playAudio(audio)}
                                    style={styles.playButton}
                                >
                                    {isPlaying ? (
                                        <Pause size={24} color="white" />
                                    ) : (
                                        <Play size={24} color="white" />
                                    )}
                                </TouchableOpacity>
                                <View style={styles.audioInfo}>
                                    <Text style={styles.audioTitle} numberOfLines={1}>
                                        {audio.title || audio.filename || 'Voice Note'}
                                    </Text>
                                    {isPlaying ? (
                                        <View style={styles.progressContainer}>
                                            <View style={styles.progressBar}>
                                                <View
                                                    style={[
                                                        styles.progressFill,
                                                        { width: `${(playbackPosition / playbackDuration) * 100}%` }
                                                    ]}
                                                />
                                            </View>
                                            <Text style={styles.audioTime}>
                                                {formatDuration(playbackPosition)} / {formatDuration(playbackDuration)}
                                            </Text>
                                        </View>
                                    ) : (
                                        <Text style={styles.audioDuration}>
                                            {audio.duration ? formatDuration(audio.duration) : 'Unknown'}
                                        </Text>
                                    )}
                                </View>
                                {isPlaying && (
                                    <TouchableOpacity onPress={changePlaybackSpeed} style={styles.speedButton}>
                                        <Text style={styles.speedText}>{playbackSpeed}x</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity onPress={() => handleDeleteAudio(audio)}>
                                    <Trash2 size={18} color="#EF4444" />
                                </TouchableOpacity>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            )}
        </View>
    );

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Lock size={24} color="#1E1E1E" />
                        <Text style={styles.headerTitle}>Secure Vault</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <X size={20} color="black" />
                    </TouchableOpacity>
                </View>

                {/* Tabs */}
                <View style={styles.tabBar}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'notes' && styles.activeTab]}
                        onPress={() => setActiveTab('notes')}
                    >
                        <FileText size={18} color={activeTab === 'notes' ? '#1E1E1E' : '#9CA3AF'} />
                        <Text style={[styles.tabText, activeTab === 'notes' && styles.activeTabText]}>
                            Notes ({notes.length})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'media' && styles.activeTab]}
                        onPress={() => setActiveTab('media')}
                    >
                        <ImageIcon size={18} color={activeTab === 'media' ? '#1E1E1E' : '#9CA3AF'} />
                        <Text style={[styles.tabText, activeTab === 'media' && styles.activeTabText]}>
                            Media ({media.length})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'audio' && styles.activeTab]}
                        onPress={() => setActiveTab('audio')}
                    >
                        <Mic size={18} color={activeTab === 'audio' ? '#1E1E1E' : '#9CA3AF'} />
                        <Text style={[styles.tabText, activeTab === 'audio' && styles.activeTabText]}>
                            Audio ({audioFiles.length})
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Content */}
                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <Text style={styles.loadingText}>Loading vault...</Text>
                    </View>
                ) : (
                    <>
                        {activeTab === 'notes' && renderNotesTab()}
                        {activeTab === 'media' && renderMediaTab()}
                        {activeTab === 'audio' && renderAudioTab()}
                    </>
                )}

                {/* Note Editor Modal */}
                <Modal visible={showNoteEditor} animationType="slide" onRequestClose={() => setShowNoteEditor(false)}>
                    <View style={styles.editorContainer}>
                        <View style={styles.editorHeader}>
                            <TouchableOpacity onPress={() => setShowNoteEditor(false)}>
                                <X size={24} color="#1E1E1E" />
                            </TouchableOpacity>
                            <Text style={styles.editorTitle}>
                                {editingNote ? 'Edit Note' : 'New Note'}
                            </Text>
                            <TouchableOpacity onPress={handleSaveNote}>
                                <Text style={styles.saveButton}>Save</Text>
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={styles.noteTitleInput}
                            value={noteTitle}
                            onChangeText={setNoteTitle}
                            placeholder="Title (optional)"
                            placeholderTextColor="#9CA3AF"
                        />
                        <TextInput
                            style={styles.noteContentInput}
                            value={noteContent}
                            onChangeText={setNoteContent}
                            placeholder="Write your note..."
                            placeholderTextColor="#9CA3AF"
                            multiline
                            textAlignVertical="top"
                        />
                    </View>
                </Modal>

                {/* Media Preview Modal */}
                <Modal
                    visible={!!selectedMedia}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setSelectedMedia(null)}
                >
                    <View style={styles.previewOverlay}>
                        <View style={styles.previewContainer}>
                            {selectedMedia?.mediaType === 'image' && (
                                <Image
                                    source={{ uri: selectedMedia.uri }}
                                    style={styles.previewImage}
                                    resizeMode="contain"
                                />
                            )}
                            {selectedMedia?.mediaType === 'video' && selectedMedia.uri && (
                                <ExpoVideo
                                    source={{ uri: selectedMedia.uri }}
                                    style={styles.previewVideo}
                                    useNativeControls
                                    resizeMode={ResizeMode.CONTAIN}
                                    shouldPlay={true}
                                    isLooping={false}
                                />
                            )}
                            <TouchableOpacity
                                onPress={() => setSelectedMedia(null)}
                                style={styles.previewClose}
                            >
                                <X size={24} color="white" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* Context Menu Modal */}
                <Modal
                    visible={showContextMenu}
                    transparent
                    animationType="fade"
                    onRequestClose={() => {
                        setShowContextMenu(false);
                        setContextMenuItem(null);
                    }}
                >
                    <TouchableOpacity
                        style={styles.contextMenuOverlay}
                        activeOpacity={1}
                        onPress={() => {
                            setShowContextMenu(false);
                            setContextMenuItem(null);
                        }}
                    >
                        <View style={styles.contextMenuContainer}>
                            <Text style={styles.contextMenuTitle} numberOfLines={1}>
                                {contextMenuItem?.title || contextMenuItem?.filename || 'Item'}
                            </Text>
                            <TouchableOpacity
                                style={styles.contextMenuOption}
                                onPress={handleRenamePress}
                            >
                                <Edit2 size={20} color="#374151" />
                                <Text style={styles.contextMenuOptionText}>Rename</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.contextMenuOption}
                                onPress={handleSaveToDevice}
                            >
                                <Download size={20} color="#374151" />
                                <Text style={styles.contextMenuOptionText}>Save to Device</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.contextMenuOption, styles.contextMenuOptionDanger]}
                                onPress={handleDeleteFromContext}
                            >
                                <Trash2 size={20} color="#EF4444" />
                                <Text style={[styles.contextMenuOptionText, styles.contextMenuOptionTextDanger]}>Delete</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.contextMenuCancel}
                                onPress={() => {
                                    setShowContextMenu(false);
                                    setContextMenuItem(null);
                                }}
                            >
                                <Text style={styles.contextMenuCancelText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </Modal>

                {/* Rename Modal */}
                <Modal
                    visible={showRenameModal}
                    transparent
                    animationType="fade"
                    onRequestClose={() => {
                        setShowRenameModal(false);
                        setContextMenuItem(null);
                    }}
                >
                    <View style={styles.renameOverlay}>
                        <View style={styles.renameContainer}>
                            <Text style={styles.renameTitle}>Rename</Text>
                            <TextInput
                                style={styles.renameInput}
                                value={renameValue}
                                onChangeText={setRenameValue}
                                placeholder="Enter new name"
                                placeholderTextColor="#9CA3AF"
                                autoFocus
                            />
                            <View style={styles.renameButtons}>
                                <TouchableOpacity
                                    style={styles.renameCancelButton}
                                    onPress={() => {
                                        setShowRenameModal(false);
                                        setContextMenuItem(null);
                                    }}
                                >
                                    <Text style={styles.renameCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.renameConfirmButton}
                                    onPress={handleRenameConfirm}
                                >
                                    <Text style={styles.renameConfirmText}>Rename</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FC',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 60,
        paddingBottom: 16,
        backgroundColor: 'white',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerTitle: {
        fontSize: 20,
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
    tabBar: {
        flexDirection: 'row',
        backgroundColor: 'white',
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 8,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
    },
    activeTab: {
        backgroundColor: '#C0F67F',
    },
    tabText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#9CA3AF',
    },
    activeTabText: {
        color: '#1E1E1E',
    },
    tabContent: {
        flex: 1,
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: '#9CA3AF',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#1E1E1E',
        paddingVertical: 14,
        borderRadius: 16,
        marginBottom: 16,
    },
    addButtonText: {
        color: 'white',
        fontWeight: '600',
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 16,
        color: '#374151',
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#9CA3AF',
        marginTop: 8,
        textAlign: 'center',
    },
    // Notes styles
    notesList: {
        flex: 1,
    },
    noteCard: {
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
    },
    noteHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    noteTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        flex: 1,
    },
    notePreview: {
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
    },
    noteDate: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 12,
    },
    // Media styles
    mediaGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    mediaItemContainer: {
        width: imageSize,
        marginBottom: 8,
    },
    mediaItem: {
        width: imageSize,
        height: imageSize,
        borderRadius: 12,
        overflow: 'hidden',
    },
    mediaThumbnail: {
        width: '100%',
        height: '100%',
    },
    mediaItemName: {
        fontSize: 11,
        color: '#374151',
        marginTop: 4,
        textAlign: 'center',
    },
    mediaTypeBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 4,
        padding: 4,
    },
    videoThumbnail: {
        backgroundColor: '#1E1E1E',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Audio styles
    audioActions: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    recordButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#EF4444',
        paddingVertical: 14,
        borderRadius: 16,
    },
    recordingActive: {
        backgroundColor: '#DC2626',
    },
    recordButtonText: {
        color: 'white',
        fontWeight: '600',
    },
    addAudioButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#F3F4F6',
        paddingVertical: 14,
        borderRadius: 16,
    },
    addAudioButtonText: {
        fontWeight: '600',
        color: '#1E1E1E',
    },
    audioList: {
        flex: 1,
    },
    audioCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: 12,
        borderRadius: 16,
        marginBottom: 12,
        gap: 12,
    },
    playButton: {
        height: 48,
        width: 48,
        backgroundColor: '#1E1E1E',
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    audioInfo: {
        flex: 1,
    },
    audioTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
    },
    audioDuration: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    progressContainer: {
        gap: 4,
    },
    progressBar: {
        height: 4,
        backgroundColor: '#E5E7EB',
        borderRadius: 2,
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#C0F67F',
        borderRadius: 2,
    },
    audioTime: {
        fontSize: 10,
        color: '#9CA3AF',
    },
    speedButton: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    speedText: {
        fontSize: 12,
        fontWeight: '600',
    },
    // Editor styles
    editorContainer: {
        flex: 1,
        backgroundColor: 'white',
    },
    editorHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 60,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    editorTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    saveButton: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#10B981',
    },
    noteTitleInput: {
        fontSize: 20,
        fontWeight: 'bold',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    noteContentInput: {
        flex: 1,
        fontSize: 16,
        paddingHorizontal: 24,
        paddingVertical: 16,
        lineHeight: 24,
    },
    // Preview styles
    previewOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewContainer: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    previewImage: {
        width: '100%',
        height: '70%',
        borderRadius: 16,
    },
    previewVideo: {
        width: '110%',
        height: '79%',
        backgroundColor: '#1E1E1E',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewVideoText: {
        color: 'white',
        marginTop: 16,
    },
    previewActions: {
        marginTop: 24,
    },
    deletePreviewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#EF4444',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 24,
    },
    deletePreviewText: {
        color: 'white',
        fontWeight: '600',
    },
    previewClose: {
        position: 'absolute',
        top: 60,
        right: 24,
        height: 44,
        width: 44,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewNameContainer: {
        position: 'absolute',
        bottom: 80,
        left: 24,
        right: 24,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    previewMediaName: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
    // Context Menu Styles
    contextMenuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    contextMenuContainer: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
    },
    contextMenuTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#374151',
        marginBottom: 20,
        textAlign: 'center',
    },
    contextMenuOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    contextMenuOptionText: {
        fontSize: 16,
        color: '#374151',
    },
    contextMenuOptionDanger: {
        borderBottomWidth: 0,
    },
    contextMenuOptionTextDanger: {
        color: '#EF4444',
    },
    contextMenuCancel: {
        marginTop: 16,
        paddingVertical: 14,
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        alignItems: 'center',
    },
    contextMenuCancelText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6B7280',
    },
    // Rename Modal Styles
    renameOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    renameContainer: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 340,
    },
    renameTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 16,
    },
    renameInput: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        color: '#374151',
        marginBottom: 20,
    },
    renameButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    renameCancelButton: {
        flex: 1,
        paddingVertical: 14,
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        alignItems: 'center',
    },
    renameCancelText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6B7280',
    },
    renameConfirmButton: {
        flex: 1,
        paddingVertical: 14,
        backgroundColor: '#1E1E1E',
        borderRadius: 12,
        alignItems: 'center',
    },
    renameConfirmText: {
        fontSize: 16,
        fontWeight: '600',
        color: 'white',
    },
});

export default VaultContentModal;
