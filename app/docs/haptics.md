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

Android uses native `performAndroidHapticsAsync` presets, following the [Expo SDK 54 guidance](https://docs.expo.dev/versions/v54.0.0/sdk/haptics/). iOS uses selection, impact, and notification feedback. Web stays silent. Native failures are swallowed. Background app states are silent. Ordinary pulses are limited to one per 80 ms across all controls; outcome patterns have 400 ms to finish without overlapping feedback.

Journey outcomes ignore placeholder data and repeat refetch results. Map saving distinguishes a completed save from permission denial and a browser download handoff. Map gestures read the current canvas transform, and drags or canceled gestures do not count as double taps.

Run `node --test tests/haptics.test.cjs` from `app` for platform mappings, pulse suppression, disabled and selected controls, native failure handling, and denied map permission. Run `bun x tsc --noEmit` for type checking.

## Physical device acceptance pass

This pass remains manual. A bundle export cannot verify motor strength or native gesture delivery.

- Compare navigation, selection, switch-on, and commit feedback on iOS and Android. Small controls should not feel as forceful as primary actions.
- Walk Home through station selection, repeated selection, time choice, swap, route search, route editing, strategy tap and swipe, and station details. Loading old placeholder data must not announce completion.
- Walk Explore, Lines, Alerts, About, Appearance, and every back button. Test both networks, disclosures, pull to refresh, retry, and external links.
- On the map, test zoom bounds, double tap, triple tap, drag, pinch, gesture cancellation, and rotation. Continuous gestures stay quiet.
- Save a map with permission granted, denied, and a failed download. Only a saved map gets success feedback. Leave the screen while saving and check that no delayed pulse fires there.
- Disable system haptics and background the app during a request. Actions must continue without vibration or errors.
