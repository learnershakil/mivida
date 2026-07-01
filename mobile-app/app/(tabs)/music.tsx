import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, Modal, TextInput, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Heart, Play, Pause, SkipBack, SkipForward, Repeat, Shuffle, ListMusic, Plus, Trash2, Edit3, Music, X, Check, FolderOpen, MoreVertical, Settings, GripVertical, ImagePlus, Palette } from 'lucide-react-native';
import { withObservables } from '@nozbe/watermelondb/react';
import { Q } from '@nozbe/watermelondb';
import { AVPlaybackStatus } from 'expo-av';
import { database } from '../../database';
import User from '../../database/models/User';
import MusicTrack from '../../database/models/MusicTrack';
import MusicCategory from '../../database/models/MusicCategory';
import { emitEvent, EventTypes } from '../../services/eventLogger';
import { initializeUser } from '../../services/userService';
import {
   pickAudioFiles,
   addTrackToLibrary,
   deleteTrack,
   toggleFavorite as toggleFavoriteService,
   incrementPlayCount,
   updateTrack,
   musicPlayer,
   pickAlbumArt,
   updateTrackAlbumArt,
   initializeCategories,
   addCategory,
   updateCategory,
   deleteCategory as deleteCategoryService,
   reorderCategories,
   updateCategoryArt,
   DEFAULT_ALBUM_ARTS,
} from '../../services/musicService';

// Fallback default album art
const FALLBACK_ALBUM_ART = 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?q=80&w=300';

// Default color palette for categories
const CATEGORY_COLORS = [
   '#4AC3FF', '#9B59B6', '#E74C3C', '#3498DB', '#2ECC71',
   '#F39C12', '#1ABC9C', '#E91E63', '#FF5722', '#607D8B',
];

// Default icons for categories
const CATEGORY_ICONS = ['🎯', '🌧️', '🔥', '😴', '🎵', '💪', '🧘', '📚', '🎮', '💼'];

interface MusicScreenProps {
   users: User[];
   tracks: MusicTrack[];
   categories: MusicCategory[];
}

