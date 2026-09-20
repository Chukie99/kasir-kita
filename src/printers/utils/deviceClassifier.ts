export type ClassifyResult = {
  driverId: string;
  protocol: 'ESCPOS' | 'TSPL' | 'ZPL';
  transport: 'BT_CLASSIC' | 'BT_LE' | 'USB' | 'TCP';
  confidence: 'high' | 'medium' | 'low';
};

export const classify = (name: string): ClassifyResult => {
  const n = (name || '').toLowerCase();

  // Printer struk ESC/POS
  if (
    n.includes('pos') || n.includes('58') || n.includes('80') ||
    n.includes('tm-') || n.includes('epson') || n.includes('star') ||
    n.includes('thermal') || n.includes('struk')
  ) {
    return { driverId: 'escpos-bt', protocol: 'ESCPOS', transport: 'BT_CLASSIC', confidence: 'high' };
  }

  // Printer label TSPL/ZPL
  if (
    n.includes('xp-') || n.includes('tsc') || n.includes('zebra') ||
    n.includes('zd') || n.includes('gk') || n.includes('label')
  ) {
    return { driverId: 'tspl-bt', protocol: 'TSPL', transport: 'BT_CLASSIC', confidence: 'high' };
  }

  // BLE
  if (n.includes('ble') || n.includes('low energy')) {
    return { driverId: 'escpos-bt', protocol: 'ESCPOS', transport: 'BT_LE', confidence: 'medium' };
  }

  return { driverId: 'escpos-bt', protocol: 'ESCPOS', transport: 'BT_CLASSIC', confidence: 'low' };
};