# NMRC website reverse engineering

Research date: 28 July 2026.

## Summary

NMRC's passenger website does not expose journey results as a public JSON
resource. The browser uses a two-request, server-rendered flow:

1. Read origin and destination IDs from the two station `<select>` elements.
2. Join them as `origin#destination`.
3. Call `GET /Captcha/EncryptString?EncryptString=<pair>`.
4. Navigate to
   `/Passenger-Information/Journey-Planner-and-Fares?id=<encrypted-token>`.
5. Read route stations, minutes, kilometres, normal fare, and concessional
   fare from the returned HTML.

The encrypted token is opaque and may contain URL-sensitive characters, so it
must always be passed through query-parameter encoding.

Example observed for station IDs `4#1`:

- From: Noida Sector 101
- To: Noida Sector 51
- Stops rendered: Sector 101, Sector 76, Sector 50, Sector 51
- Time: 6 minutes
- Distance: 3.43 km
- Normal fare: ₹20
- Sunday/national-holiday fare: ₹15

## Other data sources

- Station catalog: the planner's `sourceStation` options (21 stations).
- First/last trains and fare bands:
  `/Passenger-Information/Metro-Rail/Train-Timings`.
- Existing Aqua Line map:
  `/assets/images/Route-Map-aqua-line.jpg`, discovered from the Network Map
  page.
- Current press releases: `/Media/Press-Release`.
- Archive press releases: `/Media/ArchivePressRelease`.

Press releases are PDF links with title/date metadata. Both current and archive
pages are parsed and deduplicated by URL.

## Implementation choices

- Public NMRC HTML is fetched by the FastAPI backend, never directly parsed on
  the phone.
- HTML is parsed into a recovered `lxml.html` DOM. XPath selects semantic
  regions such as station, metric, fare, and press-release cards; regular
  expressions are limited to scalar values inside those regions (for example
  `6 Min`, `3.43 KM`, and `₹20`).
- The parser does not depend on attribute quoting, class order, exact child-tag
  serialization, or a closing section boundary. It also retains a narrow
  compatibility fallback for the older rupee-icon markup.
- The backend returns the existing `PlannedJourney`, station, line,
  notification, and map contracts, with `source: "nmrc"`.
- The live planner is authoritative for exact time, distance, and fare.
- A checked-in 21-station catalog, published fare bands, first/last train
  table, and adjacent-distance snapshot provide graceful fallback.
- Only the Aqua Line exists in the current passenger catalog, so both route
  strategies resolve to the same path and the mobile UI hides the redundant
  strategy control on NMRC.

## Transport caveat

NMRC currently emits an invalid header with whitespace before the colon:

`Access-Control-Allow-Origin : nmrccms.datahosts.in`

Browsers, curl, and Python's standard HTTP stack accept the response, while
strict `h11`/`httpx` parsing rejects it. The NMRC client therefore runs the
tolerant standard-library request in `asyncio.to_thread`; DMRC's strict clients
are unchanged.

## Official app investigation

The signed NMRC Android app was also inspected on an emulator. Its read-only
endpoints are not a better anonymous source: request and response bodies use
compact JWE (`RSA-OAEP-256` with `A256GCM`), the service requires the app's
embedded HTTP authentication, and station/fare/back-office calls still require
a valid logged-in token. Anonymous encrypted probes returned `INVALID_TOKEN`.

The relevant endpoint inventory was unchanged between the inspected 1.0.1 and
1.0.4 app builds. Because using a passenger account would expand the scope into
private account and ticketing traffic, the public website remains the more
appropriate source for these read-only features.
