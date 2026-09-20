import { NativeModules } from 'react-native';
import { PrinterDriver, PrinterProtocol, PrinterTransport, ReceiptData } from '../types';

const TAG = '[BT][ESCPOS]';

export class EscPosBluetoothDriver implements PrinterDriver {
  readonly id = 'escpos-bt';
  readonly label = 'Struk Bluetooth (ESC/POS)';
  readonly protocol: PrinterProtocol = 'ESCPOS';
  readonly transport: PrinterTransport = 'BT_CLASSIC';

  private connectedAddress: string | null = null;
  private connectedState = false;

  private log(stage: string, ...args: any[]) {
    try { console.log(`${TAG}[${stage}]`, ...args); } catch {}
  }

  private getModule(): any {
    const mod: any = (NativeModules as any).DantsuPrinter;
    if (!mod) {
      throw new Error(
        'Native module DantsuPrinter tidak tersedia. Build APK native (bukan Expo Go).'
      );
    }
    return mod;
  }

  async connect(deviceId: string): Promise<void> {
    this.log('INIT', `deviceId=${deviceId}`);
    const mod = this.getModule();

    // VERIFY: sesuaikan nama method dengan DantsuPrinterModule.java Anda
    const connectFn =
      mod.testConnect || mod.connectPrinter || mod.connect;
    if (typeof connectFn !== 'function') {
      throw new Error(
        'Method connect tidak ditemukan di DantsuPrinterModule. Cek @ReactMethod di file Java.'
      );
    }

    let lastError: any = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      this.log('CONNECT_ATTEMPT', `attempt=${attempt}/3`);
      try {
        await connectFn.call(mod, deviceId);
        this.connectedAddress = deviceId;
        this.connectedState = true;
        this.log('CONNECTED', deviceId);
        return;
      } catch (e: any) {
        lastError = e;
        this.log('CONNECT_ERROR', `attempt=${attempt} msg=${e?.message || e}`);
        if (attempt < 3) await new Promise(r => setTimeout(r, 500));
      }
    }

    this.connectedState = false;
    throw new Error(
      `Gagal connect setelah 3 percobaan: ${lastError?.message || lastError}`
    );
  }

  async disconnect(): Promise<void> {
    this.log('DISCONNECT');
    this.connectedAddress = null;
    this.connectedState = false;
  }

  isConnected(): boolean {
    return this.connectedState;
  }

  async printReceipt(data: ReceiptData): Promise<void> {
    if (!this.connectedState || !this.connectedAddress) {
      throw new Error('Printer belum terhubung. Panggil connect() dulu.');
    }
    const mod = this.getModule();

    // VERIFY: sesuaikan nama method print dengan DantsuPrinterModule.java Anda
    const printFn =
      mod.printTextWithSettings || mod.printText || mod.printReceipt;
    if (typeof printFn !== 'function') {
      throw new Error('Method print tidak ditemukan di DantsuPrinterModule.');
    }

    const line = '--------------------------------';
    let text = `${data.header || ''}\n${line}\n`;
    for (const item of data.items) {
      text += `${item.name} x${item.qty} @${item.price}\n`;
    }
    text += `${line}\nTOTAL: Rp ${data.total}\n${data.footer || ''}\n\n`;

    this.log('PAYLOAD', `len=${text.length} paper=${data.paperWidth}mm`);

    try {
      const paperArg = data.paperWidth === 80 ? '80mm' : '58mm';
      // Kalau method print lu cuma terima 2 argumen, hapus argumen ke-3 & ke-4
      await printFn.call(mod, this.connectedAddress, text, paperArg, '');
      this.log('PRINT_OK');
    } catch (e: any) {
      this.log('PRINT_ERROR', e?.message || e);
      throw e;
    }
  }

  async testPrint(): Promise<void> {
    this.log('TEST_PRINT');
    await this.printReceipt({
      header: 'TEST PRINT',
      items: [{ name: 'Item Test', qty: 1, price: 0 }],
      total: 0,
      footer: 'Jika ini tercetak, printer OK.',
      paperWidth: 58,
    });
  }
}