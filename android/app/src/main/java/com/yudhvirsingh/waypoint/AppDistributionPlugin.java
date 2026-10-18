package com.yudhvirsingh.waypoint;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Tells the web code which build it is running in: the Play Store build,
 * which gets new versions from Play, or the APK from the site, which
 * updates itself. Builds from before this plugin existed are all the
 * site APK.
 */
@CapacitorPlugin(name = "AppDistribution")
public class AppDistributionPlugin extends Plugin {
  @PluginMethod
  public void get(PluginCall call) {
    JSObject result = new JSObject();
    result.put("channel", BuildConfig.SELF_UPDATE ? "sideload" : "play");
    call.resolve(result);
  }
}
