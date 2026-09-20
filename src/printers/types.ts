export type PrinterProtocol = 'ESCPOS' | 'TSPL' | 'ZPL';
export type PrinterTransport = 'BT_CLASSIC' | 'BT_LE' | 'USB' | 'TCP';

export interface ReceiptData {
  header?: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
  footer?: string;
  paperWidth: 58 | 80;
}

export interface LabelData {
  widthMm: number;
  heightMm: number;
  lines: string[];
  barcode?: string;
  qr?: string;
}

export interface PrinterDriver {
  readonly id: string;
  readonly label: string;
  readonly protocol: PrinterProtocol;
  readonly transport: PrinterTransport;
  connect(deviceId: string): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  printReceipt(data: ReceiptData): Promise<void>;
  printLabel?(data: LabelData): Promise<void>;
  testPrint(): Promise<void>;
}