import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ActivityIndicator, Button, Divider, Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import RenderHtml from 'react-native-render-html';
import { Card } from './Card';
import { Touchable } from './Touchable';
import { useNotificationDetailQuery } from '../hooks';
import type { PassengerNotification } from '../types';
import { spacing, radius, emphasis } from '../theme';
import { duration } from '../theme/motion';

interface Props {
  notification: PassengerNotification;
}

const SLUG_PATTERN = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;
const LANGUAGE_SEGMENT_PATTERN = /^[a-z]{2}$/i;

function getNotificationTarget(notification: PassengerNotification): string | null {
  return (
    notification.link_to_outside_url ??
    notification.link_to_internal_page ??
    notification.link_to_file ??
    notification.link_to
  );
}

/**
 * Resolve the DMRC corporate-page or press-release slug used by
 * `GET /api/v1/dmrc/notifications/{page_slug}`.
 *
 * Feeds use several shapes:
 * - bare slug: `service-update-3`
 * - site path: `/pages/en/service-update-3`
 * - nested: `/pages/en/pressrelease_details/some-long-title`
 * - full URL: `https://delhimetrorail.com/pages/en/...`
 */
function getDetailSlug(notification: PassengerNotification): string | null {
  const target = getNotificationTarget(notification);
  if (!target) {
    return null;
  }

  const trimmed = target.trim();
  if (SLUG_PATTERN.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = trimmed.includes('://')
      ? new URL(trimmed)
      : new URL(trimmed, 'https://delhimetrorail.com');
    const hostname = url.hostname.toLowerCase();
    if (
      hostname !== 'delhimetrorail.com' &&
      !hostname.endsWith('.delhimetrorail.com')
    ) {
      return null;
    }

    const parts = url.pathname.split('/').filter(Boolean);
    const pagesIndex = parts.findIndex((part) => part.toLowerCase() === 'pages');
    if (pagesIndex < 0) {
      return null;
    }

    const routeParts = parts.slice(pagesIndex + 1);
    if (routeParts[0] && LANGUAGE_SEGMENT_PATTERN.test(routeParts[0])) {
      routeParts.shift();
    }

    const slug = routeParts.at(-1);
    return slug && SLUG_PATTERN.test(slug) ? slug : null;
  } catch {
    return null;
  }
}

function getExternalUrl(notification: PassengerNotification): string | null {
  const target = getNotificationTarget(notification);
  if (!target) {
    return null;
  }
  const trimmed = target.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (target === notification.link_to_file) {
    try {
      return new URL(trimmed, 'https://backend.delhimetrorail.com/').toString();
    } catch {
      return null;
    }
  }
  if (trimmed.startsWith('/')) {
    return `https://delhimetrorail.com${trimmed}`;
  }
  if (trimmed.startsWith('pages/')) {
    return `https://delhimetrorail.com/${trimmed}`;
  }
  return null;
}

function prepareNotificationHtml(content: string): string {
  return content
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<a\b[^>]*>/gi, '')
    .replace(/<\/a>/gi, '')
    .replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, '');
}

