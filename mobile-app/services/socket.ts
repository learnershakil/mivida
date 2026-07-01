import { io, Socket } from 'socket.io-client';
import { startDeadManSwitch, stopDeadManSwitch } from './background';

// Replace with Laptop IP manually or dynamic logic
const BACKEND_URL = 'http://192.168.1.10:3000'; 

class SocketService {
  public socket: Socket | null = null;
  public userId: string | null = null;

  init(userId: string) {
    this.userId = userId;
    this.socket = io(BACKEND_URL, {
      query: { userId },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('Socket Connected:', this.socket?.id);
    });

    this.socket.on('lockdown_alert', (data) => {
      console.log('Lockdown Alert:', data);
      // Trigger native module or full screen overlay
      // For now, simpler handling
      startDeadManSwitch(); // Example reuse
    });

    this.socket.on('disconnect', () => {
      console.log('Socket Disconnected');
    });
  }

  emit(event: string, data: any) {
    this.socket?.emit(event, data);
  }
}

export const socketService = new SocketService();
