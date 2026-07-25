# Expo APK Release Guide (2026)

This guide explains, step by step, how to generate a production-signed APK from an Expo project, test it, and publish it on GitHub Releases.

## 1. What You Are Building

- **APK** (`.apk`) is an installable Android package users can download and install directly.
- **AAB** (`.aab`) is for Google Play submission and is not directly installable.
- For GitHub Releases, you want an APK built from your production profile.

## 2. Prerequisites

### 2.1 Required accounts and tools

- Expo account (`eas login`)
- GitHub repository with permission to create releases
- Node.js LTS (recommended Node 20)
- Bun or npm/yarn/pnpm (match your project lockfile)
- EAS CLI (`eas-cli`)

Check versions:

```bash
node -v
bun -v
eas --version
```

If EAS is not installed globally:

```bash
npm install -g eas-cli
```

### 2.2 Project requirements

- Expo config exists (`app.json` or `app.config.*`)
- App has stable Android package id (`expo.android.package`)
- Dependencies installed

```bash
cd mobile
bun install
```

## 3. Configure App Identity

Set a non-generic app identity in `mobile/app.json`:

```json
{
  "expo": {
    "name": "Delhi Metro",
    "slug": "delhi-metro",
    "android": {
      "package": "codes.tashif.delhimetro"
    }
  }
}
```

Notes:

- `name`: App label users see on launcher.
- `slug`: Expo project slug.
- `android.package`: Unique app id; keep stable after release.

## 4. Configure EAS Build Profile for APK

Create/update `mobile/eas.json`:

```json
{
  "cli": {
    "appVersionSource": "local"
  },
  "build": {
    "github-release": {
      "environment": "production",
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleRelease"
      },
      "channel": "production",
      "autoIncrement": true
    }
  }
}
```

Why this matters:

- `buildType: "apk"` forces installable APK output.
- `gradleCommand` ensures release build path.
- `autoIncrement` bumps version code each build.
- `appVersionSource: "local"` avoids interactive prompt on modern EAS.
- `environment: "production"` pulls EAS environment variables from Expo.

## 5. Environment Variables (Without Plain Text in `eas.json`)

Do not hardcode sensitive or environment values in `eas.json`.

Use EAS environments instead:

1. Open Expo dashboard -> project -> **Environment Variables**.
2. Choose environment: `production`.
3. Add variables such as:
   - `EXPO_PUBLIC_API_BASE_URL=https://dmrc-rest-api.vercel.app/api/v1`
   - `NODE_ENV=production` (optional; you can set this in command or environment)
4. Mark sensitive values appropriately.

CLI alternatives:

```bash
cd mobile
eas env:create --name EXPO_PUBLIC_API_BASE_URL --value https://dmrc-rest-api.vercel.app/api/v1 --environment production --scope project --type string
eas env:create --name NODE_ENV --value production --environment production --scope project --type string
```

Then your profile uses `"environment": "production"` to inject these at build time.

## 6. Configure EAS Project and Updates

If not configured yet, first build may ask to link project and configure updates.

Typical one-time setup:

```bash
cd mobile
eas build:configure
npx expo install expo-updates
eas update:configure
```

This adds/updates fields such as:

- `expo.extra.eas.projectId`
- `expo.updates.url`
- `expo.runtimeVersion`

## 6b. Publish to tashif.codes F-Droid repo

Tag-driven GitHub releases automatically dispatch F-Droid publishing when
`TASHIF_CODES_WORKFLOW_TOKEN` is set on this repository (fine-grained PAT with
**Actions: Read and write** on `tashifkhan/tashif.codes`).

Manual re-import of an existing release:

```bash
# From this repo
gh workflow run fdroid-release.yml \
  --repo tashifkhan/delhi-metro \
  --field tag=v1.1.0 \
  --field apk_pattern='DelhiMetro-v*.apk'

# Or directly on the website
gh workflow run publish-fdroid.yml \
  --repo tashifkhan/tashif.codes \
  --field source_repository=tashifkhan/delhi-metro \
  --field release_tag=v1.1.0 \
  --field apk_pattern='DelhiMetro-v*.apk'
```

Install page: https://tashif.codes/fdroid  
Repo URL: https://tashif.codes/fdroid/repo

## 7. Build APK (Cloud Recommended)

Cloud build is the most reliable for release artifacts.

