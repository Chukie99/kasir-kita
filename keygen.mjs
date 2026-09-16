#!/usr/bin/env node
// Kasir Kita — Key Generator offline (HMAC legacy fallback)
// SECRET harus sama dengan src/license/license.ts APP_LICENSE_SECRET
// dan keygen-helper.html SECRET — jangan ganti sembarangan!
import { createHmac } from 'crypto';

const SECRET = '5E175D6EBE1E6E0FA1F068A59308898E090239DFFC59E2C4';
const ALPHA = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function normalize(s) {
  return String(s).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12).padEnd(12, 'X');
}
function bytesToBase32(bytes) {
  let bits = 0n, val = 0n, out = '';
  for (const b of bytes) {
    val = (val << 8n) | BigInt(b);
    bits += 8n;
    while (bits >= 5n) { out += ALPHA[Number((val >> (bits - 5n)) & 31n)]; bits -= 5n; }
  }
  if (bits > 0n) out += ALPHA[Number((val << (5n - bits)) & 31n)];
  return out.slice(0, 16);
}
function gen(deviceId) {
  const n = normalize(deviceId);
  const mac = createHmac('sha256', SECRET).update(n).digest();
  const code = bytesToBase32(mac).match(/.{4}/g).join('-');
  return { device: n, code };
}

const input = process.argv[2];
if (!input) {
  console.log('Pakai: node keygen.mjs <DEVICE_ID>');
  console.log('Contoh: node keygen.mjs QKQ1-AA11-BB22');
  console.log('Device ID lihat di layar aktivasi APK (atas).');
  process.exit(1);
}
const { device, code } = gen(input);
console.log(`Device : ${device.match(/.{4}/g).join('-')}`);
console.log(`Kode   : ${code}`);
console.log(`Kirim kode ini via WA ke customer.`);
