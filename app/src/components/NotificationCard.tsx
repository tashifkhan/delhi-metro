import { useHaptics } from '../hooks/useHaptics';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import RenderHtml from 'react-native-render-html';
import { Touchable } from './Touchable';
import { LoadingIndicator } from './loading/LoadingIndicator';
import { StateButton } from './loading/StateButton';
import { useNotificationDetailQuery } from '../hooks';
import { useAppTheme } from '../theme/ThemeContext';
import type { PassengerNotification } from '../types';
import { spacing, shape, emphasis } from '../theme';
import { duration } from '../theme/motion';

/** Where the card sits in a segmented list; decides which corners are round. */
export type NoticePosition = 'single' | 'first' | 'middle' | 'last';

interface Props {
  notification: PassengerNotification;
  position?: NoticePosition;
}

/** Readable measure for long notices on wide screens. */
const BODY_MAX_WIDTH = 720;

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

// ---------------------------------------------------------------------------
// Text clean-up. DMRC writes most titles, and the headline inside each press
// release, in capitals. Long capitals are hard to read, so they are turned
// into sentence case with the names that should stay capitalised put back.
// ---------------------------------------------------------------------------

/** Kept in capitals wherever they appear. */
const ACRONYMS = new Set([
  'AM', 'PM', 'DMRC', 'NMRC', 'NCRTC', 'NCR', 'RRTS', 'IGI', 'AIIMS', 'INA', 'ITO', 'DLF', 'GTB',
  'ISBT', 'UPI', 'QR', 'NCMC', 'CCTV', 'PSD', 'GNIDA', 'NSEZ', 'CBTC', 'UTO', 'IT', 'MD', 'CMRS',
  'CEO', 'PRO', 'OCC', 'AC', 'DC', 'II', 'III', 'IV',
]);

/** Proper nouns that sentence case would otherwise lower. Matched case-insensitively. */
const PROPER = [
  'Delhi Metro Rail Corporation', 'Noida Metro Rail Corporation', 'Delhi Metro', 'Noida Metro',
  'Airport Express', 'Rapid Metro', 'Namo Bharat', 'Aqua Line', 'Red Line', 'Yellow Line',
  'Blue Line', 'Green Line', 'Violet Line', 'Pink Line', 'Magenta Line', 'Grey Line',
  'Orange Line', 'Delhi', 'Noida', 'Greater Noida', 'Gurugram', 'Ghaziabad', 'Faridabad',
  'India', 'Indian', 'Diwali', 'Holi', 'Dussehra', 'Eid', 'Christmas', 'Raksha Bandhan',
  'Independence Day', 'Republic Day', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
  'Saturday', 'Sunday', 'January', 'February', 'March', 'April', 'June', 'July', 'August',
  'September', 'October', 'November', 'December', 'Sarthi', 'Metro Museum',
];
const PROPER_PATTERN = new RegExp(
  `\\b(${PROPER.map((p) => p.replace(/ /g, '\\s+')).sort((a, b) => b.length - a.length).join('|')})\\b`,
  'gi',
);
const PROPER_BY_KEY = new Map(PROPER.map((p) => [p.toLowerCase(), p]));

/** True when the text is mostly capital letters, like "LAST METRO TRAIN SERVICE". */
export function isShouting(text: string): boolean {
  const letters = text.replace(/[^A-Za-z]/g, '');
  if (letters.length < 8) return false;
  const lower = letters.replace(/[^a-z]/g, '').length;
  return lower / letters.length < 0.1;
}

/**
 * Sentence case for text written in capitals; anything else is returned as is.
 * Acronyms (DMRC, PM), words with digits (LN3) and known names (Pink Line,
 * Diwali) keep their capitals.
 */
