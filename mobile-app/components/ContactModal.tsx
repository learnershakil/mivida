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
import Contact from '../database/models/Contact';
import contactService from '../services/contactService';
import { Phone, Mail, Instagram, Twitter, Linkedin, Github, X, MapPin } from 'lucide-react-native';

interface ContactModalProps {
    visible: boolean;
    onClose: () => void;
    userId: string;
}

type TabType = 'list' | 'create';

export default function ContactModal({ visible, onClose, userId }: ContactModalProps) {
    const [activeTab, setActiveTab] = useState<TabType>('list');
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(false);

    // Create/Edit form state
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [socialInstagram, setSocialInstagram] = useState('');
    const [socialTwitter, setSocialTwitter] = useState('');
    const [socialLinkedin, setSocialLinkedin] = useState('');
    const [socialGithub, setSocialGithub] = useState('');
    const [source, setSource] = useState('');

    const loadContacts = async () => {
        setLoading(true);
        try {
            const fetchedContacts = await contactService.getAll(userId);
            setContacts(fetchedContacts);
        } catch (error) {
            console.error('[ContactModal] Failed to load contacts:', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (visible) {
            loadContacts();
        }
    }, [visible, userId]);

    const resetForm = () => {
        setEditingContact(null);
        setName('');
        setEmail('');
        setPhone('');
        setSocialInstagram('');
        setSocialTwitter('');
        setSocialLinkedin('');
        setSocialGithub('');
        setSource('');
    };

    const handleCreateOrUpdate = async () => {
        if (!name.trim()) {
            Alert.alert('Missing Info', 'Name is required');
            return;
        }

        const socials = {
            instagram: socialInstagram.trim(),
            twitter: socialTwitter.trim(),
            linkedin: socialLinkedin.trim(),
            github: socialGithub.trim(),
        };

        try {
            if (editingContact) {
                await contactService.update(editingContact.id, {
                    name: name.trim(),
                    email: email.trim(),
                    phone: phone.trim(),
                    socials,
                    source: source.trim(),
                });
            } else {
                await contactService.create({
                    name: name.trim(),
                    email: email.trim(),
                    phone: phone.trim(),
                    socials,
                    source: source.trim(),
                    userId,
                });
            }

            resetForm();
            setActiveTab('list');
            loadContacts();
        } catch (error) {
            console.error('[ContactModal] Failed to save contact:', error);
            Alert.alert('Error', 'Failed to save contact');
        }
    };

    const handleEdit = (contact: Contact) => {
        setEditingContact(contact);
        setName(contact.name);
        setEmail(contact.email || '');
        setPhone(contact.phone || '');
        const socials = contact.socials || {};
        setSocialInstagram(socials.instagram || '');
        setSocialTwitter(socials.twitter || '');
        setSocialLinkedin(socials.linkedin || '');
        setSocialGithub(socials.github || '');
        setSource(contact.source || '');
        setActiveTab('create');
    };

    const handleDelete = async (contact: Contact) => {
        Alert.alert(
            'Delete Contact',
            `Are you sure you want to delete ${contact.name}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await contactService.delete(contact.id);
                            loadContacts();
                        } catch (error) {
                            console.error('[ContactModal] Failed to delete contact:', error);
                        }
                    },
                },
            ]
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { resetForm(); onClose(); }}>
            <View className="flex-1 bg-black/50">
                <View className="flex-1 bg-white rounded-t-[40px] mt-20">
                    {/* Header */}
                    <View className="flex-row justify-between items-center p-6 border-b border-gray-100">
                        <Text className="text-2xl font-bold">Contacts</Text>
                        <TouchableOpacity
                            onPress={() => { resetForm(); onClose(); }}
                            className="h-10 w-10 bg-gray-100 rounded-full items-center justify-center"
                        >
                            <X size={20} color="black" />
                        </TouchableOpacity>
                    </View>

                    {/* Tab Buttons */}
                    <View className="flex-row px-6 pt-4 gap-3">
                        <TouchableOpacity
                            className={`flex-1 py-3 rounded-full items-center ${activeTab === 'list' ? 'bg-[#1E1E1E]' : 'bg-gray-100'}`}
                            onPress={() => { resetForm(); setActiveTab('list'); }}
                        >
                            <Text className={`font-bold ${activeTab === 'list' ? 'text-white' : 'text-gray-500'}`}>
                                My Contacts ({contacts.length})
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className={`flex-1 py-3 rounded-full items-center ${activeTab === 'create' ? 'bg-[#1E1E1E]' : 'bg-gray-100'}`}
                            onPress={() => { resetForm(); setActiveTab('create'); }}
                        >
                            <Text className={`font-bold ${activeTab === 'create' ? 'text-white' : 'text-gray-500'}`}>
                                {editingContact ? 'Edit Contact' : '+ New Contact'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {activeTab === 'list' ? (
                        /* Contact List */
                        <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false}>
                            {loading ? (
                                <Text className="text-gray-400 text-center py-8">Loading contacts...</Text>
                            ) : contacts.length === 0 ? (
                                <Text className="text-gray-400 text-center py-8">
                                    No contacts found. Tap &quot;+ New Contact&quot; to add one.
                                </Text>
                            ) : (
                                contacts.map((contact) => (
                                    <View key={contact.id} className="bg-gray-50 rounded-2xl p-4 mb-4">
                                        <View className="flex-row justify-between items-start mb-3">
                                            <View>
                                                <Text className="text-[#1E1E1E] font-bold text-lg mb-1">{contact.name}</Text>
                                                {contact.phone ? (
                                                    <View className="flex-row items-center mb-1">
                                                        <Phone size={14} color="#9CA3AF" />
                                                        <Text className="text-gray-500 ml-2">{contact.phone}</Text>
                                                    </View>
                                                ) : null}
                                                {contact.email ? (
                                                    <View className="flex-row items-center">
                                                        <Mail size={14} color="#9CA3AF" />
                                                        <Text className="text-gray-500 ml-2">{contact.email}</Text>
                                                    </View>
                                                ) : null}
                                                {contact.source ? (
                                                    <View className="flex-row items-start mt-1 pr-4">
                                                        <MapPin size={14} color="#4AC3FF" style={{ marginTop: 2 }} />
                                                        <Text className="text-gray-500 ml-2 flex-1">{contact.source}</Text>
                                                    </View>
                                                ) : null}
                                            </View>

                                            {/* Social Badges */}
                                            <View className="flex-row gap-2">
                                                {contact.socials?.instagram ? <Instagram size={16} color="#E1306C" /> : null}
                                                {contact.socials?.twitter ? <Twitter size={16} color="#1DA1F2" /> : null}
                                                {contact.socials?.linkedin ? <Linkedin size={16} color="#0A66C2" /> : null}
                                                {contact.socials?.github ? <Github size={16} color="#1E1E1E" /> : null}
                                            </View>
                                        </View>

                                        {/* Actions */}
                                        <View className="flex-row border-t border-gray-200 pt-3">
                                            <TouchableOpacity
                                                className="flex-1 items-center justify-center py-2 bg-gray-100 rounded-xl mr-2"
                                                onPress={() => handleEdit(contact)}
                                            >
                                                <Text className="text-[#1E1E1E] font-medium">Edit</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                className="flex-1 items-center justify-center py-2 bg-[#FF6B6B]/10 rounded-xl"
                                                onPress={() => handleDelete(contact)}
                                            >
                                                <Text className="text-[#FF6B6B] font-medium">Delete</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))
                            )}
                            <View className="h-10" />
                        </ScrollView>
                    ) : (
                        /* Create/Edit Form */
                        <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false}>
                            <Text className="text-[#1E1E1E] font-bold text-lg mb-4">
                                {editingContact ? 'Edit Contact Info' : 'New Contact Info'}
                            </Text>

                            <View className="bg-gray-50 rounded-2xl mb-6">
                                <View className="border-b border-gray-200">
                                    <TextInput
                                        className="text-[#1E1E1E] p-4 text-base font-medium"
                                        placeholder="Name *"
                                        placeholderTextColor="#9CA3AF"
                                        value={name}
                                        onChangeText={setName}
                                        autoCapitalize="words"
                                    />
                                </View>
                                <View className="border-b border-gray-200">
                                    <TextInput
                                        className="text-[#1E1E1E] p-4 text-base"
                                        placeholder="Phone"
                                        placeholderTextColor="#9CA3AF"
                                        value={phone}
                                        onChangeText={setPhone}
                                        keyboardType="phone-pad"
                                    />
                                </View>
                                <View>
                                    <TextInput
                                        className="text-[#1E1E1E] p-4 text-base"
                                        placeholder="Email"
                                        placeholderTextColor="#9CA3AF"
                                        value={email}
                                        onChangeText={setEmail}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                    />
                                </View>
                            </View>

                            <Text className="text-[#1E1E1E] font-bold text-lg mb-1">Where We Met</Text>
                            <Text className="text-gray-400 text-xs mb-4">
                                Note where you met or got their details — handy for future reference.
                            </Text>

                            <View className="bg-gray-50 rounded-2xl mb-8 flex-row items-start px-4">
                                <View className="pt-4">
                                    <MapPin size={20} color="#4AC3FF" />
                                </View>
                                <TextInput
                                    className="flex-1 text-[#1E1E1E] p-4 text-base"
                                    placeholder="e.g. React meetup, referred by Sarah, DM on LinkedIn…"
                                    placeholderTextColor="#9CA3AF"
                                    value={source}
                                    onChangeText={setSource}
                                    multiline
                                />
                            </View>

                            <Text className="text-[#1E1E1E] font-bold text-lg mb-4">Socials (Optional)</Text>

                            <View className="bg-gray-50 rounded-2xl mb-8">
                                <View className="flex-row items-center border-b border-gray-200 px-4">
                                    <Instagram size={20} color="#E1306C" />
                                    <TextInput
                                        className="flex-1 text-[#1E1E1E] p-4 text-base"
                                        placeholder="Instagram Username"
                                        placeholderTextColor="#9CA3AF"
                                        value={socialInstagram}
                                        onChangeText={setSocialInstagram}
                                        autoCapitalize="none"
                                    />
                                </View>
                                <View className="flex-row items-center border-b border-gray-200 px-4">
                                    <Twitter size={20} color="#1DA1F2" />
                                    <TextInput
                                        className="flex-1 text-[#1E1E1E] p-4 text-base"
                                        placeholder="Twitter/X Username"
                                        placeholderTextColor="#9CA3AF"
                                        value={socialTwitter}
                                        onChangeText={setSocialTwitter}
                                        autoCapitalize="none"
                                    />
                                </View>
                                <View className="flex-row items-center border-b border-gray-200 px-4">
                                    <Linkedin size={20} color="#0A66C2" />
                                    <TextInput
                                        className="flex-1 text-[#1E1E1E] p-4 text-base"
                                        placeholder="LinkedIn URL or Username"
                                        placeholderTextColor="#9CA3AF"
                                        value={socialLinkedin}
                                        onChangeText={setSocialLinkedin}
                                        autoCapitalize="none"
                                    />
                                </View>
                                <View className="flex-row items-center px-4">
                                    <Github size={20} color="#1E1E1E" />
                                    <TextInput
                                        className="flex-1 text-[#1E1E1E] p-4 text-base"
                                        placeholder="GitHub Username"
                                        placeholderTextColor="#9CA3AF"
                                        value={socialGithub}
                                        onChangeText={setSocialGithub}
                                        autoCapitalize="none"
                                    />
                                </View>
                            </View>

                            <TouchableOpacity
                                className="bg-[#1E1E1E] py-5 rounded-full items-center mb-10"
                                onPress={handleCreateOrUpdate}
                            >
                                <Text className="text-white font-bold text-lg">
                                    {editingContact ? 'Save Changes' : 'Add Contact'}
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
}
