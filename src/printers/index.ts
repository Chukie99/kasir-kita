import AsyncStorage from '@react-native-async-storage/async-storage';
import { PrinterDriver } from './types';
import { EscPosBluetoothDriver } from './drivers/EscPosBluetoothDriver';
import { EscPosUsbDriver } from './drivers/EscPosUsbDriver';

const STORAGE_KEY = 'activePrinterDriverId';
const DEFAULT_DRIVER = 'escpos-bt';

const registry: Record<string, PrinterDriver> = {
  'escpos-bt': new EscPosBluetoothDriver(),
  'escpos-usb': new EscPosUsbDriver(),
};

export const getDriver = (id: string): PrinterDriver | null => registry[id] || null;
export const getAllDrivers = (): PrinterDriver[] => Object.values(registry);

export const getActiveDriver = async (): Promise<PrinterDriver> => {
  try {
    const activeId = (await AsyncStorage.getItem(STORAGE_KEY)) || DEFAULT_DRIVER;
    return registry[activeId] || registry[DEFAULT_DRIVER];
  } catch {
    return registry[DEFAULT_DRIVER];
  }
};

export const setActiveDriver = async (id: string): Promise<void> => {
  if (!registry[id]) throw new Error(`Driver "${id}" tidak terdaftar`);
  await AsyncStorage.setItem(STORAGE_KEY, id);
};