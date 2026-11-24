import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, useTheme } from 'react-native-paper';
import { useSaved } from '../saved/SavedContext';
import { SUGGESTED_PLACES, cleanLabel } from '../saved/model';
import { PlaceIcon } from '../saved/PlaceIcon';
import { Card } from '../components/Card';
import { Touchable } from '../components/Touchable';
import { SectionHeader } from '../components/SectionHeader';
import { StationPicker } from '../components/StationPicker';
import { useAppTheme } from '../theme/ThemeContext';
import type { RootTabParamList, SavedStackParamList } from '../navigation/types';
import { spacing, radius, emphasis } from '../theme';
import { stationName } from '../utils/format';

type Nav = NativeStackNavigationProp<SavedStackParamList, 'Saved'>;

/**
 * Saved places and trips.
 *
 * A place starts a trip from its station. A trip opens its route straight
 * away; it stores only the two stations, so the route is always planned fresh.
 */
export function SavedScreen() {
  const navigation = useNavigation<Nav>();
  const theme = useTheme();
  const { fills, look } = useAppTheme();
  const saved = useSaved();
  const [editing, setEditing] = useState(false);
  const [pickingFor, setPickingFor] = useState<string | null>(null);
  const [customLabel, setCustomLabel] = useState('');

  const unusedSuggestions = SUGGESTED_PLACES.filter(
    (label) => !saved.places.some((p) => p.label.toLowerCase() === label.toLowerCase()),
  );

  const startFrom = (code: string, name: string) =>
    navigation.getParent<NavigationProp<RootTabParamList>>()?.navigate('HomeTab', {
      screen: 'Home',
      params: { presetFrom: { code, name }, openTo: true },
    });

  const nothingSaved = saved.loaded && saved.places.length === 0 && saved.trips.length === 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {nothingSaved ? (
        <Text variant="bodyMedium" style={[styles.intro, { color: theme.colors.onSurfaceVariant }]}>
          Add the stations you use most as places, like Home or Work. Save a trip from its route with the
          bookmark button, and it opens here in one tap.
        </Text>
      ) : null}

      <View style={styles.section}>
        <SectionHeader
          title="Places"
          count={saved.places.length || undefined}
          action={saved.places.length ? (editing ? 'Done' : 'Edit') : undefined}
          onAction={() => setEditing((v) => !v)}
        />
        {saved.places.length > 0 ? (
          <Card>
            {saved.places.map((place, index) => (
              <View key={place.label}>
                {index > 0 ? <View style={[styles.divider, { backgroundColor: fills.hairline }]} /> : null}
                <Touchable
                  radius={0}
                  onPress={() =>
                    editing ? setPickingFor(place.label) : startFrom(place.station.code, place.station.name)
                  }
                  accessibilityLabel={
                    editing
                      ? `Change the station for ${place.label}`
                      : `Start a trip from ${place.label}, ${place.station.name}`
                  }
                >
                  <View style={styles.row}>
                    <PlaceIcon label={place.label} />
                    <View style={styles.rowText}>
                      <Text variant="titleMedium" style={[emphasis.strong, { color: theme.colors.onSurface }]}>
                        {place.label}
                      </Text>
                      <Text variant="bodyMedium" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
                        {stationName(place.station.name)}
                      </Text>
                    </View>
                    {editing ? (
                      <Touchable
                        radius={radius.pill}
                        onPress={() => saved.removePlace(place.label)}
                        accessibilityLabel={`Remove ${place.label}`}
                      >
                        <View style={styles.iconButton}>
                          <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
                        </View>
                      </Touchable>
                    ) : (
                      <Ionicons name="arrow-forward" size={18} color={theme.colors.onSurfaceVariant} />
                    )}
                  </View>
                </Touchable>
              </View>
            ))}
          </Card>
        ) : null}

        <View style={styles.chips}>
          {unusedSuggestions.map((label) => (
            <Touchable
              key={label}
              radius={radius.pill}
              haptic="select"
              onPress={() => setPickingFor(label)}
              accessibilityLabel={`Add ${label}`}
              style={{ borderColor: theme.colors.outlineVariant, borderWidth: 1 }}
            >
              <View style={styles.chip}>
                <Ionicons name="add" size={16} color={theme.colors.onSurfaceVariant} />
                <Text variant="labelLarge" style={{ color: theme.colors.onSurface }}>
                  {label}
                </Text>
              </View>
            </Touchable>
          ))}
        </View>
        <View
          style={[
            styles.customRow,
            { borderColor: theme.colors.outlineVariant, borderRadius: look.radius.field },
          ]}
        >
          <TextInput
            value={customLabel}
            onChangeText={setCustomLabel}
            placeholder="Another place, like Mum's or Clinic"
            placeholderTextColor={theme.colors.onSurfaceVariant}
            returnKeyType="next"
            maxLength={24}
            onSubmitEditing={() => cleanLabel(customLabel) && setPickingFor(cleanLabel(customLabel))}
            style={[styles.customInput, { color: theme.colors.onSurface }]}
            accessibilityLabel="Name for a new place"
          />
          <Touchable
            radius={radius.pill}
            disabled={!cleanLabel(customLabel)}
            onPress={() => setPickingFor(cleanLabel(customLabel))}
            accessibilityLabel="Choose its station"
          >
            <View style={[styles.iconButton, { opacity: cleanLabel(customLabel) ? 1 : 0.4 }]}>
              <Ionicons name="arrow-forward" size={20} color={theme.colors.primary} />
            </View>
          </Touchable>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Trips" count={saved.trips.length || undefined} />
        {saved.trips.length > 0 ? (
          <Card>
            {saved.trips.map((trip, index) => (
              <View key={`${trip.from.code}>${trip.to.code}`}>
                {index > 0 ? <View style={[styles.divider, { backgroundColor: fills.hairline }]} /> : null}
                <Touchable
                  radius={0}
                  haptic="press"
                  onPress={() =>
                    navigation.navigate('JourneyResults', {
                      fromCode: trip.from.code,
                      toCode: trip.to.code,
                      fromName: trip.from.name,
                      toName: trip.to.name,
                    })
                  }
                  onLongPress={() =>
                    navigation.navigate('JourneyResults', {
                      fromCode: trip.to.code,
                      toCode: trip.from.code,
                      fromName: trip.to.name,
                      toName: trip.from.name,
                    })
                  }
                  accessibilityLabel={`Open the route from ${trip.from.name} to ${trip.to.name}`}
                  accessibilityHint="Long press for the way back"
                >
                  <View style={styles.row}>
                    <View style={styles.rail} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                      <View style={[styles.ring, { borderColor: theme.colors.primary }]} />
                      <View style={[styles.stem, { backgroundColor: theme.colors.primary }]} />
                      <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />
                    </View>
                    <View style={styles.rowText}>
                      <Text variant="bodyLarge" numberOfLines={1} style={[emphasis.strong, { color: theme.colors.onSurface }]}>
                        {stationName(trip.from.name)}
                      </Text>
                      <Text variant="bodyLarge" numberOfLines={1} style={[emphasis.strong, { color: theme.colors.onSurface }]}>
                        {stationName(trip.to.name)}
                      </Text>
                    </View>
                    <Touchable
                      radius={radius.pill}
                      onPress={() => saved.removeTrip(trip.from.code, trip.to.code)}
                      accessibilityLabel={`Remove the saved trip from ${trip.from.name} to ${trip.to.name}`}
                    >
                      <View style={styles.iconButton}>
                        <Ionicons name="bookmark" size={20} color={theme.colors.primary} />
                      </View>
                    </Touchable>
                  </View>
                </Touchable>
              </View>
            ))}
          </Card>
        ) : (
          <Text variant="bodyMedium" style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
            No saved trips yet. Plan a route and tap the bookmark at the top to keep it here.
          </Text>
        )}
      </View>

      <StationPicker
        visible={pickingFor !== null}
        title={pickingFor ? `Station for ${pickingFor}` : undefined}
        selectedCode={saved.places.find((p) => p.label === pickingFor)?.station.code}
        onSelect={(station) => {
          if (pickingFor) saved.setPlace(pickingFor, { code: station.code, name: station.name });
          setPickingFor(null);
          setCustomLabel('');
          setEditing(false);
        }}
        onClose={() => setPickingFor(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.base,
    gap: spacing.xl,
    paddingBottom: spacing['4xl'],
  },
  intro: {
    paddingHorizontal: spacing.xs,
  },
  section: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    minHeight: 64,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.base,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingLeft: spacing.md,
  },
  customInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: 15,
  },
  hint: {
    paddingHorizontal: spacing.xs,
  },
  rail: {
    width: 14,
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  ring: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  stem: {
    width: 2,
    flex: 1,
    minHeight: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
