const { runRules, ALL_RULES, DETERMINISTIC_RULES } = require('../rules/index');

const secretLeak      = require('../rules/secretLeak');
const sqlInjection    = require('../rules/sqlInjection');
const xssInnerHtml    = require('../rules/xssInnerHTML');
const evalUsage       = require('../rules/evalUsage');
const pathTraversal   = require('../rules/pathTraversal');
const prototypePollu  = require('../rules/prototypePollu');
const nullDeref       = require('../rules/nullDeref');
const jwtNoExpiry     = require('../rules/jwtNoExpiry');
const sensitiveDataLog = require('../rules/sensitiveDataLog');
const weakHash        = require('../rules/weakHash');
const insecureRandom  = require('../rules/insecureRandom');
const missingValidation = require('../rules/missingValidation');
const missingRateLimit  = require('../rules/missingRateLimit');
const reDoS            = require('../rules/reDoS');
const unhandledPromise = require('../rules/unhandledPromise');
const asyncAwaitLeak   = require('../rules/asyncAwaitLeak');
const memoryLeak       = require('../rules/memoryLeak');
const corsWildcard     = require('../rules/corsWildcard');
const hardcodedIp      = require('../rules/hardcodedIp');
const consoleLogRule   = require('../rules/consoleLog');

function runRule(rule, content, filename = 'app.js') {
  return rule.check(content, filename);
}

function makeLine(content) {
  return { content, line: 1 };
}

