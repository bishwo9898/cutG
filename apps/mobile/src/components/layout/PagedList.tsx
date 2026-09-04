import { useCallback, useRef } from 'react';
import type { ReactElement } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { NetworkBanner } from '@/components/ui/NetworkBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { PagedQueryResult } from '@/hooks/usePagedQuery';
import { errorMessage } from '@/lib/errors';
import { colors, spacing, typography } from '@/theme';

type PagedListProps<T> = {
  query: PagedQueryResult<T>;
  renderItem: (item: T) => ReactElement;
  keyExtractor: (item: T) => string;
  /**
   * Scrolls with the list but is not virtualised — pass the screen's title, filters and search
   * box here. It must be an *element*, not a component function: FlatList remounts a
   * `ListHeaderComponent` given as a function whenever the data changes, which would drop focus
   * out of a text field on every keystroke.
   */
  header?: ReactElement;
  emptyTitle: string;
  emptyMessage: string;
  emptyIcon?: React.ComponentProps<typeof EmptyState>['icon'];
};

/**
 * A list that mounts only the rows on screen and fetches the next page as you approach the end.
 *
 * Every list in the app used to be a column of children inside a ScrollView, which mounts every
 * row's native views at once and keeps them there. That is fine for the eight seeded barbers and
 * ruinous for a barber with a year of bookings behind them: the screen takes progressively longer
 * to open, scrolling drops frames, and memory climbs until Android reclaims the app.
 */
export const PagedList = <T,>({
  query,
  renderItem,
  keyExtractor,
  header,
  emptyTitle,
  emptyMessage,
  emptyIcon,
}: PagedListProps<T>): ReactElement => {
  // Callers define renderItem inline, so it is a new function every render. Wrapping it keeps a
  // stable identity for FlatList; the wrapper reads the latest one through a ref rather than
  // being rebuilt, which is what makes the memoisation worth anything.
  const latestRenderItem = useRef(renderItem);
  latestRenderItem.current = renderItem;
  const renderRow = useCallback(({ item }: { item: T }) => latestRenderItem.current(item), []);

  const footer =
    query.isFetchingNextPage || query.hasNextPage ? (
      <LoadingSpinner />
    ) : query.items.length > 0 && query.total !== undefined ? (
      <Text style={styles.footerNote}>
        {query.total === 1 ? '1 result' : `All ${query.total} results`}
      </Text>
    ) : null;

  return (
    <View style={styles.container}>
      <NetworkBanner />
      <FlatList
        data={query.items}
        renderItem={renderRow}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={
          query.isLoading ? (
            <LoadingSpinner />
          ) : query.isError ? (
            <EmptyState
              icon="cloud-offline"
              title="That did not load"
              message={errorMessage(query.error)}
              actionLabel="Try again"
              onAction={query.refetch}
            />
          ) : (
            <EmptyState
              {...(emptyIcon === undefined ? {} : { icon: emptyIcon })}
              title={emptyTitle}
              message={emptyMessage}
            />
          )
        }
        ListFooterComponent={footer}
        onEndReached={query.fetchNextPage}
        // Start the next page while roughly half a screen of rows is still ahead, so the spinner
        // is usually gone again before the reader reaches it.
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={query.isFetching && !query.isFetchingNextPage}
            onRefresh={query.refetch}
          />
        }
        removeClippedSubviews
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={11}
      />
    </View>
  );
};

const Separator = (): ReactElement => <View style={styles.separator} />;

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },
  footerNote: {
    ...typography.caption,
    color: colors.textSecondary,
    paddingVertical: spacing.lg,
    textAlign: 'center',
  },
  separator: {
    height: spacing.md,
  },
});
