import React, { useEffect, useRef } from 'react'
import { View, StyleSheet, Pressable, Animated } from 'react-native'
import { Text } from 'react-native-paper'
import { colors } from '../theme/theme'
import type { CartLine } from '../utils/pos'

interface Props {
  visible: boolean
  cart: CartLine[]
  total: number
  onCheckout: () => void
}

export const rupiah = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')

/**
 * Modern floating cart bar — dark teal pill with slide-up animation.
 * Left: item count + total. Right: prominent "Bayar" button.
 */
export default function StickyCartBar({ visible, cart, total, onCheckout }: Props) {
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.spring(anim, {
      toValue: visible && cart.length > 0 ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 60,
    }).start()
  }, [visible, cart.length])

  if (!visible) return null
  const itemCount = cart.reduce((s, l) => s + l.qty, 0)
  if (itemCount === 0) return null

  return (
    <Animated.View
      style={[
        styles.wrap,
        { transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [120, 0] }) }] },
      ]}
      pointerEvents="box-none"
    >
      <Pressable style={styles.bar} onPress={onCheckout} android_ripple={{ color: 'rgba(255,255,255,0.12)' }}>
        {/* Item count badge */}
        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>{itemCount}</Text>
        </View>

        <View style={styles.info}>
          <Text style={styles.total}>{rupiah(total)}</Text>
          <Text numberOfLines={1} style={styles.preview}>
            Lihat pesanan ({cart.length} jenis)
          </Text>
        </View>

        <View style={styles.payBtn}>
          <Text style={styles.payBtnText}>Bayar ›</Text>
        </View>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 84,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.greenDark,
    borderRadius: 20,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 6,
    gap: 12,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  badge: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeTxt: { color: '#4A3405', fontWeight: '900', fontSize: 15 },
  info: { flex: 1 },
  total: { color: '#FFFFFF', fontSize: 19, fontWeight: '900', letterSpacing: 0.3 },
  preview: { color: '#BFE3DE', fontSize: 11.5, marginTop: 1 },
  payBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    paddingVertical: 13,
    paddingHorizontal: 22,
  },
  payBtnText: { color: colors.greenDark, fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
})
