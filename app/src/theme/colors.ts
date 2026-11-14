/**
 * Material 3 color schemes for Delhi Metro.
 *
 * The accent and surface roles are generated from the Metro blue seed by
 * material-color-utilities (see `materialScheme`), so light and dark get the
 * real M3 tonal surfaces instead of hand-picked values over pure black. The
 * AMOLED setting still turns dark surfaces black when someone wants that.
 *
 * Alongside the standard M3 roles each scheme carries app-specific semantic
 * roles (success / warning / interchange). They follow the same
 * `role` + `onRole` + `roleContainer` + `onRoleContainer` shape as M3 proper,
 * so they compose the same way and survive dynamic theming — see
 * `ThemeContext`, which keeps these fixed while accent roles follow the
 * wallpaper. Never hardcode a status color at the call site; use these.
 */

import { materialScheme } from './materialScheme';

export const METRO_SEED = '#005FAF';

export const lightScheme = {
  ...materialScheme(METRO_SEED, false),

  // App-specific semantic roles
  success: 'rgb(27, 109, 48)',
  onSuccess: 'rgb(255, 255, 255)',
  successContainer: 'rgb(186, 243, 189)',
  onSuccessContainer: 'rgb(0, 33, 9)',
  warning: 'rgb(123, 88, 0)',
  onWarning: 'rgb(255, 255, 255)',
  warningContainer: 'rgb(255, 232, 190)',
  onWarningContainer: 'rgb(38, 26, 0)',
  interchange: 'rgb(139, 80, 0)',
  onInterchange: 'rgb(255, 255, 255)',
  interchangeContainer: 'rgb(255, 220, 186)',
  onInterchangeContainer: 'rgb(44, 22, 0)',
};

export const darkScheme = {
  ...materialScheme(METRO_SEED, true),

  // App-specific semantic roles
  success: 'rgb(135, 217, 142)',
  onSuccess: 'rgb(0, 57, 15)',
  successContainer: 'rgb(0, 83, 25)',
  onSuccessContainer: 'rgb(163, 246, 169)',
  warning: 'rgb(245, 191, 72)',
  onWarning: 'rgb(64, 45, 0)',
  warningContainer: 'rgb(94, 66, 0)',
  onWarningContainer: 'rgb(255, 222, 161)',
  interchange: 'rgb(255, 184, 106)',
  onInterchange: 'rgb(72, 38, 0)',
  interchangeContainer: 'rgb(102, 55, 0)',
  onInterchangeContainer: 'rgb(255, 220, 186)',
};
