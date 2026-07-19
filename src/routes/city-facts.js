import { readFileSync } from 'node:fs';
import express, { Router } from 'express';

const cities = JSON.parse(
  readFileSync(new URL('../../data/cities.json', import.meta.url), 'utf8')
);
const citiesById = new Map(cities.map((city) => [city.id, city]));
const randomCities = cities.filter((city) => city.population > 1_000_000);

function publicCity(city) {
  return {
    id: city.id,
    name: city.name,
    countryName: city.countryName,
    countryCode: city.country,
    lat: city.lat,
    lng: city.lng
  };
}

function searchableCity(city) {
  return {
    ...publicCity(city),
    population: city.population
  };
}

function badRequest(message, fields) {
  const error = new Error(message);
  error.statusCode = 400;
  error.fields = fields;
  return error;
}

function validateWikipediaUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const isHttp = url.protocol === 'https:' || url.protocol === 'http:';
  const isEnglishWikipedia = url.hostname === 'en.wikipedia.org';
  const isArticle = url.pathname.startsWith('/wiki/') && url.pathname.length > '/wiki/'.length;
  const hasStandardAuthority = !url.port && !url.username && !url.password;

  return isHttp && isEnglishWikipedia && isArticle && hasStandardAuthority ? url.href : null;
}

function validateFact(body) {
  const fields = {};
  const cityId = body?.cityId;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const fact = typeof body?.fact === 'string' ? body.fact.trim() : '';
  const wikipediaUrl = typeof body?.wikipediaUrl === 'string'
    ? validateWikipediaUrl(body.wikipediaUrl.trim())
    : null;

  if (!Number.isInteger(cityId) || !citiesById.has(cityId)) {
    fields.cityId = 'Select a valid city.';
  }

  if (!name || name.length >= 32) {
    fields.name = 'Enter a name shorter than 32 characters.';
  }

  if (!fact || fact.length > 1_000) {
    fields.fact = 'Enter a fact between 1 and 1000 characters.';
  }

  if (!wikipediaUrl) {
    fields.wikipediaUrl = 'Enter a link to an English Wikipedia article.';
  }

  if (Object.keys(fields).length > 0) {
    throw badRequest('Please correct the highlighted fields.', fields);
  }

  return { cityId, name, fact, wikipediaUrl };
}

export function createCityFactsRouter({ factRepository, random = Math.random } = {}) {
  const router = Router();

  router.get('/cities/random', (request, response, next) => {
    try {
      const excludeValue = request.query.exclude;
      const excludeId = excludeValue == null ? null : Number(excludeValue);

      if (excludeValue != null && !Number.isInteger(excludeId)) {
        throw badRequest('The excluded city ID must be an integer.');
      }

      const choices = excludeId == null
        ? randomCities
        : randomCities.filter((city) => city.id !== excludeId);
      const city = choices[Math.floor(random() * choices.length)];

      response.json({ city: publicCity(city) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/cities/search', (request, response, next) => {
    try {
      const query = typeof request.query.q === 'string' ? request.query.q.trim() : '';

      if (query.length > 100) {
        throw badRequest('Search queries must be 100 characters or fewer.');
      }

      if (!query) {
        response.json({ cities: [] });
        return;
      }

      const normalizedQuery = query.toLocaleLowerCase();
      const matches = cities
        .filter((city) =>
          city.name.toLocaleLowerCase().includes(normalizedQuery) ||
          city.countryName.toLocaleLowerCase().includes(normalizedQuery) ||
          city.country.toLocaleLowerCase().includes(normalizedQuery)
        )
        .sort((left, right) => right.population - left.population ||
          left.name.localeCompare(right.name) ||
          left.countryName.localeCompare(right.countryName))
        .slice(0, 20)
        .map(searchableCity);

      response.json({ cities: matches });
    } catch (error) {
      next(error);
    }
  });

  router.get('/facts/leaderboard', async (_request, response, next) => {
    try {
      if (!factRepository) {
        const error = new Error('Fact storage is unavailable');
        error.statusCode = 503;
        throw error;
      }

      const contributors = await factRepository.getLeaderboard();
      response.json({ contributors: contributors.slice(0, 10) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/facts', express.json({ limit: '16kb' }), async (request, response, next) => {
    try {
      if (!factRepository) {
        const error = new Error('Fact storage is unavailable');
        error.statusCode = 503;
        throw error;
      }

      const fact = validateFact(request.body);
      await factRepository.insert(fact);
      response.status(201).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
