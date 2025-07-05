export interface Peer {
  id: string;
  name: string;
  emoji: string;
  color: string;
  isOnline: boolean;
  socketId: string;
  roomId?: string;
}

export interface SignalData {
  type: 'offer' | 'answer' | 'ice-candidate';
  sdp?: any;
  candidate?: any;
}

export interface JoinRoomData {
  room: string;
  userId: string;
  name: string;
  color: string;
  emoji: string;
}

export interface UpdateProfileData {
  name: string;
  color: string;
  emoji: string;
}

export interface SignalMessage {
  to: string;
  from: string;
  data: SignalData;
}

export interface Room {
  id: string;
  peers: Map<string, Peer>;
  createdAt: Date;
}

export interface RedisPeer {
  id: string;
  name: string;
  emoji: string;
  color: string;
  isOnline: boolean;
  socketId: string;
  roomId?: string;
  lastSeen: number;
} 