import { Platform, PermissionsAndroid, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'btPrinterAddr';

function getModule(): any {
  const mod: any = (NativeModules as any).DantsuPrinter;
  if (!mod) {
    throw new Error(
      'Native module DantsuPrinter tidak tersedia. Build APK native, bukan Expo Go.'
    );
  }
  return mod;
}

export async function requestBtPermissions(): Promise<{ ok: boolean; msg?: string }> {
  if (Platform.OS !== 'android') return { ok: true };

  try {
    if (Number(Platform.Version) >= 31) {
      // Android 12+ — MINTA SATU PER SATU, jangan requestMultiple
      const scan = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN as any
      );
      if (scan !== PermissionsAndroid.RESULTS.GRANTED) {
        return { ok: false, msg: 'Izin BLUETOOTH_SCAN ditolak' };
      }
      const conn = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT as any
      );
      if (conn !== PermissionsAndroid.RESULTS.GRANTED) {
        return { ok: false, msg: 'Izin BLUETOOTH_CONNECT ditolak' };
      }
      return { ok: true };
    }

    // Android 11 ke bawah
    const loc = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION as any
    );
    if (loc !== PermissionsAndroid.RESULTS.GRANTED) {
      return { ok: false, msg: 'Izin ACCESS_FINE_LOCATION ditolak' };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, msg: e?.message || 'Permission error' };
  }
}

export async function listPairedPrinters(): Promise<any[]> {
  const perm = await requestBtPermissions();
  if (!perm.ok) throw new Error(perm.msg || 'Izin Bluetooth diperlukan');
  const mod = getModule();
  if (typeof mod.listPairedPrinters !== 'function') {
    throw new Error('Method listPairedPrinters tidak ada di native module');
  }
  return await mod.listPairedPrinters();
}

export async function discoverPrinters(): Promise<{ bonded: any[]; discovered: any[] }> {
  const perm = await requestBtPermissions();
  if (!perm.ok) throw new Error(perm.msg || 'Izin Bluetooth diperlukan');
  const mod = getModule();
  if (typeof mod.startDiscovery !== 'function') {
    throw new Error('Method startDiscovery tidak ada di native module');
  }
  const result = await mod.startDiscovery();
  // Normalisasi output — sesuaikan dengan struktur return native module Anda
  if (Array.isArray(result)) return { bonded: result, discovered: [] };
  return {
    bonded: result?.bonded || [],
    discovered: result?.discovered || [],
  };
}

export const getSavedPrinter = async (): Promise<string | null> =>
  await AsyncStorage.getItem(STORAGE_KEY);

export const savePrinter = async (addr: string): Promise<void> =>
  await AsyncStorage.setItem(STORAGE_KEY, addr);

export const clearSavedPrinter = async (): Promise<void> =>
  await AsyncStorage.removeItem(STORAGE_KEY);