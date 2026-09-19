// Cross-check: keygen.mjs output must match the in-app validator.
// Run: node test-license.mjs
import { createHmac } from 'node:crypto'

const APP_LICENSE_SECRET = '5E175D6EBE1E6E0FA1F068A59308898E090239DFFC59E2C4'
const BASE32_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

function bytesToBase32(bytes) {
  let bits = 0, value = 0, out = ''
  for (const b of bytes) {
    value = ((value & ((1 << bits) - 1)) << 8 | b) >>> 0 // mask selalu: buang semua bit lama (aman 32-bit)
    bits += 8
    while (bits >= 5) { out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5 }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  return out.slice(0, 16)
}

const gen = (deviceId) => {
  const n = String(deviceId).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12).padEnd(12, 'X')
  return (bytesToBase32(createHmac('sha256', APP_LICENSE_SECRET).update(n).digest()).match(/.{1,4}/g) || []).join('-')
}

let pass = 0, fail = 0
const t = (name, cond) => { if (cond) { pass++ } else { console.log('FAIL', name); fail++ } }

const key1 = gen('ABCD1234EFGH')
t('deterministic', key1 === gen('ABCD1234EFGH'))
t('format XXXX-XXXX-XXXX-XXXX', /^[2-9A-HJ-NP-Z]{4}(-[2-9A-HJ-NP-Z]{4}){3}$/.test(key1))
t('different device → different key', key1 !== gen('ZZZZ9999YYYY'))
t('case/space insensitive input', gen(' abcd 1234 efgh ') === key1)
t('short id padded', gen('AB') === gen('ABXXXXXXXXXX'))

console.log(`${pass} passed, ${fail} failed`)
console.log('\nSample:', 'ABCD1234EFGH →', key1)
process.exit(fail ? 1 : 0)
