import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getOrCreateConversation, sendMessage } from '@/lib/data/messages';

const QUICK_REPLIES = [
  'Is this still available?',
  'Can I try it on first?',
  'Is the price flexible?',
  'Where can we meet?',
];

type Props = {
  listingId: string;
  /** The lender's first name, for the greeting. */
  name?: string;
};

/**
 * A ready-to-send message to the lender, like Marketplace: pre-filled, with one-tap alternatives.
 * Sending opens the chat.
 */
export function QuickMessage({ listingId, name }: Props) {
  const theme = useTheme();
  const greeting = name ? `Hi ${name}! ` : 'Hi! ';
  const [text, setText] = useState(`${greeting}${QUICK_REPLIES[0]}`);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const conversation = await getOrCreateConversation(listingId);
      await sendMessage(conversation.id, text);
      router.push(`/chat/${conversation.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send. Try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">Message {name ?? 'the lender'}</ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {QUICK_REPLIES.map((reply) => {
          const selected = text === `${greeting}${reply}`;
          return (
            <Pressable
              key={reply}
              onPress={() => setText(`${greeting}${reply}`)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.chip,
                { borderColor: selected ? theme.accent : theme.border },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="small" style={selected ? { color: theme.accent } : undefined}>
                {reply}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={[styles.inputRow, { backgroundColor: theme.background }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Write a message…"
          placeholderTextColor={theme.textSecondary}
          multiline
          style={[styles.input, { color: theme.text }]}
          accessibilityLabel={`Message to ${name ?? 'the lender'}`}
        />
        <Pressable
          onPress={send}
          disabled={!text.trim() || sending}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          style={({ pressed }) => [
            styles.send,
            { backgroundColor: theme.accent },
            (pressed || !text.trim()) && styles.pressed,
          ]}>
          {sending ? (
            <ActivityIndicator size="small" color={theme.onAccent} />
          ) : (
            <SymbolView
              name={{ ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }}
              tintColor={theme.onAccent}
              size={18}
            />
          )}
        </Pressable>
      </View>
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
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  chips: {
    gap: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    borderRadius: 20,
    paddingLeft: Spacing.three,
    padding: Spacing.one,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 15,
    paddingVertical: Spacing.two,
    maxHeight: 100,
  },
  send: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.5,
  },
});
