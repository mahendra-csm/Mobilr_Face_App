import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, Animated, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/src/store/authStore';
import { COLORS } from '@/src/utils/constants';

export default function SplashScreen() {
  const router = useRouter();
  const { token, userType, isLoading, loadAuth } = useAuthStore();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));

  useEffect(() => {
    loadAuth();
  }, [loadAuth]);

  useEffect(() => {
    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();

    // Navigate after 2.5 seconds (or force-navigate after 6s if still loading)
    const timer = setTimeout(() => {
      if (!isLoading) {
        if (token && userType) {
          if (userType === 'student') {
            router.replace('/(tabs)/profile');
          } else {
            router.replace('/admin/dashboard');
          }
        } else {
          router.replace('/user-select');
        }
      }
    }, 2500);

    // Safety timeout: if auth loading takes too long, navigate anyway
    const safetyTimer = setTimeout(() => {
      if (isLoading) {
        console.warn('[Splash] Auth loading timed out — navigating to user-select');
        router.replace('/user-select');
      }
    }, 6000);

    return () => {
      clearTimeout(timer);
      clearTimeout(safetyTimer);
    };
  }, [isLoading, token, userType, fadeAnim, scaleAnim, router]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.logoWrapper}>
            <Image
              source={require('../assets/images/svck-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.collegeName}>Sri Venkateswara College of Engineering</Text>
          <Text style={styles.collegeShort}>(SVCK)</Text>
          <View style={styles.divider} />
          <Text style={styles.appName}>SVCK Digital</Text>
          <Text style={styles.subtitle}>Smart Attendance System</Text>
        </Animated.View>

        <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
          <Text style={styles.footerText}>Face Recognition Based Attendance</Text>
          <Text style={styles.footerSubtext}>Powered by AI Technology</Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1628',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoWrapper: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 140,
    height: 140,
  },
  collegeName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  collegeShort: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 16,
  },
  divider: {
    width: 60,
    height: 3,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
    marginVertical: 16,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.primaryLight,
    marginTop: 8,
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
  footerSubtext: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    marginTop: 4,
  },
});
