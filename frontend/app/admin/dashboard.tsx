import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
  RefreshControl, Alert, Modal, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { COLORS, YEAR_LABELS, DEPARTMENTS } from '@/src/utils/constants';
import { adminAPI, buildWebSocketUrl } from '@/src/services/api';
import { useAuthStore } from '@/src/store/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AttendanceRecord {
  id: string; student_name: string; roll_number: string;
  branch: string; year: number; time: string; geo_verified: boolean;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { clearAuth } = useAuthStore();
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [attendanceRes, statsRes] = await Promise.all([
        adminAPI.getAttendance(selectedBranch || undefined, selectedYear || undefined, selectedDate),
        adminAPI.getStatistics(selectedBranch || undefined, selectedYear || undefined),
      ]);
      setAttendance(attendanceRes.data.records);
      setStatistics(statsRes.data);
    } catch (e) { console.error(e); }
    finally { setRefreshing(false); }
  }, [selectedBranch, selectedYear, selectedDate]);

  // WebSocket for real-time attendance updates
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connectWs = async () => {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        if (!token) return;

        const wsUrl = buildWebSocketUrl(`/api/ws/admin?token=${token}`);
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (__DEV__) console.log('[WS] Connected to admin WebSocket');
          setWsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'new_attendance') {
              // Instantly add the new attendance record and refresh stats
              if (__DEV__) console.log('[WS] New attendance:', msg.data);
              loadData(); // Refresh to get accurate stats
            }
          } catch (e) {
            if (__DEV__) console.log('[WS] Parse error:', e);
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          wsRef.current = null;
          // Reconnect after 5 seconds
          reconnectTimer = setTimeout(connectWs, 5000);
        };

        ws.onerror = () => {
          setWsConnected(false);
          ws?.close();
        };
      } catch (e) {
        if (__DEV__) console.log('[WS] Connection error:', e);
      }
    };

    connectWs();

    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
      wsRef.current = null;
    };
  }, [loadData]);

  // Fallback polling (every 30s instead of 15s since we have WebSocket)
  useEffect(() => { loadData(); const i = setInterval(loadData, 30000); return () => clearInterval(i); }, [loadData]);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => { await clearAuth(); router.replace('/user-select'); } },
    ]);
  };

  const generatePDF = async () => {
    setExporting(true);
    try {
      const res = await adminAPI.exportAttendance(selectedBranch || undefined, selectedYear || undefined, selectedDate);
      const data = res.data;
      
      const html = `
<!DOCTYPE html>
<html><head><style>
body { font-family: Arial; padding: 20px; }
h1 { color: #1E3A5F; text-align: center; }
h2 { color: #2563EB; border-bottom: 2px solid #2563EB; padding-bottom: 5px; }
table { width: 100%; border-collapse: collapse; margin: 15px 0; }
th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
th { background: #1E3A5F; color: white; }
tr:nth-child(even) { background: #f9f9f9; }
.summary { background: #E8F4FD; padding: 15px; border-radius: 8px; margin: 15px 0; }
.summary-item { display: inline-block; margin-right: 30px; }
.footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
</style></head>
<body>
<h1>SVCK Digital - Attendance Report</h1>
<div class="summary">
<div class="summary-item"><strong>Date:</strong> ${data.filters.date}</div>
<div class="summary-item"><strong>Branch:</strong> ${data.filters.branch}</div>
<div class="summary-item"><strong>Year:</strong> ${data.filters.year}</div>
<div class="summary-item"><strong>Total Students:</strong> ${data.summary.total_students}</div>
<div class="summary-item"><strong>Present:</strong> ${data.summary.total_present}</div>
<div class="summary-item"><strong>Rate:</strong> ${data.summary.attendance_rate.toFixed(1)}%</div>
</div>

<h2>Attendance Records</h2>
<table>
<tr><th>S.No</th><th>Roll Number</th><th>Name</th><th>Branch</th><th>Year</th><th>Date</th><th>Time</th></tr>
${data.all_records.map((r: any, i: number) => `
<tr><td>${i+1}</td><td>${r.roll_number}</td><td>${r.student_name}</td><td>${r.branch}</td><td>${r.year}</td><td>${r.date}</td><td>${r.time}</td></tr>
`).join('')}
</table>

<div class="footer">
<p>Generated on: ${new Date().toLocaleString()}</p>
<p>Sri Venkateswara College of Engineering (SVCK)</p>
</div>
</body></html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export Attendance Report' });
      } else {
        Alert.alert('Success', 'PDF saved to: ' + uri);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to generate PDF');
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  const formatDateDisplay = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const changeDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <Text style={styles.headerSub}>{formatDateDisplay(selectedDate)}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push('/admin/assistant')} style={styles.aiBtn}>
            <Ionicons name="sparkles" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}>
        
        {/* Date Selector */}
        <View style={styles.dateSelector}>
          <TouchableOpacity style={styles.dateBtn} onPress={() => changeDate(-1)}>
            <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.dateDisplay} onPress={() => setShowDatePicker(true)}>
            <Ionicons name="calendar" size={18} color={COLORS.primary} />
            <Text style={styles.dateText}>{formatDateDisplay(selectedDate)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dateBtn} onPress={() => changeDate(1)}>
            <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.todayBtn} onPress={() => setSelectedDate(new Date().toISOString().split('T')[0])}>
            <Text style={styles.todayText}>Today</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        {statistics && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}><Ionicons name="people" size={22} color={COLORS.primary} /><Text style={styles.statNum}>{statistics.total_students}</Text><Text style={styles.statLabel}>Students</Text></View>
            <View style={styles.statCard}><Ionicons name="checkmark-circle" size={22} color={COLORS.success} /><Text style={styles.statNum}>{statistics.today_attendance}</Text><Text style={styles.statLabel}>Present</Text></View>
            <View style={styles.statCard}><Ionicons name="analytics" size={22} color={COLORS.secondary} /><Text style={styles.statNum}>{statistics.attendance_percentage.toFixed(0)}%</Text><Text style={styles.statLabel}>Rate</Text></View>
          </View>
        )}

        {/* Filters */}
        <Text style={styles.sectionTitle}>Department</Text>
        <View style={styles.filterRow}>
          <TouchableOpacity style={[styles.filterBtn, !selectedBranch && styles.filterActive]} onPress={() => setSelectedBranch(null)}>
            <Text style={[styles.filterText, !selectedBranch && styles.filterTextActive]}>All</Text>
          </TouchableOpacity>
          {DEPARTMENTS.map(d => (
            <TouchableOpacity key={d} style={[styles.filterBtn, selectedBranch === d && styles.filterActive]} onPress={() => setSelectedBranch(d)}>
              <Text style={[styles.filterText, selectedBranch === d && styles.filterTextActive]} numberOfLines={1}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Year</Text>
        <View style={styles.filterRow}>
          <TouchableOpacity style={[styles.filterBtn, !selectedYear && styles.filterActive]} onPress={() => setSelectedYear(null)}>
            <Text style={[styles.filterText, !selectedYear && styles.filterTextActive]}>All</Text>
          </TouchableOpacity>
          {[1,2,3,4].map(y => (
            <TouchableOpacity key={y} style={[styles.filterBtn, selectedYear === y && styles.filterActive]} onPress={() => setSelectedYear(y)}>
              <Text style={[styles.filterText, selectedYear === y && styles.filterTextActive]}>{y}Y</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Export Button */}
        <TouchableOpacity style={styles.exportBtn} onPress={generatePDF} disabled={exporting}>
          <Ionicons name="download-outline" size={20} color="#fff" />
          <Text style={styles.exportText}>{exporting ? 'Generating...' : 'Export PDF Report'}</Text>
        </TouchableOpacity>

        {/* Attendance List */}
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Attendance ({attendance.length})</Text>
          <View style={[styles.liveBadge, wsConnected && styles.liveBadgeConnected]}><View style={[styles.liveDot, wsConnected && styles.liveDotConnected]} /><Text style={[styles.liveText, wsConnected && styles.liveTextConnected]}>{wsConnected ? 'Live' : 'Polling'}</Text></View>
        </View>

        {attendance.length === 0 ? (
          <View style={styles.empty}><Ionicons name="calendar-outline" size={48} color={COLORS.textLight} /><Text style={styles.emptyText}>No records for this date</Text></View>
        ) : (
          attendance.map(item => (
            <View key={item.id} style={styles.card}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{item.student_name.charAt(0)}</Text></View>
              <View style={styles.cardContent}>
                <Text style={styles.cardName} numberOfLines={1}>{item.student_name}</Text>
                <Text style={styles.cardRoll}>{item.roll_number}</Text>
                <Text style={styles.cardMeta}>{item.branch} • {YEAR_LABELS[item.year]}</Text>
              </View>
              <Text style={styles.cardTime}>{item.time}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Date Picker Modal */}
      <Modal visible={showDatePicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Date</Text>
            <TextInput
              style={styles.dateInput}
              value={selectedDate}
              onChangeText={setSelectedDate}
              placeholder="YYYY-MM-DD"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowDatePicker(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={() => setShowDatePicker(false)}>
                <Text style={styles.modalConfirmText}>Apply</Text>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textPrimary },
  headerSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiBtn: { padding: 8, backgroundColor: COLORS.primaryLight + '20', borderRadius: 10 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  dateSelector: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  dateBtn: { padding: 8, backgroundColor: COLORS.surface, borderRadius: 8 },
  dateDisplay: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, padding: 12, borderRadius: 8, gap: 8 },
  dateText: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  todayBtn: { backgroundColor: COLORS.primary, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  todayText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 12, padding: 12, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: 'bold', color: COLORS.textPrimary, marginTop: 4 },
  statLabel: { fontSize: 11, color: COLORS.textSecondary },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8, marginTop: 8 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  filterBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  filterActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  filterTextActive: { color: '#fff' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.secondary, paddingVertical: 14, borderRadius: 12, marginVertical: 16, gap: 8 },
  exportText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  listTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.textPrimary },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.textLight + '15', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, gap: 6 },
  liveBadgeConnected: { backgroundColor: COLORS.success + '15' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.textLight },
  liveDotConnected: { backgroundColor: COLORS.success },
  liveText: { fontSize: 12, fontWeight: '600', color: COLORS.textLight },
  liveTextConnected: { color: COLORS.success },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: COLORS.textSecondary, marginTop: 12 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 12, padding: 12, marginBottom: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primaryLight + '30', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
  cardContent: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  cardRoll: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  cardMeta: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  cardTime: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '85%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 16 },
  dateInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: COLORS.background, alignItems: 'center' },
  modalCancelText: { color: COLORS.textSecondary, fontWeight: '600' },
  modalConfirm: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: '600' },
});
