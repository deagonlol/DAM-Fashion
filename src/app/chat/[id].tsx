import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useConversation, useMessages } from '@/hooks/use-conversations';
import { useListing } from '@/hooks/use-listings';
import { useBlockState } from '@/hooks/use-moderation';
import { useCurrentUser } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { useUser } from '@/hooks/use-users';
import { sendMessage } from '@/lib/data/messages';
import { unblockUser } from '@/lib/data/moderation';
import type { Message } from '@/lib/data/types';
import { formatPricePerDay } from '@/lib/format';

export default function ChatScreen() {
  const { id, draft } = useLocalSearchParams<{ id: string; draft?: string }>();
  const conversation = useConversation(id);
  const messages = useMessages(id);
  const listing = useListing(conversation?.listingId);
  const currentUser = useCurrentUser();
  const otherUser = useUser(conversation?.participantIds.find((userId) => userId !== currentUser.id));
  const { blockedByMe, blockedEitherWay } = useBlockState(currentUser.id, otherUser?.id);
  const headerHeight = useHeaderHeight();
  const theme = useTheme();
  const [text, setText] = useState(draft ?? '');
  const [error, setError] = useState<string | null>(null);

  // Newest first, for the inverted list that keeps the latest message at the bottom.
  const newestFirst = useMemo(() => [...messages].reverse(), [messages]);

  if (!conversation) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText themeColor="textSecondary">Conversation not found.</ThemedText>
      </ThemedView>
    );
  }

  const canSend = text.trim().length > 0;
  // The team can open a chat from a report to read it, but not post in it.
  const isParticipant = conversation.participantIds.includes(currentUser.id);
  const otherFirstName = otherUser?.name.split(' ')[0] ?? 'them';

  async function handleSend() {
    if (!canSend || !conversation) return;
    const message = text;
    setText('');
    setError(null);
    try {
      await sendMessage(conversation.id, message);
    } catch (e) {
      setText(message);
      setError(e instanceof Error ? e.message : 'Message not sent.');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: otherUser?.name ?? 'Chat',
          headerRight:
            isParticipant && otherUser
              ? () => (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/report/[userId]',
                        params: { userId: otherUser.id, conversationId: conversation.id },
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Report ${otherUser.name}`}
                    hitSlop={8}>
                    <ThemedText type="small" themeColor="danger">
                      Report
                    </ThemedText>
                  </Pressable>
                )
              : undefined,
        }}
      />
      <KeyboardAvoidingView style={styles.container} behavior="padding" keyboardVerticalOffset={headerHeight}>
        {listing ? (
          <Pressable
            onPress={() => router.push(`/listing/${listing.id}`)}
            accessibilityRole="link"
            style={[styles.listingBanner, { borderColor: theme.border }]}>
            <Image
              source={listing.imageUris[0]}
              style={[styles.listingThumb, { backgroundColor: theme.backgroundElement }]}
              contentFit="cover"
            />
            <View style={styles.flex}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {listing.title}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatPricePerDay(listing.pricePerDay)} · Size {listing.size}
              </ThemedText>
            </View>
          </Pressable>
        ) : null}

        <FlatList
          data={newestFirst}
          inverted
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble message={item} isMine={item.senderId === currentUser.id} />}
          contentContainerStyle={styles.messages}
          keyboardDismissMode="interactive"
          ListEmptyComponent={
            // Inverted lists flip their children, so flip the empty state back.
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              Say hi and ask about availability.
            </ThemedText>
          }
        />

        {!isParticipant ? (
          <SafeAreaView edges={['bottom']} style={[styles.notice, { borderColor: theme.border }]}>
            <ThemedText type="small" themeColor="textSecondary">
              Viewing as the DAM Fashion team. Read-only.
            </ThemedText>
          </SafeAreaView>
        ) : blockedEitherWay ? (
          <SafeAreaView edges={['bottom']} style={[styles.notice, { borderColor: theme.border }]}>
            <ThemedText type="small" themeColor="textSecondary">
              {blockedByMe ? `You blocked ${otherFirstName}.` : `You can’t message ${otherFirstName}.`}
            </ThemedText>
            {blockedByMe && otherUser ? (
              <Pressable onPress={() => unblockUser(otherUser.id)} accessibilityRole="button" hitSlop={8}>
                <ThemedText type="smallBold" themeColor="accent">
                  Unblock
                </ThemedText>
              </Pressable>
            ) : null}
          </SafeAreaView>
        ) : (
          <SafeAreaView edges={['bottom']} style={[styles.composerWrap, { borderColor: theme.border }]}>
            {error ? (
              <ThemedText type="small" themeColor="danger" style={styles.composerError}>
                {error}
              </ThemedText>
            ) : null}
            <View style={styles.composer}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Write a message…"
                placeholderTextColor={theme.textSecondary}
                multiline
                style={[styles.input, { borderColor: theme.border, color: theme.text }]}
              />
              <Pressable
                onPress={handleSend}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel="Send"
                style={[styles.send, { backgroundColor: theme.accent }, !canSend && styles.dimmed]}>
                <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                  Send
                </ThemedText>
              </Pressable>
            </View>
          </SafeAreaView>
        )}
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

function MessageBubble({ message, isMine }: { message: Message; isMine: boolean }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.bubble,
        isMine
          ? [styles.mine, { backgroundColor: theme.text }]
          : [styles.theirs, { backgroundColor: theme.backgroundElement }],
      ]}>
      <ThemedText style={isMine && { color: theme.background }}>{message.text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listingThumb: {
    width: 40,
    height: 52,
    borderRadius: 6,
  },
  messages: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  empty: {
    textAlign: 'center',
    transform: [{ scaleY: -1 }],
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 16,
  },
  mine: {
    alignSelf: 'flex-end',
  },
  theirs: {
    alignSelf: 'flex-start',
  },
  composerWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composerError: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  notice: {
    alignItems: 'center',
    gap: Spacing.one,
    padding: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    fontFamily: Fonts.body,
    fontSize: 16,
  },
  send: {
    borderRadius: 18,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
  },
  dimmed: {
    opacity: 0.4,
  },
});
