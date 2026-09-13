const { withProjectBuildGradle, withAppBuildGradle, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withDantsu(config) {
  // 1. Tambah maven jitpack ke project build.gradle
  config = withProjectBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (!src.includes('jitpack.io')) {
      // Gradle 8+ pakai dependencyResolutionManagement di settings.gradle, tapi project build.gradle juga dibaca fallback — tambah di allprojects jika ada, else di akhir
      if (src.includes('allprojects')) {
        src = src.replace(/allprojects\s*\{[^}]*repositories\s*\{/, (m) => m + "\n        maven { url 'https://jitpack.io' }");
      } else {
        src += "\nallprojects { repositories { maven { url 'https://jitpack.io' } } }\n";
      }
      cfg.modResults.contents = src;
    }
    return cfg;
  });

  // 2. Tambah implementation di app/build.gradle
  config = withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (!src.includes('ESCPOS-ThermalPrinter-Android')) {
      src = src.replace(/dependencies\s*\{/, "dependencies {\n    implementation 'com.github.DantSu:ESCPOS-ThermalPrinter-Android:3.3.0'");
      cfg.modResults.contents = src;
    }
    return cfg;
  });

  // 3. Tulis native module Java (DantSu bridge)
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

public class DantsuPrinterModule extends ReactContextBaseJavaModule {
  public DantsuPrinterModule(ReactApplicationContext ctx){ super(ctx); }
  @Override public String getName(){ return "DantsuPrinter"; }

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
          }catch(Exception e){
            m.putString("name", null);
            m.putString("address", null);
          }
          arr.pushMap(m);
        }
      }
      p.resolve(arr);
    }catch(Exception e){ p.reject("ERR", e.getMessage(), e); }
  }

  @ReactMethod
  public void printText(String address, String text, Promise p){
    try{
      BluetoothConnection[] list = new BluetoothPrintersConnections().getList();
      BluetoothConnection target = null;
      if(list!=null){
        for(BluetoothConnection c: list){
          try{ if(c.getDevice().getAddress().equalsIgnoreCase(address)){ target=c; break; } }catch(Exception ignore){}
        }
      }
      if(target==null){
        target = BluetoothPrintersConnections.selectFirstPaired();
      }
      if(target==null){ p.reject("NO_PRINTER", "Tidak ada printer paired. Pair dulu di Bluetooth HP"); return; }
      EscPosPrinter printer = new EscPosPrinter(target.connect(), 203, 48f, 32);
      // text sudah ESC/POS plain — bungkus biar line break rapi
      String formatted = "[L]\\n" + text.replace("\\n","\\n");
      printer.printFormattedTextAndCut(formatted);
      printer.disconnectPrinter();
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

    // 4. Auto-register package di MainApplication (Expo 51+ pakai ReactNativeHost)
    const appFiles = [
      path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'java', 'com', 'chukie99', 'posumkm', 'MainApplication.java'),
      path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'java', 'com', 'chukie99', 'posumkm', 'MainApplication.kt'),
    ];
    for(const f of appFiles){
      try{
        let s = await fs.promises.readFile(f, 'utf8');
        if(!s.includes('DantsuPrinterPackage')){
          s = s.replace(/import\s+[^;]+;/, (m)=> m + "\nimport com.chukie99.posumkm.DantsuPrinterPackage;");
          // cari getPackages() -> add
          s = s.replace(/new\s+PackageList\(this\)\.getPackages\(\)/, "new PackageList(this).getPackages()");
          s = s.replace(/\.getPackages\(\)/, ".getPackages() { packages.add(new DantsuPrinterPackage()); return packages; } // patched");
          // fallback simple: inject after PackageList
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
