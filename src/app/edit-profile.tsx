import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { PickupWindowsEditor } from '@/components/pickup-windows-editor';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { deleteAccount, updatePickupWindows, updateProfile, updateProfilePhoto } from '@/lib/data/auth';
import { MAX_BIO_LENGTH } from '@/lib/data/types';

/** Change your photo, name, and bio. */
export default function EditProfileScreen() {
  const user = useCurrentUser();
  const theme = useTheme();
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio ?? '');
  const [windows, setWindows] = useState<string[]>(user.pickupWindows ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      await updatePickupWindows(windows);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setError(null);
    setDeleting(true);
    try {
      // On success the auth guard in the root layout switches back to the log in screen.
      await deleteAccount();
    } catch (e) {
      setConfirmingDelete(false);
      setDeleting(false);
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
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

          <View style={styles.field}>
            <ThemedText type="smallBold">When you can meet</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Borrowers can only pick pickup and return times you’re usually free. Mornings are 9–11, afternoons 12–4,
              evenings 5–9. Leave it all blank for any time.
            </ThemedText>
            <PickupWindowsEditor value={windows} onChange={setWindows} />
          </View>

          <ThemedText type="small" themeColor="textSecondary">
            Your UT email ({user.email}) can’t be changed.
          </ThemedText>

          {error ? (
            <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
              {error}
            </ThemedText>
          ) : null}

          <View style={[styles.danger, { borderColor: theme.border }]}>
            <Button
              title={confirmingDelete ? 'Tap again to delete your account' : 'Delete account'}
              variant={confirmingDelete ? 'dangerFilled' : 'danger'}
              disabled={deleting}
              onPress={handleDelete}
            />
            {confirmingDelete ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                Your profile, listings, chats, and reviews will be deleted. This can’t be undone.
              </ThemedText>
            ) : null}
          </View>
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
  danger: {
    gap: Spacing.two,
    paddingTop: Spacing.four,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  center: {
    textAlign: 'center',
  },
  footer: {
    padding: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
