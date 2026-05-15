const pool = require('./db');
require('dotenv').config();

const SEED_USER_ID = process.env.SEED_USER_ID || '';

async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let effectiveUserId = SEED_USER_ID;
    if (effectiveUserId) {
      const userCheck = await client.query('SELECT id FROM public.user_profiles WHERE id=$1', [effectiveUserId]);
      if (userCheck.rows.length === 0) {
        effectiveUserId = '';
      }
    }

    if (!effectiveUserId) {
      const fallback = await client.query('SELECT id FROM public.user_profiles ORDER BY created_at ASC LIMIT 1');
      if (fallback.rows.length > 0) {
        effectiveUserId = fallback.rows[0].id;
      } else {
        const ownerFallback = await client.query('SELECT owner_id FROM public.projects ORDER BY created_at ASC LIMIT 1');
        if (ownerFallback.rows.length === 0) {
          console.error('No users found in public.user_profiles or project owners. Sign in once with GitHub, then run seed.');
          await client.query('ROLLBACK');
          process.exit(1);
        }
        effectiveUserId = ownerFallback.rows[0].owner_id;
        await client.query(
          `INSERT INTO public.user_profiles (id)
           VALUES ($1)
           ON CONFLICT (id) DO NOTHING`,
          [effectiveUserId]
        );
      }
      console.log(`SEED_USER_ID not found/empty, using existing user: ${effectiveUserId}`);
    }

    await client.query(
      `DELETE FROM public.projects WHERE owner_id=$1`,
      [effectiveUserId]
    );

    const importedProject = await client.query(
      `INSERT INTO public.projects (owner_id, name, github_repo, description, is_private, import_status, import_count)
       VALUES ($1,$2,$3,$4,$5,'done',2)
       RETURNING id`,
      [
        effectiveUserId,
        'First',
        'aryapatel23/HackCrux-----NyayaSankalan---CMS',
        'This is first and try project for it',
        false,
      ]
    );
    const importedProjectId = importedProject.rows[0].id;

    await client.query(
      `INSERT INTO public.pull_requests
        (project_id, pr_url, repo, pr_number, pr_title, author, analyzed_at, files_count, risk_score, status, is_historical)
       VALUES
        ($1,$2,$3,$4,$5,$6,NOW() - INTERVAL '2 days',$7,NULL,'imported',true),
        ($1,$8,$3,$9,$10,$11,NOW() - INTERVAL '1 day',$12,NULL,'imported',true)`,
      [
        importedProjectId,
        'https://github.com/aryapatel23/HackCrux-----NyayaSankalan---CMS/pull/2',
        'aryapatel23/HackCrux-----NyayaSankalan---CMS',
        2,
        'docs updated',
        'daxp472',
        8,
        'https://github.com/aryapatel23/HackCrux-----NyayaSankalan---CMS/pull/1',
        1,
        'add the chatbord for quick access to inquire and know about acts',
        'aryapatel23',
        9,
      ]
    );

    await client.query(
      `INSERT INTO public.developer_profiles
        (project_id, github_login, rule_weights, rule_thresholds, total_prs_analyzed, total_findings, total_critical, total_warnings)
       VALUES
        ($1,'daxp472','{}','{}',1,0,0,0),
        ($1,'aryapatel23','{}','{}',1,0,0,0)
       ON CONFLICT (project_id, github_login) DO NOTHING`,
      [importedProjectId]
    );

    const scannedProject = await client.query(
      `INSERT INTO public.projects (owner_id, name, github_repo, description, is_private, import_status, import_count)
       VALUES ($1,$2,$3,$4,$5,'done',5)
       RETURNING id`,
      [
        effectiveUserId,
        'DevDiff Demo Secure API',
        'devdiff/demo-secure-api',
        'Production-like sample with scanned risk analytics and danger-zone files',
        false,
      ]
    );
    const scannedProjectId = scannedProject.rows[0].id;

    const prA = await client.query(
      `INSERT INTO public.pull_requests
        (project_id, pr_url, repo, pr_number, pr_title, author, analyzed_at, files_count, risk_score, status, is_historical)
       VALUES ($1,$2,$3,$4,$5,$6,NOW() - INTERVAL '8 hours',$7,$8,'complete',false)
       RETURNING id`,
      [
        scannedProjectId,
        'https://github.com/devdiff/demo-secure-api/pull/41',
        'devdiff/demo-secure-api',
        41,
        'feat: optimize auth middleware and input guards',
        'aryapatel23',
        12,
        74,
      ]
    );

    const prB = await client.query(
      `INSERT INTO public.pull_requests
        (project_id, pr_url, repo, pr_number, pr_title, author, analyzed_at, files_count, risk_score, status, is_historical)
       VALUES ($1,$2,$3,$4,$5,$6,NOW() - INTERVAL '3 hours',$7,$8,'complete',false)
       RETURNING id`,
      [
        scannedProjectId,
        'https://github.com/devdiff/demo-secure-api/pull/42',
        'devdiff/demo-secure-api',
        42,
        'fix: sanitize search query and remove unsafe eval path',
        'daxp472',
        9,
        88,
      ]
    );

    const findings = [
      [scannedProjectId, prA.rows[0].id, 'src/api/users.ts', 88, 'missing-validation', 'warning', 81.5, 'Input payload used without schema validation', 'Validate req.body with zod before use', 'aryapatel23'],
      [scannedProjectId, prA.rows[0].id, 'src/api/users.ts', 121, 'sql-injection', 'critical', 93.1, 'Dynamic SQL interpolation detected', 'Use parameterized query placeholders', 'aryapatel23'],
      [scannedProjectId, prA.rows[0].id, 'src/services/token.ts', 44, 'weak-hash', 'warning', 76.2, 'Weak hashing function used for sensitive value', 'Use SHA-256 or bcrypt based on purpose', 'aryapatel23'],
      [scannedProjectId, prB.rows[0].id, 'src/search/query.ts', 17, 'reDoS', 'critical', 91.4, 'Potential catastrophic regex backtracking', 'Bound regex or use safer parser', 'daxp472'],
      [scannedProjectId, prB.rows[0].id, 'src/search/query.ts', 21, 'eval-usage', 'critical', 97.6, 'eval() usage can lead to code execution', 'Replace eval path with explicit parser', 'daxp472'],
      [scannedProjectId, prB.rows[0].id, 'src/search/query.ts', 41, 'xss-innerHTML', 'warning', 78.3, 'Unsanitized HTML assignment to innerHTML', 'Sanitize content or use textContent', 'daxp472'],
      [scannedProjectId, prB.rows[0].id, 'src/search/query.ts', 52, 'unhandled-promise', 'warning', 72.8, 'Promise rejection is not handled', 'Add await and try/catch block', 'daxp472'],
    ];

    for (const row of findings) {
      await client.query(
        `INSERT INTO public.findings
          (project_id, pr_id, filename, line_number, rule_name, severity, confidence, message, fix_hint, author)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        row
      );
    }

    await client.query(
      `INSERT INTO public.developer_patterns (project_id, author, rule_name, count, last_seen)
       VALUES
        ($1,'aryapatel23','sql-injection',3,NOW()),
        ($1,'aryapatel23','missing-validation',4,NOW()),
        ($1,'daxp472','eval-usage',5,NOW()),
        ($1,'daxp472','reDoS',2,NOW()),
        ($1,'daxp472','xss-innerHTML',3,NOW())
       ON CONFLICT (project_id, author, rule_name)
       DO UPDATE SET count=EXCLUDED.count, last_seen=NOW()`,
      [scannedProjectId]
    );

    await client.query(
      `INSERT INTO public.developer_profiles
        (project_id, github_login, rule_weights, rule_thresholds, total_prs_analyzed, total_findings, total_critical, total_warnings, weights_updated_at)
       VALUES
        ($1,'aryapatel23',$2,$3,1,3,1,2,NOW()),
        ($1,'daxp472',$4,$5,1,4,2,2,NOW())
       ON CONFLICT (project_id, github_login)
       DO UPDATE SET
         rule_weights=EXCLUDED.rule_weights,
         rule_thresholds=EXCLUDED.rule_thresholds,
         total_prs_analyzed=EXCLUDED.total_prs_analyzed,
         total_findings=EXCLUDED.total_findings,
         total_critical=EXCLUDED.total_critical,
         total_warnings=EXCLUDED.total_warnings,
         weights_updated_at=NOW()`,
      [
        scannedProjectId,
        JSON.stringify({ 'sql-injection': 1.7, 'missing-validation': 1.3, 'weak-hash': 1.1 }),
        JSON.stringify({ 'sql-injection': 48, 'missing-validation': 56, 'weak-hash': 62 }),
        JSON.stringify({ 'eval-usage': 2.0, reDoS: 1.6, 'xss-innerHTML': 1.4, 'unhandled-promise': 1.2 }),
        JSON.stringify({ 'eval-usage': 42, reDoS: 49, 'xss-innerHTML': 54, 'unhandled-promise': 58 }),
      ]
    );

    await client.query('COMMIT');
    console.log('Seed complete: imported-history + scanned-analytics demo data inserted');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
