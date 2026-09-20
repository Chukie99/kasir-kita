import React, { useEffect, useState } from 'react';
import {
  View, Text, Button, FlatList, StyleSheet, Alert,
  TouchableOpacity, NativeModules, ScrollView,
} from 'react-native';
import { discoverPrinters, savePrinter, getSavedPrinter, clearSavedPrinter } from '../utils/bluetooth';
import { getAllDrivers, getActiveDriver, setActiveDriver } from '../printers';

export const PrinterSettings = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string>('escpos-bt');
  const [savedAddr, setSavedAddr] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [btOn, setBtOn] = useState<boolean | null>(null);

  const drivers = getAllDrivers();
  const moduleAvailable = !!(NativeModules as any).DantsuPrinter;

  useEffect(() => {
    (async () => {
      const driver = await getActiveDriver();
      setActiveId(driver.id);
      const addr = await getSavedPrinter();
      setSavedAddr(addr || '');
      // Cek Bluetooth ON — VERIFY method name di native module
      try {
        const mod: any = (NativeModules as any).DantsuPrinter;
        if (mod?.isBluetoothEnabled) {
          setBtOn(await mod.isBluetoothEnabled());
        }
      } catch {}
    })();
  }, []);

  const onScan = async () => {
    try {
      setScanning(true);
      const res = await discoverPrinters();
      const all = [...res.bonded, ...res.discovered];
      setDevices(all);
      if (all.length === 0) {
        Alert.alert('Tidak ada printer', 'Pastikan printer ON dan sudah di-pair di Pengaturan Bluetooth HP.');
      }
    } catch (e: any) {
      Alert.alert('Scan gagal', e?.message || String(e));
    } finally {
      setScanning(false);
    }
  };

  const onPickDevice = async (item: any) => {
    const addr = item.address || item.id;
    if (!addr) return Alert.alert('Error', 'Device tidak punya alamat MAC');
    await savePrinter(addr);
    setSavedAddr(addr);
    Alert.alert('Tersimpan', `Printer: ${item.name || addr}`);
  };

  const onSelectDriver = async (id: string) => {
    try {
      await setActiveDriver(id);
      setActiveId(id);
    } catch (e: any) {
      Alert.alert('Error', e?.message);
    }
  };

  const onTestPrint = async () => {
    try {
      const driver = await getActiveDriver();
      await driver.testPrint();
      Alert.alert('Sukses', 'Test print terkirim.');
    } catch (e: any) {
      Alert.alert('Test print gagal', e?.message || String(e));
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.section}>Diagnostik</Text>
      <Text>Native Module: {moduleAvailable ? '✅ ADA' : '❌ TIDAK ADA'}</Text>
      <Text>Bluetooth: {btOn === null ? '❓ Tidak dicek' : btOn ? '✅ ON' : '❌ OFF'}</Text>
      <Text>Driver Aktif: {activeId}</Text>
      <Text>Printer Tersimpan: {savedAddr || '(kosong)'}</Text>
      <Text>Total Devices: {devices.length}</Text>

      <Text style={styles.section}>Jenis Printer</Text>
      {drivers.map(d => (
        <TouchableOpacity
          key={d.id}
          style={[styles.driverBtn, activeId === d.id && styles.driverBtnActive]}
          onPress={() => onSelectDriver(d.id)}
        >
          <Text>{d.label} {activeId === d.id ? '✓' : ''}</Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.section}>Aksi</Text>
      <Button title={scanning ? 'Scanning...' : 'Scan Perangkat'} onPress={onScan} disabled={scanning} />
      <View style={{ height: 8 }} />
      <Button title="Test Print" onPress={onTestPrint} />
      <View style={{ height: 8 }} />
      <Button title="Hapus Printer Tersimpan" color="#c00" onPress={async () => {
        await clearSavedPrinter();
        setSavedAddr('');
      }} />

      <Text style={styles.section}>Daftar Perangkat</Text>
      <FlatList
        data={devices}
        scrollEnabled={false}
        keyExtractor={(item, idx) => item.address || item.id || String(idx)}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.deviceItem} onPress={() => onPickDevice(item)}>
            <Text style={styles.deviceName}>{item.name || '(tanpa nama)'}</Text>
            <Text style={styles.deviceAddr}>{item.address || item.id}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Belum ada perangkat. Tekan Scan.</Text>}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  section: { fontSize: 16, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  driverBtn: { padding: 12, borderWidth: 1, borderColor: '#ccc', borderRadius: 6, marginBottom: 6 },
  driverBtnActive: { borderColor: '#0a7', backgroundColor: '#e6fbf3' },
  deviceItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  deviceName: { fontSize: 15, fontWeight: '600' },
  deviceAddr: { fontSize: 12, color: '#666' },
  empty: { color: '#999', fontStyle: 'italic', padding: 12 },
});