import { Stack, useLocalSearchParams } from 'expo-router';

import { SearchView, type SearchParams } from '@/components/search-view';

/** Search as its own screen, for links from listings and other places outside Home. */
export default function SearchScreen() {
  const params = useLocalSearchParams<SearchParams>();
  return (
    <>
      <Stack.Screen options={{ title: 'Search' }} />
      <SearchView params={params} />
    </>
  );
}
