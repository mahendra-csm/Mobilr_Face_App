import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
  Alert, RefreshControl, Modal, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, YEAR_LABELS } from '@/src/utils/constants';
import { useAuthStore } from '@/src/store/authStore';
import { studentAPI } from '@/src/services/api';
import { firebaseAuth } from '@/src/services/firebase';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, clearAuth, setAuth } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editYear, setEditYear] = useState<number>(1);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  const student = user as any;

  const loadProfile = async () => {
    try {
      const response = await studentAPI.getProfile();
      setProfile(response.data);
    } catch (e) {
      console.error('Failed to load profile:', e);
    }
  };

  useEffect(() => { loadProfile(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => { await clearAuth(); router.replace('/user-select'); } },
    ]);
  };

  const openEditModal = () => {
    setEditYear(displayProfile?.year || 1);
    setEditName(displayProfile?.name || '');
    setShowEditModal(true);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const response = await studentAPI.updateProfile({ year: editYear, name: editName });
      const updatedStudent = response.data.student;
      // Update local state
      setProfile({ ...profile, ...updatedStudent });
      // Update auth store with new user data
      const token = await firebaseAuth.getIdToken();
      if (token) {
        await setAuth(token, updatedStudent, 'student');
      }
      setShowEditModal(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const displayProfile = profile || student;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={24} color={COLORS.error} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={60} color={COLORS.primary} />
          </View>
          <Text style={styles.name}>{displayProfile?.name}</Text>
          <Text style={styles.rollNumber}>{displayProfile?.roll_number}</Text>
        </View>

        {/* Face Registration Status */}
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, displayProfile?.face_registered ? styles.statusActive : styles.statusInactive]} />
            <Text style={styles.statusLabel}>Face Registration</Text>
            <Text style={[styles.statusValue, displayProfile?.face_registered ? styles.statusValueActive : styles.statusValueInactive]}>
              {displayProfile?.face_registered ? 'Completed' : 'Pending'}
            </Text>
          </View>
          {!displayProfile?.face_registered && (
            <TouchableOpacity style={styles.registerFaceBtn} onPress={() => router.push('/face-register')}>
              <Ionicons name="camera" size={20} color="#fff" />
              <Text style={styles.registerFaceText}>Register Face Now</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Academic Details */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Academic Details</Text>
            <TouchableOpacity onPress={openEditModal} style={styles.editBtn}>
              <Ionicons name="pencil" size={18} color={COLORS.primary} />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}><Ionicons name="school-outline" size={20} color={COLORS.primary} /></View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>College</Text>
              <Text style={styles.detailValue}>{displayProfile?.college}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}><Ionicons name="git-branch-outline" size={20} color={COLORS.primary} /></View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Branch</Text>
              <Text style={styles.detailValue}>{displayProfile?.branch}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}><Ionicons name="calendar-outline" size={20} color={COLORS.primary} /></View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Year</Text>
              <Text style={styles.detailValue}>{YEAR_LABELS[displayProfile?.year] || displayProfile?.year}</Text>
            </View>
          </View>

          <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
            <View style={styles.detailIcon}><Ionicons name="document-text-outline" size={20} color={COLORS.primary} /></View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Regulation</Text>
              <Text style={styles.detailValue}>{displayProfile?.regulation}</Text>
            </View>
          </View>
        </View>

        {/* Last Attendance */}
        {profile?.last_attendance && (
          <View style={styles.lastAttendance}>
            <Ionicons name="time-outline" size={20} color={COLORS.success} />
            <Text style={styles.lastAttendanceText}>Last Attendance: {new Date(profile.last_attendance).toLocaleString()}</Text>
          </View>
        )}

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutFullBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.error} />
          <Text style={styles.logoutFullText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={showEditModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholder="Enter name" />
            
            <Text style={styles.inputLabel}>Year</Text>
            <View style={styles.yearOptions}>
              {[1, 2, 3, 4].map(y => (
                <TouchableOpacity key={y} style={[styles.yearOption, editYear === y && styles.yearOptionActive]} onPress={() => setEditYear(y)}>
                  <Text style={[styles.yearOptionText, editYear === y && styles.yearOptionTextActive]}>{YEAR_LABELS[y]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowEditModal(false)} disabled={saving}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={saveProfile} disabled={saving}>
                <Text style={styles.modalSaveText}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.textPrimary },
  logoutBtn: { padding: 8 },
  content: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: COLORS.primaryLight + '30', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  name: { fontSize: 24, fontWeight: 'bold', color: COLORS.textPrimary },
  rollNumber: { fontSize: 16, color: COLORS.textSecondary, marginTop: 4 },
  card: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textPrimary },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  editBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  statusActive: { backgroundColor: COLORS.success },
  statusInactive: { backgroundColor: COLORS.warning },
  statusLabel: { flex: 1, fontSize: 16, color: COLORS.textPrimary },
  statusValue: { fontSize: 14, fontWeight: '600' },
  statusValueActive: { color: COLORS.success },
  statusValueInactive: { color: COLORS.warning },
  registerFaceBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: 8, marginTop: 16, gap: 8 },
  registerFaceText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  detailIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryLight + '20', justifyContent: 'center', alignItems: 'center' },
  detailContent: { marginLeft: 16, flex: 1 },
  detailLabel: { fontSize: 12, color: COLORS.textLight },
  detailValue: { fontSize: 16, color: COLORS.textPrimary, fontWeight: '500', marginTop: 2 },
  lastAttendance: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.success + '15', padding: 16, borderRadius: 12, gap: 12, marginBottom: 16 },
  lastAttendanceText: { fontSize: 14, color: COLORS.success, fontWeight: '500' },
  logoutFullBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.error + '10', paddingVertical: 16, borderRadius: 12, gap: 10, borderWidth: 1, borderColor: COLORS.error + '30' },
  logoutFullText: { fontSize: 16, fontWeight: '600', color: COLORS.error },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '85%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16 },
  yearOptions: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  yearOption: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: COLORS.background, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  yearOptionActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  yearOptionText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  yearOptionTextActive: { color: '#fff' },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, paddingVertical: 14, borderRadius: 8, backgroundColor: COLORS.background, alignItems: 'center' },
  modalCancelText: { color: COLORS.textSecondary, fontWeight: '600' },
  modalSave: { flex: 1, paddingVertical: 14, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: 'center' },
  modalSaveText: { color: '#fff', fontWeight: '600' },
});
