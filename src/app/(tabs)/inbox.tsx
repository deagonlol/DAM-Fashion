import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ChipGroup } from '@/components/chip-group';
import { ProfileButton } from '@/components/profile-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useConversationSummaries, type ConversationSummary } from '@/hooks/use-conversations';
import { useCurrentUser } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { formatMessageTime } from '@/lib/format';

/** "Lenders" are chats about items you're borrowing; "My listings" are chats about your items. */
const FILTERS = ['All', 'Lenders', 'My listings'] as const;
type Filter = (typeof FILTERS)[number];

const EMPTY: Record<Filter, string> = {
  All: 'No messages yet. Message an owner from any listing.',
  Lenders: 'No chats with lenders yet. Message one from any listing.',
  'My listings': 'No one has messaged you about your items yet.',
};

/** Your conversations, newest first, searchable by person, item, or message. */
export default function InboxScreen() {
  const summaries = useConversationSummaries();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('All');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return summaries.filter((summary) => {
      if (filter === 'Lenders' && summary.role !== 'borrower') return false;
      if (filter === 'My listings' && summary.role !== 'lender') return false;
      if (!q) return true;
      return [summary.otherUserName, summary.listing?.title, summary.lastMessage?.text].some((text) =>
        text?.toLowerCase().includes(q)
      );
    });
  }, [summaries, query, filter]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="subtitle" themeColor="accent">
            Inbox
          </ThemedText>
          <ProfileButton />
        </View>
        <View style={styles.controls}>
          <TextField
            variant="search"
            value={query}
            onChangeText={setQuery}
            placeholder="Search messages…"
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
          <ChipGroup options={FILTERS} value={filter} onChange={(next) => next && setFilter(next)} />
        </View>
        <FlatList
          data={shown}
          keyExtractor={(item) => item.conversation.id}
          renderItem={({ item }) => <ConversationRow summary={item} />}
          ListEmptyComponent={
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              {query.trim() ? 'No conversations match your search.' : EMPTY[filter]}
            </ThemedText>
          }
          contentContainerStyle={styles.list}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function ConversationRow({ summary }: { summary: ConversationSummary }) {
  const theme = useTheme();
  const currentUser = useCurrentUser();
  const { conversation, otherUserName, otherUserAvatarUrl, listing, lastMessage, unread } = summary;
  const preview = lastMessage
    ? `${lastMessage.senderId === currentUser.id ? 'You: ' : ''}${lastMessage.text || (lastMessage.imagePath ? '📷 Photo' : '')}`
    : 'No messages yet';

  return (
    <Pressable
      onPress={() => router.push(`/chat/${conversation.id}`)}
      accessibilityRole="link"
      accessibilityLabel={`${otherUserName}${unread > 0 ? `, ${unread} unread` : ''}. ${preview}`}
      style={({ pressed }) => [styles.row, { borderColor: theme.border }, pressed && styles.pressed]}>
      <View>
        <Avatar name={otherUserName} uri={otherUserAvatarUrl} size={48} />
        {unread > 0 ? (
          <View style={[styles.unreadDot, { backgroundColor: theme.accent, borderColor: theme.background }]} />
        ) : null}
      </View>
      <View style={styles.rowText}>
        <View style={styles.rowTop}>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.flex}>
            {otherUserName}
          </ThemedText>
          {lastMessage ? (
            <ThemedText type="small" themeColor="accent">
              {formatMessageTime(lastMessage.createdAt)}
            </ThemedText>
          ) : null}
        </View>
        {listing ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {summary.role === 'lender' ? `Your listing · ${listing.title}` : listing.title}
          </ThemedText>
        ) : null}
        <ThemedText type={unread > 0 ? 'smallBold' : 'small'} numberOfLines={1}>
          {preview}
        </ThemedText>
      </View>
      {listing ? (
        <Image
          source={listing.imageUris[0]}
          style={[styles.thumb, { backgroundColor: theme.backgroundElement }]}
          contentFit="cover"
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  controls: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.two,
  },
  empty: {
    textAlign: 'center',
    padding: Spacing.five,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: 20,
  },
  pressed: {
    opacity: 0.6,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
  rowTop: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  thumb: {
    width: 44,
    height: 56,
    borderRadius: 6,
  },
});
