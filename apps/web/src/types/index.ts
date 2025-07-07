export interface Peer {
  id: string;
  name: string;
  emoji: string;
  color: string;
  isOnline: boolean;
  roomId?: string;
}

export interface FileTransfer {
  id: string;
  file: File;
  peer: Peer;
  status: 'pending' | 'connecting' | 'transferring' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  speed?: number;
  timeRemaining?: number;
}

export interface SignalData {
  type: 'offer' | 'answer' | 'ice-candidate';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidate;
}

export interface SocketEvents {
  'join-room': (data: { room: string; userId: string; name: string; color: string; emoji: string }) => void;
  'peers': (peers: Peer[]) => void;
  'peer-joined': (peer: Peer) => void;
  'peer-left': (peerId: string) => void;
  'update-profile': (data: { name: string; color: string; emoji: string }) => void;
  'signal': (data: { to: string; from: string; data: SignalData }) => void;
}

// Client-side event logging types
export interface EventEntry {
  id: string;                // uuid.v4()
  type: string;              // e.g. "click" | "navigation" | "form_submit"
  details: Record<string, any>;
  timestamp: number;         // Date.now()
  sessionId: string;         // generated once per app load
  userId?: string;           // optional if logged in
}