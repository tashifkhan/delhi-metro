# Appearance and page animations

Appearance stores the theme mode, palette, AMOLED, contrast, haptics and page
animation preference on the device. Native uses SQLite. Web uses localStorage.

Page animations offers Slide, Fade and Off. Slide keeps the horizontal stack
transition, shifting tabs and rising content reveals. Fade removes the spatial
movement. Off displays new pages and revealed content immediately. The choice
also controls tab indicator motion and Paper's animation scale.

The device's Reduce Motion setting overrides the animation preference. The
saved preference stays intact, so turning Reduce Motion off restores it. One
listener in ThemeProvider tracks changes and removes itself on unmount.

Existing settings default to Slide. Unknown stored values also fall back to
Slide. The selector has radio semantics and a selected state for screen readers.

Run `node --test tests/animation-preferences.test.cjs` and `bun x tsc --noEmit`
from app. On Android, select each option and navigate into a station, return,
and switch tabs. Relaunch the app to check persistence.

Verified on Android API 35 with a local release build. Off remained selected
after a full relaunch. A saved Fade choice remained selected when the system
disabled animations, while the screen explained the Reduce Motion override.
Re-enabling system animations removed the override. Native navigation and
content reveal captures use these working settings.
