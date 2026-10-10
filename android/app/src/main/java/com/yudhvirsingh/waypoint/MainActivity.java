package com.yudhvirsingh.waypoint;

import android.graphics.Rect;
import android.os.Bundle;
import android.view.ActionMode;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  // Local plugins are registered before the bridge starts.
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(ApkInstallerPlugin.class);
    super.onCreate(savedInstanceState);
  }

  // Android's floating Cut / Copy / Paste / Select all toolbar would cover
  // the editor's own formatting bar. Stripping its items (rather than
  // refusing to start the action mode, which makes the WebView drop the
  // selection) leaves the selection and drag handles working with no
  // system menu on top.
  @Override
  public ActionMode onWindowStartingActionMode(ActionMode.Callback callback, int type) {
    return super.onWindowStartingActionMode(new EmptyMenuCallback(callback), type);
  }

  @Override
  public ActionMode onWindowStartingActionMode(ActionMode.Callback callback) {
    return super.onWindowStartingActionMode(new EmptyMenuCallback(callback));
  }

  private static final class EmptyMenuCallback extends ActionMode.Callback2 {
    private final ActionMode.Callback inner;

    EmptyMenuCallback(ActionMode.Callback inner) {
      this.inner = inner;
    }

    @Override
    public boolean onCreateActionMode(ActionMode mode, Menu menu) {
      boolean ok = inner.onCreateActionMode(mode, menu);
      menu.clear();
      return ok;
    }

    @Override
    public boolean onPrepareActionMode(ActionMode mode, Menu menu) {
      boolean ok = inner.onPrepareActionMode(mode, menu);
      menu.clear();
      return ok;
    }

    @Override
    public boolean onActionItemClicked(ActionMode mode, MenuItem item) {
      return inner.onActionItemClicked(mode, item);
    }

    @Override
    public void onDestroyActionMode(ActionMode mode) {
      inner.onDestroyActionMode(mode);
    }

    @Override
    public void onGetContentRect(ActionMode mode, View view, Rect outRect) {
      if (inner instanceof ActionMode.Callback2) {
        ((ActionMode.Callback2) inner).onGetContentRect(mode, view, outRect);
      } else {
        super.onGetContentRect(mode, view, outRect);
      }
    }
  }
}