function MusicScreen({ users, tracks, categories }: MusicScreenProps) {
   const [isPlaying, setIsPlaying] = useState(false);
   const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
   const [progress, setProgress] = useState(0);
   const [elapsed, setElapsed] = useState(0);
   const [shuffle, setShuffle] = useState(false);
   const [repeat, setRepeat] = useState(false);
   const [filter, setFilter] = useState<string>('all');
   const [isLoading, setIsLoading] = useState(true);
   const [isAdding, setIsAdding] = useState(false);

   // Modal states
   const [showAddModal, setShowAddModal] = useState(false);
   const [showEditModal, setShowEditModal] = useState(false);
   const [showOptionsModal, setShowOptionsModal] = useState(false);
   const [showCategoryModal, setShowCategoryModal] = useState(false);
   const [showCategoryEditModal, setShowCategoryEditModal] = useState(false);
   const [selectedTrack, setSelectedTrack] = useState<MusicTrack | null>(null);
   const [selectedCategory, setSelectedCategory] = useState<MusicCategory | null>(null);

   // Edit form states
   const [editTitle, setEditTitle] = useState('');
   const [editArtist, setEditArtist] = useState('');
   const [editCategory, setEditCategory] = useState<string>('other');
   const [editAlbumArt, setEditAlbumArt] = useState<string | null>(null);

   // Category edit form states
   const [catEditName, setCatEditName] = useState('');
   const [catEditIcon, setCatEditIcon] = useState('🎵');
   const [catEditColor, setCatEditColor] = useState('#8E8E93');
   const [catEditArt, setCatEditArt] = useState<string | null>(null);

   // Pending files for add modal
   const [pendingFiles, setPendingFiles] = useState<{ uri: string; name: string; title: string; artist: string; category: string; albumArt: string | null }[]>([]);

   const user = users[0];
   const userId = user?.id || 'local_user';

   // Sort categories by position
   const sortedCategories = [...categories].sort((a, b) => a.position - b.position);

   // Get category names for filtering
   const categoryNames = sortedCategories.map(c => c.name.toLowerCase());

   // Filter tracks based on category
   const filteredTracks = filter === 'all'
      ? tracks
      : filter === 'favorites'
         ? tracks.filter(t => t.isFavorite)
         : tracks.filter(t => t.category === filter);

   const currentTrack = filteredTracks[currentTrackIndex];

   // Use refs to avoid circular dependencies in callbacks
   const repeatRef = useRef(repeat);
   const shuffleRef = useRef(shuffle);
   const filteredTracksRef = useRef(filteredTracks);
   const currentTrackIndexRef = useRef(currentTrackIndex);

   useEffect(() => {
      repeatRef.current = repeat;
      shuffleRef.current = shuffle;
      filteredTracksRef.current = filteredTracks;
      currentTrackIndexRef.current = currentTrackIndex;
   }, [repeat, shuffle, filteredTracks, currentTrackIndex]);

   useEffect(() => {
      const init = async () => {
         await initializeUser();
         // Initialize default categories if none exist
         await initializeCategories(userId);
         setIsLoading(false);
      };
      init();
   }, [userId]);

   const playTrackByIndex = useCallback(async (index: number) => {
      const track = filteredTracksRef.current[index];
      if (!track) return;

      setCurrentTrackIndex(index);
      setElapsed(0);
      setProgress(0);

      const loaded = await musicPlayer.loadTrack(track);
      if (loaded) {
         await musicPlayer.play();
         setIsPlaying(true);

         await incrementPlayCount(track);

         await emitEvent({
            eventType: EventTypes.MUSIC_PLAYBACK,
            entityType: 'music',
            entityId: track.id,
            payload: { action: 'play', trackTitle: track.title, category: track.category },
            userId,
         });
      }
   }, [userId]);

   // Setup playback status listener
   useEffect(() => {
      musicPlayer.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
         if (status.isLoaded) {
            const positionSec = Math.floor(status.positionMillis / 1000);
            const durationSec = status.durationMillis ? Math.floor(status.durationMillis / 1000) : 0;

            setElapsed(positionSec);
            setProgress(durationSec > 0 ? (positionSec / durationSec) * 100 : 0);

            // Track ended
            if (status.didJustFinish) {
               const current = filteredTracksRef.current[currentTrackIndexRef.current];
               if (!current) return;

               emitEvent({
                  eventType: EventTypes.MUSIC_PLAYBACK,
                  entityType: 'music',
                  entityId: current.id,
                  payload: { action: 'completed', trackTitle: current.title, duration: current.duration },
                  userId,
               });

               if (repeatRef.current) {
                  musicPlayer.seek(0);
                  musicPlayer.play();
               } else if (shuffleRef.current) {
                  const randomIndex = Math.floor(Math.random() * filteredTracksRef.current.length);
                  playTrackByIndex(randomIndex);
               } else {
                  const nextIndex = (currentTrackIndexRef.current + 1) % filteredTracksRef.current.length;
                  playTrackByIndex(nextIndex);
               }
            }
         }
      });

      return () => {
         musicPlayer.unload();
      };
   }, [userId, playTrackByIndex]);

   const playTrack = async (index: number) => {
      const track = filteredTracks[index];
      if (!track) return;

      setCurrentTrackIndex(index);
      setElapsed(0);
      setProgress(0);

      const loaded = await musicPlayer.loadTrack(track);
      if (loaded) {
         await musicPlayer.play();
         setIsPlaying(true);

         // Increment play count
         await incrementPlayCount(track);

         await emitEvent({
            eventType: EventTypes.MUSIC_PLAYBACK,
            entityType: 'music',
            entityId: track.id,
            payload: { action: 'play', trackTitle: track.title, category: track.category },
            userId,
         });
      }
   };

   const handlePlayPause = async () => {
      if (!currentTrack) {
         if (filteredTracks.length > 0) {
            await playTrack(0);
         }
         return;
      }

      if (musicPlayer.getCurrentTrackId() !== currentTrack.id) {
         await playTrack(currentTrackIndex);
         return;
      }

      if (isPlaying) {
         await musicPlayer.pause();
         setIsPlaying(false);
      } else {
         await musicPlayer.play();
         setIsPlaying(true);
      }

      await emitEvent({
         eventType: EventTypes.MUSIC_PLAYBACK,
         entityType: 'music',
         entityId: currentTrack.id,
         payload: { action: isPlaying ? 'pause' : 'play', trackTitle: currentTrack.title, elapsedSeconds: elapsed },
         userId,
      });
   };

   const handleNext = async () => {
      if (filteredTracks.length === 0) return;
      const nextIndex = (currentTrackIndex + 1) % filteredTracks.length;
      await playTrack(nextIndex);
   };

   const handlePrevious = async () => {
      if (filteredTracks.length === 0) return;

      if (elapsed > 3) {
         // Restart current track
         await musicPlayer.seek(0);
         setElapsed(0);
         setProgress(0);
      } else {
         // Go to previous track
         const prevIndex = currentTrackIndex === 0 ? filteredTracks.length - 1 : currentTrackIndex - 1;
         await playTrack(prevIndex);
      }
   };

   const handleToggleFavorite = async (track: MusicTrack) => {
      await toggleFavoriteService(track, userId);
   };

   const handlePickFiles = async () => {
      try {
         const result = await pickAudioFiles();

         if (!result.canceled && result.assets.length > 0) {
            const files = result.assets.map(asset => ({
               uri: asset.uri,
               name: asset.name || 'Unknown',
               title: asset.name?.replace(/\.[^.]+$/, '') || 'Unknown',
               artist: 'Unknown Artist',
               category: sortedCategories[0]?.name.toLowerCase() || 'other',
               albumArt: null as string | null,
            }));

            setPendingFiles(files);
            setShowAddModal(true);
         }
      } catch (error) {
         console.error('[Music] Error picking files:', error);
         Alert.alert('Error', 'Failed to pick audio files. Please try again.');
      }
   };

   const handleAddTracks = async () => {
      if (pendingFiles.length === 0) return;

      setIsAdding(true);
      try {
         for (const file of pendingFiles) {
            const track = await addTrackToLibrary(
               file.uri,
               file.name,
               userId,
               file.category,
               file.title,
               file.artist
            );

            // If user selected custom album art, update the track
            if (file.albumArt && track) {
               await updateTrackAlbumArt(track, file.albumArt);
            }
         }

         setPendingFiles([]);
         setShowAddModal(false);
         Alert.alert('Success', `Added ${pendingFiles.length} track(s) to your library!`);
      } catch (error) {
         console.error('[Music] Error adding tracks:', error);
         Alert.alert('Error', 'Failed to add some tracks. Please try again.');
      } finally {
         setIsAdding(false);
      }
   };

   const handleDeleteTrack = async (track: MusicTrack) => {
      Alert.alert(
         'Delete Track',
         `Are you sure you want to delete "${track.title}"?`,
         [
            { text: 'Cancel', style: 'cancel' },
            {
               text: 'Delete',
               style: 'destructive',
               onPress: async () => {
                  // If playing this track, stop playback
                  if (musicPlayer.getCurrentTrackId() === track.id) {
                     await musicPlayer.stop();
                     setIsPlaying(false);
                  }

                  await deleteTrack(track, userId);
                  setShowOptionsModal(false);
                  setSelectedTrack(null);
               },
            },
         ]
      );
   };

   const handleEditTrack = async () => {
      if (!selectedTrack) return;

      await updateTrack(selectedTrack, {
         title: editTitle,
         artist: editArtist,
         category: editCategory,
      });

      // Update album art if changed
      if (editAlbumArt !== selectedTrack.albumArtUri) {
         await updateTrackAlbumArt(selectedTrack, editAlbumArt);
      }

      setShowEditModal(false);
      setSelectedTrack(null);
      setEditAlbumArt(null);
   };

   const openEditModal = (track: MusicTrack) => {
      setSelectedTrack(track);
      setEditTitle(track.title);
      setEditArtist(track.artist);
      setEditCategory(track.category);
      setEditAlbumArt(track.albumArtUri);
      setShowOptionsModal(false);
      setShowEditModal(true);
   };

   const openOptionsModal = (track: MusicTrack) => {
      setSelectedTrack(track);
      setShowOptionsModal(true);
   };

   const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

   const getAlbumArt = (track: MusicTrack) => {
      // 1. Custom album art on track
      if (track.albumArtUri) {
         return track.albumArtUri;
      }
      // 2. Category default art
      const category = sortedCategories.find(c => c.name.toLowerCase() === track.category.toLowerCase());
      if (category?.defaultArtUri) {
         return category.defaultArtUri;
      }
      // 3. System default by category name
      const catName = track.category.toLowerCase() as keyof typeof DEFAULT_ALBUM_ARTS;
      return DEFAULT_ALBUM_ARTS[catName] || FALLBACK_ALBUM_ART;
   };

   // Pick album art for a file being added
   const handlePickAlbumArt = async (index: number) => {
      const uri = await pickAlbumArt();
      if (uri) {
         const updated = [...pendingFiles];
         updated[index].albumArt = uri;
         setPendingFiles(updated);
      }
   };

   // Pick album art for edit modal
   const handlePickEditAlbumArt = async () => {
      const uri = await pickAlbumArt();
      if (uri) {
         setEditAlbumArt(uri);
      }
   };

   // Category management functions
   const openCategoryEditModal = (category?: MusicCategory) => {
      if (category) {
         setSelectedCategory(category);
         setCatEditName(category.name);
         setCatEditIcon(category.icon || '🎵');
         setCatEditColor(category.color || '#8E8E93');
         setCatEditArt(category.defaultArtUri);
      } else {
         setSelectedCategory(null);
         setCatEditName('');
         setCatEditIcon('🎵');
         setCatEditColor(CATEGORY_COLORS[sortedCategories.length % CATEGORY_COLORS.length]);
         setCatEditArt(null);
      }
      setShowCategoryEditModal(true);
   };

   const handleSaveCategory = async () => {
      if (!catEditName.trim()) {
         Alert.alert('Error', 'Category name is required');
         return;
      }

      if (selectedCategory) {
         // Update existing
         await updateCategory(selectedCategory, {
            name: catEditName.trim(),
            icon: catEditIcon,
            color: catEditColor,
         });
         if (catEditArt !== selectedCategory.defaultArtUri) {
            await updateCategoryArt(selectedCategory, catEditArt);
         }
      } else {
         // Add new
         const newCat = await addCategory(catEditName.trim(), userId, catEditIcon, catEditColor);
         if (catEditArt) {
            await updateCategoryArt(newCat, catEditArt);
         }
      }

      setShowCategoryEditModal(false);
      setSelectedCategory(null);
   };

   const handleDeleteCategory = async (category: MusicCategory) => {
      if (category.isSystem) {
         Alert.alert('Cannot Delete', 'System categories cannot be deleted.');
         return;
      }

      Alert.alert(
         'Delete Category',
         `Are you sure you want to delete "${category.name}"? Tracks in this category will remain but may need to be recategorized.`,
         [
            { text: 'Cancel', style: 'cancel' },
            {
               text: 'Delete',
               style: 'destructive',
               onPress: async () => {
                  await deleteCategoryService(category);
               },
            },
         ]
      );
   };

   const handlePickCategoryArt = async () => {
      const uri = await pickAlbumArt();
      if (uri) {
         setCatEditArt(uri);
      }
   };

   const moveCategoryUp = async (category: MusicCategory) => {
      const index = sortedCategories.findIndex(c => c.id === category.id);
      if (index <= 0) return;

      const newOrder = [...sortedCategories];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      await reorderCategories(sortedCategories, newOrder.map(c => c.id));
   };

   const moveCategoryDown = async (category: MusicCategory) => {
      const index = sortedCategories.findIndex(c => c.id === category.id);
      if (index === -1 || index >= sortedCategories.length - 1) return;

      const newOrder = [...sortedCategories];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      await reorderCategories(sortedCategories, newOrder.map(c => c.id));
   };

   if (isLoading) {
      return <View className="flex-1 bg-[#F8F9FC] items-center justify-center"><ActivityIndicator size="large" color="#1E1E1E" /></View>;
   }

   return (
      <View className="flex-1 bg-[#F8F9FC]">
         <SafeAreaView className="flex-1">
            <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={true}>
               {/* --- HEADER WITH ADD BUTTON --- */}
               <View className="px-6 pt-4 pb-2 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                     <Music size={24} color="#1E1E1E" />
                     <Text className="text-xl font-bold text-primary">My Music</Text>
                  </View>
                  <TouchableOpacity
                     onPress={handlePickFiles}
                     onLongPress={() => setShowCategoryModal(true)}
                     delayLongPress={500}
                     className="h-10 w-10 bg-[#1E1E1E] rounded-full items-center justify-center"
                  >
                     <Plus size={20} color="white" />
                  </TouchableOpacity>
               </View>

               {/* --- CATEGORY FILTERS --- */}
               <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="mb-6 mt-2"
                  contentContainerStyle={{ paddingHorizontal: 24 }}
               >
                  <View className="flex-row gap-2">
                     {/* All and Favorites are always first */}
                     <TouchableOpacity
                        onPress={() => setFilter('all')}
                        style={[
                           styles.filterButton,
                           filter === 'all' ? styles.filterButtonActive : styles.filterButtonInactive
                        ]}
                     >
                        <Text style={[
                           styles.filterText,
                           filter === 'all' ? styles.filterTextActive : styles.filterTextInactive
                        ]}>All</Text>
                     </TouchableOpacity>

                     <TouchableOpacity
                        onPress={() => setFilter('favorites')}
                        style={[
                           styles.filterButton,
                           filter === 'favorites' ? styles.filterButtonActive : styles.filterButtonInactive
                        ]}
                     >
                        <Text style={[
                           styles.filterText,
                           filter === 'favorites' ? styles.filterTextActive : styles.filterTextInactive
                        ]}>♥ Favorites</Text>
                     </TouchableOpacity>

                     {/* Dynamic categories */}
                     {sortedCategories.map(cat => (
                        <TouchableOpacity
                           key={cat.id}
                           onPress={() => setFilter(cat.name.toLowerCase())}
                           style={[
                              styles.filterButton,
                              filter === cat.name.toLowerCase() ? { backgroundColor: cat.color || '#1E1E1E' } : styles.filterButtonInactive
                           ]}
                        >
                           <Text style={[
                              styles.filterText,
                              filter === cat.name.toLowerCase() ? styles.filterTextActive : styles.filterTextInactive
                           ]}>
                              {cat.icon || '🎵'} {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
                           </Text>
                        </TouchableOpacity>
                     ))}
                  </View>
               </ScrollView>

               {/* --- EMPTY STATE --- */}
               {tracks.length === 0 ? (
                  <View className="px-6 py-20 items-center">
                     <View className="h-24 w-24 bg-gray-100 rounded-full items-center justify-center mb-4">
                        <FolderOpen size={48} color="#8E8E93" />
                     </View>
                     <Text className="text-xl font-bold text-primary mb-2">No Music Yet</Text>
                     <Text className="text-secondary text-center mb-6">Add songs from your device to start listening</Text>
                     <TouchableOpacity
                        onPress={handlePickFiles}
                        className="bg-[#1E1E1E] px-6 py-3 rounded-full flex-row items-center gap-2"
                     >
                        <Plus size={20} color="white" />
                        <Text className="text-white font-semibold">Add Songs</Text>
                     </TouchableOpacity>
                  </View>
               ) : (
                  <>
                     {/* --- MAIN PLAYER CARD --- */}
                     {currentTrack && (
                        <View className="px-6 mb-8">
                           <View className="bg-white p-5 rounded-[40px] shadow-sm border border-gray-100 items-center">

                              {/* Album Art with Glow */}
                              <View className="relative mb-6">
                                 <View className="absolute top-4 left-4 right-4 bottom-0 bg-blue-300 rounded-full blur-2xl opacity-40" />
                                 <Image
                                    source={{ uri: getAlbumArt(currentTrack) }}
                                    className="h-64 w-64 rounded-[32px]"
                                 />
                                 <TouchableOpacity
                                    onPress={() => handleToggleFavorite(currentTrack)}
                                    className="absolute bottom-4 right-4 h-10 w-10 bg-white/20 rounded-full items-center justify-center backdrop-blur-md border border-white/30"
                                 >
                                    <Heart size={20} color="white" fill={currentTrack.isFavorite ? '#FF6B6B' : 'white'} />
                                 </TouchableOpacity>
                              </View>

                              {/* Song Info */}
                              <View className="items-center mb-4">
                                 <Text className="text-2xl font-bold text-primary mb-1" numberOfLines={1}>{currentTrack.title}</Text>
                                 <Text className="text-secondary font-medium" numberOfLines={1}>{currentTrack.artist}</Text>
                              </View>

                              {/* Progress Bar */}
                              <View className="w-full px-2 mb-2">
                                 <View className="h-1 bg-gray-200 rounded-full overflow-hidden">
                                    <View className="h-full bg-[#4AC3FF] rounded-full" style={{ width: `${progress}%` }} />
                                 </View>
                                 <View className="flex-row justify-between mt-1">
                                    <Text className="text-xs text-secondary">{formatTime(elapsed)}</Text>
                                    <Text className="text-xs text-secondary">{formatTime(currentTrack.duration)}</Text>
                                 </View>
                              </View>

                              {/* Controls */}
                              <View className="flex-row items-center justify-between w-full px-4 mt-4">
                                 <TouchableOpacity onPress={() => setShuffle(!shuffle)}>
                                    <Shuffle size={20} color={shuffle ? '#4AC3FF' : '#8E8E93'} />
                                 </TouchableOpacity>

                                 <TouchableOpacity onPress={handlePrevious}>
                                    <SkipBack size={28} color="#1E1E1E" fill="#1E1E1E" />
                                 </TouchableOpacity>

                                 <TouchableOpacity
                                    onPress={handlePlayPause}
                                    className="h-16 w-16 bg-[#1E1E1E] rounded-full items-center justify-center shadow-lg shadow-blue-500/30"
                                 >
                                    {isPlaying ? (
                                       <Pause size={32} color="white" fill="white" />
                                    ) : (
                                       <Play size={32} color="white" fill="white" style={{ marginLeft: 4 }} />
                                    )}
                                 </TouchableOpacity>

                                 <TouchableOpacity onPress={handleNext}>
                                    <SkipForward size={28} color="#1E1E1E" fill="#1E1E1E" />
                                 </TouchableOpacity>

                                 <TouchableOpacity onPress={() => setRepeat(!repeat)}>
                                    <Repeat size={20} color={repeat ? '#4AC3FF' : '#8E8E93'} />
                                 </TouchableOpacity>
                              </View>

                           </View>
                        </View>
                     )}

                     {/* --- TRACK LIST --- */}
                     <View className="px-6">
                        <View className="flex-row items-center gap-2 mb-4">
                           <ListMusic size={20} color="#1E1E1E" />
                           <Text className="text-lg font-bold text-primary">
                              {filter === 'all' ? 'All Songs' : filter === 'favorites' ? 'Favorites' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                           </Text>
                           <Text className="text-secondary text-sm">({filteredTracks.length} tracks)</Text>
                        </View>

                        {filteredTracks.length === 0 ? (
                           <View className="py-8 items-center">
                              <Text className="text-secondary">No tracks in this category</Text>
                           </View>
                        ) : (
                           <View className="gap-3">
                              {filteredTracks.map((item, index) => {
                                 const isActive = currentTrack?.id === item.id;
                                 return (
                                    <TouchableOpacity
                                       key={item.id}
                                       onPress={() => playTrack(index)}
                                       onLongPress={() => openOptionsModal(item)}
                                       className={`flex-row items-center p-4 rounded-3xl border ${isActive ? 'bg-[#1E1E1E] border-[#1E1E1E]' : 'bg-white border-gray-100'}`}
                                    >
                                       <Image source={{ uri: getAlbumArt(item) }} className="h-12 w-12 rounded-xl mr-4" />
                                       <View className="flex-1">
                                          <Text className={`font-bold text-base ${isActive ? 'text-white' : 'text-primary'}`} numberOfLines={1}>{item.title}</Text>
                                          <Text className={`text-xs ${isActive ? 'text-white/60' : 'text-secondary'}`} numberOfLines={1}>{item.artist} • {item.category}</Text>
                                       </View>
                                       <View className="flex-row items-center gap-3">
                                          <TouchableOpacity onPress={() => handleToggleFavorite(item)}>
                                             <Heart size={18} color={item.isFavorite ? '#FF6B6B' : (isActive ? 'white' : '#8E8E93')} fill={item.isFavorite ? '#FF6B6B' : 'transparent'} />
                                          </TouchableOpacity>
                                          <Text className={`font-medium ${isActive ? 'text-white/60' : 'text-secondary'}`}>{formatTime(item.duration)}</Text>
                                          <TouchableOpacity onPress={() => openOptionsModal(item)}>
                                             <MoreVertical size={18} color={isActive ? 'white' : '#8E8E93'} />
                                          </TouchableOpacity>
                                       </View>
                                    </TouchableOpacity>
                                 );
                              })}
                           </View>
                        )}
                     </View>
                  </>
               )}

            </ScrollView>
         </SafeAreaView>

         {/* --- ADD TRACKS MODAL --- */}
         <Modal visible={showAddModal} animationType="slide" transparent>
            <View className="flex-1 bg-black/50 justify-end">
               <View className="bg-white rounded-t-[32px] p-6 max-h-[80%]">
                  <View className="flex-row items-center justify-between mb-6">
                     <Text className="text-xl font-bold text-primary">Add Songs</Text>
                     <TouchableOpacity onPress={() => { setShowAddModal(false); setPendingFiles([]); }}>
                        <X size={24} color="#8E8E93" />
                     </TouchableOpacity>
                  </View>

                  <ScrollView className="mb-4" showsVerticalScrollIndicator={false}>
                     {pendingFiles.map((file, index) => (
                        <View key={index} className="mb-4 p-4 bg-gray-50 rounded-2xl">
                           <Text className="text-sm text-secondary mb-2">{file.name}</Text>

                           {/* Album Art Picker */}
                           <TouchableOpacity
                              onPress={() => handlePickAlbumArt(index)}
                              className="flex-row items-center p-3 bg-white rounded-xl border border-gray-200 mb-2"
                           >
                              {file.albumArt ? (
                                 <Image source={{ uri: file.albumArt }} className="h-12 w-12 rounded-lg mr-3" />
                              ) : (
                                 <View className="h-12 w-12 bg-gray-100 rounded-lg items-center justify-center mr-3">
                                    <ImagePlus size={20} color="#8E8E93" />
                                 </View>
                              )}
                              <Text className="text-secondary flex-1">
                                 {file.albumArt ? 'Change Album Art' : 'Add Album Art (Optional)'}
                              </Text>
                           </TouchableOpacity>

                           <TextInput
                              value={file.title}
                              onChangeText={(text) => {
                                 const updated = [...pendingFiles];
                                 updated[index].title = text;
                                 setPendingFiles(updated);
                              }}
                              placeholder="Title"
                              className="bg-white p-3 rounded-xl border border-gray-200 mb-2"
                           />

                           <TextInput
                              value={file.artist}
                              onChangeText={(text) => {
                                 const updated = [...pendingFiles];
                                 updated[index].artist = text;
                                 setPendingFiles(updated);
                              }}
                              placeholder="Artist"
                              className="bg-white p-3 rounded-xl border border-gray-200 mb-2"
                           />

                           <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                              <View className="flex-row gap-2">
                                 {sortedCategories.map(cat => (
                                    <TouchableOpacity
                                       key={cat.id}
                                       onPress={() => {
                                          const updated = [...pendingFiles];
                                          updated[index].category = cat.name.toLowerCase();
                                          setPendingFiles(updated);
                                       }}
                                       style={[
                                          styles.categoryButton,
                                          file.category === cat.name.toLowerCase() ? { backgroundColor: cat.color || '#1E1E1E' } : styles.categoryButtonInactive
                                       ]}
                                    >
                                       <Text style={[
                                          styles.categoryText,
                                          file.category === cat.name.toLowerCase() ? styles.categoryTextActive : styles.categoryTextInactive
                                       ]}>
                                          {cat.icon || '🎵'} {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
                                       </Text>
                                    </TouchableOpacity>
                                 ))}
                              </View>
                           </ScrollView>
                        </View>
                     ))}
                  </ScrollView>

                  <TouchableOpacity
                     onPress={handleAddTracks}
                     disabled={isAdding}
                     className={`py-4 rounded-2xl items-center ${isAdding ? 'bg-gray-300' : 'bg-[#1E1E1E]'}`}
                  >
                     {isAdding ? (
                        <ActivityIndicator color="white" />
                     ) : (
                        <Text className="text-white font-bold text-lg">Add {pendingFiles.length} Song(s)</Text>
                     )}
                  </TouchableOpacity>
               </View>
            </View>
         </Modal>

         {/* --- OPTIONS MODAL --- */}
         <Modal visible={showOptionsModal} animationType="fade" transparent>
            <Pressable className="flex-1 bg-black/50 justify-end" onPress={() => setShowOptionsModal(false)}>
               <View className="bg-white rounded-t-[32px] p-6">
                  {selectedTrack && (
                     <>
                        <View className="flex-row items-center mb-6">
                           <Image source={{ uri: getAlbumArt(selectedTrack) }} className="h-16 w-16 rounded-xl mr-4" />
                           <View className="flex-1">
                              <Text className="font-bold text-lg text-primary" numberOfLines={1}>{selectedTrack.title}</Text>
                              <Text className="text-secondary" numberOfLines={1}>{selectedTrack.artist}</Text>
                           </View>
                        </View>

                        <TouchableOpacity
                           onPress={() => openEditModal(selectedTrack)}
                           className="flex-row items-center p-4 bg-gray-50 rounded-2xl mb-3"
                        >
                           <Edit3 size={20} color="#1E1E1E" />
                           <Text className="ml-3 font-semibold text-primary">Edit Details</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                           onPress={() => handleToggleFavorite(selectedTrack)}
                           className="flex-row items-center p-4 bg-gray-50 rounded-2xl mb-3"
                        >
                           <Heart size={20} color={selectedTrack.isFavorite ? '#FF6B6B' : '#1E1E1E'} fill={selectedTrack.isFavorite ? '#FF6B6B' : 'transparent'} />
                           <Text className="ml-3 font-semibold text-primary">
                              {selectedTrack.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                           </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                           onPress={() => handleDeleteTrack(selectedTrack)}
                           className="flex-row items-center p-4 bg-red-50 rounded-2xl"
                        >
                           <Trash2 size={20} color="#FF3B30" />
                           <Text className="ml-3 font-semibold text-red-500">Delete Song</Text>
                        </TouchableOpacity>
                     </>
                  )}
               </View>
            </Pressable>
         </Modal>

         {/* --- EDIT MODAL --- */}
         <Modal visible={showEditModal} animationType="slide" transparent>
            <View className="flex-1 bg-black/50 justify-end">
               <View className="bg-white rounded-t-[32px] p-6">
                  <View className="flex-row items-center justify-between mb-6">
                     <Text className="text-xl font-bold text-primary">Edit Song</Text>
                     <TouchableOpacity onPress={() => { setShowEditModal(false); setEditAlbumArt(null); }}>
                        <X size={24} color="#8E8E93" />
                     </TouchableOpacity>
                  </View>

                  {/* Album Art Picker */}
                  <TouchableOpacity
                     onPress={handlePickEditAlbumArt}
                     className="flex-row items-center p-3 bg-gray-50 rounded-2xl border border-gray-200 mb-4"
                  >
                     {editAlbumArt ? (
                        <Image source={{ uri: editAlbumArt }} className="h-16 w-16 rounded-xl mr-4" />
                     ) : selectedTrack ? (
                        <Image source={{ uri: getAlbumArt(selectedTrack) }} className="h-16 w-16 rounded-xl mr-4" />
                     ) : (
                        <View className="h-16 w-16 bg-gray-100 rounded-xl items-center justify-center mr-4">
                           <ImagePlus size={24} color="#8E8E93" />
                        </View>
                     )}
                     <View className="flex-1">
                        <Text className="font-semibold text-primary">Album Art</Text>
                        <Text className="text-secondary text-sm">Tap to change</Text>
                     </View>
                  </TouchableOpacity>

                  <Text className="text-sm text-secondary mb-1">Title</Text>
                  <TextInput
                     value={editTitle}
                     onChangeText={setEditTitle}
                     placeholder="Song title"
                     className="bg-gray-50 p-4 rounded-2xl border border-gray-200 mb-4"
                  />

                  <Text className="text-sm text-secondary mb-1">Artist</Text>
                  <TextInput
                     value={editArtist}
                     onChangeText={setEditArtist}
                     placeholder="Artist name"
                     className="bg-gray-50 p-4 rounded-2xl border border-gray-200 mb-4"
                  />

                  <Text className="text-sm text-secondary mb-2">Category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
                     <View className="flex-row gap-2">
                        {sortedCategories.map(cat => (
                           <TouchableOpacity
                              key={cat.id}
                              onPress={() => setEditCategory(cat.name.toLowerCase())}
                              style={[
                                 styles.categoryButton,
                                 editCategory === cat.name.toLowerCase() ? { backgroundColor: cat.color || '#1E1E1E' } : styles.categoryButtonInactive
                              ]}
                           >
                              <Text style={[
                                 styles.categoryText,
                                 editCategory === cat.name.toLowerCase() ? styles.categoryTextActive : styles.categoryTextInactive
                              ]}>
                                 {cat.icon || '🎵'} {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
                              </Text>
                           </TouchableOpacity>
                        ))}
                     </View>
                  </ScrollView>

                  <TouchableOpacity
                     onPress={handleEditTrack}
                     className="bg-[#1E1E1E] py-4 rounded-2xl items-center flex-row justify-center gap-2"
                  >
                     <Check size={20} color="white" />
                     <Text className="text-white font-bold text-lg">Save Changes</Text>
                  </TouchableOpacity>
               </View>
            </View>
         </Modal>

         {/* --- CATEGORY MANAGEMENT MODAL --- */}
         <Modal visible={showCategoryModal} animationType="slide" transparent>
            <View className="flex-1 bg-black/50 justify-end">
               <View className="bg-white rounded-t-[32px] p-6 max-h-[80%]">
                  <View className="flex-row items-center justify-between mb-6">
                     <View className="flex-row items-center gap-2">
                        <Settings size={20} color="#1E1E1E" />
                        <Text className="text-xl font-bold text-primary">Manage Categories</Text>
                     </View>
                     <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                        <X size={24} color="#8E8E93" />
                     </TouchableOpacity>
                  </View>

                  <Text className="text-secondary text-sm mb-4">
                     Long-press the + button anytime to access this menu. Drag to reorder categories.
                  </Text>

                  <ScrollView className="mb-4" showsVerticalScrollIndicator={false}>
                     {sortedCategories.map((cat, index) => (
                        <View key={cat.id} className="flex-row items-center mb-3 p-4 bg-gray-50 rounded-2xl">
                           {/* Reorder buttons */}
                           <View className="mr-3">
                              <TouchableOpacity
                                 onPress={() => moveCategoryUp(cat)}
                                 disabled={index === 0}
                                 className={`p-1 ${index === 0 ? 'opacity-30' : ''}`}
                              >
                                 <Text className="text-lg">▲</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                 onPress={() => moveCategoryDown(cat)}
                                 disabled={index === sortedCategories.length - 1}
                                 className={`p-1 ${index === sortedCategories.length - 1 ? 'opacity-30' : ''}`}
                              >
                                 <Text className="text-lg">▼</Text>
                              </TouchableOpacity>
                           </View>

                           {/* Category info */}
                           <View
                              style={{ backgroundColor: cat.color || '#8E8E93' }}
                              className="h-10 w-10 rounded-full items-center justify-center mr-3"
                           >
                              <Text className="text-lg">{cat.icon || '🎵'}</Text>
                           </View>

                           <View className="flex-1">
                              <Text className="font-bold text-primary">{cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}</Text>
                              <Text className="text-secondary text-xs">{cat.isSystem ? 'System' : 'Custom'}</Text>
                           </View>

                           {/* Actions */}
                           <TouchableOpacity
                              onPress={() => { setShowCategoryModal(false); openCategoryEditModal(cat); }}
                              className="p-2 mr-2"
                           >
                              <Edit3 size={18} color="#1E1E1E" />
                           </TouchableOpacity>

                           {!cat.isSystem && (
                              <TouchableOpacity
                                 onPress={() => handleDeleteCategory(cat)}
                                 className="p-2"
                              >
                                 <Trash2 size={18} color="#FF3B30" />
                              </TouchableOpacity>
                           )}
                        </View>
                     ))}
                  </ScrollView>

                  <TouchableOpacity
                     onPress={() => { setShowCategoryModal(false); openCategoryEditModal(); }}
                     className="bg-[#1E1E1E] py-4 rounded-2xl items-center flex-row justify-center gap-2"
                  >
                     <Plus size={20} color="white" />
                     <Text className="text-white font-bold text-lg">Add New Category</Text>
                  </TouchableOpacity>
               </View>
            </View>
         </Modal>

         {/* --- CATEGORY EDIT MODAL --- */}
         <Modal visible={showCategoryEditModal} animationType="slide" transparent>
            <View className="flex-1 bg-black/50 justify-end">
               <View className="bg-white rounded-t-[32px] p-6">
                  <View className="flex-row items-center justify-between mb-6">
                     <Text className="text-xl font-bold text-primary">
                        {selectedCategory ? 'Edit Category' : 'New Category'}
                     </Text>
                     <TouchableOpacity onPress={() => { setShowCategoryEditModal(false); setSelectedCategory(null); }}>
                        <X size={24} color="#8E8E93" />
                     </TouchableOpacity>
                  </View>

                  {/* Category Art */}
                  <TouchableOpacity
                     onPress={handlePickCategoryArt}
                     className="flex-row items-center p-3 bg-gray-50 rounded-2xl border border-gray-200 mb-4"
                  >
                     {catEditArt ? (
                        <Image source={{ uri: catEditArt }} className="h-16 w-16 rounded-xl mr-4" />
                     ) : (
                        <View className="h-16 w-16 bg-gray-100 rounded-xl items-center justify-center mr-4">
                           <ImagePlus size={24} color="#8E8E93" />
                        </View>
                     )}
                     <View className="flex-1">
                        <Text className="font-semibold text-primary">Default Art</Text>
                        <Text className="text-secondary text-sm">Used for tracks without custom art</Text>
                     </View>
                  </TouchableOpacity>

                  <Text className="text-sm text-secondary mb-1">Category Name</Text>
                  <TextInput
                     value={catEditName}
                     onChangeText={setCatEditName}
                     placeholder="e.g., Workout, Study, Chill"
                     className="bg-gray-50 p-4 rounded-2xl border border-gray-200 mb-4"
                     editable={!selectedCategory?.isSystem}
                  />

                  <Text className="text-sm text-secondary mb-2">Icon</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                     <View className="flex-row gap-2">
                        {CATEGORY_ICONS.map(icon => (
                           <TouchableOpacity
                              key={icon}
                              onPress={() => setCatEditIcon(icon)}
                              className={`h-12 w-12 rounded-xl items-center justify-center ${catEditIcon === icon ? 'bg-[#1E1E1E]' : 'bg-gray-100'}`}
                           >
                              <Text className="text-xl">{icon}</Text>
                           </TouchableOpacity>
                        ))}
                     </View>
                  </ScrollView>

                  <Text className="text-sm text-secondary mb-2">Color</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
                     <View className="flex-row gap-2">
                        {CATEGORY_COLORS.map(color => (
                           <TouchableOpacity
                              key={color}
                              onPress={() => setCatEditColor(color)}
                              style={{ backgroundColor: color }}
                              className={`h-12 w-12 rounded-xl items-center justify-center ${catEditColor === color ? 'border-2 border-[#1E1E1E]' : ''}`}
                           >
                              {catEditColor === color && <Check size={20} color="white" />}
                           </TouchableOpacity>
                        ))}
                     </View>
                  </ScrollView>

                  <TouchableOpacity
                     onPress={handleSaveCategory}
                     className="bg-[#1E1E1E] py-4 rounded-2xl items-center flex-row justify-center gap-2"
                  >
                     <Check size={20} color="white" />
                     <Text className="text-white font-bold text-lg">
                        {selectedCategory ? 'Save Changes' : 'Create Category'}
                     </Text>
                  </TouchableOpacity>
               </View>
            </View>
         </Modal>
      </View>
   );
}

// Styles for filter buttons (using StyleSheet to avoid NativeWind issues with interactive elements)
const styles = StyleSheet.create({
   filterButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
   },
   filterButtonActive: {
      backgroundColor: '#1E1E1E',
   },
   filterButtonInactive: {
      backgroundColor: 'white',
      borderWidth: 1,
      borderColor: '#E5E7EB',
   },
   filterText: {
      fontWeight: '500',
   },
   filterTextActive: {
      color: 'white',
   },
   filterTextInactive: {
      color: '#6B7280',
   },
   categoryButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
   },
   categoryButtonActive: {
      backgroundColor: '#1E1E1E',
   },
   categoryButtonInactive: {
      backgroundColor: 'white',
      borderWidth: 1,
      borderColor: '#E5E7EB',
   },
   categoryText: {
      fontSize: 12,
      fontWeight: '500',
   },
   categoryTextActive: {
      color: 'white',
   },
   categoryTextInactive: {
      color: '#6B7280',
   },
});

const enhance = withObservables([], () => ({
   users: database.get<User>('users').query().observe(),
   tracks: database.get<MusicTrack>('music_tracks').query().observe(),
   categories: database.get<MusicCategory>('music_categories').query(Q.sortBy('position', Q.asc)).observe(),
}));

const EnhancedMusicScreen = enhance(MusicScreen);

export default function MusicScreenWrapper() {
   return <EnhancedMusicScreen users={[]} tracks={[]} categories={[]} />;
}
