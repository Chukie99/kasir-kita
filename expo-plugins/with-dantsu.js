const { withProjectBuildGradle, withAppBuildGradle, withDangerousMod, withAndroidManifest } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withDantsu(config) {
  config = withProjectBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (!src.includes('jitpack.io')) {
      if (src.includes('allprojects')) {
        src = src.replace(/allprojects\s*\{\s*repositories\s*\{/, (m) => m + "\n        maven { url 'https://jitpack.io' }");
      } else {
        src += "\nallprojects { repositories { maven { url 'https://jitpack.io' } } }\n";
      }
      cfg.modResults.contents = src;
    }
    return cfg;
  });
  config = withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (!src.includes('ESCPOS-ThermalPrinter-Android')) {
      src = src.replace(/dependencies\s*\{/, "dependencies {\n    implementation 'com.github.DantSu:ESCPOS-ThermalPrinter-Android:3.3.0'");
      cfg.modResults.contents = src;
    }
    return cfg;
  });
  // Fix AndroidManifest permissions for Android 12+ (BLUETOOTH_SCAN neverForLocation)
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    if (!manifest) return cfg;
    // Ensure uses-permission entries have correct flags
    const perms = manifest['uses-permission'] || [];
    const want = [
      { name: 'android.permission.BLUETOOTH', maxSdk: undefined },
      { name: 'android.permission.BLUETOOTH_ADMIN', maxSdk: undefined },
      { name: 'android.permission.BLUETOOTH_CONNECT', maxSdk: undefined },
      { name: 'android.permission.BLUETOOTH_SCAN', flags: 'neverForLocation' },
      { name: 'android.permission.ACCESS_FINE_LOCATION', maxSdk: '30' },
    ];
    // Remove duplicates and re-add with correct attrs
    const existingNames = new Set(perms.map(p => p.$?.['android:name']));
    for (const w of want) {
      if (!existingNames.has(w.name)) {
        const entry = { $: { 'android:name': w.name } };
        if (w.flags) entry.$['android:usesPermissionFlags'] = w.flags;
        if (w.maxSdk) entry.$['android:maxSdkVersion'] = w.maxSdk;
        perms.push(entry);
      } else {
        // patch existing BLUETOOTH_SCAN to add neverForLocation, ACCESS_FINE_LOCATION maxSdk
        for (const p of perms) {
          if (p.$?.['android:name'] === 'android.permission.BLUETOOTH_SCAN' && !p.$['android:usesPermissionFlags']) {
            p.$['android:usesPermissionFlags'] = 'neverForLocation';
          }
          if (p.$?.['android:name'] === 'android.permission.ACCESS_FINE_LOCATION' && !p.$['android:maxSdkVersion']) {
            p.$['android:maxSdkVersion'] = '30';
          }
        }
      }
    }
    manifest['uses-permission'] = perms;
    return cfg;
  });
  config = withDangerousMod(config, ['android', async (cfg) => {
    const base = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'java', 'com', 'chukie99', 'posumkm');
    await fs.promises.mkdir(base, { recursive: true });
    const modJava = `
package com.chukie99.posumkm;
import com.facebook.react.bridge.*;
import com.dantsu.escposprinter.connection.bluetooth.BluetoothConnection;
import com.dantsu.escposprinter.connection.bluetooth.BluetoothPrintersConnections;
import com.dantsu.escposprinter.EscPosPrinter;
import com.dantsu.escposprinter.exceptions.EscPosConnectionException;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import com.dantsu.escposprinter.textparser.PrinterTextParserImg;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import java.util.*;

public class DantsuPrinterModule extends ReactContextBaseJavaModule {
  public DantsuPrinterModule(ReactApplicationContext ctx){ super(ctx); }
  @Override public String getName(){ return "DantsuPrinter"; }

  @ReactMethod
  public void isBluetoothEnabled(Promise p){
    try{
      BluetoothAdapter a = BluetoothAdapter.getDefaultAdapter();
      p.resolve(a != null && a.isEnabled());
    }catch(Exception e){ p.resolve(false); }
  }

  @ReactMethod
  public void listPairedPrinters(Promise p){
    try{
      BluetoothConnection[] list = new BluetoothPrintersConnections().getList();
      WritableArray arr = Arguments.createArray();
      if(list!=null){
        for(BluetoothConnection c: list){
          WritableMap m = Arguments.createMap();
          try{
            m.putString("name", c.getDevice().getName());
            m.putString("address", c.getDevice().getAddress());
            m.putBoolean("bonded", true);
          }catch(Exception e){
            m.putString("name", null);
            m.putString("address", null);
            m.putBoolean("bonded", true);
          }
          arr.pushMap(m);
        }
      }
      p.resolve(arr);
    }catch(Exception e){ p.reject("ERR", e.getMessage(), e); }
  }

  // Discovery: bonded + nearby (timeout 12s). Returns combined array with bonded flag.
  @ReactMethod
  public void startDiscovery(Promise p){
    try{
      final ReactApplicationContext ctx = getReactApplicationContext();
      final BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
      if(adapter == null){ p.reject("NO_BT","Bluetooth tidak tersedia di device ini"); return; }
      if(!adapter.isEnabled()){ p.reject("BT_OFF","Bluetooth mati — nyalakan dulu di Pengaturan HP"); return; }
      // Collect bonded first
      final Set<String> seen = new HashSet<>();
      final WritableArray result = Arguments.createArray();
      try{
        BluetoothConnection[] bonded = new BluetoothPrintersConnections().getList();
        if(bonded!=null){
          for(BluetoothConnection c: bonded){
            try{
              String addr = c.getDevice().getAddress();
              if(addr==null) continue;
              seen.add(addr.toLowerCase());
              WritableMap m = Arguments.createMap();
              m.putString("name", c.getDevice().getName());
              m.putString("address", addr);
              m.putBoolean("bonded", true);
              result.pushMap(m);
            }catch(Exception ignore){}
          }
        }
      }catch(Exception ignore){}

      // Setup receiver for discovery
      final List<BluetoothDevice> found = Collections.synchronizedList(new ArrayList<BluetoothDevice>());
      final BroadcastReceiver receiver = new BroadcastReceiver(){
        @Override public void onReceive(Context c, Intent intent){
          try{
            if(BluetoothDevice.ACTION_FOUND.equals(intent.getAction())){
              BluetoothDevice d = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
              if(d!=null) found.add(d);
            }
          }catch(Exception ignore){}
        }
      };
      IntentFilter filter = new IntentFilter(BluetoothDevice.ACTION_FOUND);
      try{ ctx.registerReceiver(receiver, filter); }catch(Exception ignore){}
      boolean started = false;
      try{ 
        if(adapter.isDiscovering()) adapter.cancelDiscovery();
        started = adapter.startDiscovery(); 
      }catch(Exception e){ started = false; }
      if(!started){
        try{ ctx.unregisterReceiver(receiver); }catch(Exception ignore){}
        // fallback: return bonded only
        p.resolve(result);
        return;
      }
      // Wait 12s collecting, then cancel and return
      new Thread(new Runnable(){
        @Override public void run(){
          try{ Thread.sleep(12000); }catch(Exception ignore){}
          try{ adapter.cancelDiscovery(); }catch(Exception ignore){}
          try{ ctx.unregisterReceiver(receiver); }catch(Exception ignore){}
          // Add discovered not yet seen
          for(BluetoothDevice d: found){
            try{
              String addr = d.getAddress();
              if(addr==null) continue;
              String low = addr.toLowerCase();
              if(seen.contains(low)) continue;
              seen.add(low);
              WritableMap m = Arguments.createMap();
              m.putString("name", d.getName());
              m.putString("address", addr);
              boolean isBonded = false;
              try{ isBonded = d.getBondState() == BluetoothDevice.BOND_BONDED; }catch(Exception ignore){}
              m.putBoolean("bonded", isBonded);
              result.pushMap(m);
            }catch(Exception ignore){}
          }
          p.resolve(result);
        }
      }).start();
    }catch(Exception e){ p.reject("ERR", e.getMessage(), e); }
  }

  @ReactMethod
  public void cancelDiscovery(Promise p){
    try{
      BluetoothAdapter a = BluetoothAdapter.getDefaultAdapter();
      if(a!=null) a.cancelDiscovery();
      p.resolve(true);
    }catch(Exception e){ p.reject("ERR", e.getMessage(), e); }
  }

  @ReactMethod
  public void testConnect(String address, Promise p){
    try{
      BluetoothConnection[] list = new BluetoothPrintersConnections().getList();
      // try to find bonded target first
      BluetoothConnection target = null;
      if(list!=null){
        for(BluetoothConnection c: list){
          try{ if(c.getDevice().getAddress().equalsIgnoreCase(address)){ target=c; break; } }catch(Exception ignore){}
        }
      }
      // if not bonded, try create via adapter
      if(target==null){
        try{
          BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
          if(adapter!=null){
            BluetoothDevice dev = adapter.getRemoteDevice(address);
            if(dev!=null){
              // try generic SPP uuid connect via DantSu BluetoothConnection
              target = new BluetoothConnection(dev);
            }
          }
        }catch(Exception ignore){}
      }
      if(target==null){ p.reject("NO_PRINTER","Printer tidak ditemukan. Pastikan sudah Pair dan alamat MAC benar: "+address); return; }
      // try connect + disconnect quickly
      try{
        target.connect();
        try{ Thread.sleep(300); }catch(Exception ignore){}
        try{ target.disconnect(); }catch(Exception ignore){}
        p.resolve(true);
      }catch(Exception e){
        p.reject("CONN","Gagal connect ke "+address+": "+e.getMessage()+". Pastikan printer nyala, tidak dipakai app lain, dan jarak <10m.");
      }
    }catch(Exception e){ p.reject("ERR", e.getMessage(), e); }
  }

  @ReactMethod
  public void printText(String address, String text, Promise p){
    printTextWithSettings(address, text, "58mm", "", p);
  }

  @ReactMethod
  public void printTextWithSettings(String address, String text, String paperSize, String logoPath, Promise p){
    try{
      BluetoothConnection[] list = new BluetoothPrintersConnections().getList();
      BluetoothConnection target = null;
      if(list!=null){
        for(BluetoothConnection c: list){
          try{ if(c.getDevice().getAddress().equalsIgnoreCase(address)){ target=c; break; } }catch(Exception ignore){}
        }
      }
      // fallback to direct device if not in bonded list (allow discovered-but-not-bonded? will fail but give clear error)
      if(target==null){
        try{
          BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
          if(adapter!=null){
            BluetoothDevice dev = adapter.getRemoteDevice(address);
            if(dev!=null) target = new BluetoothConnection(dev);
          }
        }catch(Exception ignore){}
      }
      if(target==null){
        target = BluetoothPrintersConnections.selectFirstPaired();
      }
      if(target==null){ p.reject("NO_PRINTER", "Tidak ada printer paired. Pair dulu di Bluetooth HP (PIN 0000/1234) lalu tap Scan lagi"); return; }
      float mmWidth = 48f;
      int nbrChars = 32;
      if(paperSize != null){
        String ps = paperSize.toLowerCase().trim();
        if(ps.contains("a6") || ps.contains("105")){ mmWidth = 90f; nbrChars = 64; }
        else if(ps.contains("80")){ mmWidth = 72f; nbrChars = 48; }
        else if(ps.contains("custom")){
          try{
            String dims = ps.contains(":") ? ps.split(":")[1] : ps;
            if(dims.contains("x")){
              int w = Integer.parseInt(dims.split("x")[0].trim());
              if(w >= 100){ mmWidth = 90f; nbrChars = 64; }
              else if(w >= 70){ mmWidth = 72f; nbrChars = 48; }
              else { mmWidth = 48f; nbrChars = 32; }
            }
          }catch(Exception ignore){ mmWidth = 48f; nbrChars = 32; }
        }
        else if(ps.contains("x")){
          try{
            int w = Integer.parseInt(ps.split("x")[0].trim());
            if(w >= 100){ mmWidth = 90f; nbrChars = 64; }
            else if(w >= 70){ mmWidth = 72f; nbrChars = 48; }
            else { mmWidth = 48f; nbrChars = 32; }
          }catch(Exception ignore){}
          if(ps.contains("80")){ mmWidth = 72f; nbrChars = 48; }
          else if(ps.contains("58") || ps.contains("57")){ mmWidth = 48f; nbrChars = 32; }
          else if(ps.contains("50")){ mmWidth = 48f; nbrChars = 32; }
        }
        else if(ps.contains("58") || ps.contains("57")){ mmWidth = 48f; nbrChars = 32; }
        else if(ps.contains("50")){ mmWidth = 48f; nbrChars = 32; }
      }
      EscPosPrinter printer = new EscPosPrinter(target.connect(), 203, mmWidth, nbrChars);
      String logoPart = "";
      if(logoPath != null && logoPath.length() > 5){
        try{
          String path = logoPath.replace("file://", "");
          Bitmap bmp = BitmapFactory.decodeFile(path);
          if(bmp != null){
            int maxW = mmWidth >= 70 ? 450 : 350;
            if(bmp.getWidth() > maxW){
              float ratio = (float)maxW / bmp.getWidth();
              int nh = Math.round(bmp.getHeight()*ratio);
              bmp = Bitmap.createScaledBitmap(bmp, maxW, nh, true);
            }
            String hex = PrinterTextParserImg.bitmapToHexadecimalString(printer, bmp);
            logoPart = "[C]<img>" + hex + "</img>\\n";
          }
        }catch(Exception _le){}
      }
      String formatted = logoPart + "[C]<font size='big'>KASIR KITA</font>\\n" + "[L]\\n" + text + "\\n";
      try{ printer.printFormattedTextAndCut(formatted); } catch(Exception _e2){ try{ printer.printFormattedText("[L]" + text); } catch(Exception _e3){} }
      try{ printer.disconnectPrinter(); } catch(Exception ignore){}
      p.resolve("printed");
    }catch(EscPosConnectionException e){
      p.reject("CONN", e.getMessage(), e);
    }catch(Exception e){ p.reject("ERR", e.getMessage(), e); }
  }

  @ReactMethod
  public void printAndCut(String address, String text, Promise p){ printText(address, text, p); }
}
`.trim();
    const pkgJava = `
package com.chukie99.posumkm;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import java.util.*;

public class DantsuPrinterPackage implements ReactPackage {
  @Override public List<NativeModule> createNativeModules(ReactApplicationContext ctx){
    List<NativeModule> l=new ArrayList<>(); l.add(new DantsuPrinterModule(ctx)); return l;
  }
  @Override public List<ViewManager> createViewManagers(ReactApplicationContext ctx){ return Collections.emptyList(); }
}
`.trim();
    await fs.promises.writeFile(path.join(base, 'DantsuPrinterModule.java'), modJava, 'utf8');
    await fs.promises.writeFile(path.join(base, 'DantsuPrinterPackage.java'), pkgJava, 'utf8');
    const appFiles = [
      path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'java', 'com', 'chukie99', 'posumkm', 'MainApplication.java'),
      path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'java', 'com', 'chukie99', 'posumkm', 'MainApplication.kt'),
    ];
    for(const f of appFiles){
      try{
        let s = await fs.promises.readFile(f, 'utf8');
        if(!s.includes('DantsuPrinterPackage')){
          s = s.replace(/import\s+[^;]+;/, (m)=> m + "\nimport com.chukie99.posumkm.DantsuPrinterPackage;");
          s = s.replace(/new\s+PackageList\(this\)\.getPackages\(\)/, "new PackageList(this).getPackages()");
          s = s.replace(/\.getPackages\(\)/, ".getPackages() { packages.add(new DantsuPrinterPackage()); return packages; } // patched");
          if(!s.includes('DantsuPrinterPackage')){
            s = s.replace(/return packages;/, "packages.add(new DantsuPrinterPackage());\n      return packages;");
          }
          await fs.promises.writeFile(f, s, 'utf8');
        }
      }catch(e){}
    }
    return cfg;
  }]);
  return config;
}

module.exports = withDantsu;
