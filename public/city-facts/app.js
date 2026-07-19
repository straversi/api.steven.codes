const API_PATH = '/city-facts/api';
const NAME_STORAGE_KEY = 'city-facts-name';
const populationFormatter = new Intl.NumberFormat();

const selectedCountry = document.querySelector('#selected-country');
const citySearchLink = document.querySelector('#city-search-link');
const randomCityButton = document.querySelector('#random-city');
const openCitySearchButton = document.querySelector('#open-city-search');
const citySearchDialog = document.querySelector('#city-search-dialog');
const closeCitySearchButton = document.querySelector('#close-city-search');
const searchInput = document.querySelector('#city-search');
const searchStatus = document.querySelector('#search-status');
const searchResults = document.querySelector('#search-results');
const factForm = document.querySelector('#fact-form');
const factInput = document.querySelector('#fact');
const factCount = document.querySelector('#fact-count');
const factError = document.querySelector('#fact-error');
const wikipediaInput = document.querySelector('#wikipedia-url');
const wikipediaError = document.querySelector('#wikipedia-error');
const submitButton = document.querySelector('#submit-fact');
const contributorStatus = document.querySelector('#contributor-status');
const contributorName = document.querySelector('#contributor-name');
const changeNameButton = document.querySelector('#change-name');
const openLeaderboardButton = document.querySelector('#open-leaderboard');
const leaderboardDialog = document.querySelector('#leaderboard-dialog');
const closeLeaderboardButton = document.querySelector('#close-leaderboard');
const leaderboardStatus = document.querySelector('#leaderboard-status');
const leaderboardList = document.querySelector('#leaderboard-list');
const formStatus = document.querySelector('#form-status');
const nameDialog = document.querySelector('#name-dialog');
const nameForm = document.querySelector('#name-form');
const nameInput = document.querySelector('#visitor-name');
const nameError = document.querySelector('#name-error');
const cancelNameButton = document.querySelector('#cancel-name');

let selectedCity = null;
let searchTimer = null;
let searchRequest = null;
let pendingSubmission = false;

function setSelectedCity(city) {
  selectedCity = city;
  citySearchLink.textContent = city.name;
  selectedCountry.textContent = city.countryName;
  citySearchLink.href = `https://duckduckgo.com/?q=${encodeURIComponent(
    `${city.name}, ${city.countryName}`
  )}`;
  searchInput.value = '';
  searchStatus.textContent = '';
  searchResults.replaceChildren();
  formStatus.textContent = '';

  if (citySearchDialog.open) {
    citySearchDialog.close();
  }
}

async function readJson(response) {
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error || 'Something went wrong.');
    error.fields = data.fields;
    throw error;
  }

  return data;
}

async function chooseRandomCity() {
  randomCityButton.disabled = true;
  formStatus.textContent = '';

  try {
    const exclude = selectedCity ? `?exclude=${selectedCity.id}` : '';
    const response = await fetch(`${API_PATH}/cities/random${exclude}`);
    const data = await readJson(response);
    setSelectedCity(data.city);
  } catch (error) {
    formStatus.textContent = error.message;
  } finally {
    randomCityButton.disabled = false;
  }
}

function resultButton(city) {
  const item = document.createElement('li');
  const button = document.createElement('button');
  const detail = document.createElement('span');

  button.type = 'button';
  button.textContent = `${city.name} — ${city.countryName}`;
  detail.className = 'result-detail';
  detail.textContent = `Population: ${populationFormatter.format(city.population)}`;
  button.append(detail);
  button.addEventListener('click', () => setSelectedCity(city));
  item.append(button);
  return item;
}

async function searchCities(query) {
  searchRequest?.abort();
  searchRequest = new AbortController();
  searchStatus.textContent = 'Searching…';

  try {
    const response = await fetch(`${API_PATH}/cities/search?q=${encodeURIComponent(query)}`, {
      signal: searchRequest.signal
    });
    const data = await readJson(response);
    searchResults.replaceChildren(...data.cities.map(resultButton));
    searchStatus.textContent = data.cities.length === 0 ? 'No cities found.' : '';
  } catch (error) {
    if (error.name !== 'AbortError') {
      searchStatus.textContent = error.message;
      searchResults.replaceChildren();
    }
  }
}

function getSavedName() {
  try {
    const value = localStorage.getItem(NAME_STORAGE_KEY)?.trim() ?? '';
    return value && value.length < 32 ? value : null;
  } catch {
    return null;
  }
}

function saveName(name) {
  try {
    localStorage.setItem(NAME_STORAGE_KEY, name);
  } catch {
    // Submission still works when storage is unavailable.
  }

  renderContributor();
}

function renderContributor() {
  const name = getSavedName();

  if (!name) {
    contributorStatus.hidden = true;
    contributorName.textContent = '';
    return;
  }

  contributorName.textContent = name;
  contributorStatus.hidden = false;
}

function leaderboardItem(contributor) {
  const item = document.createElement('li');
  const name = document.createElement('span');
  const count = document.createElement('span');

  name.className = 'leaderboard-name';
  name.textContent = contributor.name;
  count.className = 'leaderboard-count';
  count.textContent = `${contributor.factCount} ${contributor.factCount === 1 ? 'fact' : 'facts'}`;
  item.append(name, count);
  return item;
}

