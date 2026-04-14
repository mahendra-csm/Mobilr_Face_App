import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
  RefreshControl, FlatList, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, YEAR_LABELS, DEPARTMENTS, SECTIONS } from '@/src/utils/constants';
import { adminAPI } from '@/src/services/api';

interface Student {
  id: string;
  name: string;
  roll_number: string;
  branch: string;
  section: string;
  year: number;
  regulation: string;
  face_registered: boolean;
}

export default function AdminStudentsScreen() {
  const router = useRouter();
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadStudents = useCallback(async () => {
    try {
      const res = await adminAPI.getStudents(
        selectedBranch || undefined,
        selectedYear || undefined,
        selectedSection || undefined
      );
      setStudents(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  }, [selectedBranch, selectedYear, selectedSection]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const onRefresh = () => {
    setRefreshing(true);
    loadStudents();
  };

  const handleDeleteStudent = (student: Student) => {
    Alert.alert(
      'Delete Student',
      `Are you sure you want to delete "${student.name}" (${student.roll_number})?\n\nThis will permanently delete:\n- Account & credentials\n- Face registration data\n- All attendance records`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminAPI.deleteStudent(student.id);
              Alert.alert('Success', `Student ${student.roll_number} deleted successfully`);
              loadStudents(); // Refresh the list
            } catch (error: any) {
              console.error('Delete error:', error);
              Alert.alert('Error', error.response?.data?.detail || 'Failed to delete student');
            }
          },
        },
      ]
    );
  };

  const renderStudent = ({ item }: { item: Student }) => (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.cardRoll}>{item.roll_number}</Text>
        <View style={styles.cardMeta}>
          <Text style={styles.metaText}>{item.branch}</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaText}>Sec {item.section}</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaText}>{YEAR_LABELS[item.year]}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={() => handleDeleteStudent(item)} style={styles.deleteBtn}>
        <Ionicons name="trash-outline" size={18} color={COLORS.error} />
      </TouchableOpacity>
      <View style={[styles.statusBadge, item.face_registered ? styles.statusActive : styles.statusInactive]}>
        <Ionicons name={item.face_registered ? 'checkmark-circle' : 'alert-circle'} size={16} color={item.face_registered ? COLORS.success : COLORS.warning} />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Registered Students</Text>
      </View>

      <ScrollView style={styles.filtersContainer} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContent}>
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Branch:</Text>
          <TouchableOpacity style={[styles.filterBtn, !selectedBranch && styles.filterActive]} onPress={() => setSelectedBranch(null)}>
            <Text style={[styles.filterText, !selectedBranch && styles.filterTextActive]}>All</Text>
          </TouchableOpacity>
          {DEPARTMENTS.map(d => (
            <TouchableOpacity key={d} style={[styles.filterBtn, selectedBranch === d && styles.filterActive]} onPress={() => setSelectedBranch(d)}>
              <Text style={[styles.filterText, selectedBranch === d && styles.filterTextActive]} numberOfLines={1}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <ScrollView style={styles.filtersContainer} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContent}>
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Year:</Text>
          <TouchableOpacity style={[styles.filterBtn, !selectedYear && styles.filterActive]} onPress={() => setSelectedYear(null)}>
            <Text style={[styles.filterText, !selectedYear && styles.filterTextActive]}>All</Text>
          </TouchableOpacity>
          {[1, 2, 3, 4].map(y => (
            <TouchableOpacity key={y} style={[styles.filterBtn, selectedYear === y && styles.filterActive]} onPress={() => setSelectedYear(y)}>
              <Text style={[styles.filterText, selectedYear === y && styles.filterTextActive]}>{y}Y</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <ScrollView style={styles.filtersContainer} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContent}>
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Section:</Text>
          <TouchableOpacity style={[styles.filterBtn, !selectedSection && styles.filterActive]} onPress={() => setSelectedSection(null)}>
            <Text style={[styles.filterText, !selectedSection && styles.filterTextActive]}>All</Text>
          </TouchableOpacity>
          {SECTIONS.map(s => (
            <TouchableOpacity key={s} style={[styles.filterBtn, selectedSection === s && styles.filterActive]} onPress={() => setSelectedSection(s)}>
              <Text style={[styles.filterText, selectedSection === s && styles.filterTextActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={styles.countBar}>
        <Text style={styles.countText}>Total: {students.length} students</Text>
        <Text style={styles.countText}>
          Face Registered: {students.filter(s => s.face_registered).length}
        </Text>
      </View>

      {students.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={60} color={COLORS.textLight} />
          <Text style={styles.emptyText}>No students found</Text>
        </View>
      ) : (
        <FlatList
          data={students}
          renderItem={renderStudent}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn: { padding: 4, marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textPrimary },
  filtersContainer: { maxHeight: 50 },
  filtersContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  filterGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginRight: 4 },
  filterBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  filterActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  filterTextActive: { color: '#fff' },
  countBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: COLORS.primaryLight + '20' },
  countText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  list: { padding: 16, paddingTop: 8 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 12, padding: 12, marginBottom: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primaryLight + '30', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
  cardContent: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  cardRoll: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  metaText: { fontSize: 11, color: COLORS.textLight },
  metaDot: { fontSize: 11, color: COLORS.textLight, marginHorizontal: 4 },
  deleteBtn: { padding: 8, marginRight: 8 },
  statusBadge: { padding: 6, borderRadius: 12 },
  statusActive: { backgroundColor: COLORS.success + '15' },
  statusInactive: { backgroundColor: COLORS.warning + '15' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: COLORS.textSecondary, fontSize: 16, marginTop: 12 },
});
