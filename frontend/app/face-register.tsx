import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Image,
  ScrollView,
  Platform,
  StatusBar,
} from 'react-native';

const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/src/utils/constants';
import { describeApiError, studentAPI } from '@/src/services/api';
import { useAuthStore } from '@/src/store/authStore';
import { LoadingOverlay } from '@/src/components/LoadingOverlay';

const REQUIRED_FACE_IMAGES = 5;
const FACE_IMAGE_QUALITY = 0.8;

export default function FaceRegisterScreen() {
  const router = useRouter();
  const updateFaceRegistered = useAuthStore((state) => state.updateFaceRegistered);
  const [permission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const registerFaces = async (images: string[], attempt = 1) => {
    if (images.length < REQUIRED_FACE_IMAGES) {
      Alert.alert('More Photos Needed', `Please capture at least ${REQUIRED_FACE_IMAGES} clear photos before registering.`);
      return;
    }

    setLoading(true);
    try {
      const response = await studentAPI.registerFace({ face_images: images });
      updateFaceRegistered(true);
      Alert.alert(
        'Success!',
        `Face registered successfully! The system captured ${response.data.encodings_count} unique face profile(s).`,
        [{ text: 'Continue', onPress: () => router.replace('/(tabs)/profile') }]
      );
    } catch (error: any) {
      console.error('Registration error (attempt ' + attempt + '):', error);
      const isNetworkError = !error?.response && error?.code !== 'ECONNABORTED';
      // Auto-retry once on pure network errors (Wi-Fi hiccup, etc.)
      if (isNetworkError && attempt === 1) {
        console.log('Network error detected, retrying once...');
        setLoading(false);
        await new Promise(r => setTimeout(r, 2000));
        return registerFaces(images, 2);
      }
      const message = describeApiError(
        error,
        'Registration failed. Please try again with clear face photos in good lighting.'
      );
      Alert.alert('Registration Failed', message, [
        { text: 'Try Again', onPress: () => {} },
        { text: 'Retake Photos', onPress: () => setCapturedImages([]) },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const captureFromCamera = async () => {
    if (!cameraRef.current) return;
    
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: FACE_IMAGE_QUALITY,
      });

      if (photo?.base64) {
        const imageData = `data:image/jpeg;base64,${photo.base64}`;
        addImage(imageData);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to capture. Try using the gallery option.');
    }
  };

  const pickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 4],
        quality: FACE_IMAGE_QUALITY,
        base64: true,
      });

      if (!result.canceled && result.assets[0]?.base64) {
        const imageData = `data:image/jpeg;base64,${result.assets[0].base64}`;
        addImage(imageData);
      }
    } catch (error) {
      console.error('Gallery error:', error);
      Alert.alert('Error', 'Failed to pick image from gallery.');
    }
  };

  const useSystemCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is needed.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [3, 4],
        quality: FACE_IMAGE_QUALITY,
        base64: true,
        cameraType: ImagePicker.CameraType.front,
      });

      if (!result.canceled && result.assets[0]?.base64) {
        const imageData = `data:image/jpeg;base64,${result.assets[0].base64}`;
        addImage(imageData);
      }
    } catch (error) {
      console.error('System camera error:', error);
      Alert.alert('Error', 'Failed to open camera.');
    }
  };

  const addImage = (imageData: string) => {
    const newImages = [...capturedImages, imageData];
    setCapturedImages(newImages);
    setShowCamera(false);
  };

  const removeImage = (index: number) => {
    setCapturedImages(capturedImages.filter((_, i) => i !== index));
  };

  const skipRegistration = () => {
    Alert.alert(
      'Skip Registration?',
      'You need to register your face to mark attendance.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Skip', onPress: () => router.replace('/(tabs)/profile') },
      ]
    );
  };

  // Show camera view
  if (showCamera && permission?.granted) {
    return (
      <SafeAreaView style={styles.cameraContainer}>
        <View style={styles.cameraHeader}>
          <TouchableOpacity onPress={() => setShowCamera(false)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.cameraTitle}>Take Photo {capturedImages.length + 1}/{REQUIRED_FACE_IMAGES}</Text>
        </View>

        <View style={styles.cameraWrapper}>
          <CameraView ref={cameraRef} style={styles.camera} facing="front" />
        </View>

        <View style={styles.cameraControls}>
          <TouchableOpacity style={styles.captureBtn} onPress={captureFromCamera}>
            <View style={styles.captureBtnInner}>
              <Ionicons name="camera" size={32} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LoadingOverlay visible={loading} message="Analysing your face photos... This may take 30-60 seconds." />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Face Registration</Text>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={24} color={COLORS.primary} />
          <Text style={styles.infoText}>
            Upload {REQUIRED_FACE_IMAGES} clear photos of your face. Use good natural lighting, face the camera directly, and try different angles for best accuracy.
          </Text>
        </View>

        {/* Captured Images */}
        <View style={styles.imagesContainer}>
          {[...Array(REQUIRED_FACE_IMAGES)].map((_, index) => (
            <View key={index} style={styles.imageSlot}>
              {capturedImages[index] ? (
                <View style={styles.imageWrapper}>
                  <Image source={{ uri: capturedImages[index] }} style={styles.image} />
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => removeImage(index)}
                  >
                    <Ionicons name="close-circle" size={24} color={COLORS.error} />
                  </TouchableOpacity>
                  <View style={styles.checkBadge}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  </View>
                </View>
              ) : (
                <View style={styles.emptySlot}>
                  <Ionicons name="person" size={40} color={COLORS.textLight} />
                  <Text style={styles.slotText}>Photo {index + 1}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Progress */}
        <Text style={styles.progressText}>
          {capturedImages.length}/{REQUIRED_FACE_IMAGES} photos captured
        </Text>

        {/* Action Buttons */}
        {capturedImages.length < REQUIRED_FACE_IMAGES && (
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.primaryBtn} onPress={useSystemCamera}>
              <Ionicons name="camera" size={24} color="#fff" />
              <Text style={styles.primaryBtnText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={pickFromGallery}>
              <Ionicons name="images" size={24} color={COLORS.primary} />
              <Text style={styles.secondaryBtnText}>Choose from Gallery</Text>
            </TouchableOpacity>

            {permission?.granted && (
              <TouchableOpacity style={styles.tertiaryBtn} onPress={() => setShowCamera(true)}>
                <Ionicons name="videocam" size={20} color={COLORS.textSecondary} />
                <Text style={styles.tertiaryBtnText}>Use Live Camera</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Register Button */}
        {capturedImages.length >= REQUIRED_FACE_IMAGES && !loading && (
          <TouchableOpacity style={styles.registerBtn} onPress={() => registerFaces(capturedImages)}>
            <Text style={styles.registerBtnText}>Register Face</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Skip Button */}
        <TouchableOpacity style={styles.skipBtn} onPress={skipRegistration}>
          <Text style={styles.skipBtnText}>Skip for now</Text>
        </TouchableOpacity>

        {/* Tips */}
        <View style={styles.tipsBox}>
          <Text style={styles.tipsTitle}>Tips for better registration:</Text>
          <Text style={styles.tipItem}>- Use good lighting</Text>
          <Text style={styles.tipItem}>- Face the camera directly</Text>
          <Text style={styles.tipItem}>- Remove glasses or sunglasses</Text>
          <Text style={styles.tipItem}>- Use different angles for each photo</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backBtn: {
    padding: 8,
    marginRight: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.primaryLight + '20',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.primary,
    lineHeight: 20,
  },
  imagesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  imageSlot: {
    width: '31%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptySlot: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slotText: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.textLight,
  },
  imageWrapper: {
    flex: 1,
    position: 'relative',
  },
  image: {
    flex: 1,
    borderRadius: 12,
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  checkBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: COLORS.success,
    borderRadius: 12,
    padding: 4,
  },
  progressText: {
    textAlign: 'center',
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 24,
  },
  actionButtons: {
    gap: 12,
    marginBottom: 16,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  secondaryBtnText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  tertiaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  tertiaryBtnText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  registerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  registerBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  skipBtn: {
    alignItems: 'center',
    padding: 12,
  },
  skipBtnText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  tipsBox: {
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  tipItem: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: STATUS_BAR_HEIGHT + 16,
    paddingBottom: 16,
  },
  cameraTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 12,
  },
  cameraWrapper: {
    flex: 1,
    margin: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    padding: 24,
    alignItems: 'center',
  },
  captureBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureBtnInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
