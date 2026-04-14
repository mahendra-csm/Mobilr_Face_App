import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/src/utils/constants';

export default function UserSelectScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Image
          source={require('../assets/images/svck-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>SVCK Digital</Text>
        <Text style={styles.subtitle}>Select your role to continue</Text>
      </View>

      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.roleButton, styles.studentButton]}
          onPress={() => router.push('/student-auth')}
          activeOpacity={0.8}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="school" size={40} color={COLORS.surface} />
          </View>
          <View style={styles.roleTextContainer}>
            <Text style={styles.roleTitle}>Student</Text>
            <Text style={styles.roleDescription}>
              Mark attendance with face recognition
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={COLORS.surface} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.roleButton, styles.adminButton]}
          onPress={() => router.push('/admin-login')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconContainer, styles.adminIcon]}>
            <Ionicons name="settings" size={40} color={COLORS.surface} />
          </View>
          <View style={styles.roleTextContainer}>
            <Text style={styles.roleTitle}>Admin</Text>
            <Text style={styles.roleDescription}>
              Monitor attendance in real-time
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={COLORS.surface} />
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Sri Venkateswara College of Engineering
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  buttonsContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    gap: 20,
  },
  roleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    shadowColor: COLORS.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  studentButton: {
    backgroundColor: COLORS.primary,
  },
  adminButton: {
    backgroundColor: COLORS.secondary,
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  roleTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  roleTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.surface,
  },
  roleDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  footer: {
    paddingBottom: 30,
    alignItems: 'center',
  },
  footerText: {
    color: COLORS.textLight,
    fontSize: 14,
  },
});
