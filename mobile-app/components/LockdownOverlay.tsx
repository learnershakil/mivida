import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, BackHandler, StyleSheet, Modal, Vibration } from 'react-native';
import { lockdownService } from '../services/lockdown';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Phone, AlertTriangle } from 'lucide-react-native';

type LockdownStatus = {
    isActive: boolean;
    remainingMs: number;
    totalDurationMs: number;
    breakAttempts: number;
};

export function LockdownOverlay() {
    const [status, setStatus] = useState<LockdownStatus>({
        isActive: false,
        remainingMs: 0,
        totalDurationMs: 0,
        breakAttempts: 0,
    });

    useEffect(() => {
        // Subscribe to lockdown status changes
        const unsubscribe = lockdownService.subscribe(setStatus);

        // Disable Back Button during lockdown
        const onBackPress = () => {
            if (status.isActive) {
                // Vibrate to indicate blocked action
                Vibration.vibrate(100);
                return true; // Prevent default behavior
            }
            return false;
        };

        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

        return () => {
            unsubscribe();
            subscription.remove();
        };
    }, [status.isActive]);

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const getProgress = () => {
        if (status.totalDurationMs === 0) return 0;
        return ((status.totalDurationMs - status.remainingMs) / status.totalDurationMs) * 100;
    };

    const handleEmergencyCall = async () => {
        await lockdownService.openEmergencyDialer();
    };

    if (!status.isActive) return null;

    return (
        <Modal visible={status.isActive} animationType="fade" transparent={false}>
            <View style={styles.container}>
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.content}>
                        {/* Break attempt warning */}
                        {status.breakAttempts > 0 && (
                            <View style={styles.warningBanner}>
                                <AlertTriangle size={16} color="#FF3B30" />
                                <Text style={styles.warningText}>
                                    {status.breakAttempts} break attempt{status.breakAttempts > 1 ? 's' : ''} detected
                                </Text>
                            </View>
                        )}

                        <Text style={styles.title}>FOCUS MODE</Text>

                        {/* Progress ring placeholder - simple bar for now */}
                        <View style={styles.progressContainer}>
                            <View style={[styles.progressBar, { width: `${getProgress()}%` }]} />
                        </View>

                        <Text style={styles.timer}>{formatTime(status.remainingMs)}</Text>
                        <Text style={styles.subtitle}>Stay focused. You've got this.</Text>

                        <View style={styles.emergencyContainer}>
                            <Text style={styles.emergencyText}>Emergency?</Text>
                            <TouchableOpacity
                                style={styles.callButton}
                                onPress={handleEmergencyCall}
                                activeOpacity={0.7}
                            >
                                <Phone size={16} color="white" />
                                <Text style={styles.callButtonText}>Open Dialer</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </SafeAreaView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
        zIndex: 9999,
    },
    safeArea: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        gap: 20,
        width: '100%',
        paddingHorizontal: 40,
    },
    warningBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(255, 59, 48, 0.15)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginBottom: 20,
    },
    warningText: {
        color: '#FF3B30',
        fontSize: 14,
        fontWeight: '600',
    },
    title: {
        color: '#FF3B30',
        fontSize: 24,
        fontWeight: 'bold',
        letterSpacing: 2,
    },
    progressContainer: {
        width: '100%',
        height: 4,
        backgroundColor: '#333',
        borderRadius: 2,
        marginVertical: 20,
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#C0F67F',
        borderRadius: 2,
    },
    timer: {
        color: '#FFFFFF',
        fontSize: 72,
        fontWeight: '900',
        fontVariant: ['tabular-nums'],
    },
    subtitle: {
        color: '#8e8e93',
        fontSize: 16,
    },
    emergencyContainer: {
        marginTop: 60,
        alignItems: 'center',
        gap: 12,
    },
    emergencyText: {
        color: '#424242',
        fontSize: 14,
    },
    callButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#1c1c1e',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#333',
    },
    callButtonText: {
        color: 'white',
        fontWeight: '600',
    },
});
