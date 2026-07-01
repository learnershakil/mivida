import React, { useState, useEffect, ReactNode } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, Alert, Vibration, StyleSheet } from 'react-native';
import { Lock, Settings, X } from 'lucide-react-native';
import vaultService from '../services/vaultService';

interface VaultAccessProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    userId: string;
}

/**
 * Named export - VaultAccess as a wrapper component that renders children
 * Used by music screen to wrap UI elements
 */
interface VaultAccessWrapperProps {
    children: ReactNode;
}

export function VaultAccess({ children }: VaultAccessWrapperProps) {
    // This is a simple wrapper that just renders children
    // The actual vault access functionality is in the default export
    return <>{children}</>;
}

/**
 * VaultAccessModal - Full vault access modal with passcode entry
 * Used by index and profile screens
 */
export default function VaultAccessModal({ visible, onClose, onSuccess, userId }: VaultAccessProps) {
    const [isSetupMode, setIsSetupMode] = useState(false);
    const [code, setCode] = useState('');
    const [confirmCode, setConfirmCode] = useState('');
    const [isVaultSetup, setIsVaultSetup] = useState(false);
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        if (visible) {
            checkVaultSetup();
        }
    }, [userId, visible]);

    useEffect(() => {
        if (!visible) {
            // Reset state when modal closes
            setCode('');
            setConfirmCode('');
        }
    }, [visible]);

    const checkVaultSetup = async () => {
        setIsChecking(true);
        try {
            const setup = await vaultService.isSetup(userId);
            setIsVaultSetup(setup);
            setIsSetupMode(!setup);
        } catch (error) {
            console.error('Error checking vault setup:', error);
        } finally {
            setIsChecking(false);
        }
    };

    const handleSetup = async () => {
        if (code.length < 4) {
            Alert.alert('Error', 'Passcode must be at least 4 digits');
            return;
        }

        if (code !== confirmCode) {
            Vibration.vibrate([100, 100, 100]);
            Alert.alert('Error', 'Passcodes do not match');
            setConfirmCode('');
            return;
        }

        try {
            await vaultService.setup(code, userId);
            setCode('');
            setConfirmCode('');
            setIsVaultSetup(true);
            Alert.alert('Vault Created', 'Your secure vault is now set up. Enter passcode to access.');
            // After setup, switch to unlock mode
            setIsSetupMode(false);
        } catch (error) {
            console.error('Setup error:', error);
            Alert.alert('Error', 'Failed to create vault');
        }
    };

    const verifyCode = async () => {
        if (code.length < 4) {
            Alert.alert('Error', 'Please enter your passcode');
            return;
        }

        try {
            const isValid = await vaultService.verify(code, userId);

            if (isValid) {
                setCode('');
                onSuccess();
            } else {
                Vibration.vibrate([100, 100, 100]);
                Alert.alert(
                    'Access Denied',
                    'Incorrect passcode.',
                    [
                        { text: 'Try Again', style: 'cancel' },
                        {
                            text: 'Reset Vault',
                            style: 'destructive',
                            onPress: handleResetVault
                        },
                    ]
                );
                setCode('');
            }
        } catch (error) {
            console.error('Verify error:', error);
            Alert.alert('Error', 'Failed to verify passcode');
            setCode('');
        }
    };

    const handleResetVault = () => {
        Alert.alert(
            'Reset Vault?',
            'This will delete your vault passcode and all vault media. You will need to set up a new passcode.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await vaultService.reset(userId, true);
                            setIsVaultSetup(false);
                            setIsSetupMode(true);
                            Alert.alert('Vault Reset', 'Please set up a new passcode.');
                        } catch (error) {
                            console.error('Reset error:', error);
                            Alert.alert('Error', 'Failed to reset vault');
                        }
                    },
                },
            ]
        );
    };

    const handleSubmit = () => {
        if (isSetupMode) {
            handleSetup();
        } else {
            verifyCode();
        }
    };

    const handleClose = () => {
        setCode('');
        setConfirmCode('');
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Close button */}
                    <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                        <X size={20} color="#fff" />
                    </TouchableOpacity>

                    <View style={styles.iconContainer}>
                        {isSetupMode ? <Settings size={32} color="#fff" /> : <Lock size={32} color="#fff" />}
                    </View>

                    <Text style={styles.title}>
                        {isSetupMode ? 'Create Vault' : 'Secure Vault'}
                    </Text>
                    <Text style={styles.subtitle}>
                        {isSetupMode
                            ? 'Set a 4+ digit passcode to protect your vault.'
                            : 'Enter your passcode to access hidden files.'}
                    </Text>

                    <TextInput
                        style={styles.input}
                        placeholder={isSetupMode ? 'New Passcode' : '0000'}
                        placeholderTextColor="#555"
                        keyboardType="number-pad"
                        maxLength={8}
                        value={code}
                        onChangeText={setCode}
                        secureTextEntry
                        autoFocus
                    />

                    {isSetupMode && (
                        <TextInput
                            style={[styles.input, { marginBottom: 24 }]}
                            placeholder="Confirm Passcode"
                            placeholderTextColor="#555"
                            keyboardType="number-pad"
                            maxLength={8}
                            value={confirmCode}
                            onChangeText={setConfirmCode}
                            secureTextEntry
                        />
                    )}

                    {!isSetupMode && <View style={{ height: 8 }} />}

                    <View style={styles.buttonRow}>
                        <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                            <Text style={styles.submitButtonText}>{isSetupMode ? 'Create' : 'Unlock'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    container: {
        width: '100%',
        backgroundColor: '#1c1c1e',
        padding: 24,
        borderRadius: 32,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
    },
    closeButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        height: 32,
        width: 32,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        marginBottom: 24,
        height: 64,
        width: 64,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 14,
        marginBottom: 24,
        textAlign: 'center',
    },
    input: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        width: '100%',
        padding: 16,
        borderRadius: 16,
        color: 'white',
        textAlign: 'center',
        fontSize: 24,
        fontWeight: 'bold',
        letterSpacing: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginBottom: 16,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 16,
        width: '100%',
    },
    cancelButton: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    cancelButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
    submitButton: {
        flex: 1,
        backgroundColor: '#C0F67F',
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    submitButtonText: {
        color: 'black',
        fontWeight: 'bold',
    },
});
