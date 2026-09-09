# Haptics

Feedback is owned by the control that accepts the action. `Touchable` defaults to a soft navigation tap. Use `select` for choices and disclosures, `press` for committing actions, and `false` when the handler owns feedback. A selected option and a disabled control stay silent.

| Interaction | Feedback |
| --- | --- |
| Open a screen, station details, picker, link, or back button | Soft navigation tap |
| Change tabs, station, network, theme, palette, departure time, or route strategy | Selection tick |
| Expand station details, notices, or palette list | Selection tick |
| Toggle appearance settings | Light on pulse, lighter off tick |
| Find a route, open a popular route, reverse endpoints, retry, save map | Commit pulse |
| Pull to refresh | One selection tick at release |
| Zoom buttons or map double tap | Selection tick when scale changes |
| Route ready or map saved | Success pattern |
| Map permission denied or unavailable | Warning pattern |
| Route planning, map saving, or notice link opening fails | Error pattern |
| Typing, scrolling, panning, pinching, automatic refresh, repeated selection, zoom limit | Silent |

## Layout

`useHaptics` owns the vocabulary and the pacing policy; a platform driver owns the waveform. `hapticEffects.ts` names the effects the drivers share, and Metro picks `hapticsDriver.ts` or `hapticsDriver.web.ts` per platform. Keeping the policy above the drivers stops one platform drifting into feeling chattier than the others, and keeps `expo-haptics` out of the web bundle entirely.

Ordinary pulses are limited to one per 80 ms across all controls; outcome patterns have 400 ms to finish without overlapping feedback, and cancel the tap that asked for them so the tail cannot blur their first beat.

## Android

Android plays the system's own effects through `performAndroidHapticsAsync`, following the [Expo SDK 54 guidance](https://docs.expo.dev/versions/v54.0.0/sdk/haptics/), so each one is tuned for the device's actuator and matches what the rest of the platform does for the same gesture: `Clock_Tick`, `Segment_Tick`, `Toggle_On`/`Toggle_Off`, `Virtual_Key`, `Confirm`, and `Reject`.

Navigation deliberately avoids `Segment_Frequent_Tick`. That constant is specified for scrubbing through many values in quick succession, and its contract lets a device skip it when it cannot vibrate that softly. Opening a screen is deliberate and infrequent, so it takes the lightest effect that is still guaranteed to be felt.

## iOS

iOS follows Apple's conventions rather than imitating Android: the selection generator owns discrete choices, impacts carry weight (soft, light, medium), and the notification generator owns outcomes.

## Web

The web runs on [`web-haptics`](https://haptics.lochie.me), which drives `navigator.vibrate` and falls back to toggling a hidden switch element where that is missing, which Safari answers with a system tap. The library's own debug click track and floating switch stay off.

Browsers expose duration, not amplitude. `web-haptics` accepts an `intensity` below 1, but can only fake one by chopping the pulse into on/off slices, which reads as a buzz rather than as a lighter tap. So every effect runs at full intensity and carries its weight in duration alone: 6 ms for navigation up to 12 ms for a press, with outcomes adding a second beat (rising for success, falling for a warning, repeating for a failure). Beats stay at or under 16 ms because the fallback repeats its toggle at that interval for as long as a beat lasts, and a longer beat would rattle instead of tap.

There is no web equivalent of the system haptics switch, so `prefers-reduced-motion` stands in for it. A hidden tab is silent, and leaving the tab cancels a pattern mid-flight.

## Behaviour

Journey outcomes ignore placeholder data and repeat refetch results. Map saving distinguishes a completed save from permission denial and a browser download handoff. Map gestures read the current canvas transform, and drags or canceled gestures do not count as double taps. Native failures are swallowed, as are blocked or unimplemented vibrations. Background app states are silent.

## Verification

Run `node --test tests/haptics.test.cjs` from `app` for the platform mappings, web pattern shape, pulse suppression, reduced motion and hidden pages, disabled and selected controls, driver failure handling, and denied map permission. Run `bun x tsc --noEmit` for type checking.

### Physical device acceptance pass

This pass remains manual. A bundle export cannot verify motor strength or native gesture delivery.

- Compare navigation, selection, switch-on, and commit feedback on iOS and Android. Small controls should not feel as forceful as primary actions.
- Walk Home through station selection, repeated selection, time choice, swap, route search, route editing, strategy tap and swipe, and station details. Loading old placeholder data must not announce completion.
- Walk Explore, Lines, Alerts, About, Appearance, and every back button. Test both networks, disclosures, pull to refresh, retry, and external links.
- On the map, test zoom bounds, double tap, triple tap, drag, pinch, gesture cancellation, and rotation. Continuous gestures stay quiet.
- Save a map with permission granted, denied, and a failed download. Only a saved map gets success feedback. Leave the screen while saving and check that no delayed pulse fires there.
- Disable system haptics and background the app during a request. Actions must continue without vibration or errors.
- On a phone browser, repeat the Home walkthrough in Chrome for Android and Safari. Chrome ignores `navigator.vibrate` until the page has been tapped once, so check that feedback starts from the first interaction onward. Enable Reduce Motion and confirm the site falls silent.
