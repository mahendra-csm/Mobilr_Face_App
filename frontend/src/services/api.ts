import axios, { isAxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseAuth } from './firebase';

const configuredBackendUrl = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();

export const BACKEND_URL =
  configuredBackendUrl ||
  (__DEV__
    ? 'http://localhost:8000'
    : (() => {
        throw new Error('EXPO_PUBLIC_BACKEND_URL must be configured for production builds.');
      })());

export const buildWebSocketUrl = (path: string) =>
  `${BACKEND_URL.replace(/^http/i, 'ws')}${path}`;

if (__DEV__) console.log('[API] Backend URL:', BACKEND_URL);

const DEFAULT_TIMEOUT_MS = 60000;
const FACE_REGISTRATION_TIMEOUT_MS = 180000;
const ATTENDANCE_TIMEOUT_MS = 120000;

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: DEFAULT_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach auth token
api.interceptors.request.use(async (config) => {
  if (__DEV__) console.log('[API] Request:', config.method?.toUpperCase(), config.url);
  
  // First try to get Firebase token
  const firebaseToken = await firebaseAuth.getIdToken();
  if (firebaseToken) {
    config.headers.Authorization = `Bearer ${firebaseToken}`;
    return config;
  }
  
  // Fallback to stored token (for admin)
  const token = await AsyncStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  if (__DEV__) console.log('[API] Request error:', error);
  return Promise.reject(error);
});

// Handle response errors
api.interceptors.response.use(
  (response) => {
    if (__DEV__) console.log('[API] Response:', response.status, response.config.url);
    return response;
  },
  async (error) => {
    if (__DEV__) {
      console.log('[API] Error:', error.message, error.response?.status, error.config?.url);
    }
    
    if (error.response?.status === 401) {
      // Clear stored auth data on unauthorized
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('auth_user');
      await AsyncStorage.removeItem('auth_type');
      // Also sign out from Firebase
      try {
        await firebaseAuth.signOut();
      } catch {
        // Ignore sign out errors
      }
    }
    return Promise.reject(error);
  }
);

// Student API
export const studentAPI = {
  register: (data: {
    name: string;
    roll_number: string;
    password: string;
    regulation: string;
    branch: string;
    section: string;
    year: number;
    college: string;
  }) => api.post('/student/register', data),

  login: (data: { roll_number: string; password: string }) =>
    api.post('/student/login', data),

  registerFace: (data: { face_images: string[] }) =>
    api.post('/student/register-face', data, { timeout: FACE_REGISTRATION_TIMEOUT_MS }),

  getProfile: () => api.get('/student/profile'),

  updateProfile: (data: { year?: number; name?: string }) =>
    api.put('/student/profile', data),

  getAttendanceHistory: () => api.get('/student/attendance-history'),

  markAttendance: (data: {
    face_image: string;
    latitude: number;
    longitude: number;
  }) => api.post('/student/mark-attendance', data, { timeout: ATTENDANCE_TIMEOUT_MS }),
};

// Admin API
export const adminAPI = {
  login: (data: { email: string; password: string }) =>
    api.post('/admin/login', data),

  getStatistics: (branch?: string, year?: number) =>
    api.get('/admin/statistics', {
      params: { branch, year },
    }),

  getAttendance: (branch?: string, year?: number, date?: string) =>
    api.get('/admin/attendance', {
      params: { branch, year, date_filter: date },
    }),

  getStudents: (branch?: string, year?: number, section?: string) =>
    api.get('/admin/students', {
      params: { branch, year, section },
    }),

  exportAttendance: (branch?: string, year?: number, date?: string) =>
    api.get('/admin/export-attendance', {
      params: { branch, year, date_filter: date },
    }),

  deleteStudent: (studentId: string) =>
    api.delete(`/admin/student/${studentId}`),
};

export interface AssistantMessagePayload {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string | Date;
}

export const assistantAPI = {
  studentChat: (message: string, history: AssistantMessagePayload[] = []) =>
    api.post('/assistant/student', { message, history }),

  adminChat: (
    message: string,
    history: AssistantMessagePayload[] = [],
    appContext?: {
      totalStudents?: number;
      todayAttendance?: number;
      statistics?: Record<string, unknown>;
      attendanceRecords?: Record<string, unknown>[];
      students?: Record<string, unknown>[];
    }
  ) => api.post('/assistant/admin', { message, history, appContext }),
};

export const describeApiError = (error: unknown, fallback: string) => {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }
    if (error.code === 'ECONNABORTED') {
      return 'The request took too long. Please retry with fewer, clearer photos or try again after the backend finishes processing.';
    }
    if (!error.response) {
      return `Network error. Make sure your phone and laptop are on the same Wi-Fi and the backend ${BACKEND_URL} is running.`;
    }
  }
  return fallback;
};

export default api;
