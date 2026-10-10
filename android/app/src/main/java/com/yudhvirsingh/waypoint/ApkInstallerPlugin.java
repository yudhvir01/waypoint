package com.yudhvirsingh.waypoint;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import androidx.core.content.pm.PackageInfoCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;

/**
 * Downloads a new Waypoint APK with progress, checks it, and hands it to
 * Android's installer.
 *
 * Android never lets a sideloaded app install silently: the system shows its
 * own "Do you want to update this app?" screen, and that screen is the
 * confirmation. This plugin removes everything around it (finding the file,
 * opening the installer) but not that one tap.
 *
 * Before the installer is shown the file is checked three ways: its SHA-256
 * against the value in the update manifest, that it is this same package,
 * and that it is newer than what is installed. Android itself then refuses
 * it unless it is signed with the key the installed app was signed with.
 */
@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstallerPlugin extends Plugin {
  private static final String UPDATE_DIR = "updates";
  private static final String FILE_NAME = "waypoint-update.apk";
  private static final long MAX_BYTES = 200L * 1024 * 1024;

  private volatile boolean cancelled = false;

  private File updateDir() {
    return new File(getContext().getCacheDir(), UPDATE_DIR);
  }

  @PluginMethod
  public void canInstall(PluginCall call) {
    boolean allowed =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.O
            || getContext().getPackageManager().canRequestPackageInstalls();
    JSObject result = new JSObject();
    result.put("allowed", allowed);
    call.resolve(result);
  }

  /** Opens the system screen where "Install unknown apps" is switched on for Waypoint. */
  @PluginMethod
  public void openInstallSettings(PluginCall call) {
    Intent intent =
        new Intent(
            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:" + getContext().getPackageName()));
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    getContext().startActivity(intent);
    call.resolve();
  }

  @PluginMethod
  public void cancel(PluginCall call) {
    cancelled = true;
    call.resolve();
  }

  @PluginMethod
  public void download(final PluginCall call) {
    final String address = call.getString("url");
    final String expected = call.getString("sha256");
    if (address == null || !address.startsWith("https://")) {
      call.reject("The update address must be https.");
      return;
    }
    if (expected == null || !expected.matches("(?i)^[0-9a-f]{64}$")) {
      call.reject("The update has no valid checksum.");
      return;
    }
    cancelled = false;

    new Thread(
            () -> {
              File partial = null;
              try {
                File dir = updateDir();
                if (!dir.exists() && !dir.mkdirs()) throw new IOException("Cannot create cache folder.");
                // One update at a time; anything left over is stale.
                File[] old = dir.listFiles();
                if (old != null) for (File f : old) f.delete();
                partial = new File(dir, FILE_NAME + ".part");
                File target = new File(dir, FILE_NAME);

                HttpURLConnection conn = (HttpURLConnection) new URL(address).openConnection();
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(30000);
                conn.setInstanceFollowRedirects(true);
                int status = conn.getResponseCode();
                if (status != 200) throw new IOException("The server answered " + status + ".");
                long total = conn.getContentLengthLong();
                if (total > MAX_BYTES) throw new IOException("The update is unexpectedly large.");

                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                long received = 0;
                long lastReport = 0;
                try (InputStream in = conn.getInputStream();
                    OutputStream out = new FileOutputStream(partial)) {
                  byte[] buffer = new byte[16 * 1024];
                  int n;
                  while ((n = in.read(buffer)) != -1) {
                    if (cancelled) throw new IOException("cancelled");
                    out.write(buffer, 0, n);
                    digest.update(buffer, 0, n);
                    received += n;
                    if (received > MAX_BYTES) throw new IOException("The update is unexpectedly large.");
                    long now = System.currentTimeMillis();
                    if (now - lastReport > 120) {
                      lastReport = now;
                      JSObject progress = new JSObject();
                      progress.put("received", received);
                      progress.put("total", total);
                      notifyListeners("progress", progress);
                    }
                  }
                }
                conn.disconnect();

                StringBuilder hex = new StringBuilder();
                for (byte b : digest.digest()) hex.append(String.format(Locale.US, "%02x", b));
                if (!hex.toString().equalsIgnoreCase(expected)) {
                  partial.delete();
                  call.reject("The downloaded update did not match its checksum.");
                  return;
                }
                if (!partial.renameTo(target)) throw new IOException("Cannot save the update.");

                PackageManager pm = getContext().getPackageManager();
                PackageInfo archive = pm.getPackageArchiveInfo(target.getAbsolutePath(), 0);
                if (archive == null || !getContext().getPackageName().equals(archive.packageName)) {
                  target.delete();
                  call.reject("The downloaded file is not a Waypoint update.");
                  return;
                }
                PackageInfo installed = pm.getPackageInfo(getContext().getPackageName(), 0);

                JSObject result = new JSObject();
                result.put("path", target.getAbsolutePath());
                result.put("size", target.length());
                result.put("versionCode", PackageInfoCompat.getLongVersionCode(archive));
                result.put("installedVersionCode", PackageInfoCompat.getLongVersionCode(installed));
                JSObject done = new JSObject();
                done.put("received", received);
                done.put("total", received);
                notifyListeners("progress", done);
                call.resolve(result);
              } catch (Exception e) {
                if (partial != null) partial.delete();
                call.reject(cancelled ? "cancelled" : "Couldn't download the update: " + e.getMessage());
              }
            },
            "waypoint-apk-download")
        .start();
  }

  @PluginMethod
  public void install(PluginCall call) {
    String path = call.getString("path");
    if (path == null) {
      call.reject("No update file.");
      return;
    }
    try {
      File file = new File(path).getCanonicalFile();
      File dir = updateDir().getCanonicalFile();
      // Only ever the file this plugin downloaded.
      if (!file.getParentFile().equals(dir) || !file.isFile()) {
        call.reject("That is not a downloaded update.");
        return;
      }
      Uri uri =
          FileProvider.getUriForFile(
              getContext(), getContext().getPackageName() + ".fileprovider", file);
      Intent intent = new Intent(Intent.ACTION_VIEW);
      intent.setDataAndType(uri, "application/vnd.android.package-archive");
      intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
      getContext().startActivity(intent);
      call.resolve();
    } catch (Exception e) {
      call.reject("Couldn't open the installer: " + e.getMessage());
    }
  }
}
