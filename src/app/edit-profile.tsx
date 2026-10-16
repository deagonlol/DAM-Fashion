import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { updateProfile, updateProfilePhoto } from '@/lib/data/auth';
import { MAX_BIO_LENGTH } from '@/lib/data/types';

/** Change your photo, name, and bio. */
export default function EditProfileScreen() {
  const user = useCurrentUser();
  const theme = useTheme();
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function changePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) {
      await updateProfilePhoto(result.assets[0].uri);
    }
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await updateProfile({ name, bio });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic">
          <Pressable
            onPress={changePhoto}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            style={styles.photo}>
            <Avatar name={name || user.name} uri={user.avatarUrl} size={96} />
            <ThemedText type="smallBold" themeColor="accent">
              Change photo
            </ThemedText>
          </Pressable>

          <TextField label="Name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" />

          <View style={styles.field}>
            <TextField
              label="Bio"
              value={bio}
              onChangeText={setBio}
              placeholder="Your year, style, where you usually do pickups…"
              multiline
              maxLength={MAX_BIO_LENGTH}
            />
            <ThemedText type="small" themeColor="textSecondary" style={styles.counter}>
              {bio.length}/{MAX_BIO_LENGTH}
            </ThemedText>
          </View>

          <ThemedText type="small" themeColor="textSecondary">
            Your UT email ({user.email}) can’t be changed.
          </ThemedText>

          {error ? (
            <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
              {error}
            </ThemedText>
          ) : null}
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={[styles.footer, { borderColor: theme.border }]}>
          <Button title="Save" disabled={!name.trim() || saving} onPress={handleSave} />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  photo: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  field: {
    gap: Spacing.one,
  },
  counter: {
    textAlign: 'right',
  },
  footer: {
    padding: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
