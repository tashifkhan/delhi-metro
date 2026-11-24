const { AndroidConfig, withGradleProperties } = require('expo/config-plugins');

const ABI_VERSION_SUFFIX = {
  'armeabi-v7a': 1,
  'arm64-v8a': 2,
};

module.exports = ({ config }) => {
  const abi = process.env.ANDROID_RELEASE_ABI;
  if (abi && !Object.hasOwn(ABI_VERSION_SUFFIX, abi)) {
    throw new Error(`Unknown Android release ABI: ${abi}`);
  }

  const android = { ...config.android };
  if (abi) {
    // F-Droid names APKs by package and versionCode. Prefer arm64 on devices that support both.
    android.versionCode = android.versionCode * 10 + ABI_VERSION_SUFFIX[abi];
  }

  const expoConfig = {
    ...config,
    android,
    plugins: [
      ...config.plugins,
      [
        'expo-build-properties',
        {
          android: {
            buildArchs: abi ? [abi] : Object.keys(ABI_VERSION_SUFFIX),
            enableMinifyInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
            enableBundleCompression: false,
            // Compress native libraries in the APK for direct downloads.
            useLegacyPackaging: true,
            // Expo keeps this class name, and SQLite JNI also calls its constructor.
            extraProguardRules:
              '-keepclassmembers class expo.modules.sqlite.InvalidConvertibleException { public <init>(java.lang.String); }',
          },
        },
      ],
    ],
  };

  return withGradleProperties(expoConfig, (modConfig) => {
    AndroidConfig.BuildProperties.updateAndroidBuildProperty(
      modConfig.modResults,
      'expo.gif.enabled',
      'false',
    );
    return modConfig;
  });
};
