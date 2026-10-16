import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useConversationSummaries, type ConversationSummary } from '@/hooks/use-conversations';
import { useCurrentUser } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { formatMessageTime } from '@/lib/format';

export default function InboxScreen() {
  const summaries = useConversationSummaries();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <FlatList
          data={summaries}
          keyExtractor={(item) => item.conversation.id}
          renderItem={({ item }) => <ConversationRow summary={item} />}
          ListHeaderComponent={
            <ThemedText type="subtitle" style={styles.title}>
              Inbox
            </ThemedText>
          }
          ListEmptyComponent={
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              No messages yet. Message an owner from any listing.
            </ThemedText>
          }
          contentInsetAdjustmentBehavior="automatic"
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function ConversationRow({ summary }: { summary: ConversationSummary }) {
  const theme = useTheme();
  const currentUser = useCurrentUser();
  const { conversation, otherUserName, otherUserAvatarUrl, listing, lastMessage } = summary;
  const preview = lastMessage
    ? `${lastMessage.senderId === currentUser.id ? 'You: ' : ''}${lastMessage.text}`
    : 'No messages yet';

  return (
    <Pressable
      onPress={() => router.push(`/chat/${conversation.id}`)}
      accessibilityRole="link"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Avatar name={otherUserName} uri={otherUserAvatarUrl} size={48} />
      <View style={styles.rowText}>
        <View style={styles.rowTop}>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.flex}>
            {otherUserName}
          </ThemedText>
          {lastMessage ? (
            <ThemedText type="small" themeColor="textSecondary">
              {formatMessageTime(lastMessage.createdAt)}
            </ThemedText>
          ) : null}
        </View>
        {listing ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {listing.title}
          </ThemedText>
        ) : null}
        <ThemedText type="small" numberOfLines={1}>
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
  flex: {
    flex: 1,
  },
  title: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  empty: {
    textAlign: 'center',
    padding: Spacing.five,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
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
