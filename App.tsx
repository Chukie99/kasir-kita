import React, { useEffect, useState } from 'react'
import { View, Text, Image, ActivityIndicator, BackHandler, Alert } from 'react-native'
import { PaperProvider, Appbar } from 'react-native-paper'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import * as Font from 'expo-font'
import { MaterialCommunityIcons } from '@expo/vector-icons'

import * as SplashScreen from 'expo-splash-screen'
import { initDatabase, seedDemoData } from './src/db/database'
import { theme, colors, applyTheme } from './src/theme/theme'
import { getTheme, getSetting, setSetting, type ThemePref } from './src/utils/settings'
import { getDeviceId, formatDeviceCode, isActivated, activate } from './src/license/license'
import ActivationGate from './src/screens/ActivationGate'
import CashierScreen from './src/screens/CashierScreen'
import HistoryScreen from './src/screens/HistoryScreen'
import ManageProductsScreen from './src/screens/ManageProductsScreen'
import SettingsScreen from './src/screens/SettingsScreen'
import FloatingBottomBar from './src/components/FloatingBottomBar'

type Tab = 'kasir' | 'produk' | 'riwayat' | 'pengaturan'

export default function App() {
  const [ready, setReady] = useState(false)
  const [activated, setActivated] = useState(false)
  const [deviceCode, setDeviceCode] = useState('')
  const [tab, setTab] = useState<Tab>('kasir')
  const [refreshKey, setRefreshKey] = useState(0)
  const [dark, setDark] = useState(false)
  // bump agar semua layar re-render saat tema berubah (colors adalah let-binding)
  const [themeTick, setThemeTick] = useState(0)
  const [produkModalOpen, setProdukModalOpen] = useState(false)

  useEffect(() => {
    SplashScreen.preventAutoHideAsync().catch(() => {})
    ;(async () => {
      try { await Font.loadAsync(MaterialCommunityIcons.font) } catch {}
      initDatabase()
      seedDemoData()
      setDeviceCode(formatDeviceCode(getDeviceId()))
      setActivated(isActivated())
      const pref: ThemePref = getTheme()
      applyTheme(pref)
      setDark(pref === 'dark')
      setReady(true)
    })()
  }, [])

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {})
  }, [ready])

  // Android back: kalau modal produk kebuka -> tutup, kalau bukan di Kasir -> balik ke Kasir, di Kasir -> tanya Keluar/Batal
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (produkModalOpen) {
        setProdukModalOpen(false)
        return true
      }
      if (tab !== 'kasir') {
        setTab('kasir')
        return true
      }
      Alert.alert('Keluar aplikasi?', 'Yakin mau keluar dari Kasir Kita?', [
        { text: 'Batal', style: 'cancel' },
        { text: 'Keluar', style: 'destructive', onPress: () => BackHandler.exitApp() },
      ])
      return true
    })
    return () => sub.remove()
  }, [tab, produkModalOpen])

  const toggleTheme = () => {
    const next: ThemePref = dark ? 'light' : 'dark'
    setSetting('theme', next)
    applyTheme(next)
    setDark(!dark)
    setThemeTick((t) => t + 1)
  }

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F2440', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <View style={{ width: 120, height: 120, borderRadius: 28, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 }}>
          <Image source={require('./assets/splash-icon.png')} style={{ width: 96, height: 96, borderRadius: 18 }} resizeMode="contain" />
        </View>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 1.5, textAlign: 'center' }}>Kasir Kita</Text>
        <Text style={{ color: '#AEBDCA', fontSize: 12, marginTop: 6, letterSpacing: 2, textAlign: 'center' }}>KASIR OFFLINE UMKM</Text>
        <View style={{ marginTop: 28, alignItems: 'center' }}>
          <ActivityIndicator size="small" color="#7895B2" />
          <Text style={{ color: '#7895B2', fontSize: 11, marginTop: 10, letterSpacing: 0.5 }}>Memuat kasir...</Text>
        </View>
      </View>
    )
  }

  return (
    <PaperProvider theme={theme}>
      <SafeAreaProvider>
        <StatusBar style={dark ? 'light' : 'dark'} />
        {!activated ? (
          <ActivationGate
            deviceCode={deviceCode}
            onActivate={(key) => {
              const ok = activate(key)
              if (ok) setActivated(true)
              return ok
            }}
          />
        ) : (
          <View key={themeTick} style={{ flex: 1, backgroundColor: colors.bg }}>
            <Appbar.Header elevated={false} style={{ backgroundColor: colors.surface }}>
              <Appbar.Content
                title={
                  tab === 'kasir' ? `${getSetting('storeName', 'Kasir Kita')} — Kasir`
                  : tab === 'produk' ? 'Kelola Produk & Menu'
                  : tab === 'pengaturan' ? 'Pengaturan & Backup'
                  : 'Laporan & Riwayat'
                }
                titleStyle={{ fontWeight: '800', color: colors.text, fontSize: 19 }}
              />
            </Appbar.Header>

            <View style={{ flex: 1, backgroundColor: colors.bg }}>
              {tab === 'kasir' && <CashierScreen onSold={() => setRefreshKey((k) => k + 1)} />}
              {tab === 'produk' && <ManageProductsScreen key={refreshKey} onModalChange={setProdukModalOpen} />}
              {tab === 'riwayat' && <HistoryScreen key={refreshKey} />}
              {tab === 'pengaturan' && (
                <SettingsScreen
                  dark={dark}
                  onToggleTheme={toggleTheme}
                />
              )}
            </View>

            <FloatingBottomBar active={tab} onChange={setTab} hidden={produkModalOpen} />
          </View>
        )}
      </SafeAreaProvider>
    </PaperProvider>
  )
}
