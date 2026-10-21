// Jest has no native modules and doesn't read .env.local, so use the official AsyncStorage mock
// and placeholder Supabase settings. Tests never reach the network; ones that need Supabase mock it.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';