export function sentenceCase(text: string): string {
  if (!isShouting(text)) return text;
  let out = text.replace(/[A-Za-z][A-Za-z'.]*/g, (word) => {
    const bare = word.replace(/[^A-Za-z]/g, '').toUpperCase();
    return ACRONYMS.has(bare) ? word.toUpperCase() : word.toLowerCase();
  });
  out = out.replace(PROPER_PATTERN, (match) => PROPER_BY_KEY.get(match.toLowerCase().replace(/\s+/g, ' ')) ?? match);
  // Capitalise the first letter of the text and of each sentence.
  out = out.replace(/(^\s*[("']?|[.!?]\s+[("']?)([a-z])/g, (_, lead: string, letter: string) => lead + letter.toUpperCase());
  return out;
}

/**
 * "2026-11-06" (DMRC) or "29-10-2026" (NMRC) to "6 Nov 2026". Unknown formats
 * pass through.
 */
export function formatNoticeDate(value: string): string {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const dmy = value.match(/^(\d{2})[-/.](\d{2})[-/.](\d{4})$/);
  const parts = iso ? [iso[1], iso[2], iso[3]] : dmy ? [dmy[3], dmy[2], dmy[1]] : null;
  if (!parts) return value;
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function normalise(text: string): string {
  return decodeEntities(text.replace(/<[^>]+>/g, ' '))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Make an upstream notice readable in the card.
 *
 * Strips scripts, styles, links and buttons as before, then drops the blocks
 * that only repeat what the card already shows (the "PRESS RELEASE" label and
 * the headline, which is the card title), and turns any remaining capitals
 * into sentence case. Alignment set inline by the source is ignored at render
 * time, so nothing is centred.
 */
function prepareNotificationHtml(content: string, title: string): string {
  const titleKey = normalise(title);
  return content
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<a\b[^>]*>/gi, '')
    .replace(/<\/a>/gi, '')
    .replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, '')
    .replace(/<(p|h[1-6]|div)\b[^>]*>([\s\S]*?)<\/\1>/gi, (block, _tag: string, inner: string) => {
      const key = normalise(inner);
      if (!key) return block;
      if (key === 'press release' || (titleKey.length > 12 && key === titleKey)) return '';
      return block;
    })
    // Entities stay encoded so a decoded `<` can't open a tag.
    .replace(/>([^<]+)</g, (_, text: string) => `>${sentenceCase(text.replace(/&nbsp;/gi, ' '))}<`);
}
export const NotificationCard = memo(function NotificationCard({
  notification,
  position = 'single',
}: Props) {
  const theme = useTheme();
  const { fills } = useAppTheme();
  const haptics = useHaptics();
  const [isExpanded, setIsExpanded] = useState(false);
  const [bodyWidth, setBodyWidth] = useState(0);
  const pageSlug = useMemo(() => getDetailSlug(notification), [notification]);
  const externalUrl = useMemo(() => getExternalUrl(notification), [notification]);
  const detailQuery = useNotificationDetailQuery(pageSlug, isExpanded);
  const chevronProgress = useSharedValue(0);
  const title = useMemo(() => sentenceCase(notification.title.trim()), [notification.title]);

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
      void Linking.openURL(externalUrl).catch(() => haptics.error());
    }
  }, [externalUrl, haptics]);

  const htmlSource = useMemo(
    () =>
      detailQuery.data
        ? { html: prepareNotificationHtml(detailQuery.data.content, notification.title) }
        : undefined,
    [detailQuery.data, notification.title],
  );

  // Expand when we have a corporate slug (in-app HTML) or any external URL fallback.
  const canExpand = pageSlug !== null || externalUrl !== null;
  const outer = shape.xl;
  const inner = shape.sm;
  const top = position === 'single' || position === 'first' ? outer : inner;
  const bottom = position === 'single' || position === 'last' ? outer : inner;
  const corners = {
    borderTopLeftRadius: top,
    borderTopRightRadius: top,
    borderBottomLeftRadius: bottom,
    borderBottomRightRadius: bottom,
  };

  return (
    <Animated.View
      layout={LinearTransition.duration(duration.medium2)}
      style={[
        styles.container,
        corners,
        { backgroundColor: isExpanded ? fills.container : fills.containerLow },
      ]}
    >
      <Touchable
        onPress={canExpand ? handleToggle : undefined}
        radius={0}
        haptic="select"
        accessibilityLabel={title}
        accessibilityHint={
          canExpand
            ? isExpanded
              ? 'Collapses the notice'
              : 'Shows the full notice'
            : 'The full notice is not available'
        }
        accessibilityState={{ expanded: canExpand ? isExpanded : undefined }}
      >
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: theme.colors.secondaryContainer }]}>
            <Ionicons
              name="megaphone-outline"
              size={20}
              color={theme.colors.onSecondaryContainer}
            />
          </View>
          <View style={styles.summary}>
            <Text
              variant="titleSmall"
              numberOfLines={isExpanded ? undefined : 3}
              selectable
              style={[emphasis.strong, styles.title, { color: theme.colors.onSurface }]}
            >
              {title}
            </Text>
            <View style={[styles.dateChip, { backgroundColor: fills.containerHigh }]}>
              <Ionicons name="calendar-clear-outline" size={13} color={theme.colors.onSurfaceVariant} />
              <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {formatNoticeDate(notification.date)}
              </Text>
            </View>
          </View>
          {canExpand ? (
            <Animated.View style={[styles.chevron, chevronStyle]}>
              <Ionicons name="chevron-down" size={20} color={theme.colors.onSurfaceVariant} />
            </Animated.View>
          ) : null}
        </View>
      </Touchable>

      {isExpanded ? (
        <Animated.View
          entering={FadeIn.duration(duration.short4)}
          exiting={FadeOut.duration(duration.short3)}
          style={styles.detail}
          onLayout={(event) => setBodyWidth(event.nativeEvent.layout.width)}
        >
          {pageSlug && detailQuery.isPending ? (
            <View style={styles.detailState}>
              <LoadingIndicator size={40} accessibilityLabel="Loading the notice" />
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Loading the notice
              </Text>
            </View>
          ) : null}
          {pageSlug && detailQuery.isError && !detailQuery.data ? (
            <View style={styles.detailState}>
              <Text
                variant="bodyMedium"
                selectable
                style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}
              >
                Couldn't load this notice.
              </Text>
              <View style={styles.actions}>
                <StateButton
                  label="Try again"
                  icon="refresh"
                  tone="tonal"
                  onPress={() => void detailQuery.refetch()}
                />
                {externalUrl ? (
                  <StateButton
                    label="Open on the website"
                    icon="open-outline"
                    tone="tonal"
                    onPress={handleOpenExternal}
                  />
                ) : null}
              </View>
            </View>
          ) : null}
          {!pageSlug && externalUrl ? (
            <View style={styles.detailState}>
              <Text
                variant="bodyMedium"
                selectable
                style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}
              >
                This notice is published as a document on the operator's website.
              </Text>
              <StateButton
                label="Open the document"
                icon="document-text-outline"
                tone="tonal"
                onPress={handleOpenExternal}
              />
            </View>
          ) : null}
          {htmlSource && bodyWidth > 0 ? (
            <View style={styles.body}>
              <RenderHtml
                contentWidth={Math.min(bodyWidth, BODY_MAX_WIDTH)}
                source={htmlSource}
                // The source centres its headings and signature inline; a card
                // reads better left-aligned.
                ignoredStyles={['textAlign']}
                baseStyle={{
                  color: theme.colors.onSurfaceVariant,
                  fontSize: 15,
                  lineHeight: 24,
                  textAlign: 'left',
                }}
                classesStyles={{
                  'd-none': { display: 'none' },
                }}
                tagsStyles={{
                  body: { margin: 0 },
                  h2: {
                    color: theme.colors.onSurface,
                    fontSize: 18,
                    lineHeight: 26,
                    fontWeight: '600',
                    marginTop: 0,
                    marginBottom: spacing.sm,
                  },
                  h3: {
                    color: theme.colors.onSurface,
                    fontSize: 16,
                    lineHeight: 24,
                    fontWeight: '600',
                    marginTop: 0,
                    marginBottom: spacing.sm,
                  },
                  p: {
                    marginTop: 0,
                    marginBottom: spacing.md,
                  },
                  strong: {
                    color: theme.colors.onSurface,
                    fontWeight: '600',
                  },
                }}
              />
              {externalUrl ? (
                <View style={styles.sourceRow}>
                  <StateButton
                    label="Open on the website"
                    icon="open-outline"
                    tone="tonal"
                    onPress={handleOpenExternal}
                  />
                </View>
              ) : null}
            </View>
          ) : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    paddingVertical: 14,
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summary: {
    flex: 1,
    gap: spacing.sm,
  },
  title: {
    lineHeight: 21,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    height: 26,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
  },
  chevron: {
    width: 32,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detail: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  body: {
    maxWidth: BODY_MAX_WIDTH,
  },
  detailState: {
    minHeight: 96,
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  stateText: {
    lineHeight: 20,
  },
  sourceRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
});