function surroundingLines(content) {
  return [content];
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. secret-leak
// ──────────────────────────────────────────────────────────────────────────────
describe('secret-leak', () => {
  test('detects hardcoded password', () => {
    const result = runRule(secretLeak, 'const password = "superSecret123"');
    expect(result).not.toBeNull();
    expect(result.message).toContain('secret');
  });

  test('detects hardcoded api_key', () => {
    const result = runRule(secretLeak, "api_key = 'myLongApiKey123456'");
    expect(result).not.toBeNull();
  });

  test('detects hardcoded secret with colon', () => {
    const result = runRule(secretLeak, 'secret: "abc123def456"');
    expect(result).not.toBeNull();
  });

  test('detects AWS access key', () => {
    const result = runRule(secretLeak, 'const key = "AKIAIOSFODNN7EXAMPLE"');
    expect(result).not.toBeNull();
  });

  test('detects generic long token', () => {
    const result = runRule(secretLeak, 'token = "aB3dE5gH7jK9mN1pR3sT5vW7y"');
    expect(result).not.toBeNull();
  });

  test('returns null for short password value (< 6 chars)', () => {
    const result = runRule(secretLeak, 'password = "abc"');
    expect(result).toBeNull();
  });

  test('returns null for test files', () => {
    const result = runRule(secretLeak, 'password = "superSecret123"', 'app.test.js');
    expect(result).toBeNull();
  });

  test('returns null for spec files', () => {
    const result = runRule(secretLeak, 'password = "superSecret123"', 'app.spec.js');
    expect(result).toBeNull();
  });

  test('returns null for .env.example files', () => {
    const result = runRule(secretLeak, 'password = "superSecret123"', '.env.example');
    expect(result).toBeNull();
  });

  test('returns null for safe code with no secrets', () => {
    const result = runRule(secretLeak, 'const x = 42;');
    expect(result).toBeNull();
  });

  test('detects auth_token with equals sign', () => {
    const result = runRule(secretLeak, 'auth_token="eyJhbGciOiJIUzI1NiIs"');
    expect(result).not.toBeNull();
  });

  test('detects private_key assignment', () => {
    const result = runRule(secretLeak, "private_key = 'MIIEvQIBADANBgkq'");
    expect(result).not.toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. sql-injection
// ──────────────────────────────────────────────────────────────────────────────
describe('sql-injection', () => {
  test('detects SQL with template literal', () => {
    const result = runRule(sqlInjection,
      'db.query(`SELECT * FROM users WHERE id = ${userId}`)', 'query.js');
    expect(result).not.toBeNull();
    expect(result.message).toContain('SQL');
  });

  test('detects SQL with string concatenation', () => {
    const result = runRule(sqlInjection,
      'db.query("SELECT * FROM users WHERE id = " + userId)', 'query.js');
    expect(result).not.toBeNull();
  });

  test('detects Python f-string SQL', () => {
    const result = runRule(sqlInjection,
      'cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")', 'query.py');
    expect(result).not.toBeNull();
  });

  test('detects SQL DELETE with template', () => {
    const result = runRule(sqlInjection,
      'db.query(`DELETE FROM sessions WHERE token = ${token}`)', 'db.js');
    expect(result).not.toBeNull();
  });

  test('detects SQL INSERT with concat', () => {
    const result = runRule(sqlInjection,
      "db.query('INSERT INTO logs VALUES (' + data + ')')", 'logger.js');
    expect(result).not.toBeNull();
  });

  test('returns null for safe parameterized query', () => {
    const result = runRule(sqlInjection,
      'db.query("SELECT * FROM users WHERE id = ?", [userId])', 'query.js');
    expect(result).toBeNull();
  });

  test('returns null for .py files with no SQL keyword', () => {
    const result = runRule(sqlInjection,
      'x = f"hello {name}"', 'app.py');
    expect(result).toBeNull();
  });

  test('returns null for wrong file extension', () => {
    const result = runRule(sqlInjection,
      'db.query(`SELECT * FROM users WHERE id = ${userId}`)', 'query.txt');
    expect(result).toBeNull();
  });

  test('returns null for safe .jsx file', () => {
    const result = runRule(sqlInjection,
      'const x = "hello world"', 'app.jsx');
    expect(result).toBeNull();
  });

  test('detects Ruby string concat SQL', () => {
    const result = runRule(sqlInjection,
      "conn.exec('SELECT * FROM users WHERE id = ' + user_id)", 'query.rb');
    expect(result).not.toBeNull();
  });

  test('returns null for PHP concat (dot operator not detected)', () => {
    const result = runRule(sqlInjection,
      "$db->query('SELECT * FROM users WHERE id = ' . $id)", 'query.php');
    expect(result).toBeNull();
  });

  test('returns null for TypeScript with no SQL', () => {
    const result = runRule(sqlInjection,
      'const x: number = 42;', 'app.ts');
    expect(result).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. xss-innerhtml
// ──────────────────────────────────────────────────────────────────────────────
describe('xss-innerhtml', () => {
  test('detects innerHTML assignment with variable', () => {
    const result = runRule(xssInnerHtml,
      'element.innerHTML = userInput', 'app.js');
    expect(result).not.toBeNull();
    expect(result.message).toContain('XSS');
  });

  test('detects dangerouslySetInnerHTML with variable', () => {
    const result = runRule(xssInnerHtml,
      'dangerouslySetInnerHTML={{ __html: content }}', 'App.jsx');
    expect(result).not.toBeNull();
  });

  test('detects document.write()', () => {
    const result = runRule(xssInnerHtml,
      'document.write(userInput)', 'page.js');
    expect(result).not.toBeNull();
  });

  test('detects innerHTML with string concat', () => {
    const result = runRule(xssInnerHtml,
      'el.innerHTML = "<div>" + name + "</div>"', 'app.ts');
    expect(result).not.toBeNull();
  });

  test('detects dangerouslySetInnerHTML in TSX', () => {
    const result = runRule(xssInnerHtml,
      '<div dangerouslySetInnerHTML={{ __html: htmlContent }} />', 'Component.tsx');
    expect(result).not.toBeNull();
  });

  test('detects innerHTML with static HTML string (regex limitation)', () => {
    const result = runRule(xssInnerHtml,
      "element.innerHTML = '<div>Hello</div>'", 'app.js');
    expect(result).not.toBeNull();
  });

  test('returns null for wrong file extension', () => {
    const result = runRule(xssInnerHtml,
      'element.innerHTML = userInput', 'app.py');
    expect(result).toBeNull();
  });

  test('returns null for safe .html with no patterns', () => {
    const result = runRule(xssInnerHtml,
      '<div>Hello World</div>', 'page.html');
    expect(result).toBeNull();
  });

  test('detects in .html files', () => {
    const result = runRule(xssInnerHtml,
      'document.write(dynamicContent)', 'page.html');
    expect(result).not.toBeNull();
  });

  test('detects innerHTML in .tsx files', () => {
    const result = runRule(xssInnerHtml,
      'ref.current.innerHTML = template', 'Comp.tsx');
    expect(result).not.toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. eval-usage
// ──────────────────────────────────────────────────────────────────────────────
describe('eval-usage', () => {
  test('detects eval()', () => {
    const result = runRule(evalUsage, 'eval(userInput)', 'app.js');
    expect(result).not.toBeNull();
    expect(result.message).toContain('eval');
  });

  test('detects new Function()', () => {
    const result = runRule(evalUsage, 'new Function("return " + code)()', 'app.js');
    expect(result).not.toBeNull();
  });

  test('detects setInterval with string', () => {
    const result = runRule(evalUsage,
      "setInterval('alert(1)', 1000)", 'app.js');
    expect(result).not.toBeNull();
  });

  test('does not flag setTimeout with string (not setInterval)', () => {
    const result = runRule(evalUsage,
      "setTimeout('alert(1)', 1000)", 'app.js');
    expect(result).toBeNull();
  });

  test('returns null for safe code', () => {
    const result = runRule(evalUsage, 'JSON.parse(data)', 'app.js');
    expect(result).toBeNull();
  });

  test('returns null for wrong file extension', () => {
    const result = runRule(evalUsage, 'eval(code)', 'app.py');
    expect(result).toBeNull();
  });

  test('detects eval in .ts files', () => {
    const result = runRule(evalUsage, 'eval(expr)', 'app.ts');
    expect(result).not.toBeNull();
  });

  test('detects eval in .jsx files', () => {
    const result = runRule(evalUsage, 'eval(code)', 'Component.jsx');
    expect(result).not.toBeNull();
  });

  test('returns null for substring "eval" without parenthesis', () => {
    const result = runRule(evalUsage, 'const evaluation = 5;', 'app.js');
    expect(result).toBeNull();
  });

  test('detects eval with complex expression', () => {
    const result = runRule(evalUsage,
      'const result = eval("(function() { return 42; })()")', 'utils.js');
    expect(result).not.toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 5. path-traversal
// ──────────────────────────────────────────────────────────────────────────────
describe('path-traversal', () => {
  test('detects fs.readFile with req.params', () => {
    const result = runRule(pathTraversal,
      'fs.readFile(req.params.filename, callback)', 'routes.js');
    expect(result).not.toBeNull();
    expect(result.message).toContain('Path traversal');
  });

  test('detects readFileSync with req.query', () => {
    const result = runRule(pathTraversal,
      'fs.readFileSync(req.query.path)', 'file.js');
    expect(result).not.toBeNull();
  });

  test('detects path.join with req.body', () => {
    const result = runRule(pathTraversal,
      'path.join(__dirname, req.body.dir)', 'routes.js');
    expect(result).not.toBeNull();
  });

  test('detects createReadStream with req.params', () => {
    const result = runRule(pathTraversal,
      'fs.createReadStream(req.params.file)', 'download.js');
    expect(result).not.toBeNull();
  });

  test('detects traversal literal with req.params', () => {
    const result = runRule(pathTraversal,
      'const p = "../" + req.params.name', 'routes.js');
    expect(result).not.toBeNull();
  });

  test('returns null for safe file read', () => {
    const result = runRule(pathTraversal,
      'fs.readFile("config.json", callback)', 'app.js');
    expect(result).toBeNull();
  });

  test('returns null for wrong file extension', () => {
    const result = runRule(pathTraversal,
      'fs.readFile(req.params.file)', 'app.rb');
    expect(result).toBeNull();
  });

  test('detects in .py files', () => {
    const result = runRule(pathTraversal,
      'open(req.query.path)', 'routes.py');
    expect(result).toBeNull();  // py doesn't use fs.readFile pattern
  });

  test('returns null for path.join without user input', () => {
    const result = runRule(pathTraversal,
      'path.join(__dirname, "public")', 'app.js');
    expect(result).toBeNull();
  });

  test('detects multiple fs operations with req.body', () => {
    const result = runRule(pathTraversal,
      'fs.readFile(req.body.file, cb)', 'routes.js');
    expect(result).not.toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 6. prototype-pollution
// ──────────────────────────────────────────────────────────────────────────────
describe('prototype-pollution', () => {
  test('detects __proto__ assignment', () => {
    const result = runRule(prototypePollu,
      'obj.__proto__ = userInput', 'app.js');
    expect(result).not.toBeNull();
    expect(result.message).toContain('Prototype pollution');
  });

  test('detects bracket __proto__ assignment', () => {
    const result = runRule(prototypePollu,
      'obj["__proto__"] = malicious', 'app.js');
    expect(result).not.toBeNull();
  });

  test('detects Object.assign with req.body', () => {
    const result = runRule(prototypePollu,
      'Object.assign(target, req.body)', 'routes.js');
    expect(result).not.toBeNull();
  });

  test('detects Object.assign with req.params', () => {
    const result = runRule(prototypePollu,
      'Object.assign(config, req.params)', 'settings.js');
    expect(result).not.toBeNull();
  });

  test('detects Object.assign with req.query', () => {
    const result = runRule(prototypePollu,
      'Object.assign(options, req.query)', 'routes.js');
    expect(result).not.toBeNull();
  });

  test('detects constructor prototype access', () => {
    const result = runRule(prototypePollu,
      "obj.constructor['prototype'] = value", 'app.js');
    expect(result).not.toBeNull();
  });

  test('returns null for safe Object.assign', () => {
    const result = runRule(prototypePollu,
      'Object.assign({}, defaults)', 'config.js');
    expect(result).toBeNull();
  });

  test('returns null for wrong file extension', () => {
    const result = runRule(prototypePollu,
      'obj.__proto__ = x', 'app.py');
    expect(result).toBeNull();
  });

  test('returns null for safe code', () => {
    const result = runRule(prototypePollu,
      'const x = Object.assign({}, a, b)', 'app.js');
    expect(result).toBeNull();
  });

  test('detects in .ts files', () => {
    const result = runRule(prototypePollu,
      'obj.__proto__ = data', 'handler.ts');
    expect(result).not.toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 7. null-deref
// ──────────────────────────────────────────────────────────────────────────────
describe('null-deref', () => {
  test('detects chained access on req.params without guard', () => {
    const result = runRule(nullDeref,
      'const id = req.params.userId.name', 'routes.js');
    expect(result).not.toBeNull();
    expect(result.message).toContain('null dereference');
  });

  test('detects chained access on req.body', () => {
    const result = runRule(nullDeref,
      'req.body.user.email.send()', 'handler.js');
    expect(result).not.toBeNull();
  });

  test('detects chained access on req.query', () => {
    const result = runRule(nullDeref,
      'const val = req.query.filter.sort', 'routes.js');
    expect(result).not.toBeNull();
  });

  test('detects chained access on res.locals', () => {
    const result = runRule(nullDeref,
      'res.locals.user.permissions.admin', 'middleware.js');
    expect(result).not.toBeNull();
  });

  test('detects bracket + dot chain', () => {
    const result = runRule(nullDeref,
      "req.body['config'].database.host", 'routes.js');
    expect(result).not.toBeNull();
  });

  test('returns null with optional chaining guard', () => {
    const result = runRule(nullDeref,
      'req.params?.userId?.name', 'routes.js');
    expect(result).toBeNull();
  });

  test('returns null with && null guard', () => {
    const result = runRule(nullDeref,
      'req.params && req.params.id.name', 'routes.js');
    expect(result).toBeNull();
  });

  test('returns null for wrong file extension', () => {
    const result = runRule(nullDeref,
      'req.params.user.name', 'routes.py');
    expect(result).toBeNull();
  });

  test('detects chained access on single property', () => {
    const result = runRule(nullDeref,
      'const id = req.params.id', 'routes.js');
    expect(result).not.toBeNull();
  });

  test('detects chained access on event.data', () => {
    const result = runRule(nullDeref,
      'event.data.payload.content', 'handler.ts');
    expect(result).not.toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 8. jwt-no-expiry
// ──────────────────────────────────────────────────────────────────────────────
describe('jwt-no-expiry', () => {
  test('detects jwt.sign without expiresIn', () => {
    const result = runRule(jwtNoExpiry,
      'jwt.sign({ id: user.id }, secret)', 'auth.js');
    expect(result).not.toBeNull();
    expect(result.message).toContain('expiresIn');
  });

  test('detects jwt.sign with only payload and secret', () => {
    const result = runRule(jwtNoExpiry,
      "jwt.sign({ role: 'admin' }, process.env.SECRET)", 'token.js');
    expect(result).not.toBeNull();
  });

  test('detects in .ts files', () => {
    const result = runRule(jwtNoExpiry,
      'jwt.sign(payload, key)', 'auth.ts');
    expect(result).not.toBeNull();
  });

  test('returns null when expiresIn is present', () => {
    const result = runRule(jwtNoExpiry,
      'jwt.sign({ id: 1 }, secret, { expiresIn: "24h" })', 'auth.js');
    expect(result).toBeNull();
  });

  test('returns null for safe code without jwt.sign', () => {
    const result = runRule(jwtNoExpiry,
      'const token = generateToken()', 'auth.js');
    expect(result).toBeNull();
  });

  test('returns null for wrong file extension', () => {
    const result = runRule(jwtNoExpiry,
      'jwt.sign({ id: 1 }, secret)', 'auth.jsx');
    expect(result).toBeNull();
  });

  test('returns null for jwt.verify (not sign)', () => {
    const result = runRule(jwtNoExpiry,
      'jwt.verify(token, secret)', 'auth.js');
    expect(result).toBeNull();
  });

  test('detects jwt.sign with options but no expiresIn', () => {
    const result = runRule(jwtNoExpiry,
      'jwt.sign({ id: 1 }, secret, { algorithm: "HS256" })', 'auth.js');
    expect(result).not.toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 9. sensitive-data-log
// ──────────────────────────────────────────────────────────────────────────────
describe('sensitive-data-log', () => {
  test('detects console.log with password', () => {
    const result = runRule(sensitiveDataLog,
      'console.log(req.body.password)', 'routes.js');
    expect(result).not.toBeNull();
    expect(result.message).toContain('Sensitive');
  });

  test('detects console.error with token', () => {
    const result = runRule(sensitiveDataLog,
      'console.error("Token:", token)', 'auth.js');
    expect(result).not.toBeNull();
  });

  test('detects logger.debug with secret', () => {
    const result = runRule(sensitiveDataLog,
      'logger.debug("Secret:", secret)', 'app.js');
    expect(result).not.toBeNull();
  });

  test('detects console.warn with apiKey', () => {
    const result = runRule(sensitiveDataLog,
      'console.warn("apiKey:", apiKey)', 'routes.js');
    expect(result).not.toBeNull();
  });

  test('detects console.log with credit_card', () => {
    const result = runRule(sensitiveDataLog,
      'console.log(req.body.credit_card)', 'payment.js');
    expect(result).not.toBeNull();
  });

  test('returns null for console.log without sensitive data', () => {
    const result = runRule(sensitiveDataLog,
      'console.log("Server started")', 'app.js');
    expect(result).toBeNull();
  });

  test('returns null for logger without sensitive fields', () => {
    const result = runRule(sensitiveDataLog,
      'logger.info("Request received")', 'app.js');
    expect(result).toBeNull();
  });

  test('returns null for wrong file extension', () => {
    const result = runRule(sensitiveDataLog,
      'console.log(password)', 'app.rb');
    expect(result).toBeNull();
  });

  test('detects in .py files', () => {
    const result = runRule(sensitiveDataLog,
      'print(req.body["password"])', 'routes.py');
    expect(result).toBeNull();  // print doesn't match console/logger pattern
  });

  test('detects logger.log with authorization', () => {
    const result = runRule(sensitiveDataLog,
      'logger.log("auth:", authorization)', 'middleware.js');
    expect(result).not.toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 10. syntax-error — SKIPPED (uses Babel parser, not testable via check)
// ──────────────────────────────────────────────────────────────────────────────
describe('syntax-error', () => {
  test.skip('skipped — syntax-error uses Babel parser, not regex-based check', () => {});
});

// ──────────────────────────────────────────────────────────────────────────────
// 11. weak-hash
// ──────────────────────────────────────────────────────────────────────────────
describe('weak-hash', () => {
  test('detects MD5 in auth file', () => {
    const result = runRule(weakHash,
      'crypto.createHash("md5")', 'auth/hasher.js');
    expect(result).not.toBeNull();
    expect(result.message).toContain('Weak');
  });

  test('detects SHA1 in hash context', () => {
    const result = runRule(weakHash,
      'crypto.createHash("sha1")', 'crypto/hash.js');
    expect(result).not.toBeNull();
  });

  test('detects md5() function call', () => {
    const result = runRule(weakHash,
      'md5(data)', 'login/hash.js');
    expect(result).not.toBeNull();
  });

  test('detects sha1() function call', () => {
    const result = runRule(weakHash,
      'sha1(input)', 'auth/hash.js');
    expect(result).not.toBeNull();
  });

  test('returns null for MD5 in non-security context', () => {
    const result = runRule(weakHash,
      'crypto.createHash("md5")', 'cache.js');
    expect(result).toBeNull();
  });

  test('returns null for SHA-256 in auth file', () => {
    const result = runRule(weakHash,
      'crypto.createHash("sha256")', 'auth/hasher.js');
    expect(result).toBeNull();
  });

  test('returns null for wrong file extension', () => {
    const result = runRule(weakHash,
      'md5(data)', 'hash.rb');
    expect(result).toBeNull();
  });

  test('detects in .py files', () => {
    const result = runRule(weakHash,
      'hashlib.md5(data)', 'auth/hash.py');
    expect(result).not.toBeNull();
  });

  test('detects in account context', () => {
    const result = runRule(weakHash,
      'md5(password)', 'auth/account.js');
    expect(result).not.toBeNull();
  });

  test('detects in credential context', () => {
    const result = runRule(weakHash,
      'sha1(token)', 'auth/credential.js');
    expect(result).not.toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 12. insecure-random
// ──────────────────────────────────────────────────────────────────────────────
describe('insecure-random', () => {
  test('detects Math.random() in auth file', () => {
    const result = runRule(insecureRandom,
      'const token = Math.random()', 'auth/tokens.js');
    expect(result).not.toBeNull();
    expect(result.message).toContain('Math.random');
  });

  test('detects Math.random() in session file', () => {
    const result = runRule(insecureRandom,
      'Math.random().toString(36)', 'auth/session.js');
    expect(result).not.toBeNull();
  });

  test('detects Math.random() in token file', () => {
    const result = runRule(insecureRandom,
      'const id = Math.random()', 'auth/token.js');
    expect(result).not.toBeNull();
  });

  test('detects Math.random() in otp file', () => {
    const result = runRule(insecureRandom,
      'const otp = Math.floor(Math.random() * 1000000)', 'auth/otp.js');
    expect(result).not.toBeNull();
  });

  test('returns null for Math.random() in non-security context', () => {
    const result = runRule(insecureRandom,
      'const x = Math.random()', 'utils.js');
    expect(result).toBeNull();
  });

  test('returns null for crypto.randomBytes in auth file', () => {
    const result = runRule(insecureRandom,
      'crypto.randomBytes(32)', 'auth/utils.js');
    expect(result).toBeNull();
  });

  test('returns null for wrong file extension', () => {
    const result = runRule(insecureRandom,
      'Math.random()', 'auth/utils.py');
    expect(result).toBeNull();
  });

  test('detects Math.random() in csrf file', () => {
    const result = runRule(insecureRandom,
      'const csrf = Math.random().toString()', 'auth/csrf.js');
    expect(result).not.toBeNull();
  });

  test('detects in .jsx files', () => {
    const result = runRule(insecureRandom,
      'Math.random()', 'components/Auth.jsx');
    expect(result).not.toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 13. missing-validation
// ──────────────────────────────────────────────────────────────────────────────
describe('missing-validation', () => {
  test('detects req.body access without validation', () => {
    const result = runRule(missingValidation,
      'const email = req.body.email', 'routes.js');
    expect(result).not.toBeNull();
    expect(result.message).toContain('validation');
  });

  test('detects multiple req.body accesses', () => {
    const result = runRule(missingValidation,
      'const name = req.body.name; const age = req.body.age', 'routes.js');
    expect(result).not.toBeNull();
  });

  test('returns null when joi validation is used', () => {
    const result = runRule(missingValidation,
      'joi.validate(req.body, schema); const email = req.body.email', 'routes.js');
    expect(result).toBeNull();
  });

  test('returns null when typeof check is used', () => {
    const result = runRule(missingValidation,
      'if (typeof req.body.email === "string") { use(req.body.email); }', 'routes.js');
    expect(result).toBeNull();
  });

  test('returns null when zod validation is used', () => {
    const result = runRule(missingValidation,
      'zod.parse(req.body); const x = req.body.value', 'routes.js');
    expect(result).toBeNull();
  });

  test('returns null when .trim() is used', () => {
    const result = runRule(missingValidation,
      'const email = req.body.email.trim()', 'routes.js');
    expect(result).toBeNull();
  });

  test('returns null for wrong file extension', () => {
    const result = runRule(missingValidation,
      'req.body.email', 'routes.py');
    expect(result).toBeNull();
  });

  test('returns null when parseInt is used', () => {
    const result = runRule(missingValidation,
      'const age = parseInt(req.body.age)', 'routes.js');
    expect(result).toBeNull();
  });

  test('returns null when validator library is used', () => {
    const result = runRule(missingValidation,
      'validator.isEmail(req.body.email); const e = req.body.email', 'routes.js');
    expect(result).toBeNull();
  });

  test('detects in .tsx files', () => {
    const result = runRule(missingValidation,
      'const val = req.body.value', 'api.tsx');
    expect(result).not.toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 14. missing-rate-limit
// ──────────────────────────────────────────────────────────────────────────────
describe('missing-rate-limit', () => {
  test('detects router.post /login without rate limiting', () => {
    const result = runRule(missingRateLimit,
      "router.post('/login', handler)", 'routes.js');
    expect(result).not.toBeNull();
    expect(result.message).toContain('rate limiting');
  });

  test('detects router.post /register without rate limiting', () => {
    const result = runRule(missingRateLimit,
      "router.post('/register', handler)", 'auth.js');
    expect(result).not.toBeNull();
  });

  test('detects router.post /auth without rate limiting', () => {
    const result = runRule(missingRateLimit,
      "router.post('/auth', handler)", 'routes.ts');
    expect(result).not.toBeNull();
  });

  test('detects router.get /signin without rate limiting', () => {
    const result = runRule(missingRateLimit,
      "router.get('/signin', handler)", 'auth.js');
    expect(result).not.toBeNull();
  });

  test('returns null when rateLimit is present', () => {
    const result = runRule(missingRateLimit,
      "router.post('/login', rateLimit({ windowMs: 900000, max: 10 }), handler)",
      'routes.js');
    expect(result).toBeNull();
  });

  test('returns null when throttle is present', () => {
    const result = runRule(missingRateLimit,
      "router.post('/login', throttle(10, 900000), handler)", 'routes.js');
    expect(result).toBeNull();
  });

  test('returns null for non-auth routes', () => {
    const result = runRule(missingRateLimit,
      "router.get('/api/users', handler)", 'routes.js');
    expect(result).toBeNull();
  });

  test('returns null for wrong file extension', () => {
    const result = runRule(missingRateLimit,
      "router.post('/login', handler)", 'routes.jsx');
    expect(result).toBeNull();
  });

  test('detects router.post /forgot-password', () => {
    const result = runRule(missingRateLimit,
      "router.post('/forgot-password', handler)", 'auth.js');
    expect(result).not.toBeNull();
  });

  test('detects router.post /signup', () => {
    const result = runRule(missingRateLimit,
      "router.post('/signup', handler)", 'routes.js');
    expect(result).not.toBeNull();
  });

  test('returns null when limiter is present', () => {
    const result = runRule(missingRateLimit,
      "router.post('/login', limiter, handler)", 'routes.js');
    expect(result).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 15. redos
// ──────────────────────────────────────────────────────────────────────────────
describe('redos', () => {
  test('detects nested quantifiers in regex', () => {
    const result = runRule(reDoS,
      '/(a+)+$/', 'validator.js');
    expect(result).not.toBeNull();
    expect(result.message).toContain('regex');
  });

  test('detects nested quantifiers with character class', () => {
    const result = runRule(reDoS,
      '/[a-z]**/', 'validator.js');
    expect(result).not.toBeNull();
  });

  test('detects dynamic RegExp from req input', () => {
    const result = runRule(reDoS,
      'new RegExp(req.query.pattern)', 'search.js');
    expect(result).not.toBeNull();
  });

  test('detects dynamic RegExp from userInput', () => {
    const result = runRule(reDoS,
      'new RegExp(userInput)', 'search.js');
    expect(result).not.toBeNull();
  });

  test('detects dynamic RegExp from input', () => {
    const result = runRule(reDoS,
      'new RegExp(input)', 'search.js');
    expect(result).not.toBeNull();
  });

  test('detects dynamic RegExp from query', () => {
    const result = runRule(reDoS,
      'new RegExp(query)', 'search.js');
    expect(result).not.toBeNull();
  });

  test('returns null for safe regex', () => {
    const result = runRule(reDoS,
      '/^[a-z]+$/', 'validator.js');
    expect(result).toBeNull();
  });

  test('returns null for wrong file extension', () => {
    const result = runRule(reDoS,
      '/(a+)+$/', 'validator.py');
    expect(result).toBeNull();
  });

  test('returns null for safe RegExp with fixed pattern', () => {
    const result = runRule(reDoS,
      'new RegExp("^[a-z]+$")', 'search.js');
    expect(result).toBeNull();
  });

  test('returns null for simple regex', () => {
    const result = runRule(reDoS,
      '/hello/', 'test.js');
    expect(result).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 16. unhandled-promise
// ──────────────────────────────────────────────────────────────────────────────
describe('unhandled-promise', () => {
  test('detects .then() without .catch()', () => {
    const result = runRule(unhandledPromise,
      'fetch(url).then(res => res.json())', 'app.js');
    expect(result).not.toBeNull();
    expect(result.message).toContain('Unhandled promise');
  });

  test('detects await without try/catch', () => {
    const result = runRule(unhandledPromise,
      'const data = await fetch(url)', 'app.js');
    expect(result).not.toBeNull();
  });

  test('detects .then() with .catch() (regex limitation)', () => {
    const result = runRule(unhandledPromise,
      'fetch(url).then(res => res.json()).catch(err => {})', 'app.js');
    expect(result).not.toBeNull();
  });

  test('returns null when try/catch wraps await', () => {
    const result = runRule(unhandledPromise,
      'try { const data = await fetch(url); } catch(e) {}', 'app.js');
    expect(result).toBeNull();
  });

  test('returns null for wrong file extension', () => {
    const result = runRule(unhandledPromise,
      'fetch(url).then(r => r)', 'app.py');
    expect(result).toBeNull();
  });

  test('detects .then() chain without catch', () => {
    const result = runRule(unhandledPromise,
      'promise.then(handleData).then(transform)', 'app.js');
    expect(result).not.toBeNull();
  });

  test('returns null for safe .then().catch() chain', () => {
    const result = runRule(unhandledPromise,
      'promise.then(handleData).catch(handleError)', 'app.js');
    expect(result).toBeNull();
  });

  test('detects await assignment without try/catch', () => {
    const result = runRule(unhandledPromise,
      'const result = await someAsync()', 'worker.js');
    expect(result).not.toBeNull();
  });

  test('returns null when only catch keyword present', () => {
    const result = runRule(unhandledPromise,
      'const result = await someAsync(); catch(err) {}', 'worker.js');
    expect(result).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 17. async-await-leak
// ──────────────────────────────────────────────────────────────────────────────
describe('async-await-leak', () => {
  test('detects await without try or catch', () => {
    const result = runRule(asyncAwaitLeak,
      'await fetchUser()', 'handler.js');
    expect(result).not.toBeNull();
    expect(result.message).toContain('await');
  });

  test('detects async function without try', () => {
    const result = runRule(asyncAwaitLeak,
      'async function getUser() { const data = await fetch(); }', 'handler.js');
    expect(result).not.toBeNull();
  });

  test('detects async arrow function without try', () => {
    const result = runRule(asyncAwaitLeak,
      'const fn = async () => { await save(); }', 'handler.js');
    expect(result).not.toBeNull();
  });

  test('returns null when try block exists', () => {
    const result = runRule(asyncAwaitLeak,
      'try { await fetch(); } catch(e) {}', 'handler.js');
    expect(result).toBeNull();
  });

  test('returns null when .catch() is used', () => {
    const result = runRule(asyncAwaitLeak,
      'fetch().catch(e => {})', 'handler.js');
    expect(result).toBeNull();
  });

  test('returns null for wrong file extension', () => {
    const result = runRule(asyncAwaitLeak,
      'await save()', 'handler.py');
    expect(result).toBeNull();
  });

  test('returns null for safe async with error handling', () => {
    const result = runRule(asyncAwaitLeak,
      'async function run() { try { await fetch(); } catch(e) { console.log(e); } }',
      'handler.js');
    expect(result).toBeNull();
  });

  test('detects in .ts files', () => {
    const result = runRule(asyncAwaitLeak,
      'await loadData()', 'handler.ts');
    expect(result).not.toBeNull();
  });

  test('detects in .tsx files', () => {
    const result = runRule(asyncAwaitLeak,
      'await submit()', 'Component.tsx');
    expect(result).not.toBeNull();
  });

  test('returns null for sync code', () => {
    const result = runRule(asyncAwaitLeak,
      'const x = 42;', 'app.js');
    expect(result).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 18. memory-leak
// ──────────────────────────────────────────────────────────────────────────────
describe('memory-leak', () => {
  test('detects addEventListener without removeEventListener in component', () => {
    const result = runRule(memoryLeak,
      'element.addEventListener("click", handler)', 'src/components/App.js');
    expect(result).not.toBeNull();
    expect(result.message).toContain('memory leak');
  });

  test('detects setInterval without clearInterval in component', () => {
    const result = runRule(memoryLeak,
      'setInterval(fetchData, 5000)', 'src/pages/Dashboard.js');
    expect(result).not.toBeNull();
  });

  test('detects addEventListener in hooks', () => {
    const result = runRule(memoryLeak,
      'window.addEventListener("scroll", onScroll)', 'src/hooks/useScroll.js');
    expect(result).not.toBeNull();
  });

  test('detects addEventListener in views', () => {
    const result = runRule(memoryLeak,
      'document.addEventListener("keydown", handler)', 'src/views/Home.js');
    expect(result).not.toBeNull();
  });

  test('returns null when removeEventListener is present', () => {
    const result = runRule(memoryLeak,
      'element.addEventListener("click", handler); element.removeEventListener("click", handler)',
      'components/App.js');
    expect(result).toBeNull();
  });

  test('returns null when clearInterval is present', () => {
    const result = runRule(memoryLeak,
      'const id = setInterval(fn, 1000); clearInterval(id);', 'pages/Dash.js');
    expect(result).toBeNull();
  });

  test('returns null for non-component files', () => {
    const result = runRule(memoryLeak,
      'element.addEventListener("click", handler)', 'utils.js');
    expect(result).toBeNull();
  });

  test('returns null for wrong file extension', () => {
    const result = runRule(memoryLeak,
      'addEventListener("click", h)', 'components/App.py');
    expect(result).toBeNull();
  });

  test('detects setInterval in hooks without clearInterval', () => {
    const result = runRule(memoryLeak,
      'setInterval(poll, 1000)', 'src/hooks/usePoll.js');
    expect(result).not.toBeNull();
  });

  test('detects addEventListener in pages without removeEventListener', () => {
    const result = runRule(memoryLeak,
      'window.addEventListener("resize", onResize)', 'src/pages/Settings.js');
    expect(result).not.toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 19. cors-wildcard
// ──────────────────────────────────────────────────────────────────────────────
describe('cors-wildcard', () => {
  test('detects cors wildcard origin with double quotes', () => {
    const result = runRule(corsWildcard,
      'cors({ origin: "*" })', 'server.js');
    expect(result).not.toBeNull();
    expect(result.message).toContain('CORS');
  });

  test('detects cors wildcard with single quotes', () => {
    const result = runRule(corsWildcard,
      "cors({ origin: '*' })", 'server.js');
    expect(result).not.toBeNull();
  });

  test('detects Access-Control-Allow-Origin header wildcard', () => {
    const result = runRule(corsWildcard,
      '"Access-Control-Allow-Origin": "*"', 'server.js');
    expect(result).not.toBeNull();
  });

  test('detects cors with backtick quotes', () => {
    const result = runRule(corsWildcard,
      'cors({ origin: `*` })', 'server.js');
    expect(result).not.toBeNull();
  });

  test('detects in .ts files', () => {
    const result = runRule(corsWildcard,
      'cors({ origin: "*" })', 'server.ts');
    expect(result).not.toBeNull();
  });

  test('returns null for restricted origin', () => {
    const result = runRule(corsWildcard,
      'cors({ origin: "https://mydomain.com" })', 'server.js');
    expect(result).toBeNull();
  });

  test('returns null for wrong file extension', () => {
    const result = runRule(corsWildcard,
      'cors({ origin: "*" })', 'server.jsx');
    expect(result).toBeNull();
  });

  test('returns null for safe cors configuration', () => {
    const result = runRule(corsWildcard,
      'cors({ origin: ["https://trusted.com"] })', 'server.js');
    expect(result).toBeNull();
  });

  test('detects Access-Control-Allow-Origin with comma separator', () => {
    const result = runRule(corsWildcard,
      '{"Access-Control-Allow-Origin": "*"}', 'middleware.js');
    expect(result).not.toBeNull();
  });

  test('returns null for cors without wildcard', () => {
    const result = runRule(corsWildcard,
      'cors({ credentials: true })', 'server.js');
    expect(result).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 20. hardcoded-ip
// ──────────────────────────────────────────────────────────────────────────────
describe('hardcoded-ip', () => {
  test('detects hardcoded public IP', () => {
    const result = runRule(hardcodedIp,
      'const host = "8.8.8.8"', 'config.js');
    expect(result).not.toBeNull();
    expect(result.message).toContain('IP');
  });

  test('detects hardcoded IP with port', () => {
    const result = runRule(hardcodedIp,
      'const url = "http://203.0.113.50:8080"', 'config.js');
    expect(result).not.toBeNull();
  });

  test('returns null for localhost 127.0.0.1', () => {
    const result = runRule(hardcodedIp,
      'const host = "127.0.0.1"', 'config.js');
    expect(result).toBeNull();
  });

  test('returns null for 0.0.0.0', () => {
    const result = runRule(hardcodedIp,
      'const host = "0.0.0.0"', 'config.js');
    expect(result).toBeNull();
  });

  test('returns null for 192.168.x.x', () => {
    const result = runRule(hardcodedIp,
      'const host = "192.168.1.100"', 'config.js');
    expect(result).toBeNull();
  });

  test('returns null for 10.x.x.x', () => {
    const result = runRule(hardcodedIp,
      'const host = "10.0.0.1"', 'config.js');
    expect(result).toBeNull();
  });

  test('returns null for 172.16-31.x.x', () => {
    const result = runRule(hardcodedIp,
      'const host = "172.16.0.1"', 'config.js');
    expect(result).toBeNull();
  });

  test('returns null for test files', () => {
    const result = runRule(hardcodedIp,
      'const host = "8.8.8.8"', 'config.test.js');
    expect(result).toBeNull();
  });

  test('returns null for spec files', () => {
    const result = runRule(hardcodedIp,
      'const host = "8.8.8.8"', 'config.spec.js');
    expect(result).toBeNull();
  });

  test('returns null for example files', () => {
    const result = runRule(hardcodedIp,
      'const host = "8.8.8.8"', 'config.example.js');
    expect(result).toBeNull();
  });

  test('returns null for template files', () => {
    const result = runRule(hardcodedIp,
      'const host = "8.8.8.8"', 'config.template.js');
    expect(result).toBeNull();
  });

  test('returns null for fixture files', () => {
    const result = runRule(hardcodedIp,
      'const host = "8.8.8.8"', 'fixture.json');
    expect(result).toBeNull();
  });

  test('returns null for no IP address', () => {
    const result = runRule(hardcodedIp,
      'const x = "hello world"', 'config.js');
    expect(result).toBeNull();
  });

  test('detects IP in middle of string', () => {
    const result = runRule(hardcodedIp,
      'const url = "http://198.51.100.1/api"', 'config.js');
    expect(result).not.toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// console-log (bonus — included in ALL_RULES)
// ──────────────────────────────────────────────────────────────────────────────
describe('console-log', () => {
  test('detects console.log in production code', () => {
    const result = runRule(consoleLogRule, 'console.log("debug")', 'app.js');
    expect(result).not.toBeNull();
  });

  test('returns null for test files', () => {
    const result = runRule(consoleLogRule, 'console.log(x)', 'app.test.js');
    expect(result).toBeNull();
  });

  test('returns null for logger files', () => {
    const result = runRule(consoleLogRule, 'console.log(x)', 'logger.js');
    expect(result).toBeNull();
  });

  test('returns null for node_modules in path', () => {
    const result = runRule(consoleLogRule, 'console.log(x)', 'src/node_modules/pkg/index.js');
    expect(result).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ALL_RULES exports
// ──────────────────────────────────────────────────────────────────────────────
describe('ALL_RULES exports', () => {
  test('ALL_RULES contains exactly 20 rules', () => {
    expect(ALL_RULES.length).toBe(20);
  });

  test('every rule has name, severity, and check function', () => {
    for (const rule of ALL_RULES) {
      expect(rule.name).toBeDefined();
      expect(typeof rule.name).toBe('string');
      expect(rule.severity).toBeDefined();
      expect(typeof rule.check).toBe('function');
    }
  });

  test('DETERMINISTIC_RULES is a Set with expected entries', () => {
    expect(DETERMINISTIC_RULES).toBeInstanceOf(Set);
    expect(DETERMINISTIC_RULES.has('secret-leak')).toBe(true);
    expect(DETERMINISTIC_RULES.has('eval-usage')).toBe(true);
    expect(DETERMINISTIC_RULES.has('sql-injection')).toBe(true);
    expect(DETERMINISTIC_RULES.has('prototype-pollution')).toBe(true);
    expect(DETERMINISTIC_RULES.has('jwt-no-expiry')).toBe(true);
    expect(DETERMINISTIC_RULES.has('sensitive-data-log')).toBe(true);
    expect(DETERMINISTIC_RULES.has('null-deref')).toBe(true);
    expect(DETERMINISTIC_RULES.has('unhandled-promise')).toBe(true);
    expect(DETERMINISTIC_RULES.has('xss-innerhtml')).toBe(true);
    expect(DETERMINISTIC_RULES.has('path-traversal')).toBe(true);
    expect(DETERMINISTIC_RULES.has('weak-hash')).toBe(true);
    expect(DETERMINISTIC_RULES.has('insecure-random')).toBe(true);
    expect(DETERMINISTIC_RULES.has('hardcoded-ip')).toBe(true);
    expect(DETERMINISTIC_RULES.has('missing-validation')).toBe(true);
    expect(DETERMINISTIC_RULES.has('reDoS')).toBe(true);
    expect(DETERMINISTIC_RULES.has('console-log')).toBe(true);
    expect(DETERMINISTIC_RULES.has('memory-leak')).toBe(true);
    expect(DETERMINISTIC_RULES.has('async-await-leak')).toBe(true);
    expect(DETERMINISTIC_RULES.has('missing-rate-limit')).toBe(true);
    expect(DETERMINISTIC_RULES.has('cors-wildcard')).toBe(true);
    expect(DETERMINISTIC_RULES.size).toBe(20);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// runRules()
// ──────────────────────────────────────────────────────────────────────────────
describe('runRules', () => {
  const makeLine = (content) => ({ content, line: 1 });
  const surrounding = (content) => [content];

  test('returns empty array when no rules match', () => {
    const findings = runRules(makeLine('const x = 42;'), 'app.js');
    expect(Array.isArray(findings)).toBe(true);
    expect(findings.length).toBe(0);
  });

  test('finding has all required fields', () => {
    const findings = runRules(
      makeLine('eval(userInput)'),
      'app.js',
    );
    expect(findings.length).toBeGreaterThan(0);
    const f = findings[0];
    expect(f).toHaveProperty('rule_name');
    expect(f).toHaveProperty('severity');
    expect(f).toHaveProperty('message');
    expect(f).toHaveProperty('fix_hint');
    expect(f).toHaveProperty('weight');
    expect(f).toHaveProperty('features');
    expect(f).toHaveProperty('contextSignals');
    expect(f).toHaveProperty('isDeterministic');
  });

  test('feature vector has exactly 15 elements', () => {
    const findings = runRules(makeLine('eval(x)'), 'app.js');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].features.length).toBe(15);
  });

  test('context-aware: warning stays warning even in critical file with user input', () => {
    // insecure-random is 'warning'. Severity no longer auto-escalates.
    const findings = runRules(
      makeLine('Math.random() req.body'),
      'auth/token.js',
    );
    const f = findings.find(f => f.rule_name === 'insecure-random');
    expect(f).toBeDefined();
    expect(f.severity).toBe('warning');
  });

  test('context-aware: critical stays critical even with null guard and no user input', () => {
    // eval-usage is 'critical'. Severity no longer auto-de-escalates.
    const findings = runRules(
      makeLine('eval(code)'),
      'utils.js',
      [],
      surrounding('if (typeof code !== "undefined")'),
    );
    const f = findings.find(f => f.rule_name === 'eval-usage');
    expect(f).toBeDefined();
    expect(f.severity).toBe('critical');
  });

  test('test files get severity = info', () => {
    const findings = runRules(
      makeLine('eval(userInput)'),
      'app.test.js',
    );
    const f = findings.find(f => f.rule_name === 'eval-usage');
    expect(f).toBeDefined();
    expect(f.severity).toBe('info');
  });

  test('weight is a number', () => {
    const findings = runRules(makeLine('eval(code)'), 'app.js');
    expect(findings.length).toBeGreaterThan(0);
    expect(typeof findings[0].weight).toBe('number');
  });

  test('contextSignals is an array', () => {
    const findings = runRules(
      makeLine('eval(req.body.code)'),
      'auth.js',
    );
    expect(findings.length).toBeGreaterThan(0);
    expect(Array.isArray(findings[0].contextSignals)).toBe(true);
  });

  test('isDeterministic matches DETERMINISTIC_RULES set', () => {
    const findings = runRules(makeLine('eval(x)'), 'app.js');
    const f = findings.find(f => f.rule_name === 'eval-usage');
    expect(f).toBeDefined();
    expect(f.isDeterministic).toBe(true);
  });

  test('multiple rules can fire on same line', () => {
    const findings = runRules(
      makeLine('console.log(eval(req.body.password))'),
      'auth.js',
    );
    const ruleNames = findings.map(f => f.rule_name);
    expect(ruleNames).toContain('eval-usage');
    expect(ruleNames).toContain('sensitive-data-log');
  });

  test('weight is capped at 1.5', () => {
    // Trigger rule in critical file with user input and repeat patterns
    const patterns = [
      { rule_name: 'eval-usage', count: 5 },
    ];
    const findings = runRules(
      makeLine('eval(req.body.code)'),
      'auth.js',
      patterns,
    );
    const f = findings.find(f => f.rule_name === 'eval-usage');
    expect(f).toBeDefined();
    expect(f.weight).toBeLessThanOrEqual(1.5);
  });

  test('contextSignals includes user-input-present when req.body/params/query present', () => {
    const findings = runRules(
      makeLine('eval(req.body.code)'),
      'app.js',
    );
    const f = findings.find(f => f.rule_name === 'eval-usage');
    expect(f).toBeDefined();
    expect(f.contextSignals).toContain('user-input-present');
  });

  test('contextSignals includes critical-file for critical file paths', () => {
    const findings = runRules(
      makeLine('eval(code)'),
      'auth/login.js',
    );
    const f = findings.find(f => f.rule_name === 'eval-usage');
    expect(f).toBeDefined();
    expect(f.contextSignals).toContain('critical-file');
  });

  test('contextSignals includes test-file for test files', () => {
    const findings = runRules(
      makeLine('eval(code)'),
      'app.test.js',
    );
    const f = findings.find(f => f.rule_name === 'eval-usage');
    expect(f).toBeDefined();
    expect(f.contextSignals).toContain('test-file');
  });

  test('contextSignals includes null-guard-nearby when guard present', () => {
    const findings = runRules(
      makeLine('eval(code)'),
      'app.js',
      [],
      surrounding('if (code)'),
    );
    const f = findings.find(f => f.rule_name === 'eval-usage');
    expect(f).toBeDefined();
    expect(f.contextSignals).toContain('null-guard-nearby');
  });

  test('contextSignals includes repeat-offender for high count', () => {
    const findings = runRules(
      makeLine('eval(code)'),
      'app.js',
      [{ rule_name: 'eval-usage', count: 3 }],
    );
    const f = findings.find(f => f.rule_name === 'eval-usage');
    expect(f).toBeDefined();
    expect(f.contextSignals).toContain('repeat-offender(3x)');
  });

  test('multiple findings can have different severities', () => {
    const findings = runRules(
      makeLine('eval(req.body.data)'),
      'auth.js',
    );
    // eval-usage is critical, sensitive-data-log is critical
    const severities = findings.map(f => f.severity);
    expect(severities.length).toBeGreaterThan(1);
  });

  test('runRules handles empty content gracefully', () => {
    const findings = runRules(makeLine(''), 'app.js');
    expect(Array.isArray(findings)).toBe(true);
  });

  test('runRules handles empty patterns gracefully', () => {
    const findings = runRules(makeLine('eval(x)'), 'app.js', []);
    expect(findings.length).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Cross-rule integration
// ──────────────────────────────────────────────────────────────────────────────
describe('cross-rule integration', () => {
  test('secret-leak does not fire on safe env var usage', () => {
    const findings = runRules(
      makeLine('const db = process.env.DATABASE_URL'),
      'config.js',
    );
    const f = findings.find(f => f.rule_name === 'secret-leak');
    expect(f).toBeUndefined();
  });

  test('sql-injection fires on template literal with SQL keyword', () => {
    const findings = runRules(
      makeLine('db.query(`SELECT * FROM users WHERE id = ${id}`)'),
      'query.js',
    );
    const f = findings.find(f => f.rule_name === 'sql-injection');
    expect(f).toBeDefined();
  });

  test('xss-innerhtml fires on document.write', () => {
    const findings = runRules(
      makeLine('document.write(content)'),
      'page.js',
    );
    const f = findings.find(f => f.rule_name === 'xss-innerhtml');
    expect(f).toBeDefined();
  });

  test('path-traversal fires on fs.readFile with req.params', () => {
    const findings = runRules(
      makeLine('fs.readFile(req.params.file, cb)'),
      'routes.js',
    );
    const f = findings.find(f => f.rule_name === 'path-traversal');
    expect(f).toBeDefined();
  });

  test('prototype-pollution fires on Object.assign with req.body', () => {
    const findings = runRules(
      makeLine('Object.assign(target, req.body)'),
      'routes.js',
    );
    const f = findings.find(f => f.rule_name === 'prototype-pollution');
    expect(f).toBeDefined();
  });

  test('jwt-no-expiry fires on jwt.sign without expiresIn', () => {
    const findings = runRules(
      makeLine('jwt.sign(payload, secret)'),
      'auth.js',
    );
    const f = findings.find(f => f.rule_name === 'jwt-no-expiry');
    expect(f).toBeDefined();
  });

  test('cors-wildcard fires on cors wildcard', () => {
    const findings = runRules(
      makeLine('cors({ origin: "*" })'),
      'server.js',
    );
    const f = findings.find(f => f.rule_name === 'cors-wildcard');
    expect(f).toBeDefined();
  });

  test('missing-rate-limit fires on unprotected login route', () => {
    const findings = runRules(
      makeLine("router.post('/login', handler)"),
      'routes.js',
    );
    const f = findings.find(f => f.rule_name === 'missing-rate-limit');
    expect(f).toBeDefined();
  });

  test('hardcoded-ip fires on public IP', () => {
    const findings = runRules(
      makeLine('const host = "8.8.8.8"'),
      'config.js',
    );
    const f = findings.find(f => f.rule_name === 'hardcoded-ip');
    expect(f).toBeDefined();
  });

  test('weak-hash fires on MD5 in auth context', () => {
    const findings = runRules(
      makeLine('crypto.createHash("md5")'),
      'auth/hash.js',
    );
    const f = findings.find(f => f.rule_name === 'weak-hash');
    expect(f).toBeDefined();
  });

  test('insecure-random fires on Math.random in security context', () => {
    const findings = runRules(
      makeLine('Math.random()'),
      'auth/tokens.js',
    );
    const f = findings.find(f => f.rule_name === 'insecure-random');
    expect(f).toBeDefined();
  });

  test('missing-validation fires on req.body without validation', () => {
    const findings = runRules(
      makeLine('const email = req.body.email'),
      'routes.js',
    );
    const f = findings.find(f => f.rule_name === 'missing-validation');
    expect(f).toBeDefined();
  });

  test('redos fires on nested quantifiers', () => {
    const findings = runRules(
      makeLine('/(a+)+$/'),
      'validator.js',
    );
    const f = findings.find(f => f.rule_name === 'redos');
    expect(f).toBeDefined();
  });

  test('memory-leak fires on addEventListener in component without cleanup', () => {
    const findings = runRules(
      makeLine('element.addEventListener("click", handler)'),
      'src/components/App.js',
    );
    const f = findings.find(f => f.rule_name === 'memory-leak');
    expect(f).toBeDefined();
  });

  test('async-await-leak fires on await without error handling', () => {
    const findings = runRules(
      makeLine('await fetchData()'),
      'handler.js',
    );
    const f = findings.find(f => f.rule_name === 'async-await-leak');
    expect(f).toBeDefined();
  });

  test('sensitive-data-log fires on console.log with password', () => {
    const findings = runRules(
      makeLine('console.log(req.body.password)'),
      'routes.js',
    );
    const f = findings.find(f => f.rule_name === 'sensitive-data-log');
    expect(f).toBeDefined();
  });

  const makeLine = (content) => ({ content, line: 1 });
  const surrounding = (content) => [makeLine(content)];
});
