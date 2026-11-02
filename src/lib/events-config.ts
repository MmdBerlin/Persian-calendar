/**
 * Where the app downloads occasion data from.
 *
 * Recommended (stable): a JSON file of your own repository, e.g. on GitHub:
 *   https://raw.githubusercontent.com/<user>/<repo>/main/src/data/events-{year}.json
 * `{year}` is replaced with the Persian year (1406, 1407, ...). The file is the same one that
 * scripts/update-events-from-timeir.mjs writes and the GitHub Action (.github/workflows/update-events.yml)
 * commits every month. Set it here or with the NEXT_PUBLIC_EVENTS_JSON_URL build variable.
 */
export const EVENTS_JSON_URL: string = process.env.NEXT_PUBLIC_EVENTS_JSON_URL || '';

/** Last resort: read the yearly page of Time.ir directly (its page structure is not guaranteed to stay the same). */
export const TIMEIR_PAGE_URL = 'https://www.time.ir/event-year';
