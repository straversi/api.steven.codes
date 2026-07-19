import assert from 'node:assert/strict';
import test from 'node:test';

import { createApp } from '../src/app.js';

async function startApp(options = {}) {
  const server = createApp(options).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    })
  };
}

test('serves the app and a random city without population data', async (t) => {
  const server = await startApp({ random: () => 0 });
  t.after(server.close);

  const pageResponse = await fetch(`${server.baseUrl}/city-facts`);
  assert.equal(pageResponse.status, 200);
  const page = await pageResponse.text();
  assert.match(page, /Contribute to City Guesser/);
  assert.match(page, /href="https:\/\/steven\.codes\/city-guesser\/">City Guesser<\/a>/);
  assert.match(page, /Add as many as you like!/);
  assert.match(page, /id="city-search-link"/);
  assert.match(page, /https:\/\/duckduckgo\.com/);
  assert.match(page, /target="_blank"/);
  assert.match(page, /id="open-city-search"/);
  assert.match(page, /id="open-city-search" class="primary"/);
  assert.match(page, />Random<\/button>/);
  assert.match(page, />Search cities<\/button>/);
  assert.match(page, /What's something neat about this city\?/);
  assert.match(page, /id="fact" name="fact" rows="4"/);
  assert.match(page, /Related wikipedia article/);
  assert.equal((page.match(/class="required-marker"/g) ?? []).length, 3);
  assert.match(page, /id="submit-fact" class="primary" type="submit">Submit<\/button>/);
  assert.match(page, /Contributing as <span id="contributor-name"><\/span>/);
  assert.ok(page.indexOf('id="form-status"') < page.indexOf('id="contributor-status"'));
  assert.match(page, /id="change-name" class="link-button" type="button">Change<\/button>/);
  assert.match(page, /id="open-leaderboard"/);
  assert.match(page, /id="leaderboard-dialog"/);
  assert.match(page, /id="city-search-dialog"/);

  const stylesResponse = await fetch(`${server.baseUrl}/city-facts/styles.css`);
  const styles = await stylesResponse.text();
  assert.match(styles, /--bg: #101113/);
  assert.match(styles, /--accent: #e8c468/);

  const cityResponse = await fetch(`${server.baseUrl}/city-facts/api/cities/random`);
  const body = await cityResponse.json();
  assert.equal(cityResponse.status, 200);
  assert.equal(body.city.name, 'Dubai');
  assert.equal('population' in body.city, false);
});

test('searches all cities by city or country', async (t) => {
  const server = await startApp();
  t.after(server.close);

  const cityResponse = await fetch(`${server.baseUrl}/city-facts/api/cities/search?q=Andorra%20la%20Vella`);
  const cityBody = await cityResponse.json();
  assert.ok(cityBody.cities.some((city) => city.id === 3041563));

  const countryResponse = await fetch(`${server.baseUrl}/city-facts/api/cities/search?q=Andorra`);
  const countryBody = await countryResponse.json();
  assert.ok(countryBody.cities.some((city) => city.countryName === 'Andorra'));
  assert.equal(typeof countryBody.cities[0].population, 'number');
  assert.ok(countryBody.cities.every((city, index, allCities) =>
    index === 0 || allCities[index - 1].population >= city.population
  ));
});

test('accepts a valid fact and rejects invalid submissions', async (t) => {
  const inserted = [];
  const server = await startApp({
    factRepository: {
      insert: async (fact) => inserted.push(fact),
      getLeaderboard: async () => Array.from({ length: 12 }, (_value, index) => ({
        name: `Contributor ${index + 1}`,
        factCount: 12 - index
      }))
    }
  });
  t.after(server.close);

  const validResponse = await fetch(`${server.baseUrl}/city-facts/api/facts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cityId: 3041563,
      name: ' Ada ',
      fact: ' It is one of the highest capital cities in Europe. ',
      wikipediaUrl: 'https://en.wikipedia.org/wiki/Andorra_la_Vella'
    })
  });

  assert.equal(validResponse.status, 201);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].name, 'Ada');
  assert.equal(inserted[0].cityId, 3041563);

  const leaderboardResponse = await fetch(`${server.baseUrl}/city-facts/api/facts/leaderboard`);
  const leaderboardBody = await leaderboardResponse.json();
  assert.equal(leaderboardResponse.status, 200);
  assert.equal(leaderboardBody.contributors.length, 10);
  assert.deepEqual(leaderboardBody.contributors[0], {
    name: 'Contributor 1',
    factCount: 12
  });

  const invalidResponse = await fetch(`${server.baseUrl}/city-facts/api/facts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cityId: -1,
      name: '',
      fact: '',
      wikipediaUrl: 'https://fr.wikipedia.org/wiki/Paris'
    })
  });
  const invalidBody = await invalidResponse.json();

  assert.equal(invalidResponse.status, 400);
  assert.deepEqual(Object.keys(invalidBody.fields).sort(), [
    'cityId',
    'fact',
    'name',
    'wikipediaUrl'
  ]);

  const oversizedResponse = await fetch(`${server.baseUrl}/city-facts/api/facts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cityId: 3041563,
      name: 'Ada',
      fact: 'x'.repeat(1001),
      wikipediaUrl: 'https://en.wikipedia.org/wiki/Andorra_la_Vella'
    })
  });
  const oversizedBody = await oversizedResponse.json();

  assert.equal(oversizedResponse.status, 400);
  assert.equal(typeof oversizedBody.fields.fact, 'string');
});
