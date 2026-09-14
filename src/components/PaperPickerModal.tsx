import React, { useState, useEffect } from 'react'
import { Modal, View, ScrollView, Pressable } from 'react-native'
import { Text, Button, TextInput } from 'react-native-paper'
import { colors } from '../theme/theme'
import { PAPER_OPTIONS, getCustomDims, setCustomDims, getPaperLabel, type PaperSize } from '../utils/settings'

type Props = {
  visible: boolean
  value: PaperSize
  onSelect: (v: PaperSize) => void
  onClose: () => void
}

const ALL: { value: PaperSize; label: string; group: string; wMm: number; hMm: number }[] = [
  ...PAPER_OPTIONS,
  { value: 'A4' as PaperSize, label: 'A4 — 210 × 297 mm', group: 'LAINNYA', wMm: 210, hMm: 297 },
]

export default function PaperPickerModal({ visible, value, onSelect, onClose }: Props) {
  const [cw, setCw] = useState('58')
  const [ch, setCh] = useState('200')
  const [err, setErr] = useState('')

  useEffect(() => {
    if (visible) {
      const d = getCustomDims()
      setCw(String(d.wMm))
      setCh(String(d.hMm))
      setErr('')
    }
  }, [visible])

  const grouped: Record<string, typeof ALL> = {}
  for (const o of ALL) {
    if (!grouped[o.group]) grouped[o.group] = []
    if (grouped[o.group].some(x => x.value === o.value)) continue
    grouped[o.group].push(o)
  }

  const onPick = (v: PaperSize) => {
    onSelect(v)
    onClose()
  }

  const onSaveCustom = () => {
    const w = parseInt(cw, 10)
    const h = parseInt(ch, 10)
    if (isNaN(w) || isNaN(h) || w < 30 || w > 210 || h < 30 || h > 297) {
      setErr('W 30-210 mm, H 30-297 mm')
      return
    }
    setCustomDims(w, h)
    onSelect('custom' as PaperSize)
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 16 }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: colors.surface, borderRadius: 16, maxHeight: '88%', overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
          <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 4 }}>
            <Text style={{ fontSize: 14, fontWeight: '900', color: colors.text }}>Pilih Ukuran Kertas</Text>
            <Text style={{ fontSize: 11, color: colors.textMuted }}>Thermal, label & kwitansi. Custom bisa atur mm sendiri.</Text>
            <Text style={{ fontSize: 11, color: colors.greenDark, fontWeight: '700' }}>Aktif: {getPaperLabel(value as PaperSize)}</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }} showsVerticalScrollIndicator={false}>
            {Object.entries(grouped).map(([group, opts]) => (
              <View key={group} style={{ gap: 6 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.greenDark, letterSpacing: 0.5 }}>{group}</Text>
                <View style={{ gap: 6 }}>
                  {opts.map(o => {
                    const active = value === o.value
                    return (
                      <Pressable key={`${group}-${o.value}`} onPress={() => onPick(o.value as PaperSize)} style={{ paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, borderColor: active ? colors.green : colors.border, backgroundColor: active ? '#EAF4E8' : colors.surface, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, fontWeight: active ? '800' : '600', color: active ? colors.greenDark : colors.text }}>{o.label}</Text>
                        {active ? <Text style={{ fontSize: 12, color: colors.green }}>✓</Text> : null}
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            ))}
            <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.text }}>Custom — Atur mm sendiri</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textMuted }}>LEBAR (mm)</Text>
                  <TextInput value={cw} onChangeText={setCw} keyboardType="numeric" placeholder="58" dense style={{ backgroundColor: colors.surface }} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textMuted }}>TINGGI (mm)</Text>
                  <TextInput value={ch} onChangeText={setCh} keyboardType="numeric" placeholder="200" dense style={{ backgroundColor: colors.surface }} />
                </View>
              </View>
              {err ? <Text style={{ fontSize: 11, color: colors.error }}>{err}</Text> : null}
              <Button mode="contained" onPress={onSaveCustom} compact>Simpan Custom {cw}×{ch} mm</Button>
              <Text style={{ fontSize: 10, color: colors.textMuted, textAlign: 'center' }}>Contoh: A6 = 105×148, 80×80, 57×40 bebas</Text>
            </View>
          </ScrollView>
          <View style={{ padding: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Button mode="text" onPress={onClose} textColor={colors.textMuted}>Tutup</Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
