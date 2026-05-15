const { queries } = require('../db/queries');

async function getAuthorPatterns(author) {
  if (!author || author === 'unknown') return [];
  try {
    return await queries.getAuthorPatterns({ author });
  } catch {
    return [];
  }
}

async function updatePatterns(author, findings) {
  if (!author || author === 'unknown' || !findings || !findings.length) return;
  for (const f of findings) {
    try {
      await queries.upsertPattern({ author, rule_name: f.rule_name });
    } catch { /* non-critical */ }
  }
}

/**
 * Returns Set of rule names auto-escalated for this author.
 * A rule is escalated when the author has 3+ historical occurrences.
 */
function getEscalatedRules(patterns) {
  const escalated = new Set();
  for (const p of patterns) {
    if (p.count >= 3) escalated.add(p.rule_name);
  }
  return escalated;
}

module.exports = { getAuthorPatterns, updatePatterns, getEscalatedRules };
