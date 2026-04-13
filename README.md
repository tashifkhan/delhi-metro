# Delhi Metro

Monorepo for a Delhi Metro journey platform:

- `api/`: FastAPI backend wrapper over DMRC upstream APIs
- `mobile/`: Expo React Native mobile app
- `docs/`: project documentation, flows, and release guides

## Repository Layout

- `api/`
  - Backend service with typed schemas, service layer, and DMRC/map endpoints
- `mobile/`
  - Cross-platform app for journey planning, station search, lines, maps, and alerts
- `docs/`
  - API deep dive, mobile deep dive, DMRC flow research, and release documentation

## Quick Start

### 1) Run the API

```bash
cd api
uv sync
uv run uvicorn app.main:app --reload
```

API docs will be available at:

- `http://127.0.0.1:8000/docs`

### 2) Run the Mobile App

```bash
cd mobile
bun install
bun run start
```

Set mobile env (`mobile/.env`):

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
```

## Documentation

- API backend guide: `docs/api-backend-guide.md`
- Expo app guide: `docs/expo-app-guide.md`
- DMRC API flow notes: `docs/DMRC_API_FLOW.md`
- Expo APK release guide: `docs/expo-apk-release-guide.md`
- API package README: `api/README.md`
- Mobile package README: `mobile/README.md`

## Product Capabilities

- Metro lines and station discovery
- Station search and station detail
- Fare + route planning across two strategies
- First/last train timing lookup
- DMRC map asset discovery and delivery
- Mobile route caching and offline fallback for popular routes

## Notes

- Backend depends on upstream DMRC services and frontend assets.
- Map PDFs may be unavailable for some map families based on upstream publication.
- Prefer environment variables for deployment-specific configuration.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
