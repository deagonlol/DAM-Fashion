import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Fragment, useState, type ReactNode } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useListing } from '@/hooks/use-listings';
import { useNow } from '@/hooks/use-now';
import { useOpenProposal } from '@/hooks/use-proposals';
import { useTheme } from '@/hooks/use-theme';
import { useUser } from '@/hooks/use-users';
import { getOrCreateConversation } from '@/lib/data/messages';
import { codeToShow, ORDER_STEPS, orderStage, rentalDays } from '@/lib/data/rentals';
import type { Rental, Sale } from '@/lib/data/types';
import { formatDateRange, formatPrice } from '@/lib/format';

type Role = 'borrower' | 'lender';
type Tone = 'accent' | 'danger' | 'muted';

/** One borrow on the Orders tab: the item, who it's with, a step tracker, the handoff code, and chat. */
export function OrderCard({ rental, role }: { rental: Rental; role: Role }) {
  const listing = useListing(rental.listingId);
  const otherId = role === 'borrower' ? rental.lenderId : rental.borrowerId;
  const other = useUser(otherId);
  const now = useNow();
  const proposal = useOpenProposal(rental.id);
  const myId = role === 'borrower' ? rental.borrowerId : rental.lenderId;
  // An open counter-offer or change of plans waiting on this person comes first.
  const waitingOnMe = proposal !== undefined && proposal.proposerId !== myId;
  const baseStage = orderStage(rental, now, role);
  const stage = proposal
    ? {
        ...baseStage,
        status: waitingOnMe
          ? rental.status === 'requested'
            ? 'Counter-offer to review'
            : 'New plans to review'
          : rental.status === 'requested'
            ? 'Counter-offer sent'
            : 'New plans sent',
        tone: waitingOnMe ? ('accent' as const) : ('muted' as const),
      }
    : baseStage;
  const code = codeToShow(rental, role);
  const otherLabel = role === 'borrower' ? 'Lender' : 'Renter';
  const perDay = rental.offeredPricePerDay ?? listing?.pricePerDay;
  const total = perDay != null ? perDay * rentalDays(rental.startDate, rental.endDate) : undefined;
  const openDetail = () => router.push(`/rental/${rental.id}`);

  return (
    <CardFrame
      listingId={rental.listingId}
      otherId={otherId}
      openChatAs={role === 'lender' ? rental.borrowerId : undefined}
      onOpen={openDetail}
      menuExtras={[{ label: 'Borrow details', onPress: openDetail }]}
      otherLabel={otherLabel}
      code={code}
      primary={
        waitingOnMe || (rental.status === 'requested' && role === 'lender' && !proposal)
          ? { title: 'Review', onPress: openDetail }
          : undefined
      }
      summary={
        <OrderSummary
          title={listing?.title ?? 'Item'}
          imageUri={listing?.imageUris[0]}
          person={`${otherLabel}: ${other?.name ?? 'Unknown'}`}
          detail={`${formatDateRange(rental.startDate, rental.endDate)}${total != null ? ` · ${formatPrice(total)}` : ''}`}
          status={stage.status}
          tone={stage.tone}
          next={stage.next}
        />
      }
      tracker={stage.step != null ? <Tracker step={stage.step} /> : null}
    />
  );
}

/** One buy request on the Orders tab, styled like a borrow but without the tracker. */
export function SaleOrderCard({ sale, role }: { sale: Sale; role: Role }) {
  const listing = useListing(sale.listingId);
  const otherId = role === 'borrower' ? sale.sellerId : sale.buyerId;
  const other = useUser(otherId);
  const otherLabel = role === 'borrower' ? 'Seller' : 'Buyer';
  const open = sale.status === 'requested';
  const status = open
    ? role === 'lender'
      ? 'Wants to buy it'
      : 'Waiting for the seller'
    : role === 'lender'
      ? 'Sold'
      : 'Bought';
  const openDetail = () => router.push(`/sale/${sale.id}`);

  return (
    <CardFrame
      listingId={sale.listingId}
      otherId={otherId}
      openChatAs={role === 'lender' ? sale.buyerId : undefined}
      onOpen={openDetail}
      menuExtras={[{ label: 'Request details', onPress: openDetail }]}
      otherLabel={otherLabel}
      primary={open && role === 'lender' ? { title: 'Review', onPress: openDetail } : undefined}
      summary={
        <OrderSummary
          title={listing?.title ?? 'Item'}
          imageUri={listing?.imageUris[0]}
          person={`${otherLabel}: ${other?.name ?? 'Unknown'}`}
          detail={`${formatPrice(sale.price)} to buy`}
          status={status}
          tone={open && role === 'lender' ? 'accent' : 'muted'}
          next={null}
        />
      }
      tracker={null}
    />
  );
}

type CardFrameProps = {
  listingId: string;
  otherId: string;
  /** For the seller or lender: the other person, so the chat opens with them. */
  openChatAs?: string;
  onOpen: () => void;
  menuExtras: { label: string; onPress: () => void }[];
  otherLabel: string;
  code?: string;
  /** Replaces the Message button as the main action, e.g. Review on a request. */
  primary?: { title: string; onPress: () => void };
  summary: ReactNode;
  tracker: ReactNode;
};

