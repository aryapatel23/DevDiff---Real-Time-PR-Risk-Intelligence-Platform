/**
 * cascade/index.js — CascadeFlow module exports
 *
 * Clean API for the cascade routing system.
 */

const { routeReview, calculateQuality } = require('./llmRouter');
const auditTrail = require('./auditTrail');
const config = require('./cascadeConfig');

module.exports = {
  routeReview,
  calculateQuality,
  auditTrail,
  config,
};
