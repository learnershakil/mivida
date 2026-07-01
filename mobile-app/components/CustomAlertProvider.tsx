import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, DeviceEventEmitter } from 'react-native';
import { UIAlertButton, UIAlertOptions } from '../services/uiAlertService';

interface AlertState {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: UIAlertButton[];
  options?: UIAlertOptions;
}

export const CustomAlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alertState, setAlertState] = useState<AlertState>({
    visible: false,
    title: '',
  });

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      'SHOW_CUSTOM_UI_ALERT',
      ({ title, message, buttons, options }: Omit<AlertState, 'visible'>) => {
        setAlertState({
          visible: true,
          title,
          message,
          buttons: buttons || [{ text: 'OK', onPress: () => {} }],
          options,
        });
      }
    );
    return () => subscription.remove();
  }, []);

  const handleClose = () => {
    setAlertState((prev) => ({ ...prev, visible: false }));
  };

  const handlePress = (button: UIAlertButton) => {
    handleClose();
    if (button.onPress) {
      // Small timeout to allow modal to close before executing action
      setTimeout(button.onPress, 100);
    }
  };

  const buttons = alertState.buttons || [];
  const isCancelable = alertState.options?.cancelable !== false;

  return (
    <>
      {children}
      <Modal
        visible={alertState.visible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (isCancelable) {
            handleClose();
            alertState.options?.onDismiss?.();
          }
        }}
      >
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className="bg-[#1E1E1E] w-full rounded-[24px] p-6 shadow-xl border border-white/10">
            <Text className="text-white text-xl font-bold mb-3 text-center">{alertState.title}</Text>
            {!!alertState.message && (
              <Text className="text-white/80 text-center mb-6 leading-6">
                {alertState.message}
              </Text>
            )}
            
            <View className="flex-col gap-3">
              {buttons.map((button, index) => {
                const isDestructive = button.style === 'destructive';
                const isCancel = button.style === 'cancel';
                const isDefault = button.style === 'default' || !button.style;

                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => handlePress(button)}
                    className={`py-4 rounded-[16px] items-center ${
                      isDestructive ? 'bg-red-500/20 border border-red-500/50' : 
                      isCancel ? 'bg-white/5 border border-white/10' : 
                      'bg-[#C0F67F]'
                    }`}
                  >
                    <Text
                      className={`font-bold text-lg ${
                        isDestructive ? 'text-red-400' : 
                        isCancel ? 'text-white/70' : 
                        'text-black'
                      }`}
                    >
                      {button.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};
