import { Router } from 'express';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

const GOODREADS_UPDATES_RSS_URL = 'https://www.goodreads.com/user/updates_rss/176655250';
const GOODREADS_USER_AGENT = 'api.steven.codes/1.0 (+https://api.steven.codes)';

const xmlParser = new XMLParser({
  attributeNamePrefix: '@_',
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true
});

function goodreadsError(message, options) {
  const error = new Error(message, options);
  error.statusCode = 502;
  return error;
}

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function findNode(node, predicate) {
  if (Array.isArray(node)) {
    for (const child of node) {
      const result = findNode(child, predicate);
      if (result) return result;
    }

    return null;
  }

  if (!node || typeof node !== 'object') {
    return null;
  }

  if (predicate(node)) {
    return node;
  }

  for (const child of Object.values(node)) {
    const result = findNode(child, predicate);
    if (result) return result;
  }

  return null;
}

function hasClass(node, className) {
  return node['@_class']?.split(/\s+/).includes(className) ?? false;
}

function textContent(node) {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(textContent).join('');
  if (!node || typeof node !== 'object') return '';

  return Object.entries(node)
    .filter(([key]) => !key.startsWith('@_'))
    .map(([_key, value]) => textContent(value))
    .join('');
}

function parseBook(item, eventName) {
  const description = item.description;

  if (typeof description !== 'string') {
    throw goodreadsError(`Goodreads ${eventName} item is missing its description`);
  }

  const fragment = xmlParser.parse(`<root>${description}</root>`).root;
  const bookNode = findNode(fragment, (node) => hasClass(node, 'bookTitle'));
  const authorNode = findNode(fragment, (node) => hasClass(node, 'authorName'));
  const imageNode = findNode(fragment, (node) => typeof node['@_src'] === 'string');

  const name = textContent(bookNode).trim();
  const author = textContent(authorNode).trim();
  const imageSource = imageNode?.['@_src'];

  if (!name || !author || !imageSource) {
    throw goodreadsError(`Goodreads ${eventName} item is missing required book details`);
  }

  return {
    name,
    author,
    image: new URL(imageSource, GOODREADS_UPDATES_RSS_URL).href
  };
}

export function parseReadingFeed(xml) {
  const validationResult = XMLValidator.validate(xml);

  if (validationResult !== true) {
    throw goodreadsError('Goodreads RSS feed contains invalid XML');
  }

  let feed;

  try {
    feed = xmlParser.parse(xml);
  } catch (cause) {
    throw goodreadsError('Goodreads RSS feed could not be parsed', { cause });
  }

  const items = asArray(feed?.rss?.channel?.item);
  const currentlyReadingItem = items.find((item) =>
    item.title?.startsWith('Steven Traversi started reading ')
  );

  if (currentlyReadingItem) {
    return {
      status: 'currently-reading',
      book: parseBook(currentlyReadingItem, 'started-reading')
    };
  }

  const justFinishedItem = items.find((item) =>
    item.title?.startsWith('Steven Traversi finished reading ')
  );

  if (justFinishedItem) {
    return {
      status: 'just-finished',
      book: parseBook(justFinishedItem, 'finished-reading')
    };
  }

  return {
    status: null,
    book: null
  };
}

async function getReadingStatus() {
  let response;

  try {
    response = await fetch(GOODREADS_UPDATES_RSS_URL, {
      headers: {
        Accept: 'application/rss+xml, application/xml',
        'User-Agent': GOODREADS_USER_AGENT
      }
    });
  } catch (cause) {
    throw goodreadsError('Goodreads RSS feed request failed', { cause });
  }

  if (!response.ok) {
    throw goodreadsError(`Goodreads RSS feed request failed with ${response.status}`);
  }

  let xml;

  try {
    xml = await response.text();
  } catch (cause) {
    throw goodreadsError('Goodreads RSS feed response could not be read', { cause });
  }

  return parseReadingFeed(xml);
}

const currentlyReadingRouter = Router();

currentlyReadingRouter.get('/', async (_request, response, next) => {
  try {
    const result = await getReadingStatus();
    response.json(result);
  } catch (error) {
    next(error);
  }
});

export default currentlyReadingRouter;