async function showLeaderboard() {
  leaderboardList.replaceChildren();
  leaderboardStatus.textContent = 'Loading…';
  leaderboardDialog.showModal();

  try {
    const response = await fetch(`${API_PATH}/facts/leaderboard`);
    const data = await readJson(response);
    leaderboardList.replaceChildren(...data.contributors.map(leaderboardItem));
    leaderboardStatus.textContent = data.contributors.length === 0
      ? 'No contributors yet.'
      : '';
  } catch (error) {
    leaderboardStatus.textContent = error.message;
  }
}

function isWikipediaArticle(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) &&
      url.hostname === 'en.wikipedia.org' &&
      !url.port &&
      !url.username &&
      !url.password &&
      url.pathname.startsWith('/wiki/') &&
      url.pathname.length > '/wiki/'.length;
  } catch {
    return false;
  }
}

function validateFactForm() {
  factError.textContent = '';
  wikipediaError.textContent = '';
  formStatus.textContent = '';
  wikipediaInput.setCustomValidity('');

  if (!factInput.value.trim()) {
    factInput.setCustomValidity('Enter a fun fact.');
  } else {
    factInput.setCustomValidity('');
  }

  if (wikipediaInput.value && !isWikipediaArticle(wikipediaInput.value.trim())) {
    wikipediaInput.setCustomValidity('Enter a link to an English Wikipedia article.');
  }

  const isValid = factForm.reportValidity();
  factError.textContent = factInput.validationMessage;
  wikipediaError.textContent = wikipediaInput.validationMessage;

  if (!selectedCity) {
    formStatus.textContent = 'Wait for a city to be selected.';
    return false;
  }

  return isValid;
}

async function submitFact(name) {
  submitButton.disabled = true;
  formStatus.textContent = 'Submitting…';

  try {
    const response = await fetch(`${API_PATH}/facts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cityId: selectedCity.id,
        name,
        fact: factInput.value,
        wikipediaUrl: wikipediaInput.value
      })
    });
    const data = await readJson(response);

    if (data.ok) {
      factForm.reset();
      factCount.textContent = '0 / 1000';
      formStatus.textContent = `Thanks! Your fact about ${selectedCity.name} was submitted.`;
      factInput.focus();
    }
  } catch (error) {
    factError.textContent = error.fields?.fact ?? '';
    wikipediaError.textContent = error.fields?.wikipediaUrl ?? '';
    formStatus.textContent = error.message;

    if (error.fields?.name) {
      pendingSubmission = true;
      nameError.textContent = error.fields.name;
      nameDialog.showModal();
    }
  } finally {
    submitButton.disabled = false;
  }
}

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const query = searchInput.value.trim();

  if (!query) {
    searchRequest?.abort();
    searchResults.replaceChildren();
    searchStatus.textContent = '';
    return;
  }

  searchTimer = setTimeout(() => searchCities(query), 200);
});

openCitySearchButton.addEventListener('click', () => {
  searchInput.value = '';
  searchStatus.textContent = '';
  searchResults.replaceChildren();
  citySearchDialog.showModal();
  searchInput.focus();
});

closeCitySearchButton.addEventListener('click', () => {
  citySearchDialog.close();
});

citySearchDialog.addEventListener('close', () => {
  clearTimeout(searchTimer);
  searchRequest?.abort();
});

citySearchDialog.addEventListener('click', (event) => {
  if (event.target === citySearchDialog) {
    citySearchDialog.close();
  }
});

factInput.addEventListener('input', () => {
  factInput.setCustomValidity('');
  factError.textContent = '';
  factCount.textContent = `${factInput.value.length} / 1000`;
});

wikipediaInput.addEventListener('input', () => {
  wikipediaInput.setCustomValidity('');
  wikipediaError.textContent = '';
});

factForm.addEventListener('submit', (event) => {
  event.preventDefault();

  if (!validateFactForm()) {
    return;
  }

  const name = getSavedName();

  if (name) {
    submitFact(name);
    return;
  }

  pendingSubmission = true;
  nameError.textContent = '';
  nameInput.value = '';
  nameDialog.showModal();
  nameInput.focus();
});

nameForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();

  if (!name || name.length >= 32) {
    nameError.textContent = 'Enter a name shorter than 32 characters.';
    nameInput.focus();
    return;
  }

  saveName(name);
  nameDialog.close();
  nameError.textContent = '';

  if (pendingSubmission) {
    pendingSubmission = false;
    submitFact(name);
  }
});

cancelNameButton.addEventListener('click', () => {
  pendingSubmission = false;
  nameDialog.close();
});

changeNameButton.addEventListener('click', () => {
  pendingSubmission = false;
  nameError.textContent = '';
  nameInput.value = getSavedName() ?? '';
  nameDialog.showModal();
  nameInput.focus();
  nameInput.select();
});

openLeaderboardButton.addEventListener('click', showLeaderboard);

closeLeaderboardButton.addEventListener('click', () => {
  leaderboardDialog.close();
});

leaderboardDialog.addEventListener('click', (event) => {
  if (event.target === leaderboardDialog) {
    leaderboardDialog.close();
  }
});

nameDialog.addEventListener('cancel', () => {
  pendingSubmission = false;
});

randomCityButton.addEventListener('click', chooseRandomCity);
renderContributor();
chooseRandomCity();
