import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BRANCHES, YEARS, REGULATIONS, SECTIONS } from '@/src/utils/constants';
import { studentAPI } from '@/src/services/api';
import { firebaseAuth } from '@/src/services/firebase';
import { useAuthStore } from '@/src/store/authStore';
import { LoadingOverlay } from '@/src/components/LoadingOverlay';

export default function StudentAuthScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);

  // Login state
  const [loginRoll, setLoginRoll] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Register state
  const [name, setName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [regulation, setRegulation] = useState('R20');
  const [branch, setBranch] = useState('CSE');
  const [section, setSection] = useState('A');
  const [year, setYear] = useState(1);

  const describeAuthError = (e: any): string => {
    // Firebase Auth error codes
    const code: string = e?.code || '';
    if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      return 'Invalid roll number or password. Please check and try again.';
    }
    if (code === 'auth/too-many-requests') {
      return 'Too many failed attempts. Please wait a few minutes before trying again.';
    }
    if (code === 'auth/network-request-failed') {
      return 'Network error. Please check your internet connection and try again.';
    }
    if (code === 'auth/user-disabled') {
      return 'This account has been disabled. Please contact the administrator.';
    }
    // Backend API error
    if (e?.response?.data?.detail) {
      return e.response.data.detail;
    }
    // Axios network error
    if (!e?.response && e?.message?.toLowerCase().includes('network')) {
      return 'Cannot reach the server. Make sure you are on the correct Wi-Fi network and the backend is running.';
    }
    return e?.message || 'Login failed. Please try again.';
  };

  const handleLogin = async (attempt = 1) => {
    if (!loginRoll || !loginPass) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    setLoading(true);
    try {
      const normalizedRoll = loginRoll.trim().toUpperCase();
      const email = `${normalizedRoll.toLowerCase()}@svck.edu.in`;
      const { token } = await firebaseAuth.signIn(email, loginPass);

      const profileResponse = await studentAPI.getProfile();
      const student = profileResponse.data;

      await setAuth(token, student, 'student');
      if (!student.face_registered) {
        router.replace('/face-register');
      } else {
        router.replace('/(tabs)/profile');
      }
    } catch (e: any) {
      try {
        await firebaseAuth.signOut();
      } catch {
        // Ignore cleanup errors
      }
      // Auto-retry once on network errors (not auth errors)
      const isNetworkError = e?.code === 'auth/network-request-failed' ||
        (!e?.response && !e?.code?.startsWith('auth/') && attempt === 1);
      if (isNetworkError && attempt === 1) {
        setLoading(false);
        await new Promise(r => setTimeout(r, 2000));
        return handleLogin(2);
      }
      Alert.alert('Login Failed', describeAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (attempt = 1) => {
    if (!name || !rollNumber || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    if (!rollNumber.trim()) {
      Alert.alert('Error', 'Roll number is required');
      return;
    }
    setLoading(true);
    try {
      // Register with backend (creates Firebase user + Firestore data)
      const res = await studentAPI.register({
        name: name.trim(),
        roll_number: rollNumber.trim().toUpperCase(),
        password,
        regulation,
        branch,
        section,
        year,
        college: 'SVCK',
      });

      // Sign in immediately using the custom token returned by the backend
      const email = `${rollNumber.trim().toLowerCase()}@svck.edu.in`;
      if (res.data.custom_token) {
        await firebaseAuth.signInWithCustomToken(res.data.custom_token);
      } else {
        await firebaseAuth.signIn(email, password);
      }

      const token = await firebaseAuth.getIdToken();
      if (!token) {
        throw new Error('Authentication succeeded but token was empty. Please try logging in.');
      }
      await setAuth(token, res.data.student, 'student');
      router.replace('/face-register');
    } catch (e: any) {
      // Auto-retry once on pure network errors
      const isNetworkError = !e?.response && !e?.code?.startsWith('auth/');
      if (isNetworkError && attempt === 1) {
        setLoading(false);
        await new Promise(r => setTimeout(r, 2000));
        return handleRegister(2);
      }
      const errorMessage = e?.response?.data?.detail || e?.message || 'Could not register. Please try again.';
      Alert.alert('Registration Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <LoadingOverlay visible={loading} message={activeTab === 'login' ? 'Logging in...' : 'Registering...'} />
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Student Portal</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, activeTab === 'login' && styles.tabActive]} onPress={() => setActiveTab('login')}>
            <Text style={[styles.tabText, activeTab === 'login' && styles.tabTextActive]}>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'register' && styles.tabActive]} onPress={() => setActiveTab('register')}>
            <Text style={[styles.tabText, activeTab === 'register' && styles.tabTextActive]}>Register</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {activeTab === 'login' ? (
            <>
              <Text style={styles.label}>Roll Number</Text>
              <TextInput style={styles.input} placeholder="Enter roll number" value={loginRoll} onChangeText={setLoginRoll} autoCapitalize="characters" />
              <Text style={styles.label}>Password</Text>
              <TextInput style={styles.input} placeholder="Enter password" value={loginPass} onChangeText={setLoginPass} secureTextEntry />
              <TouchableOpacity style={styles.primaryBtn} onPress={() => handleLogin()}>
                <Text style={styles.primaryBtnText}>Login</Text>
              </TouchableOpacity>
              <Text style={styles.forgotText}>Forgot password? Contact Administrator</Text>
            </>
          ) : (
            <>
              <Text style={styles.label}>Full Name</Text>
              <TextInput style={styles.input} placeholder="Enter your name" value={name} onChangeText={setName} />
              
              <Text style={styles.label}>Roll Number</Text>
              <TextInput style={styles.input} placeholder="e.g., 22KH1A3306" value={rollNumber} onChangeText={setRollNumber} autoCapitalize="characters" />
              
              <Text style={styles.label}>Regulation</Text>
              <View style={styles.optionRow}>
                {REGULATIONS.map(r => (
                  <TouchableOpacity key={r} style={[styles.optionBtn, regulation === r && styles.optionActive]} onPress={() => setRegulation(r)}>
                    <Text style={[styles.optionText, regulation === r && styles.optionTextActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <Text style={styles.label}>Branch</Text>
              <View style={styles.optionRow}>
                {BRANCHES.map(b => (
                  <TouchableOpacity key={b} style={[styles.optionBtn, branch === b && styles.optionActive]} onPress={() => setBranch(b)}>
                    <Text style={[styles.optionText, branch === b && styles.optionTextActive]} numberOfLines={1}>{b}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <Text style={styles.label}>Section</Text>
              <View style={styles.optionRow}>
                {SECTIONS.map(s => (
                  <TouchableOpacity key={s} style={[styles.optionBtn, section === s && styles.optionActive]} onPress={() => setSection(s)}>
                    <Text style={[styles.optionText, section === s && styles.optionTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <Text style={styles.label}>Year</Text>
              <View style={styles.optionRow}>
                {YEARS.map(y => (
                  <TouchableOpacity key={y} style={[styles.optionBtn, year === y && styles.optionActive]} onPress={() => setYear(y)}>
                    <Text style={[styles.optionText, year === y && styles.optionTextActive]}>{y}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <Text style={styles.label}>Password</Text>
              <TextInput style={styles.input} placeholder="Create password (min 6 chars)" value={password} onChangeText={setPassword} secureTextEntry />
              
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput style={styles.input} placeholder="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
              
              <TouchableOpacity style={styles.primaryBtn} onPress={() => handleRegister()}>
                <Text style={styles.primaryBtnText}>Register</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  backBtn: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textPrimary },
  tabs: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: COLORS.surface, borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 16, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: '#fff' },
  content: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 14, fontSize: 16 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, minWidth: 60, alignItems: 'center' },
  optionActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  optionText: { fontSize: 14, fontWeight: '500', color: COLORS.textSecondary },
  optionTextActive: { color: '#fff' },
  primaryBtn: { backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  primaryBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  forgotText: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 16, fontSize: 14 },
});
