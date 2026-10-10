import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

// The system notification that tells someone a focus block or a break has
// ended while the phone is on the desk and the app isn't in front. It is
// scheduled with the operating system, so it fires even if the app has
// been closed. Android and iOS only; a browser tab can't be woken once it
// is gone, so the web app relies on the in-app prompt and, while the page
// is alive in the background, a web notification.

// Two channels, because Android fixes a channel's sound when it is created.
// The alert channel sounds and vibrates, and is used while the app is out
// of sight. While the app is in front, the in-app sound and the pop-up do
// that job, so the notification is posted quietly rather than playing a
// second sound on top of the first.
const ALERT_CHANNEL = "focus-timer";
const QUIET_CHANNEL = "focus-timer-quiet";
const NOTIFICATION_ID = 7101;

function native(): boolean {
  return Capacitor.isNativePlatform();
}

let channelsReady: Promise<void> | null = null;
function ensureChannels(): Promise<void> {
  if (!channelsReady) {
    channelsReady = (async () => {
      try {
        await LocalNotifications.createChannel({
          id: ALERT_CHANNEL,
          name: "Focus timer",
          description: "Sounds when a focus block or a break has ended",
          importance: 4,
          visibility: 1,
          vibration: true,
        });
        await LocalNotifications.createChannel({
          id: QUIET_CHANNEL,
          name: "Focus timer (quiet)",
          description: "The same alerts without a sound, while Waypoint is open",
          importance: 2,
          visibility: 1,
          vibration: false,
        });
      } catch {
        // Notifications are an extra; the pop-up still works.
      }
    })();
  }
  return channelsReady;
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
    await ensureChannels();
  } catch {
    // Without it the in-app prompt still works.
  }
}

export async function schedulePhaseNotification(options: {
  at: number;
  title: string;
  body: string;
  // Sound and vibration. False while the app is open and plays its own.
  loud: boolean;
}): Promise<void> {
  if (!native()) return;
  try {
    await ensureChannels();
    await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: NOTIFICATION_ID,
          title: options.title,
          body: options.body,
          channelId: options.loud ? ALERT_CHANNEL : QUIET_CHANNEL,
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

// Takes the notification back: the pending one, and one already shown in
// the shade (the person has dealt with it in the app).
export async function cancelPhaseNotification(): Promise<void> {
  if (!native()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
  } catch {
    // Nothing was scheduled.
  }
  try {
    await LocalNotifications.removeDeliveredNotificationsById({ ids: [NOTIFICATION_ID] });
  } catch {
    // Nothing was delivered.
  }
}
