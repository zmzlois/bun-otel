/**
 * Database helper functions
 */

/**
 * Simulate a database query
 */
export async function simulateDatabaseQuery(query: string) {
  // Simulate query time
  await Bun.sleep(Math.random() * 100 + 50);

  const rowCount = Math.floor(Math.random() * 10) + 1;
  return { rows: rowCount, data: `Result for: ${query}` };
}
