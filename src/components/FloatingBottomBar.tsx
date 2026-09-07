import React from 'react'
import { View, StyleSheet, Pressable, Platform } from 'react-native'
import { Text, Icon } from 'react-native-paper'
import { colors } from '../theme/theme'

export type Tab = 'kasir' | 'produk' | 'riwayat' | 'pengaturan'

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
}

const ITEMS: { id: Tab; label: string; icon: string }[] = [
  { id: 'kasir', label: 'Kasir', icon: 'storefront-outline' },
  { id: 'produk', label: 'Produk', icon: 'cube-outline' },
  { id: 'riwayat', label: 'Laporan', icon: 'chart-bar' },
  { id: 'pengaturan', label: 'Lainnya', icon: 'dots-horizontal' },
]

export default function FloatingBottomBar({ active, onChange }: Props) {
  return (
    <View style={[styles.wrap, Platform.OS === 'ios' && { paddingBottom: 12 }]}>
      <View style={styles.bar}>
        {ITEMS.map((item) => {
          const isActive = active === item.id
          return (
            <Pressable
              key={item.id}
              onPress={() => onChange(item.id)}
              android_ripple={{ color: colors.chipBg, borderless: true }}
              style={({ pressed }) => [
                styles.item,
                pressed && styles.itemPressed,
                isActive && styles.itemActive,
              ]}
            >
              <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
                <Icon source={item.icon} size={18} color={isActive ? '#FFF' : colors.textMuted} />
              </View>
              <Text style={[styles.label, isActive && styles.labelActive]}>{item.label}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  bar: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: 28,
    paddingVertical: 8,
    paddingHorizontal: 10,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 3,
    minWidth: 64,
  },
  itemPressed: {
    opacity: 0.7,
  },
  itemActive: {
    backgroundColor: colors.green,
  },
  iconWrap: {
    width: 32,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  icon: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: colors.textMuted,
  },
  iconActive: {
    color: '#FFF',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
  },
  labelActive: {
    color: '#FFF',
  },
})
