# api.steven.codes

Small Express service for collecting city facts and exposing personal media
status endpoints.

## Setup

Requires Node 24 and PostgreSQL.

```sh
npm install
cp .env.example .env
createdb api_steven_codes
```

Set `DATABASE_URL` in `.env` to your local database. The default example is:

```text
postgresql://localhost/api_steven_codes
```

The facts table and its city index are created automatically when the server
starts. To use the Spotify endpoint, also fill in a Spotify app client ID,
client secret, and refresh token with these scopes:

```text
user-read-currently-playing user-read-recently-played
```

## Run

```sh
npm start
```

## Deploy

1. Push the repo to GitHub.
2. Create or open the Render Web Service connected to this repository. Use
   `npm ci` as the build command, `npm start` as the start command, and
   `/healthz` as the health check path.
3. Create a Render Postgres database in the same region as the web service.
   Use `api-steven-codes-db` as its name, `api_steven_codes` as its database
   name, and the `basic-256mb` instance type.
4. Copy the database's internal URL and add it to the web service as the
   `DATABASE_URL` environment variable.
5. Set `NODE_VERSION` to `24` and add the Spotify environment variables:
   `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and `SPOTIFY_REFRESH_TOKEN`.
6. Deploy the web service. The facts table and index are created automatically
   during startup.
7. In your DNS provider, add a CNAME record if it is not already present:

```text
Name: api
Value: api-steven-codes.onrender.com
```

Use the exact `onrender.com` hostname Render assigns if it differs.

## City facts app

Open:

```text
http://localhost:3000/city-facts
```

The app chooses a city, lets visitors search the bundled `data/cities.json`,
and stores submitted facts by the selected city's numeric ID. Visitor names
are remembered only in that browser's local storage.

The same-origin app uses these endpoints:

```http
GET /city-facts/api/cities/random
GET /city-facts/api/cities/search?q=paris
GET /city-facts/api/facts/leaderboard
POST /city-facts/api/facts
```

Facts accept only non-empty text up to 1000 characters and links under
`en.wikipedia.org/wiki/`. Names are requested on first submission and must be
shorter than 32 characters.

## Media endpoints

```http
GET /currently-playing
```

Responses are cached in memory for 10 seconds to avoid repeated Spotify API
calls during quick successive requests.

When Spotify has a currently playing track:

```json
{
  "isPlaying": true,
  "source": "currently-playing",
  "track": {
    "name": "Song Name",
    "artist": "Artist Name",
    "songUrl": "https://open.spotify.com/track/...",
    "artistUrl": "https://open.spotify.com/artist/...",
    "albumArtwork": "https://i.scdn.co/image/...",
    "progressMs": 42137
  }
}
```

When nothing is currently playing, the endpoint returns your most recently
played track when one is available:

```json
{
  "isPlaying": false,
  "source": "recently-played",
  "track": {
    "name": "Previous Song Name",
    "artist": "Artist Name",
    "songUrl": "https://open.spotify.com/track/...",
    "artistUrl": "https://open.spotify.com/artist/...",
    "albumArtwork": "https://i.scdn.co/image/..."
  }
}
```

When nothing is currently playing and Spotify has no recent track available:

```json
{
  "isPlaying": false,
  "source": null,
  "track": null
}
```

```http
GET /currently-reading
```

This endpoint reads the public Goodreads updates RSS feed. “Started reading”
and “is currently reading” items are treated as currently reading. Responses
are cached in memory for one hour.

```json
{
  "status": "currently-reading",
  "book": {
    "name": "Circe",
    "author": "Madeline Miller",
    "image": "https://i.gr-assets.com/images/..."
  }
}
```

When there is no current-reading item, the endpoint falls back to the first
“finished reading” item in the feed:

```json
{
  "status": "just-finished",
  "book": {
    "name": "Circe",
    "author": "Madeline Miller",
    "image": "https://i.gr-assets.com/images/..."
  }
}
```

When neither is available, it returns:

```json
{
  "status": null,
  "book": null
}
```
