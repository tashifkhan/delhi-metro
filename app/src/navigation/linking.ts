import type { LinkingOptions } from '@react-navigation/native';

import type { RootTabParamList } from './types';

/**
 * Client-side routes for the web build. Tab switches, pushed pages, and the
 * search query all land in the URL, so pages are shareable and the browser
 * back button works. Native ignores the https prefixes and behaves as before.
 *
 * Detail paths stay unique per tab (`/station/...` under Plan,
 * `/search/station/...` under Search) so an incoming URL resolves to exactly
 * one stack. Everything not in the path segments (station names, codes left
 * over, departure time) rides along as query params automatically.
 */
export const navigationLinking: LinkingOptions<RootTabParamList> = {
  prefixes: [
    'https://ncr-metro.tashif.codes',
    'http://localhost:8081',
    'http://localhost:19006',
  ],
  config: {
    screens: {
      HomeTab: {
        path: '',
        screens: {
          Home: '',
          JourneyResults: 'journey/:fromCode/:toCode',
          StationDetail: 'station/:stationCode',
          Appearance: 'appearance',
          About: 'about',
        },
      },
      SearchTab: {
        path: 'search',
        screens: {
          StationSearch: '',
          StationDetail: 'station/:stationCode',
        },
      },
      LinesTab: {
        path: 'lines',
        screens: {
          MetroLines: '',
          LineStations: ':lineCode',
          StationDetail: 'station/:stationCode',
        },
      },
      MapTab: {
        path: 'map',
        screens: {
          MetroMap: '',
        },
      },
      AlertsTab: {
        path: 'notifications',
        screens: {
          Notifications: '',
        },
      },
    },
  },
};
