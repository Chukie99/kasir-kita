---
When to Use: When working on POS UMKM Android app development (Expo, React Native, SQLite).
---

# POS UMKM Android Development Workflow

Complete workflow for building, testing, and releasing the **POS UMKM** Android application.

## 📱 App Overview

- **Framework**: Expo (React Native, TypeScript)
- **Database**: Expo SQLite (local, offline)
- **State**: React hooks + SQLite persisted
- **Build**: EAS (Expo Application Services)

## 🚀 Development Cycle

### 1. Setup & Environment

```bash
# Install dependencies
cd "C:/file ku/pos-umkm-android"
npm install

# Enable EAS (only once)
eas login
eas credentials --platform android
```

### 2. Testing Locally

```bash
# Run Expo dev server
npx expo start

# Or simulate on Android emulator/device
npx expo start --android
```

### 3. Build for Release

```bash
# Preview build (quick test)
eas build -p android --profile preview

# Production build
eas build -p android --profile production
```

## 🐛 Common Issues & Fixes

### Issue: Tab Laporan "Hari Ini" tetap muncul di semua mode
**Cause**: `React.useMemo` dependencies or `WHERE` clause not matching date format
**Fix**: Verify `strftime('%Y-%m', t.created_at)` matches `strftime('%Y-%m', NOW)`

### Issue: QRIS pas bayar tapi user tetep ketinggalan input uang
**Fix**: Set `paid = total` otomatis jika `method === 'qris'` di `CheckoutSheet.tsx`

### Issue: Foto produk tidak muncul di kasir
**Fix**: Simpan URI ke `FileSystem.documentDirectory` pakai `expo-file-system`

## 📦 Release Checklist

- [ ] Update `app.json` version + versionCode
- [ ] Run `npx tsc --noEmit` — no errors
- [ ] Test di HP fisik: aktivasi, kasir, laporan, tema gelap
- [ ] Upload APK ke GitHub Releases
- [ ] Update `Panduan-POS-UMKM.pdf` jika ada perubahan UI

## 🔧 Key Functions

| Function | Purpose |
|----------|---------|
| `generateActivationKey(deviceId)` | Buat kode aktivasi (keygen-helper.html) |
| `buildReceiptText(txId)` | Generate teks struk |
| `printReceipt(txId)` | Buka dialog print Android |
| `exportDailyReport()` | Export CSV laporan hari ini |

## 🎨 UI Guidelines

- **Primary color**: Teal `#249D8F`
- **Accent**: Kuning `#E9C46A`
- **Error**: Terracotta `#E76F51`
- **Background**: Krem `#FDF0D5`
- **Font**: Roboto (light mode), putih/abu-abu ringan (dark mode)

## 📁 File Structure

```
src/
  assets/          # Icons, images
  db/              # SQLite schema + migrations
  screens/         # React screens
  components/      # Reusable UI
  utils/           # Business logic
  theme/           # Colors & fonts

app.json           # Expo config
package.json       # Dependencies
```

## 🔗 Useful Commands

```bash
# Generate activation key (via terminal)
node keygen.mjs QKQ1-AA11-BB22

# Generate key via browser (offline)
# Buka keygen-helper.html di Chrome, paste device ID, copy key

# Build APK
eas build -p android --profile preview

# Check build status
eas build --status <build-id>
```

## 🛠️ Support Files

- `references/keygen-fix.md` — Cara pakai keygen-helper.html
- `templates/release-checklist.md` — Checklist sebelum push versi baru