export const NotificationCard = memo(function NotificationCard({ notification }: Props) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [isExpanded, setIsExpanded] = useState(false);
  const pageSlug = useMemo(() => getDetailSlug(notification), [notification]);
  const externalUrl = useMemo(() => getExternalUrl(notification), [notification]);
  const detailQuery = useNotificationDetailQuery(pageSlug, isExpanded);
  const chevronProgress = useSharedValue(0);

  useEffect(() => {
    chevronProgress.value = withTiming(isExpanded ? 1 : 0, {
      duration: duration.short4,
    });
  }, [chevronProgress, isExpanded]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronProgress.value * 180}deg` }],
  }));

  const handleToggle = useCallback(() => {
    setIsExpanded((current) => !current);
  }, []);

  const handleOpenExternal = useCallback(() => {
    if (externalUrl) {
      void Linking.openURL(externalUrl);
    }
  }, [externalUrl]);

  const htmlSource = useMemo(
    () =>
      detailQuery.data
        ? { html: prepareNotificationHtml(detailQuery.data.content) }
        : undefined,
    [detailQuery.data],
  );

  // Expand when we have a corporate slug (in-app HTML) or any external URL fallback.
  const canExpand = pageSlug !== null || externalUrl !== null;
  const contentWidth = Math.max(0, width - spacing.base * 4 - spacing.md * 2);

  return (
    <Animated.View layout={LinearTransition.duration(duration.medium2)}>
      <Card style={styles.container}>
        <Touchable
          onPress={canExpand ? handleToggle : undefined}
          radius={radius.card}
          haptic="select"
          accessibilityLabel={notification.title}
          accessibilityHint={
            canExpand
              ? isExpanded
                ? 'Collapses notification details'
                : 'Expands notification details'
              : 'Notification details are unavailable'
          }
          accessibilityState={{ expanded: canExpand ? isExpanded : undefined }}
        >
          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: theme.colors.primaryContainer }]}>
              <Ionicons
                name="megaphone-outline"
                size={18}
                color={theme.colors.onPrimaryContainer}
              />
            </View>
            <View style={styles.summary}>
              <Text
                variant="bodyMedium"
                numberOfLines={isExpanded ? undefined : 3}
                selectable
                style={[emphasis.medium, styles.title, { color: theme.colors.onSurface }]}
              >
                {notification.title}
              </Text>
              <View style={styles.metaRow}>
                <Ionicons
                  name="calendar-outline"
                  size={12}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text
                  variant="labelSmall"
                  selectable
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {notification.date}
                </Text>
              </View>
            </View>
            {canExpand ? (
              <Animated.View style={[styles.chevron, chevronStyle]}>
                <Ionicons
                  name="chevron-down"
                  size={20}
                  color={theme.colors.onSurfaceVariant}
                />
              </Animated.View>
            ) : null}
          </View>
        </Touchable>

        {isExpanded ? (
          <Animated.View
            entering={FadeIn.duration(duration.short4)}
            exiting={FadeOut.duration(duration.short3)}
            style={styles.detail}
          >
            <Divider />
            {pageSlug && detailQuery.isPending ? (
              <View style={styles.detailState}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  Loading notice…
                </Text>
              </View>
            ) : null}
            {pageSlug && detailQuery.isError ? (
              <View style={styles.detailState}>
                <Text
                  variant="bodySmall"
                  selectable
                  style={[styles.stateText, { color: theme.colors.error }]}
                >
                  Could not load this notice.
                </Text>
                <View style={styles.errorActions}>
                  <Button compact mode="text" icon="refresh" onPress={() => detailQuery.refetch()}>
                    Try again
                  </Button>
                  {externalUrl ? (
                    <Button compact mode="text" icon="open-in-new" onPress={handleOpenExternal}>
                      Open source
                    </Button>
                  ) : null}
                </View>
              </View>
            ) : null}
            {!pageSlug && externalUrl ? (
              <View style={styles.detailState}>
                <Text
                  variant="bodySmall"
                  selectable
                  style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}
                >
                  This notice is published as an external document.
                </Text>
                <Button compact mode="text" icon="open-in-new" onPress={handleOpenExternal}>
                  Open source
                </Button>
              </View>
            ) : null}
            {htmlSource ? (
              <RenderHtml
                contentWidth={contentWidth}
                source={htmlSource}
                baseStyle={{
                  color: theme.colors.onSurfaceVariant,
                  fontSize: 14,
                  lineHeight: 21,
                }}
                classesStyles={{
                  'd-none': { display: 'none' },
                }}
                tagsStyles={{
                  body: { margin: 0 },
                  h2: {
                    color: theme.colors.onSurface,
                    fontSize: 18,
                    lineHeight: 24,
                    marginTop: 0,
                    marginBottom: spacing.sm,
                  },
                  h3: {
                    color: theme.colors.onSurface,
                    fontSize: 16,
                    lineHeight: 22,
                    marginTop: 0,
                    marginBottom: spacing.sm,
                  },
                  p: {
                    marginTop: 0,
                    marginBottom: spacing.sm,
                  },
                }}
              />
            ) : null}
          </Animated.View>
        ) : null}
      </Card>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    padding: spacing.base,
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.iconSmall,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summary: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  chevron: {
    width: 28,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detail: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
    gap: spacing.md,
  },
  detailState: {
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  errorActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  stateText: {
    textAlign: 'center',
  },
});
