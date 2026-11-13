/**
 * Schedules the phone alerts for upcoming pickups and returns. Web has no notification tray, so
 * this does nothing there; the notifications screen still lists the same items.
 */
import { Platform } from 'react-native';

import type { NotificationPlan } from '@/lib/data/notification-plans';

type NotificationModule = typeof import('expo-notifications');

const PREFIX = 'lendr-';
const CHANNEL = 'reminders';

let handlerReady = false;
let lastSignature: string | null = null;

export async function syncScheduledNotifications(plans: NotificationPlan[]) {
  if (Platform.OS === 'web') return;
  const signature = plans.map((plan) => `${plan.id}@${plan.fireAt.getTime()}`).join('|');
  if (signature === lastSignature) return;
  try {
    const Notifications = await import('expo-notifications');
    if (!handlerReady) {
      handlerReady = true;
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Pickups and returns',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted' && plans.length > 0) {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((request) => request.identifier.startsWith(PREFIX))
        .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier))
    );
    if (status !== 'granted') return;
    await Promise.all(
      plans.map((plan) =>
        Notifications.scheduleNotificationAsync({
          identifier: `${PREFIX}${plan.id}`,
          content: {
            title: plan.title,
            body: plan.body,
            data: { url: plan.href },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: plan.fireAt,
            channelId: CHANNEL,
          },
        })
      )
    );
    lastSignature = signature;
  } catch {
    lastSignature = null;
  }
}

/** Opens the rental or order a tapped phone alert points at. No-op on web. */
export function listenForNotificationOpens(open: (url: string) => void) {
  if (Platform.OS === 'web') return () => {};
  let removed = false;
  let subscription: { remove: () => void } | undefined;
  void import('expo-notifications').then((Notifications: NotificationModule) => {
    if (removed) return;
    const last = Notifications.getLastNotificationResponse();
    const url = last?.notification.request.content.data?.url;
    if (typeof url === 'string') open(url);
    subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const next = response.notification.request.content.data?.url;
      if (typeof next === 'string') open(next);
    });
  });
  return () => {
    removed = true;
    subscription?.remove();
  };
}

/**
 * Dev only: a phone alert a few seconds from now, to check notifications show up. Returns why it
 * couldn't, or null once it's scheduled.
 */
export async function sendTestNotification(): Promise<string | null> {
  if (Platform.OS === 'web') return 'Phone alerts only work in the app, not on web.';
  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    handlerReady = true;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Pickups and returns',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return 'Notifications are off for Expo Go. Turn them on in Settings.';
    await Notifications.scheduleNotificationAsync({
      identifier: `test-${Date.now()}`,
      content: {
        title: 'Pickup tomorrow at 6 PM',
        body: 'Test alert from Lendr. Tap to open your notifications.',
        data: { url: '/notifications' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
        channelId: CHANNEL,
      },
    });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Could not schedule the alert.';
  }
}
