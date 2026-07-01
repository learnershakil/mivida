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
import { Phone, Mail, Instagram, Twitter, Linkedin, Github } from 'lucide-react-native';

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
                });
            } else {
                await contactService.create({
                    name: name.trim(),
                    email: email.trim(),
                    phone: phone.trim(),
                    socials,
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
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 bg-black/50 justify-end">
                <View className="bg-[#1E1E1E] rounded-t-3xl h-[90%]">
                    {/* Header */}
                    <View className="flex-row justify-between items-center p-5 border-b border-[#2C2C2E]">
                        <Text className="text-xl font-bold text-white">Contacts</Text>
                        <TouchableOpacity onPress={() => { resetForm(); onClose(); }}>
                            <Text className="text-[#4AC3FF] text-lg font-medium">Done</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Tab Buttons */}
                    <View className="flex-row p-3">
                        <TouchableOpacity
                            className={`flex-1 py-3 rounded-xl mr-2 ${activeTab === 'list' ? 'bg-[#4AC3FF]' : 'bg-[#2C2C2E]'}`}
                            onPress={() => { resetForm(); setActiveTab('list'); }}
                        >
                            <Text className={`text-center font-bold ${activeTab === 'list' ? 'text-black' : 'text-white'}`}>
                                My Contacts ({contacts.length})
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className={`flex-1 py-3 rounded-xl ${activeTab === 'create' ? 'bg-[#C0F67F]' : 'bg-[#2C2C2E]'}`}
                            onPress={() => { resetForm(); setActiveTab('create'); }}
                        >
                            <Text className={`text-center font-bold ${activeTab === 'create' ? 'text-black' : 'text-white'}`}>
                                {editingContact ? 'Edit Contact' : '+ New Contact'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {activeTab === 'list' ? (
                        /* Contact List */
                        <ScrollView className="flex-1 px-4 pt-2">
                            {loading ? (
                                <Text className="text-gray-400 text-center py-8">Loading contacts...</Text>
                            ) : contacts.length === 0 ? (
                                <Text className="text-gray-400 text-center py-8">
                                    No contacts found. Tap "+ New Contact" to add one.
                                </Text>
                            ) : (
                                contacts.map((contact) => (
                                    <View key={contact.id} className="bg-[#2C2C2E] rounded-2xl p-4 mb-4 shadow-sm">
                                        <View className="flex-row justify-between items-start mb-3">
                                            <View>
                                                <Text className="text-white font-bold text-lg mb-1">{contact.name}</Text>
                                                {contact.phone ? (
                                                    <View className="flex-row items-center mb-1">
                                                        <Phone size={14} color="#8E8E93" />
                                                        <Text className="text-gray-400 ml-2">{contact.phone}</Text>
                                                    </View>
                                                ) : null}
                                                {contact.email ? (
                                                    <View className="flex-row items-center">
                                                        <Mail size={14} color="#8E8E93" />
                                                        <Text className="text-gray-400 ml-2">{contact.email}</Text>
                                                    </View>
                                                ) : null}
                                            </View>
                                            
                                            {/* Social Badges */}
                                            <View className="flex-row gap-2">
                                                {contact.socials?.instagram ? <Instagram size={16} color="#FF8E6E" /> : null}
                                                {contact.socials?.twitter ? <Twitter size={16} color="#4AC3FF" /> : null}
                                                {contact.socials?.linkedin ? <Linkedin size={16} color="#D8C8FE" /> : null}
                                                {contact.socials?.github ? <Github size={16} color="#FFFFFF" /> : null}
                                            </View>
                                        </View>

                                        {/* Actions */}
                                        <View className="flex-row border-t border-[#3C3C3E] pt-3">
                                            <TouchableOpacity
                                                className="flex-1 items-center justify-center py-2 bg-[#3C3C3E] rounded-lg mr-2"
                                                onPress={() => handleEdit(contact)}
                                            >
                                                <Text className="text-white font-medium">Edit</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                className="flex-1 items-center justify-center py-2 bg-[#FF6E6E]/20 rounded-lg"
                                                onPress={() => handleDelete(contact)}
                                            >
                                                <Text className="text-[#FF6E6E] font-medium">Delete</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))
                            )}
                            <View className="h-10" />
                        </ScrollView>
                    ) : (
                        /* Create/Edit Form */
                        <ScrollView className="flex-1 px-5 pt-4">
                            <Text className="text-white font-bold text-lg mb-4">
                                {editingContact ? 'Edit Contact Info' : 'New Contact Info'}
                            </Text>

                            <View className="bg-[#2C2C2E] p-1 rounded-2xl mb-6">
                                <View className="border-b border-[#3C3C3E]">
                                    <TextInput
                                        className="text-white p-4 text-base font-medium"
                                        placeholder="Name *"
                                        placeholderTextColor="#8E8E93"
                                        value={name}
                                        onChangeText={setName}
                                        autoCapitalize="words"
                                    />
                                </View>
                                <View className="border-b border-[#3C3C3E]">
                                    <TextInput
                                        className="text-white p-4 text-base"
                                        placeholder="Phone"
                                        placeholderTextColor="#8E8E93"
                                        value={phone}
                                        onChangeText={setPhone}
                                        keyboardType="phone-pad"
                                    />
                                </View>
                                <View>
                                    <TextInput
                                        className="text-white p-4 text-base"
                                        placeholder="Email"
                                        placeholderTextColor="#8E8E93"
                                        value={email}
                                        onChangeText={setEmail}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                    />
                                </View>
                            </View>

                            <Text className="text-white font-bold text-lg mb-4">Socials (Optional)</Text>
                            
                            <View className="bg-[#2C2C2E] p-1 rounded-2xl mb-8">
                                <View className="flex-row items-center border-b border-[#3C3C3E] px-4">
                                    <Instagram size={20} color="#FF8E6E" />
                                    <TextInput
                                        className="flex-1 text-white p-4 text-base"
                                        placeholder="Instagram Username"
                                        placeholderTextColor="#8E8E93"
                                        value={socialInstagram}
                                        onChangeText={setSocialInstagram}
                                        autoCapitalize="none"
                                    />
                                </View>
                                <View className="flex-row items-center border-b border-[#3C3C3E] px-4">
                                    <Twitter size={20} color="#4AC3FF" />
                                    <TextInput
                                        className="flex-1 text-white p-4 text-base"
                                        placeholder="Twitter/X Username"
                                        placeholderTextColor="#8E8E93"
                                        value={socialTwitter}
                                        onChangeText={setSocialTwitter}
                                        autoCapitalize="none"
                                    />
                                </View>
                                <View className="flex-row items-center border-b border-[#3C3C3E] px-4">
                                    <Linkedin size={20} color="#D8C8FE" />
                                    <TextInput
                                        className="flex-1 text-white p-4 text-base"
                                        placeholder="LinkedIn URL or Username"
                                        placeholderTextColor="#8E8E93"
                                        value={socialLinkedin}
                                        onChangeText={setSocialLinkedin}
                                        autoCapitalize="none"
                                    />
                                </View>
                                <View className="flex-row items-center px-4">
                                    <Github size={20} color="#FFFFFF" />
                                    <TextInput
                                        className="flex-1 text-white p-4 text-base"
                                        placeholder="GitHub Username"
                                        placeholderTextColor="#8E8E93"
                                        value={socialGithub}
                                        onChangeText={setSocialGithub}
                                        autoCapitalize="none"
                                    />
                                </View>
                            </View>

                            <TouchableOpacity
                                className="bg-[#C0F67F] p-4 rounded-full items-center mb-10 shadow-sm"
                                onPress={handleCreateOrUpdate}
                            >
                                <Text className="text-black font-bold text-lg">
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
