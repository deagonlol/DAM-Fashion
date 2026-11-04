import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useListing } from '@/hooks/use-listings';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { useUser } from '@/hooks/use-users';
import { getOrCreateConversation } from '@/lib/data/messages';
import { orderStatus } from '@/lib/data/rentals';
import type { Rental } from '@/lib/data/types';
import { formatDateRange } from '@/lib/format';

/** One borrow on the Orders tab: the item, the other person, where it stands, and a message button. */
export function OrderCard({ rental, role }: { rental: Rental; role: 'borrower' | 'lender' }) {
  const theme = useTheme();
  const listing = useListing(rental.listingId);
  const other = useUser(role === 'borrower' ? rental.lenderId : rental.borrowerId);
  const now = useNow();
  const status = orderStatus(rental, now, role);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const otherLabel = role === 'borrower' ? 'Lender' : 'Borrower';
  const otherId = role === 'borrower' ? rental.lenderId : rental.borrowerId;
  const openDetail = () => router.push(`/rental/${rental.id}`);

  async function shareListing() {
    setError(null);
    try {
      const url = Linking.createURL(`/listing/${rental.listingId}`);
      await Share.share({ message: `${listing?.title ?? 'Check this out'} on Lendr: ${url}` });
    } catch {
      setError('Sharing isn’t available here.');
    }
  }

  const menu = [
    { label: 'Borrow details', onPress: openDetail },
    { label: 'View listing', onPress: () => router.push(`/listing/${rental.listingId}`) },
    { label: `View ${otherLabel.toLowerCase()} profile`, onPress: () => router.push(`/user/${otherId}`) },
    { label: 'Share listing', onPress: shareListing },
  ];

  async function openChat() {
    setError(null);
    try {
      const conversation = await getOrCreateConversation(
        rental.listingId,
        role === 'lender' ? rental.borrowerId : undefined
      );
      router.push(`/chat/${conversation.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open chat.');
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <Pressable
        onPress={openDetail}
        accessibilityRole="link"
        accessibilityLabel={`${listing?.title ?? 'Item'}, ${status.label}`}
        style={({ pressed }) => [styles.top, pressed && styles.pressed]}>
        <Image
          source={listing?.imageUris[0]}
          style={[styles.image, { backgroundColor: theme.background }]}
          contentFit="cover"
          transition={150}
        />
        <View style={styles.info}>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.title}>
            {listing?.title ?? 'Item'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {otherLabel}: {other?.name ?? 'Unknown'} <ThemedText type="small" themeColor="accent">✓</ThemedText>
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatDateRange(rental.startDate, rental.endDate)}
          </ThemedText>
          <View style={[styles.status, { backgroundColor: theme.background }]}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.statusLabel}>
              {status.label}
            </ThemedText>
            {status.text ? (
              <ThemedText
                type="smallBold"
                themeColor={status.tone === 'danger' ? 'danger' : status.tone === 'accent' ? 'accent' : 'text'}>
                {status.text}
              </ThemedText>
            ) : null}
          </View>
        </View>
      </Pressable>

      <View style={styles.actions}>
        <Button title={`Message ${otherLabel}`} onPress={openChat} style={styles.message} />
        <Pressable
          onPress={() => setMenuOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityLabel="More options"
          accessibilityState={{ expanded: menuOpen }}
          hitSlop={4}
          style={({ pressed }) => [styles.more, { backgroundColor: theme.background }, pressed && styles.pressed]}>
          <ThemedText type="smallBold">⋮</ThemedText>
        </Pressable>
      </View>
      {menuOpen ? (
        <View style={[styles.menu, { backgroundColor: theme.background }]}>
          {menu.map((item, index) => (
            <Pressable
              key={item.label}
              onPress={() => {
                setMenuOpen(false);
                item.onPress();
              }}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.menuItem,
                index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="small">{item.label}</ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}
      {error ? (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  top: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
  image: {
    width: 88,
    aspectRatio: 3 / 4,
    borderRadius: 8,
  },
  info: {
    flex: 1,
    gap: Spacing.half,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 16,
  },
  status: {
    marginTop: Spacing.one,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one + Spacing.half,
    gap: Spacing.half,
  },
  statusLabel: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  message: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: 8,
  },
  menu: {
    borderRadius: 8,
  },
  menuItem: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
  },
  more: {
    width: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
