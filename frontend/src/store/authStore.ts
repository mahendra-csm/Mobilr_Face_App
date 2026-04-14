import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseAuth } from '../services/firebase';

interface Student {
  id: string;
  name: string;
  roll_number: string;
  regulation: string;
  branch: string;
  section?: string;
  year: number;
  college: string;
  face_registered: boolean;
}

interface Admin {
  email: string;
  role: string;
}

interface AuthState {
  token: string | null;
  user: Student | Admin | null;
  userType: 'student' | 'admin' | null;
  isLoading: boolean;
  setAuth: (token: string, user: Student | Admin, userType: 'student' | 'admin') => Promise<void>;
  clearAuth: () => Promise<void>;
  loadAuth: () => Promise<void>;
  updateFaceRegistered: (status: boolean) => void;
  updateStudent: (updates: Partial<Student>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  userType: null,
  isLoading: true,

  setAuth: async (token, user, userType) => {
    await AsyncStorage.setItem('auth_token', token);
    await AsyncStorage.setItem('auth_user', JSON.stringify(user));
    await AsyncStorage.setItem('auth_type', userType);
    set({ token, user, userType, isLoading: false });
  },

  clearAuth: async () => {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('auth_user');
    await AsyncStorage.removeItem('auth_type');
    // Sign out from Firebase
    try {
      await firebaseAuth.signOut();
    } catch {
      // Ignore sign out errors
    }
    set({ token: null, user: null, userType: null, isLoading: false });
  },

  loadAuth: async () => {
    try {
      // Wait for Firebase to finish restoring the persisted session
      const firebaseUser = await firebaseAuth.waitForAuthReady();
      if (firebaseUser) {
        const token = await firebaseAuth.getIdToken();
        const userStr = await AsyncStorage.getItem('auth_user');
        if (token && userStr) {
          const user = JSON.parse(userStr);
          set({ token, user, userType: 'student', isLoading: false });
          return;
        }
      }
      
      // Fallback to stored auth (for admin)
      const token = await AsyncStorage.getItem('auth_token');
      const userStr = await AsyncStorage.getItem('auth_user');
      const userType = await AsyncStorage.getItem('auth_type') as 'student' | 'admin' | null;
      
      if (token && userStr && userType) {
        const user = JSON.parse(userStr);
        set({ token, user, userType, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  updateFaceRegistered: (status) => {
    const currentUser = get().user;
    if (currentUser && 'face_registered' in currentUser) {
      const updatedUser = { ...currentUser, face_registered: status } as Student;
      set({ user: updatedUser });
      // Also update in AsyncStorage
      AsyncStorage.setItem('auth_user', JSON.stringify(updatedUser));
    }
  },

  updateStudent: (updates) => {
    const currentUser = get().user;
    if (currentUser && 'roll_number' in currentUser) {
      const updatedUser = { ...currentUser, ...updates } as Student;
      set({ user: updatedUser });
      // Also update in AsyncStorage
      AsyncStorage.setItem('auth_user', JSON.stringify(updatedUser));
    }
  },
}));
