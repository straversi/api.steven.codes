# api.steven.codes

Simple Express server for your currently playing Spotify track, with a fallback
to your most recently played track.

## Setup

Requires Node 24.

```sh
npm install
cp .env.example .env
```

Fill in `.env` with a Spotify app client ID, client secret, and a refresh token
that has these scopes:

```text
user-read-currently-playing user-read-recently-played
```

## Run

```sh
npm start
```

## Deploy

This repo includes a Render Blueprint in `render.yaml` for a free web service.

1. Push the repo to GitHub.
2. In Render, create a new Blueprint from the repo.
3. Enter the requested secret environment variables:
   `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and `SPOTIFY_REFRESH_TOKEN`.
4. Deploy the service.
5. In your DNS provider, add a CNAME record:

```text
Name: api
Value: api-steven-codes.onrender.com
```

Use the exact `onrender.com` hostname Render assigns if it differs.

## Endpoint

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

This endpoint reads the public Goodreads updates RSS feed. A “started reading”
item is treated as currently reading. Its response is not cached.

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

When there is no “started reading” item, the endpoint falls back to the first
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
