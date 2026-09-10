# Haptics

Routine navigation, selections, button presses, refresh, and map zoom are silent on native and web. Light feedback remains for appearance switches, recognized long presses, and operation results such as route completion or map saving.

`useHaptics` applies this policy centrally. Existing `navigate`, `select`, and `press` calls are silent, so nested handlers and shared controls follow the same rule. Switches and long presses are limited to one pulse per 250 ms. Outcomes can interrupt that feedback, then suppress further pulses for 600 ms.

The user can turn feedback off entirely in Appearance → Options → Haptics. The saved preference defaults to on. Background apps, hidden browser tabs, and browsers requesting reduced motion remain silent. Driver failures never interrupt an action.

## Platform feedback

Android uses `Segment_Frequent_Tick` for retained effects. This is the soft system preset and may stay silent on hardware that cannot produce it, as described in the [Expo haptics documentation](https://docs.expo.dev/versions/v54.0.0/sdk/haptics/).

iOS uses selection feedback for both switch directions and a single soft impact for long presses and outcomes. There are no heavy impacts or notification sequences.

Web uses a single 4 ms pulse for switches and 6 ms for long presses and outcomes. There are no second beats. Browser hardware controls amplitude; the fallback system tap cannot be made softer through duration alone. The library's debug audio and floating switch remain disabled.

## Verification

Run `node --test tests/haptics.test.cjs` and `bun x tsc --noEmit` from `app`.

On physical devices, check that navigation, station selection, tabs, route strategy, swap, refresh, retry, and map zoom stay silent. Switches and operation results should give one light pulse. Confirm that disabling Haptics silences all feedback, and that leaving a screen during a request does not produce a delayed result pulse there. Actual motor strength requires a device check.
