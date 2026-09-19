import React from 'react'
import { View, StyleSheet, ScrollView, Alert } from 'react-native'
import { Text as RNText } from 'react-native'
import { Text, Surface, Button, TextInput, Modal } from 'react-native-paper'
import { colors } from '../theme/theme'
import { getOpenShift, openShift, closeShift, shiftSummary, listShifts, addCashMovement } from '../utils/shifts'
import { getDb } from '../db/database'

export default function ShiftScreen() {
  const [refresh, setRefresh] = React.useState(0)
  const [cashInput, setCashInput] = React.useState('')
  const [note, setNote] = React.useState('')
  const [showIn, setShowIn] = React.useState(false)
  const [showOut, setShowOut] = React.useState(false)
  const [movAmt, setMovAmt] = React.useState('')
  const [movNote, setMovNote] = React.useState('')

  const open = React.useMemo(() => { try { return getOpenShift() } catch { return null } }, [refresh])
  const shifts = React.useMemo(() => { try { return listShifts(10) } catch { return [] } }, [refresh])
  const sum = React.useMemo(() => {
    if (!open) return null
    try { return shiftSummary(open.id) } catch { return null }
  }, [open, refresh])

  const doOpen = () => {
    const v = parseInt(cashInput.replace(/\D/g, '') || '0', 10)
    try { openShift(v, note.trim()); setCashInput(''); setNote(''); setRefresh(k => k + 1) }
    catch (e: any) { Alert.alert('Gagal', String(e?.message || e)) }
  }
  const doClose = () => {
    const v = parseInt(cashInput.replace(/\D/g, '') || '0', 10)
    Alert.alert('Tutup shift?', `Kas fisik Rp ${v.toLocaleString('id-ID')} — lanjut?`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Tutup', onPress: () => { try { closeShift(v, note.trim()); setCashInput(''); setNote(''); setRefresh(k => k + 1) } catch (e: any) { Alert.alert('Gagal', String(e?.message || e)) } } }
    ])
  }
  const doMov = (kind: 'in'|'out') => {
    const v = parseInt(movAmt.replace(/\D/g, '') || '0', 10)
    if (v <= 0) { Alert.alert('Nominal salah'); return }
    try { addCashMovement(open?.id ?? null, kind, v, movNote.trim() || (kind === 'in' ? 'Kas masuk' : 'Kas keluar')); setMovAmt(''); setMovNote(''); setShowIn(false); setShowOut(false); setRefresh(k => k + 1) }
    catch (e: any) { Alert.alert('Gagal', String(e?.message || e)) }
  }

  // today cash movements for open shift
  const moves = React.useMemo(() => {
    try {
      if (!open) return []
      return getDb().getAllSync<any>('SELECT * FROM cash_movements WHERE shift_id=? ORDER BY id DESC', [open.id])
    } catch { return [] }
  }, [open, refresh])

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 110, gap: 12 }}>
        {open ? (
          <>
            <Surface style={styles.openCard} elevation={0}>
              <Text style={styles.openTitle}>Shift BUKA sejak {open.opened_at.slice(0, 16)}</Text>
              <RNText style={styles.openSub}>Modal awal Rp {open.opening_cash.toLocaleString('id-ID')}{open.note ? ` • ${open.note}` : ''}</RNText>
              {sum ? (
                <View style={styles.sumRow}>
                  <View style={styles.sumBox}><RNText style={styles.sumLabel}>Tunai (non-bon)</RNText><RNText style={styles.sumVal}>Rp {sum.cash.toLocaleString('id-ID')}</RNText></View>
                  <View style={styles.sumBox}><RNText style={styles.sumLabel}>QRIS</RNText><RNText style={styles.sumVal}>Rp {sum.qris.toLocaleString('id-ID')}</RNText></View>
                  <View style={styles.sumBox}><RNText style={styles.sumLabel}>VOID</RNText><RNText style={styles.sumValBad}>{sum.voided}</RNText></View>
                </View>
              ) : null}
              {sum ? <RNText style={styles.bonSub}>Bon belum lunas (global): Rp {sum.bonSisa.toLocaleString('id-ID')}</RNText> : null}
            </Surface>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button mode="outlined" icon="plus" onPress={() => setShowIn(true)} style={{ flex: 1 }}>Kas Masuk</Button>
              <Button mode="outlined" icon="minus" onPress={() => setShowOut(true)} style={{ flex: 1 }}>Kas Keluar</Button>
            </View>
            <Surface style={styles.card} elevation={0}>
              <Text style={styles.cardTitle}>Tutup Shift — Hitung Kas Fisik</Text>
              <TextInput value={cashInput} onChangeText={v => setCashInput(v.replace(/\D/g, ''))} keyboardType="number-pad" dense style={{ backgroundColor: colors.surface, marginTop: 8 }} placeholder="Kas di laci sekarang" left={<TextInput.Affix text="Rp " />} />
              <TextInput value={note} onChangeText={setNote} dense style={{ backgroundColor: colors.surface, marginTop: 8 }} placeholder="Catatan tutup (opsional)" />
              <Button mode="contained" buttonColor="#0F2440" onPress={doClose} style={{ marginTop: 10 }}>Tutup Shift</Button>
            </Surface>
            {moves.length > 0 ? (
              <Surface style={styles.card} elevation={0}>
                <Text style={styles.cardTitle}>Kas Masuk / Keluar (shift ini)</Text>
                {moves.map((m: any) => (
                  <View key={m.id} style={styles.movRow}>
                    <RNText style={[styles.movKind, m.kind === 'in' ? { color: colors.greenDark } : { color: '#B91C1C' }]}>{m.kind === 'in' ? '+ Masuk' : '- Keluar'}</RNText>
                    <RNText style={styles.movAmt}>Rp {m.amount.toLocaleString('id-ID')}</RNText>
                    <RNText style={styles.movNote} numberOfLines={1}>{m.note}</RNText>
                  </View>
                ))}
              </Surface>
            ) : null}
          </>
        ) : (
          <Surface style={styles.card} elevation={0}>
            <Text style={styles.cardTitle}>Buka Shift Baru</Text>
            <RNText style={styles.help}>Catat modal awal di laci. Nanti Tutup Shift biar selisih kas ketahuan.</RNText>
            <TextInput value={cashInput} onChangeText={v => setCashInput(v.replace(/\D/g, ''))} keyboardType="number-pad" dense style={{ backgroundColor: colors.surface, marginTop: 8 }} placeholder="Modal awal (0 jika kosong)" left={<TextInput.Affix text="Rp " />} />
            <TextInput value={note} onChangeText={setNote} dense style={{ backgroundColor: colors.surface, marginTop: 8 }} placeholder="Catatan buka (opsional: shift pagi)" />
            <Button mode="contained" onPress={doOpen} style={{ marginTop: 10 }}>Buka Shift</Button>
          </Surface>
        )}
        <Surface style={styles.card} elevation={0}>
          <Text style={styles.cardTitle}>Riwayat Shift (10 terbaru)</Text>
          {shifts.length === 0 ? <RNText style={styles.help}>Belum ada shift.</RNText> : shifts.map((s: any) => (
            <View key={s.id} style={styles.shiftRow}>
              <RNText style={styles.shiftId}>#{s.id} {s.status === 'open' ? '● BUKA' : '○ TUTUP'}</RNText>
              <RNText style={styles.shiftMeta}>{s.opened_at.slice(0, 16)}{s.closed_at ? ` → ${s.closed_at.slice(0, 16)}` : ''}</RNText>
              <RNText style={styles.shiftMeta}>Buka Rp {s.opening_cash.toLocaleString('id-ID')}{s.closing_cash != null ? ` • Tutup Rp ${s.closing_cash.toLocaleString('id-ID')}` : ''}</RNText>
            </View>
          ))}
        </Surface>
      </ScrollView>
      <Modal visible={showIn} onDismiss={() => setShowIn(false)} contentContainerStyle={styles.modal}>
        <Text style={styles.modalTitle}>Kas Masuk</Text>
        <TextInput value={movAmt} onChangeText={v => setMovAmt(v.replace(/\D/g, ''))} keyboardType="number-pad" dense style={{ backgroundColor: colors.surface, marginTop: 8 }} placeholder="Nominal" left={<TextInput.Affix text="Rp " />} />
        <TextInput value={movNote} onChangeText={setMovNote} dense style={{ backgroundColor: colors.surface, marginTop: 8 }} placeholder="Keterangan: setoran / tambahan modal" />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}><Button mode="outlined" onPress={() => setShowIn(false)} style={{ flex: 1 }}>Batal</Button><Button mode="contained" onPress={() => doMov('in')} style={{ flex: 1 }}>Simpan</Button></View>
      </Modal>
      <Modal visible={showOut} onDismiss={() => setShowOut(false)} contentContainerStyle={styles.modal}>
        <Text style={styles.modalTitle}>Kas Keluar</Text>
        <TextInput value={movAmt} onChangeText={v => setMovAmt(v.replace(/\D/g, ''))} keyboardType="number-pad" dense style={{ backgroundColor: colors.surface, marginTop: 8 }} placeholder="Nominal" left={<TextInput.Affix text="Rp " />} />
        <TextInput value={movNote} onChangeText={setMovNote} dense style={{ backgroundColor: colors.surface, marginTop: 8 }} placeholder="Keterangan: belanja / ambil kas" />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}><Button mode="outlined" onPress={() => setShowOut(false)} style={{ flex: 1 }}>Batal</Button><Button mode="contained" buttonColor="#B91C1C" onPress={() => doMov('out')} style={{ flex: 1 }}>Simpan</Button></View>
      </Modal>
    </View>
  )
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14 },
  cardTitle: { fontSize: 14, fontWeight: '900', color: colors.text },
  help: { fontSize: 12, color: colors.textMuted, marginTop: 6, lineHeight: 16 },
  openCard: { backgroundColor: '#EFF6FF', borderRadius: 14, borderWidth: 1, borderColor: '#BFDBFE', padding: 14 },
  openTitle: { fontSize: 14, fontWeight: '900', color: '#1E40AF' },
  openSub: { fontSize: 12, color: '#3B82F6', marginTop: 4 },
  sumRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  sumBox: { flex: 1, backgroundColor: '#FFF', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  sumLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  sumVal: { fontSize: 13, fontWeight: '900', color: colors.text, marginTop: 2 },
  sumValBad: { fontSize: 13, fontWeight: '900', color: '#B91C1C', marginTop: 2 },
  bonSub: { fontSize: 11, color: '#92400E', marginTop: 8, fontWeight: '700' },
  shiftRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  shiftId: { fontSize: 13, fontWeight: '900', color: colors.text },
  shiftMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  movRow: { flexDirection: 'row', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' },
  movKind: { fontSize: 11, fontWeight: '900', minWidth: 70 },
  movAmt: { fontSize: 12, fontWeight: '800', color: colors.text, minWidth: 90, textAlign: 'right' },
  movNote: { fontSize: 11, color: colors.textMuted, flex: 1 },
  modal: { backgroundColor: colors.surface, margin: 20, borderRadius: 16, padding: 18 },
  modalTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
})
