import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/src/utils/constants';
import { describeApiError, studentAPI } from '@/src/services/api';
import { useAuthStore } from '@/src/store/authStore';

const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;

type AttendanceStep = 'ready' | 'camera' | 'preview' | 'processing' | 'success' | 'error';

const ATTENDANCE_IMAGE_QUALITY = 0.8;

export default function AttendanceScreen() {
  const { user } = useAuthStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<AttendanceStep>('ready');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [successTime, setSuccessTime] = useState('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  const student = user as any;

  const startAttendance = () => setStep('camera');

  const captureWithCamera = async () => {
    if (!cameraRef.current) return;
    setLoading(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: ATTENDANCE_IMAGE_QUALITY });
      if (photo?.base64) {
        setCapturedImage(`data:image/jpeg;base64,${photo.base64}`);
        setStep('preview');
      }
    } catch {
      openSystemCamera();
    } finally {
      setLoading(false);
    }
  };

  const openSystemCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return;
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false, quality: ATTENDANCE_IMAGE_QUALITY, base64: true,
        cameraType: ImagePicker.CameraType.front,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        setCapturedImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
        setStep('preview');
      }
    } catch {
      setMessage('Failed to open camera');
      setStep('error');
    }
  };

  const confirmAndSubmit = async (attempt = 1) => {
    if (!capturedImage) return;
    setStep('processing');
    setLoading(true);
    try {
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      if (locStatus !== 'granted') {
        setMessage('Location permission is required to mark attendance. Please enable it in your device settings.');
        setStep('error');
        setLoading(false);
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const response = await studentAPI.markAttendance({
        face_image: capturedImage,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      setSuccessTime(response.data.attendance.time);
      setStep('success');
    } catch (error: any) {
      // Auto-retry once on pure network errors
      const isNetworkError = !error?.response && error?.code !== 'ECONNABORTED';
      if (isNetworkError && attempt === 1) {
        console.log('Network error, retrying attendance once...');
        setLoading(false);
        await new Promise(r => setTimeout(r, 2000));
        return confirmAndSubmit(2);
      }
      const detail = describeApiError(error, 'Failed to mark attendance. Please try again.');
      setMessage(detail);
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setStep('ready');
    setCapturedImage(null);
    setMessage('');
  };

  // Face not registered
  if (!student?.face_registered) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <View style={[styles.iconCircle, { backgroundColor: COLORS.warning + '20' }]}>
            <Ionicons name="alert-circle" size={60} color={COLORS.warning} />
          </View>
          <Text style={styles.title}>Face Not Registered</Text>
          <Text style={styles.subtitle}>Register your face in Profile tab first.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Ready
  if (step === 'ready') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mark Attendance</Text>
        </View>
        <View style={styles.center}>
          <View style={styles.iconCircle}>
            <Ionicons name="camera" size={50} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>Face Verification</Text>
          <Text style={styles.subtitle}>Take a photo to verify your identity</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={startAttendance}>
            <Ionicons name="scan" size={24} color="#fff" />
            <Text style={styles.primaryBtnText}>Start Verification</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={openSystemCamera}>
            <Text style={styles.secondaryBtnText}>Use System Camera</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Camera
  if (step === 'camera') {
    if (!permission?.granted) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.center}>
            <Ionicons name="camera" size={60} color={COLORS.textLight} />
            <Text style={styles.title}>Camera Permission Required</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
              <Text style={styles.primaryBtnText}>Grant Permission</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={openSystemCamera}>
              <Text style={styles.secondaryBtnText}>Use System Camera</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={styles.cameraContainer}>
        <View style={styles.cameraHeader}>
          <TouchableOpacity onPress={resetFlow}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
          <Text style={styles.cameraTitle}>Face Verification</Text>
        </View>
        <View style={styles.cameraWrapper}>
          <CameraView ref={cameraRef} style={styles.camera} facing="front" />
        </View>
        <View style={styles.cameraControls}>
          <TouchableOpacity style={styles.altBtn} onPress={openSystemCamera}>
            <Ionicons name="camera-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.captureBtn} onPress={captureWithCamera} disabled={loading}>
            <View style={styles.captureBtnInner}>
              {loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="scan" size={32} color="#fff" />}
            </View>
          </TouchableOpacity>
          <View style={{ width: 50 }} />
        </View>
      </SafeAreaView>
    );
  }

  // Preview
  if (step === 'preview' && capturedImage) {
    return (
      <SafeAreaView style={styles.cameraContainer}>
        <View style={styles.cameraHeader}>
          <TouchableOpacity onPress={() => setStep('camera')}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
          <Text style={styles.cameraTitle}>Confirm Photo</Text>
        </View>
        <View style={styles.cameraWrapper}>
          <Image source={{ uri: capturedImage }} style={styles.previewImage} />
        </View>
        <View style={styles.confirmControls}>
          <TouchableOpacity style={styles.retakeBtn} onPress={() => setStep('camera')}>
            <Ionicons name="refresh" size={20} color={COLORS.error} />
            <Text style={styles.retakeBtnText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmBtn} onPress={() => confirmAndSubmit()}>
            <Ionicons name="checkmark" size={20} color="#fff" />
            <Text style={styles.confirmBtnText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Processing
  if (step === 'processing') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.title}>Verifying...</Text>
          <Text style={styles.subtitle}>Analysing face — please wait up to 30 seconds</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Success
  if (step === 'success') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <View style={[styles.iconCircle, { backgroundColor: COLORS.success + '20' }]}>
            <Ionicons name="checkmark" size={60} color={COLORS.success} />
          </View>
          <Text style={[styles.title, { color: COLORS.success }]}>Attendance Marked!</Text>
          <Text style={styles.timeText}>{successTime}</Text>
          <Text style={styles.subtitle}>{new Date().toLocaleDateString()}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error - Show message on screen instead of alert
  if (step === 'error') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <View style={[styles.iconCircle, { backgroundColor: COLORS.error + '20' }]}>
            <Ionicons name="close" size={60} color={COLORS.error} />
          </View>
          <Text style={[styles.title, { color: COLORS.error }]}>Verification Failed</Text>
          <View style={styles.errorBox}>
            <Ionicons name="information-circle" size={24} color={COLORS.error} />
            <Text style={styles.errorText}>{message}</Text>
          </View>
          <TouchableOpacity style={styles.primaryBtn} onPress={resetFlow}>
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 24, paddingVertical: 16 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.textPrimary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  iconCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: COLORS.primaryLight + '30', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: COLORS.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: 16, color: COLORS.textSecondary, marginTop: 8, textAlign: 'center' },
  timeText: { fontSize: 36, fontWeight: 'bold', color: COLORS.textPrimary, marginTop: 8 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 12, marginTop: 24, gap: 8, width: '100%' },
  primaryBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  secondaryBtn: { marginTop: 16, padding: 12 },
  secondaryBtnText: { color: COLORS.primary, fontSize: 16 },
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: STATUS_BAR_HEIGHT + 16, paddingBottom: 16, gap: 12 },
  cameraTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  cameraWrapper: { flex: 1, margin: 20, borderRadius: 24, overflow: 'hidden' },
  camera: { flex: 1 },
  previewImage: { flex: 1, resizeMode: 'cover' },
  cameraControls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 24, gap: 24 },
  altBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  captureBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  captureBtnInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  confirmControls: { flexDirection: 'row', justifyContent: 'center', padding: 24, gap: 16 },
  retakeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, gap: 8, borderWidth: 1, borderColor: COLORS.error },
  retakeBtnText: { color: COLORS.error, fontSize: 16, fontWeight: '600' },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.success, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, gap: 8 },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.error + '15', padding: 16, borderRadius: 12, marginTop: 16, marginBottom: 8, gap: 12, width: '100%' },
  errorText: { flex: 1, color: COLORS.error, fontSize: 14, lineHeight: 20 },
});
