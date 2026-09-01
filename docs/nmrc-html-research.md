# NMRC website reverse engineering

Research date: 28 July 2026

NMRC has no public API for journeys. I had to read the actual passenger site to understand how the browser gets a fare and route. It turned out to be a quirky two step dance, not a JSON endpoint.

## Summary

The passenger site does not expose journey results as JSON. The browser does this:

1. Read origin and destination ids from the two station `<select>` elements.
2. Join them as `origin#destination`, for example `4#1`.
3. Call `GET /Captcha/EncryptString?EncryptString=<pair>` to get an encrypted token.
4. Navigate to `/Passenger-Information/Journey-Planner-and-Fares?id=<encrypted-token>`.
5. Parse route stations, minutes, kilometres, normal fare, and concessional fare from the HTML that comes back.

The token is opaque and can contain URL sensitive characters, so always encode it as a query param. Do not paste it raw.

Example I saw for `4#1`:

- from Noida Sector 101
- to Noida Sector 51
- stops rendered were Sector 101, Sector 76, Sector 50, Sector 51
- time 6 minutes
- distance 3.43 km
- normal fare 20 rupees
- Sunday and national holiday fare 15 rupees

If the site changes its markup a little, the flow above will still be the key. The token step is the part people miss.

## Other data sources

- station catalog comes from the planner's `sourceStation` select. It had 21 stations when I checked.
- first and last trains and fare bands live on `/Passenger-Information/Metro-Rail/Train-Timings`
- Aqua Line map image lives at `/assets/images/Route-Map-aqua-line.jpg`, which I found from the Network Map page
- current press releases live at `/Media/Press-Release`
- archive press releases live at `/Media/ArchivePressRelease`

Press releases are just PDF links with title and date. The backend parses both current and archive pages and deduplicates by URL.

## Implementation choices

This project fetches NMRC HTML on the FastAPI backend, never on the phone. A few reasons:

- parsing on the server keeps the app small and lets me update selectors without shipping a new binary
- I can use lxml and real XPath instead of fragile string searches

How parsing works:

- the HTML is recovered into an `lxml.html` DOM. XPath picks semantic regions like station lists, metric blocks, fare cards, and press release cards. Regex is only for scalars inside those regions, like `6 Min`, `3.43 KM`, or `20` rupees
- the parser does not depend on attribute quoting, class order, exact child tag serialization, or where a section closes. It also keeps a narrow fallback for the older rupee icon markup which still shows up

What the backend does with the parse:

- it returns the same `PlannedJourney`, station, line, notification, and map shapes as DMRC, with `source: "nmrc"` so callers know where it came from
- the live planner is the source of truth for exact time, distance, and fare
- a checked in 21 station catalog, published fare bands, first and last train table, and an adjacent distance snapshot act as fallback if the page cannot be fetched
- there is only the Aqua Line in the current catalog, so both `least-distance` and `minimum-interchange` resolve to the same path. The mobile UI hides the redundant strategy control when the network is NMRC. It is simpler that way.

## Transport caveat

NMRC currently sends an invalid header with a space before the colon:

`Access-Control-Allow-Origin : nmrccms.datahosts.in`

Browsers, curl, and Python's standard library accept it. Strict `h11` and `httpx` reject it. So the NMRC client runs a tolerant standard library request inside `asyncio.to_thread` and returns the HTML. DMRC clients stay on strict `httpx`. I did not want to loosen parsing globally for one host.

## Official app investigation

I also installed the signed NMRC Android app on an emulator to see if it had a cleaner anonymous API. It does not.

Request and response bodies there use compact JWE with `RSA-OAEP-256` and `A256GCM`, the service wants the app's embedded HTTP auth, and station and fare and back office calls still need a valid logged in token. Anonymous encrypted probes I tried came back as `INVALID_TOKEN`.

The endpoint inventory was the same between the app builds I checked, 1.0.1 and 1.0.4. Using a passenger account would pull the scope into private account and ticketing traffic, which is not what this project needs. The public website, while awkward, stays the appropriate source for these read only features.
