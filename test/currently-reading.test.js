import assert from 'node:assert/strict';
import test from 'node:test';

import { parseReadingFeed } from '../src/routes/currently-reading.js';

function rss(items) {
  return `<?xml version="1.0"?><rss><channel>${items}</channel></rss>`;
}

function item(title, { name = 'Circe', author = 'Madeline Miller', image = '/circe.jpg' } = {}) {
  return `
    <item>
      <title><![CDATA[${title}]]></title>
      <description><![CDATA[
        <a href="/book/circe"><img src="${image}" /></a>
        <a class="bookTitle" href="/book/circe">${name}</a>
        <span class="by">by</span>
        <a class="authorName" href="/author/madeline-miller">${author}</a>
      ]]></description>
    </item>
  `;
}

test('maps the first started-reading item to currently-reading', () => {
  const xml = rss(`
    ${item("Steven Traversi added 'Another Book'")}
    ${item("Steven Traversi started reading 'Circe'")}
    ${item("Steven Traversi started reading 'Older Book'", { name: 'Older Book' })}
  `);

  assert.deepEqual(parseReadingFeed(xml), {
    status: 'currently-reading',
    book: {
      name: 'Circe',
      author: 'Madeline Miller',
      image: 'https://www.goodreads.com/circe.jpg'
    }
  });
});

test('prefers started-reading over finished-reading', () => {
  const xml = rss(`
    ${item("Steven Traversi finished reading 'Finished Book'", { name: 'Finished Book' })}
    ${item("Steven Traversi started reading 'Current Book'", { name: 'Current Book' })}
  `);

  assert.equal(parseReadingFeed(xml).status, 'currently-reading');
  assert.equal(parseReadingFeed(xml).book.name, 'Current Book');
});

test('falls back to the first finished-reading item', () => {
  const xml = rss(`
    ${item("Steven Traversi added 'Another Book'")}
    ${item("Steven Traversi finished reading 'Finished Book'", {
      name: 'Finished Book',
      author: 'Finished Author',
      image: 'https://images.example/finished.jpg'
    })}
  `);

  assert.deepEqual(parseReadingFeed(xml), {
    status: 'just-finished',
    book: {
      name: 'Finished Book',
      author: 'Finished Author',
      image: 'https://images.example/finished.jpg'
    }
  });
});

test('returns an empty result when there are no relevant events', () => {
  assert.deepEqual(parseReadingFeed(rss(item("Steven Traversi added 'Circe'"))), {
    status: null,
    book: null
  });
});

test('rejects relevant items with missing book details', () => {
  const xml = rss(`
    <item>
      <title><![CDATA[Steven Traversi started reading 'Incomplete Book']]></title>
      <description><![CDATA[<a class="bookTitle">Incomplete Book</a>]]></description>
    </item>
  `);

  assert.throws(
    () => parseReadingFeed(xml),
    (error) => error.statusCode === 502 && /missing required book details/.test(error.message)
  );
});

test('rejects invalid XML', () => {
  assert.throws(
    () => parseReadingFeed('<rss>'),
    (error) => error.statusCode === 502 && /invalid XML/.test(error.message)
  );
});
