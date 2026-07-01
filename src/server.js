import 'dotenv/config';
import express from 'express';

const app = express();

const {
  HOST = '0.0.0.0',
  PORT = 3000,
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REFRESH_TOKEN
} = process.env;

const CURRENTLY_PLAYING_CACHE_TTL_MS = 10_000;

let cachedCurrentlyPlayingResponse = null;
let cachedCurrentlyPlayingExpiresAt = 0;
let pendingCurrentlyPlayingRequest = null;

function requiredSpotifyConfig() {
  const missing = [];

  if (!SPOTIFY_CLIENT_ID) missing.push('SPOTIFY_CLIENT_ID');
  if (!SPOTIFY_CLIENT_SECRET) missing.push('SPOTIFY_CLIENT_SECRET');
  if (!SPOTIFY_REFRESH_TOKEN) missing.push('SPOTIFY_REFRESH_TOKEN');

  return missing;
}

async function getSpotifyAccessToken() {
  const missing = requiredSpotifyConfig();

  if (missing.length > 0) {
    const error = new Error(`Missing Spotify configuration: ${missing.join(', ')}`);
    error.statusCode = 500;
    throw error;
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: SPOTIFY_REFRESH_TOKEN
  });

  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!response.ok) {
    const details = await response.text();
    const error = new Error(`Spotify token request failed with ${response.status}: ${details}`);
    error.statusCode = 502;
    throw error;
  }

  const data = await response.json();
  return data.access_token;
}

function formatTrack(track) {
  if (!track) {
    return null;
  }

  const image = track.album?.images?.[0]?.url ?? null;

  return {
    name: track.name,
    artist: track.artists?.map((artist) => artist.name).join(', ') ?? null,
    albumArtwork: image
  };
}

async function getCurrentlyPlaying() {
  const accessToken = await getSpotifyAccessToken();
  const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    const details = await response.text();
    const error = new Error(`Spotify currently-playing request failed with ${response.status}: ${details}`);
    error.statusCode = 502;
    throw error;
  }

  const data = await response.json();

  if (!data?.item) {
    return null;
  }

  return formatTrack(data.item);
}

async function getRecentlyPlayed() {
  const accessToken = await getSpotifyAccessToken();
  const response = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=1', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const details = await response.text();
    const error = new Error(`Spotify recently-played request failed with ${response.status}: ${details}`);
    error.statusCode = 502;
    throw error;
  }

  const data = await response.json();
  const playHistory = data?.items?.[0];

  if (!playHistory?.track) {
    return null;
  }

  return formatTrack(playHistory.track);
}

async function buildCurrentlyPlayingResponse() {
  const track = await getCurrentlyPlaying();

  if (track) {
    return {
      isPlaying: true,
      source: 'currently-playing',
      track
    };
  }

  const recentlyPlayedTrack = await getRecentlyPlayed();

  return {
    isPlaying: false,
    source: recentlyPlayedTrack ? 'recently-played' : null,
    track: recentlyPlayedTrack
  };
}

async function getCachedCurrentlyPlayingResponse() {
  const now = Date.now();

  if (cachedCurrentlyPlayingResponse && now < cachedCurrentlyPlayingExpiresAt) {
    return cachedCurrentlyPlayingResponse;
  }

  if (!pendingCurrentlyPlayingRequest) {
    pendingCurrentlyPlayingRequest = buildCurrentlyPlayingResponse()
      .then((result) => {
        cachedCurrentlyPlayingResponse = result;
        cachedCurrentlyPlayingExpiresAt = Date.now() + CURRENTLY_PLAYING_CACHE_TTL_MS;
        return result;
      })
      .finally(() => {
        pendingCurrentlyPlayingRequest = null;
      });
  }

  return pendingCurrentlyPlayingRequest;
}

app.get('/healthz', (_request, response) => {
  response.json({ ok: true });
});

app.get('/currently-playing', async (_request, response, next) => {
  try {
    const result = await getCachedCurrentlyPlayingResponse();
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  const statusCode = error.statusCode ?? 500;

  response.status(statusCode).json({
    error: error.message
  });
});

app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
