const { withProjectBuildGradle, withAppBuildGradle, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withDantsu(config) {
  config = withProjectBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (!src.includes('jitpack.io')) {
      if (src.includes('allprojects')) {
        src = src.replace(/allprojects\s*\{[^}]*repositories\s*\{/, (m) => m + "\n        maven { url 'https://jitpack.io' }");
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
      if(target==null){
        target = BluetoothPrintersConnections.selectFirstPaired();
      }
      if(target==null){ p.reject("NO_PRINTER", "Tidak ada printer paired. Pair dulu di Bluetooth HP"); return; }
      float mmWidth = 48f;
      int nbrChars = 32;
      if(paperSize != null){
        String ps = paperSize.toLowerCase().trim();
        if(ps.contains("a6") || ps.contains("105")){ mmWidth = 90f; nbrChars = 64; }
        else if(ps.contains("80")){ mmWidth = 72f; nbrChars = 48; }
        else if(ps.contains("custom")){
          try{
            String dims = ps.contains(":") ? ps.split(":")[1] : ps;
            // dims like "105x148" or "80x50"
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
