/**
 * @typedef {Object} HealthResponse
 * @property {'ok'|'degraded'} status
 * @property {boolean} database
 */

/**
 * @typedef {Object} Citation
 * @property {string} [title]
 * @property {string} [url]
 * @property {string} [source]
 */

/**
 * @typedef {Object} AskResponse
 * @property {string} answer
 * @property {boolean} refused
 * @property {string|null} refusal_reason
 * @property {Citation[]} citations
 * @property {Object[]} tool_outputs
 * @property {string[]} warnings
 * @property {number} token_usage
 * @property {string} correlation_id
 * @property {number} latency_ms
 */
