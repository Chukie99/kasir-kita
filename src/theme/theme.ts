import { MD3LightTheme, configureFonts } from 'react-native-paper'

/**
 * Kasir Kita — Palet Pastel Profesional v1.4
 * Sumber: ColorHunt Pastel — https://colorhunt.co/palette/f5efe6e8dfcaaebdca7895b2
 *   #F5EFE6 — warm cream (bg utama, lembut di mata kasir seharian)
 *   #E8DFCA — beige sand (chip, card highlight)
 *   #AEBDCA — dusty blue-grey (border, secondary)
 *   #7895B2 — steel blue (primary aksi: Bayar, Aktif, Highlight)
 *
 * Kenapa ini? 4 warna selaras, muted, premium — tidak norak, tidak gelap,
 * tetap kontras untuk jempol kasir. Cocok untuk foto struk & listing Lynk.id.
 */

// Font simple — Inter/System clean, tanpa dekorasi
const fontConfig = {
  default: {
    fontFamily: 'System',
    fontWeight: '400' as const,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.15,
  },
}

export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    background: '#F5EFE6',
    surface: '#FFFFFF',
    surfaceVariant: '#E8DFCA',
    primary: '#7895B2',
    onPrimary: '#FFFFFF',
    primaryContainer: '#DBE6F0',
    onPrimaryContainer: '#1E3447',
    secondary: '#5A758F',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#E8DFCA',
    onSecondaryContainer: '#2E3A47',
    tertiary: '#8AA0B5',
    error: '#D98C7A',
    onError: '#FFFFFF',
    errorContainer: '#FBE9E4',
    onErrorContainer: '#5C2A1A',
    outline: '#AEBDCA',
    outlineVariant: '#E8DFCA',
  },
  fonts: configureFonts({ config: fontConfig }),
}

function palette(mode: 'light' | 'dark') {
  const base = {
    steel: '#7895B2',
    dusty: '#AEBDCA',
    sand: '#E8DFCA',
    cream: '#F5EFE6',
  }
  if (mode === 'dark') {
    return {
      bg: '#1B2838',
      surface: '#223449',
      text: '#EAF0F6',
      textMuted: '#9AAFC2',
      green: base.steel,
      greenDark: '#8FB0D4',
      blue: '#AEBDCA',
      yellow: base.sand,
      terra: '#E0A090',
      cream: '#253A4E',
      chipBg: '#253A4E',
      badgeBg: '#2A3F55',
      badgeText: base.sand,
      border: '#2F455C',
      error: '#E0A090',
    }
  }
  return {
    bg: '#F5EFE6',
    surface: '#FFFFFF',
    text: '#2E3A47',
    textMuted: '#7A8EA3',
    green: base.steel,
    greenDark: '#5A7A9B',
    blue: base.dusty,
    yellow: base.sand,
    terra: '#D98C7A',
    cream: base.cream,
    chipBg: '#FAF6F0',
    badgeBg: '#EAF0F6',
    badgeText: '#3A5570',
    border: '#D6E0E8',
    error: '#D98C7A',
  }
}

export let colors = palette('light')

export function applyTheme(mode: 'light' | 'dark') {
  colors = palette(mode)
}
