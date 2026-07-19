import pg from 'pg';

const { Pool } = pg;

export function createFactRepository(connectionString) {
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL configuration');
  }

  const pool = new Pool({ connectionString });

  return {
    async initialize() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS facts (
          id BIGSERIAL PRIMARY KEY,
          city_id BIGINT NOT NULL,
          author_name VARCHAR(31) NOT NULL,
          fact_text VARCHAR(1000) NOT NULL,
          wikipedia_url TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query('CREATE INDEX IF NOT EXISTS facts_city_id_idx ON facts (city_id)');
    },

    async insert({ cityId, name, fact, wikipediaUrl }) {
      await pool.query(
        `INSERT INTO facts (city_id, author_name, fact_text, wikipedia_url)
         VALUES ($1, $2, $3, $4)`,
        [cityId, name, fact, wikipediaUrl]
      );
    },

    async getLeaderboard() {
      const result = await pool.query(`
        SELECT author_name AS name, COUNT(*)::integer AS "factCount"
        FROM facts
        GROUP BY author_name
        ORDER BY COUNT(*) DESC, LOWER(author_name), author_name
        LIMIT 10
      `);

      return result.rows;
    },

    async close() {
      await pool.end();
    }
  };
}
