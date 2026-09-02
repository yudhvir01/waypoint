import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSupabase } from "../context/SupabaseProvider";
import {
  isPushSupported,
  subscribeToPush,
  subscriptionToRow,
  unsubscribeFromPush,
} from "../lib/push";

export function usePushSubscription() {
  const { client } = useSupabase();
  const [subscribed, setSubscribed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isPushSupported()) {
      setChecking(false);
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .finally(() => setChecking(false));
  }, []);

  const enable = useMutation({
    mutationFn: async () => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Notification permission was denied.");
      }
      const sub = await subscribeToPush();
      const row = subscriptionToRow(sub);
      const { error } = await client!.from("push_subscriptions").upsert(
        { user_id: (await client!.auth.getUser()).data.user!.id, ...row },
        { onConflict: "endpoint" },
      );
      if (error) throw error;
    },
    onSuccess: () => setSubscribed(true),
  });

  const disable = useMutation({
    mutationFn: async () => {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await client!.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
      await unsubscribeFromPush();
    },
    onSuccess: () => setSubscribed(false),
  });

  return {
    supported: isPushSupported(),
    checking,
    subscribed,
    enable,
    disable,
  };
}
