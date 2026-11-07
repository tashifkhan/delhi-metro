const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Paper loads MaterialCommunityIcons with a runtime require, so Metro follows
// it even though nothing in the app names that font. The component below
// draws the same names with Ionicons, which is the only font the app uses.
const paperIcon = path.resolve(__dirname, 'src/icons/paperIcon');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const fromPaper = context.originModulePath.includes(`${path.sep}react-native-paper${path.sep}`);
  if (
    fromPaper &&
    (moduleName === './MaterialCommunityIcon' ||
      moduleName === '../MaterialCommunityIcon' ||
      moduleName.endsWith('/MaterialCommunityIcons') ||
      moduleName.endsWith('/material-design-icons'))
  ) {
    return context.resolveRequest(context, paperIcon, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
