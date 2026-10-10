import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

// The system notification that tells someone a focus block or a break has
// ended while the phone is on the desk and the app isn't in front. It is
// scheduled with the operating system, so it fires even if the app has
// been closed. Android and iOS only; a browser tab can't be woken once it
// is gone, so the web app relies on the in-app prompt and, while the page
// is alive in the background, a web notification.

const CHANNEL_ID = "focus-timer";
const NOTIFICATION_ID = 7101;

function native(): boolean {
  return Capacitor.isNativePlatform();
}

let channelReady: Promise<void> | null = null;
function ensureChannel(): Promise<void> {
  if (!channelReady) {
    channelReady = LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: "Focus timer",
      description: "Tells you when a focus block or a break has ended",
      importance: 4,
      visibility: 1,
      vibration: true,
    }).catch(() => undefined);
  }
  return channelReady;
}

// Asked for the first time someone starts a timer, so the prompt has a
// reason the person can see.
export async function requestTimerNotificationPermission(): Promise<void> {
  if (!native()) return;
  try {
    const status = await LocalNotifications.checkPermissions();
    if (status.display === "prompt" || status.display === "prompt-with-rationale") {
      await LocalNotifications.requestPermissions();
    }
    await ensureChannel();
  } catch {
    // Without it the in-app prompt still works.
  }
}

export async function schedulePhaseNotification(options: {
  at: number;
  title: string;
  body: string;
}): Promise<void> {
  if (!native()) return;
  try {
    await ensureChannel();
    await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: NOTIFICATION_ID,
          title: options.title,
          body: options.body,
          channelId: CHANNEL_ID,
          schedule: { at: new Date(options.at), allowWhileIdle: true },
          smallIcon: "ic_stat_waypoint",
          autoCancel: true,
        },
      ],
    });
  } catch {
    // The timer itself is unaffected.
  }
}

export async function cancelPhaseNotification(): Promise<void> {
  if (!native()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
  } catch {
    // Nothing was scheduled.
  }
}