/** The card shell: tappable summary, tracker, and the code / message / more row. */
function CardFrame({
  listingId,
  otherId,
  openChatAs,
  onOpen,
  menuExtras,
  otherLabel,
  code,
  primary,
  summary,
  tracker,
}: CardFrameProps) {
  const theme = useTheme();
  const listing = useListing(listingId);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  async function openChat() {
    setError(null);
    try {
      const conversation = await getOrCreateConversation(listingId, openChatAs);
      router.push(`/chat/${conversation.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open chat.');
    }
  }

  async function shareListing() {
    setError(null);
    try {
      const url = Linking.createURL(`/listing/${listingId}`);
      await Share.share({
        message: `${listing?.title ?? 'Check this out'} on Lendr: ${url}`,
      });
    } catch {
      setError('Sharing isn’t available here.');
    }
  }

  const menu = [
    ...menuExtras,
    ...(primary ? [{ label: `Message ${otherLabel.toLowerCase()}`, onPress: openChat }] : []),
    {
      label: 'View listing',
      onPress: () => router.push(`/listing/${listingId}`),
    },
    {
      label: `View ${otherLabel.toLowerCase()} profile`,
      onPress: () => router.push(`/user/${otherId}`),
    },
    { label: 'Share listing', onPress: shareListing },
  ];

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <Pressable onPress={onOpen} accessibilityRole="link" style={({ pressed }) => pressed && styles.pressed}>
        {summary}
      </Pressable>
      {tracker}
      <View style={styles.actions}>
        {code ? (
          <View
            style={[styles.code, { backgroundColor: theme.background }]}
            accessible
            accessibilityLabel={`Handoff code ${code.split('').join(' ')}`}>
            <ThemedText themeColor="textSecondary" style={styles.caps}>
              Code
            </ThemedText>
            <ThemedText style={styles.codeValue}>{code}</ThemedText>
          </View>
        ) : null}
        <Button
          title={primary?.title ?? `Message ${otherLabel}`}
          onPress={primary?.onPress ?? openChat}
          style={styles.message}
        />
        <Pressable
          onPress={() => setMenuOpen((isOpen) => !isOpen)}
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
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderColor: theme.border,
                },
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

type OrderSummaryProps = {
  title: string;
  imageUri?: string;
  person: string;
  detail: string;
  status: string;
  tone: Tone;
  next: { label: string; text: string } | null;
};

function OrderSummary({ title, imageUri, person, detail, status, tone, next }: OrderSummaryProps) {
  const theme = useTheme();
  return (
    <View style={styles.top}>
      <Image
        source={imageUri}
        style={[styles.image, { backgroundColor: theme.background }]}
        contentFit="cover"
        transition={150}
      />
      <View style={styles.info}>
        <ThemedText numberOfLines={1} style={styles.title}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {person}{' '}
          <ThemedText type="small" themeColor="accent">
            ✓
          </ThemedText>
        </ThemedText>
        <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.detail}>
          {detail}
        </ThemedText>
        <ThemedText
          type="smallBold"
          themeColor={tone === 'danger' ? 'danger' : tone === 'accent' ? 'accent' : 'textSecondary'}>
          {status}
        </ThemedText>
        {next ? (
          <View style={[styles.next, { backgroundColor: theme.background }]}>
            <ThemedText themeColor="textSecondary" style={styles.caps}>
              {next.label}
            </ThemedText>
            <ThemedText type="smallBold" themeColor="accent" numberOfLines={2}>
              {next.text}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Requested → Confirmed → Pickup → Return. Done steps are filled, the current one is a ring. */
function Tracker({ step }: { step: number }) {
  const theme = useTheme();
  const current = step < ORDER_STEPS.length ? ORDER_STEPS[step] : null;
  return (
    <View
      style={styles.tracker}
      accessible
      accessibilityLabel={current ? `Progress: next step ${current}` : 'Progress: all steps done'}>
      <View style={styles.trackRow}>
        {ORDER_STEPS.map((label, index) => (
          <Fragment key={label}>
            {index > 0 ? (
              <View
                style={[
                  styles.line,
                  {
                    backgroundColor: index <= step ? theme.accent : theme.textSecondary,
                  },
                ]}
              />
            ) : null}
            <View
              style={[
                styles.dot,
                index < step && { backgroundColor: theme.accent },
                index === step && [styles.ring, { borderColor: theme.accent }],
                index > step && { backgroundColor: theme.textSecondary },
              ]}
            />
          </Fragment>
        ))}
      </View>
      <View style={styles.labels}>
        {ORDER_STEPS.map((label, index) => (
          <ThemedText
            key={label}
            themeColor={index === step ? 'accent' : index < step ? 'text' : 'textSecondary'}
            style={[styles.stepLabel, index === step && styles.stepCurrent]}>
            {label}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

const DOT = 10;
const STEP_LABEL_WIDTH = 80;

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
    width: 96,
    aspectRatio: 1,
    borderRadius: 10,
    // Stay square instead of stretching to the height of the text beside it.
    alignSelf: 'flex-start',
  },
  info: {
    flex: 1,
    gap: Spacing.half,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    lineHeight: 24,
  },
  detail: {
    fontSize: 12,
    lineHeight: 16,
  },
  next: {
    marginTop: Spacing.one,
    borderRadius: 8,
    paddingHorizontal: Spacing.two + Spacing.half,
    paddingVertical: Spacing.two,
    gap: Spacing.half,
  },
  caps: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  tracker: {
    gap: Spacing.one,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // Line the end dots up under the first and last labels.
    marginHorizontal: STEP_LABEL_WIDTH / 2 - DOT / 2,
  },
  line: {
    flex: 1,
    height: 2,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
  ring: {
    width: DOT + 4,
    height: DOT + 4,
    borderRadius: (DOT + 4) / 2,
    borderWidth: 2,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepLabel: {
    width: STEP_LABEL_WIDTH,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 14,
  },
  stepCurrent: {
    fontFamily: Fonts.bodySemiBold,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  code: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
  },
  codeValue: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    letterSpacing: 1,
  },
  message: {
    flex: 1,
    paddingVertical: Spacing.two + Spacing.half,
    borderRadius: 999,
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
