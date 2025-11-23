/**
 * External API helper functions
 */

/**
 * Simulate an external API call
 */
export async function callExternalAPI(endpoint: string) {
  try {
    const response = await fetch(endpoint);
    return response;
  } catch (error) {
    console.error("External API call failed:", error);
    throw error;
  }
}
