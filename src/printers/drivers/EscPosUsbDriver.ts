import { PrinterDriver, PrinterProtocol, PrinterTransport, ReceiptData } from '../types';

export class EscPosUsbDriver implements PrinterDriver {
  readonly id = 'escpos-usb';
  readonly label = 'Struk USB (ESC/POS)';
  readonly protocol: PrinterProtocol = 'ESCPOS';
  readonly transport: PrinterTransport = 'USB';

  async connect(_deviceId: string): Promise<void> {
    throw new Error('Driver USB belum diimplementasikan');
  }
  async disconnect(): Promise<void> { /* no-op */ }
  isConnected(): boolean { return false; }
  async printReceipt(_data: ReceiptData): Promise<void> {
    throw new Error('Driver USB belum diimplementasikan');
  }
  async testPrint(): Promise<void> {
    throw new Error('Driver USB belum diimplementasikan');
  }
}