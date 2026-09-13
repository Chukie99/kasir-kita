#!/usr/bin/env node
/**
 * validate-dantsu.js — tight loop 5 detik (ganti 7 menit GH)
 * Cek DantsuPrinterModule.java yang di-generate dari with-dantsu.js gak ada:
 *  - unclosed string literal (newline di dalam "...")
 *  - cannot find symbol cutPaper()
 *  - import missing
 * Usage: node scripts/validate-dantsu.js
 * Exit 0 = GREEN, Exit 1 = RED (fail reason printed)
 */
const fs = require('fs');
const path = require('path');

const pluginPath = path.join(__dirname, '..', 'expo-plugins', 'with-dantsu.js');
// fallback when run from repo root: scripts/validate-dantsu.js
const altPath = path.join(process.cwd(), 'expo-plugins', 'with-dantsu.js');
const srcPath = fs.existsSync(pluginPath) ? pluginPath : altPath;

if (!fs.existsSync(srcPath)) {
  console.error(`[RED] with-dantsu.js not found at ${srcPath}`);
  process.exit(1);
}

const src = fs.readFileSync(srcPath, 'utf8');
const m = src.match(/const modJava = `([\s\S]*?)`\.trim\(\)/);
if (!m) {
  console.error('[RED] const modJava template not found');
  process.exit(1);
}
const inner = m[1];
let out;
try {
  const fn = new Function('return `' + inner + '`');
  out = fn();
} catch (e) {
  console.error('[RED] template eval failed:', e.message);
  process.exit(1);
}

let red = false;
const fails = [];

// 1. Unclosed string literal: any line with odd number of unescaped quotes
out.split('\n').forEach((line, idx) => {
  // count quotes not escaped by backslash
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('//')) return;
  // skip lines that are not Java string contexts — rough check
  let inStr = false;
  let escaped = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') inStr = !inStr;
  }
  if (inStr) {
    // if line ends inside string but next line continues? In Java that's illegal unless \ at end
    // For our case, a line ending inside string = unclosed
    if (!line.trim().endsWith('+') && !line.trim().endsWith(',')) {
      // check if next line doesn't start with string continuation — treat as unclosed
      const next = out.split('\n')[idx + 1] || '';
      if (!next.trim().startsWith('"')) {
        // but allow multi-line string concatenation where line ends with " +
        if (!line.includes('" +') && !line.includes('+ "')) {
          // only flag if line contains opening quote without closing
          const quotes = (line.match(/"/g) || []).length;
          // rough: if quotes odd and not continued
          if (quotes % 2 === 1) {
            fails.push(`line ${idx + 1} unclosed string: ${line.trim().slice(0, 90)}`);
            red = true;
          }
        }
      }
    }
  }
  // Also detect literal newline inside quotes (state inStr at EOL)
  if (inStr) {
    fails.push(`line ${idx + 1} newline inside string literal: ${line.trim().slice(0, 90)}`);
    red = true;
  }
});

// 2. cutPaper() not in DantSu API
if (out.includes('cutPaper()')) {
  fails.push('contains cutPaper() — EscPosPrinter has no such method (use printFormattedTextAndCut only)');
  red = true;
}

// 3. Required imports
const required = ['Bitmap', 'BitmapFactory', 'PrinterTextParserImg'];
// For minimal (no-logo) variant, these are optional — only fail if logoPart present but imports missing
const hasLogo = out.includes('logoPart') || out.includes('bitmapToHex');
required.forEach(imp => {
  if (hasLogo && !out.includes(imp)) {
    fails.push(`missing import for ${imp} but logo code present`);
    red = true;
  }
});

// 4. Contains actual Java newline inside quoted string (the root cause of v1.1.4/1.1.5)
// Detect pattern: " ... \n (real newline) ... " — already covered by inStr check above
// Extra: scan raw out for quote-newline-quote without + concatenation
if (/"[^"]*\n[^"]*"/.test(out)) {
  // This regex finds real newline inside quotes — already flagged above, but double-check
  const badLines = out.split('\n').filter((l, i) => {
    // line that is continuation of string without proper +
    return l.includes('"') && (out.split('\n')[i] || '').includes('"') === false;
  });
}

if (red) {
  console.error('[RED] validate-dantsu FAILED:');
  fails.forEach(f => console.error('  - ' + f));
  console.error('\nGenerated Java preview (offending area):');
  out.split('\n').forEach((l, i) => {
    if (l.includes('logoPart') || l.includes('formatted') || l.includes('cutPaper') || fails.some(f => f.includes(`line ${i + 1}`))) {
      console.error(`${String(i + 1).padStart(3)}: ${l}`);
    }
  });
  process.exit(1);
}

console.log('[GREEN] validate-dantsu PASSED');
console.log(`  generated ${out.length} chars, ${out.split('\n').length} lines, no unclosed strings, no cutPaper()`);
process.exit(0);
