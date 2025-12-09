export enum Role {
  KTA = 'Kta', // Boy
  KTI = 'Kti', // Girl
  ADMIN = 'Admin'
}

export interface User {
  id: string;
  displayName: string;
  age: number;
  role: Role;
  email: string;
  password?: string; 
  bio?: string;
  photoUrl?: string;
  interests?: string[]; 
  favorites?: string[];
  fcmToken?: string; // NEW
  online: boolean;
  lastSeen: number;
  blockedUsers: string[];
  isBanned: boolean;
}

export interface Match {
  id: string;
  userA: string;
  userB: string;
  createdAt: number;
  chatRoomId: string;
  active: boolean;
}

export interface Message {
  id: string;
  chatRoomId: string;
  fromUserId: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface Report {
  id: string;
  targetUserId: string;
  reporterUserId: string;
  reason: string;
  timestamp: number;
  resolved: boolean;
}

export interface Announcement {
  id: string;
  text: string;
  active: boolean;
  createdAt: number;
}

export enum ViewState {
  LANDING = 'LANDING',
  DASHBOARD = 'DASHBOARD',
  CHAT = 'CHAT',
  PROFILE = 'PROFILE',
  ADMIN = 'ADMIN',
  SETUP = 'SETUP'
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, pass: string) => Promise<User>;
  signup: (data: Partial<User>) => Promise<User>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
}