```bash
cd mobile
bun x eas-cli build --platform android --profile github-release --non-interactive
```

Download latest APK:

```bash
bun x eas-cli build:download --platform android --profile github-release --latest --output ./DelhiMetro-v1.0.0.apk
```

## 8. Build APK Locally (Optional)

Use local build only if you need it and your Android toolchain is ready.

### 8.1 Android SDK setup (macOS)

Add to `~/.zshrc`:

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"
```

Reload shell:

```bash
source ~/.zshrc
```

Install command-line tools if missing:

```bash
brew install --cask android-commandlinetools
```

Ensure cmdline-tools are linked under SDK root if needed:

```bash
mkdir -p "$HOME/Library/Android/sdk/cmdline-tools"
ln -sfn "/opt/homebrew/share/android-commandlinetools/cmdline-tools/latest" "$HOME/Library/Android/sdk/cmdline-tools/latest"
```

Install required SDK packages:

```bash
sdkmanager --sdk_root="$ANDROID_HOME" "platform-tools" "platforms;android-36" "build-tools;36.0.0"
yes | sdkmanager --sdk_root="$ANDROID_HOME" --licenses
```

### 8.2 Gradle memory tuning (important)

Create `~/.gradle/gradle.properties`:

```properties
org.gradle.jvmargs=-Xmx6g -XX:MaxMetaspaceSize=2g -Dfile.encoding=UTF-8
org.gradle.workers.max=2
```

This helps prevent `OutOfMemoryError: Metaspace` during KSP/Gradle tasks.

### 8.3 Run local build

```bash
cd mobile
NODE_ENV=production bun x eas-cli build --platform android --profile github-release --local --non-interactive --clear-cache
```

## 9. Validate APK Before Releasing

Install to device:

```bash
adb install -r ./DelhiMetro-v1.0.0.apk
```

Smoke test checklist:

- App opens normally
- API calls hit production backend
- Core flows work (search, route, fare, etc.)
- No red screen/crash on startup

## 10. Manual GitHub Release Upload

1. Go to repository -> **Releases** -> **Draft a new release**.
2. Create/select tag (e.g. `v1.0.0`).
3. Add release notes.
4. Attach APK file (`DelhiMetro-v1.0.0.apk`).
5. Publish.

## 11. Automated GitHub Release Workflow

Use `.github/workflows/release.yml` to build and upload APK on tag push.

Required repository secret:

- `EXPO_TOKEN`

Create token in Expo account settings and add it in GitHub: repository settings -> secrets and variables -> actions.

## 12. Versioning Best Practices

- Keep `expo.version` aligned with release tag.
- Ensure `android.versionCode` always increases (or use `autoIncrement`).
- Name artifacts with version, for example:
  - `DelhiMetro-v1.0.0.apk`

## 13. Common Errors and Fixes

### 13.1 Old CLI crash (`prototype` error)

Symptom:

- `TypeError: Cannot read properties of undefined (reading 'prototype')`

Fix:

```bash
cd mobile
bun x eas-cli build ...
```

Use `eas-cli` explicitly, not legacy `bun x eas`.

### 13.2 App version source prompt

Fix:

- Set `"cli": { "appVersionSource": "local" }` in `eas.json`.

### 13.3 Android SDK not found

Fix:

- Set `ANDROID_HOME` and `ANDROID_SDK_ROOT`.
- Install SDK components and accept licenses.

### 13.4 Metaspace OOM in Gradle/KSP

Fix:

- Increase Gradle memory in `~/.gradle/gradle.properties`.

### 13.5 Channel warning for `expo-updates`

Fix:

- Install/configure `expo-updates`, or remove `channel` from build profile.

## 14. Security Notes

- Never commit secrets to repo.
- Prefer EAS environment variables/secrets and GitHub Actions secrets.
- If build logs containing credential payloads are shared publicly, rotate credentials immediately.

## 15. Recommended Release Flow (Short Version)

1. Update code and version.
2. Build APK (cloud):

```bash
cd mobile
bun x eas-cli build --platform android --profile github-release --non-interactive
bun x eas-cli build:download --platform android --profile github-release --latest --output ./DelhiMetro-vX.Y.Z.apk
```

3. Install and smoke test via `adb install -r`.
4. Publish GitHub Release and attach APK.
5. Tag and push (`vX.Y.Z`).
