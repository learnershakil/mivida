import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { useToastStore } from '../store/toastStore';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react-native';

export function GlobalToast() {
  const { visible, message, type } = useToastStore();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-50)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 50,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -50,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible && opacity._value === 0) return null;

  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle2 color="#C0F67F" size={20} />;
      case 'error': return <AlertCircle color="#FF6E6E" size={20} />;
      default: return <Info color="#4AC3FF" size={20} />;
    }
  };

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ translateY }] }]}>
      <View style={styles.content}>
        {getIcon()}
        <Text style={styles.message}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    zIndex: 9999,
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#3C3C3E',
  },
  message: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 10,
  }
});
