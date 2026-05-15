const { fetchIssueText } = require('../github/fetcher');

const DOMAIN_KEYWORDS = {
  auth:     ['login', 'logout', 'auth', 'authentication', 'password', 'token', 'session', 'oauth', 'jwt', 'register', 'signup'],
  payment:  ['payment', 'billing', 'invoice', 'charge', 'stripe', 'subscription', 'price', 'checkout', 'refund', 'transaction'],
  database: ['database', 'migration', 'schema', 'query', 'index', 'sql', 'table', 'column', 'seed', 'orm'],
  user:     ['user', 'profile', 'account', 'avatar', 'settings', 'preference', 'role', 'permission', 'admin'],
  ui:       ['component', 'button', 'form', 'modal', 'page', 'layout', 'style', 'css', 'design', 'responsive'],
};

function detectDomain(text) {
  const lower = text.toLowerCase();
  const scores = {};
  for (const [domain, words] of Object.entries(DOMAIN_KEYWORDS)) {
    scores[domain] = words.filter(w => lower.includes(w)).length;
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : null;
}

async function validateIntent(ticketUrl, changedFiles, issueTextFetcher = fetchIssueText) {
  if (!ticketUrl || !changedFiles || !changedFiles.length) {
    return { hasWarning: false, message: null };
  }

  const ticketText = await issueTextFetcher(ticketUrl);
  if (!ticketText || ticketText.trim().length < 10) {
    return { hasWarning: false, message: null };
  }

  const ticketDomain = detectDomain(ticketText);
  if (!ticketDomain) return { hasWarning: false, message: null };

  const fileText   = changedFiles.join(' ').toLowerCase();
  const fileDomain = detectDomain(fileText);

  if (fileDomain && fileDomain !== ticketDomain) {
    const topFiles = changedFiles.slice(0, 3).join(', ');
    return {
      hasWarning: true,
      message: `Ticket intent mismatch — ticket is about "${ticketDomain}" but changed files suggest "${fileDomain}" (${topFiles}). Possible scope drift or wrong branch.`,
    };
  }

  return { hasWarning: false, message: null };
}

module.exports = { validateIntent, detectDomain };
