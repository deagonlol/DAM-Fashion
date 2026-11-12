import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useConversation, useMessages } from '@/hooks/use-conversations';
import { useListing } from '@/hooks/use-listings';
import { usePrivatePhotoUrls } from '@/hooks/use-private-photos';
import { useBlockState } from '@/hooks/use-moderation';
import { useCurrentUser } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { useUser } from '@/hooks/use-users';
import { sendMessage } from '@/lib/data/messages';
import { markConversationRead } from '@/lib/data/reads';
import { unblockUser } from '@/lib/data/moderation';
import type { Message } from '@/lib/data/types';
import { formatMessageTime, formatPricePerDay } from '@/lib/format';

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
  const [sendingPhoto, setSendingPhoto] = useState(false);

  // Reading the chat clears its unread dot, including messages that arrive while it's open.
  const isMember = conversation?.participantIds.includes(currentUser.id) ?? false;
  useEffect(() => {
    if (isMember && id) void markConversationRead(id).catch(() => {});
  }, [isMember, id, messages.length]);

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

  async function sendPhoto() {
    if (!conversation || sendingPhoto) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled) return;
    // Any typed text goes along as the caption.
    const caption = text;
    setText('');
    setError(null);
    setSendingPhoto(true);
    try {
      await sendMessage(conversation.id, caption, result.assets[0].uri);
    } catch (e) {
      setText(caption);
      setError(e instanceof Error ? e.message : 'Photo not sent.');
    } finally {
      setSendingPhoto(false);
    }
  }

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
            style={({ pressed }) => [
              styles.listingBanner,
              { backgroundColor: theme.backgroundElement },
              pressed && styles.dimmed,
            ]}>
            <Image
              source={listing.imageUris[0]}
              style={[styles.listingThumb, { backgroundColor: theme.background }]}
              contentFit="cover"
            />
            <View style={styles.flex}>
              <ThemedText type="smallBold" numberOfLines={1} style={styles.listingTitle}>
                {listing.title}
              </ThemedText>
              <ThemedText type="small" themeColor="accent">
                {formatPricePerDay(listing.pricePerDay)}
                <ThemedText type="small" themeColor="textSecondary">
                  {' '}
                  · Size {listing.size}
                  {listing.brand ? ` · ${listing.brand}` : ''}
                </ThemedText>
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="accent">
              View ›
            </ThemedText>
          </Pressable>
        ) : null}

        <FlatList
          data={newestFirst}
          inverted
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isMine={item.senderId === currentUser.id}
              onReport={
                isParticipant && item.senderId !== currentUser.id
                  ? () =>
                      router.push({
                        pathname: '/report/[userId]',
                        params: {
                          userId: item.senderId,
                          conversationId: item.conversationId,
                          messageId: item.id,
                          reason: 'Inappropriate messages',
                        },
                      })
                  : undefined
              }
            />
          )}
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
              Viewing as the Lendr team. Read-only.
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
              <Pressable
                onPress={sendPhoto}
                disabled={sendingPhoto}
                accessibilityRole="button"
                accessibilityLabel={sendingPhoto ? 'Sending photo' : 'Send a photo'}
                hitSlop={6}
                style={[
                  styles.photoButton,
                  { backgroundColor: theme.backgroundElement },
                  sendingPhoto && styles.dimmed,
                ]}>
                <SymbolView
                  name={{ ios: 'photo', android: 'photo_library', web: 'photo_library' }}
                  tintColor={theme.text}
                  size={20}
                />
              </Pressable>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Write a message…"
                placeholderTextColor={theme.textSecondary}
                multiline
                style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
              />
              <Pressable
                onPress={handleSend}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel="Send"
                style={[styles.send, { backgroundColor: theme.accent }, !canSend && styles.dimmed]}>
                <ThemedText style={[styles.sendArrow, { color: theme.onAccent }]}>↑</ThemedText>
              </Pressable>
            </View>
          </SafeAreaView>
        )}
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

/** Long-press someone else's message to report it. */
function MessageBubble({ message, isMine, onReport }: { message: Message; isMine: boolean; onReport?: () => void }) {
  const theme = useTheme();
  const [photoUrl] = usePrivatePhotoUrls('chat-photos', message.imagePath ? [message.imagePath] : []);

  return (
    <View style={[styles.messageRow, isMine ? styles.mine : styles.theirs]}>
      <Pressable
        onLongPress={onReport}
        disabled={!onReport}
        accessibilityHint={onReport ? 'Long-press to report this message' : undefined}
        style={[
          styles.bubble,
          isMine
            ? [styles.mineBubble, { backgroundColor: theme.accent }]
            : [styles.theirsBubble, { backgroundColor: theme.backgroundElement }],
        ]}>
        {message.imagePath ? (
          <Image
            source={photoUrl ?? undefined}
            style={[styles.photo, { backgroundColor: theme.background }]}
            contentFit="cover"
            transition={150}
            accessibilityLabel="Photo"
          />
        ) : null}
        {message.text ? <ThemedText style={isMine && { color: theme.onAccent }}>{message.text}</ThemedText> : null}
      </Pressable>
      <ThemedText type="small" themeColor="textSecondary" style={styles.time}>
        {formatMessageTime(message.createdAt)}
      </ThemedText>
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
    margin: Spacing.three,
    marginBottom: 0,
    padding: Spacing.two,
    borderRadius: 12,
  },
  listingThumb: {
    width: 44,
    height: 56,
    borderRadius: 8,
  },
  listingTitle: {
    fontFamily: Fonts.heading,
  },
  messages: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  empty: {
    textAlign: 'center',
    transform: [{ scaleY: -1 }],
  },
  messageRow: {
    maxWidth: '80%',
    gap: Spacing.half,
  },
  mine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  theirs: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 20,
  },
  photo: {
    width: 220,
    aspectRatio: 1,
    borderRadius: 14,
    marginVertical: Spacing.one,
  },
  photoButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A squared-off corner on the speaker's side, like a speech bubble's tail.
  mineBubble: {
    borderBottomRightRadius: 6,
  },
  theirsBubble: {
    borderBottomLeftRadius: 6,
  },
  time: {
    fontSize: 11,
    lineHeight: 14,
    paddingHorizontal: Spacing.one,
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
    borderRadius: 22,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    fontFamily: Fonts.body,
    fontSize: 16,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendArrow: {
    fontFamily: Fonts.heading,
    fontSize: 20,
    lineHeight: 24,
  },
  dimmed: {
    opacity: 0.4,
  },
});
