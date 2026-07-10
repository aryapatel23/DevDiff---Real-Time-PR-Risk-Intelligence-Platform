const { parsePRUrl, fetchPRMeta, fetchPRFiles } = require('../github/fetcher');
const { parseDiff } = require('../parser/diffParser');
const { runRules } = require('../rules/index');
const { scoreFeatures } = require('../ml/mlBridge');
const { validateIntent } = require('../intent/ticketValidator');
const { enrichWithFunctionContext } = require('./codeEnricher');
const { reviewAllChunks } = require('./logicReviewer');
const queries = require('../db/queries');
const pool = require('../db/db');

async function analyzePR(prUrl, ticketUrl, projectId, githubToken, onFinding, existingPrId = null) {
  const { owner, repo, number } = parsePRUrl(prUrl);
  const meta = await fetchPRMeta(owner, repo, number, githubToken);
  const files = await fetchPRFiles(owner, repo, number, githubToken);

  onFinding({
    event: 'pr_meta',
    data: {
      title: meta.title,
      author: meta.author,
      repo: `${owner}/${repo}`,
      prNumber: number,
      prUrl,
      files: files.map(f => ({
        filename: f.filename,
        additions: f.additions,
        deletions: f.deletions,
        status: f.status,
        diffPreview: (f.patch || '').split('\n').slice(0, 25).join('\n'),
      })),
    },
  });

  const enrichableFiles = files.map(f => ({
    filename: f.filename,
    patch: f.patch,
    lines: f.patch ? parseDiff(f.patch) : [],
  }));

  const chunks = await enrichWithFunctionContext({ owner, repo, head: meta.head }, enrichableFiles, githubToken);

  onFinding({
    event: 'code_loaded',
    data: {
      files: enrichableFiles.map(f => ({ filename: f.filename, lines: f.lines, patch: f.patch || '' })),
    },
  });

  let prId;
  if (existingPrId) {
    prId = existingPrId;
    await queries.updatePRStatus({ id: prId, status: 'processing', risk_score: 0 });
    // Mark as no longer just "imported" — it's now fully analyzed
    await pool.query('UPDATE public.pull_requests SET is_historical=false WHERE id=$1', [prId]);
  } else {
    prId = await queries.insertPR({
      project_id: projectId,
      pr_url: prUrl,
      repo: `${owner}/${repo}`,
      pr_number: number,
      pr_title: meta.title,
      author: meta.author,
      ticket_url: ticketUrl || null,
      files_count: files.length,
      is_historical: false,
    });
  }

  const profileState = await queries.getOrCreateProfile(projectId, meta.author);
  if (profileState.isNew) {
    onFinding({
      event: 'new_user',
      data: {
        author: meta.author,
        message: `First PR from ${meta.author} — building their baseline profile`,
      },
    });
  }

  const ruleWeights = profileState.profile?.rule_weights || {};
  const ruleThresholds = profileState.profile?.rule_thresholds || {};

  const patterns = await queries.getAuthorPatterns(projectId, meta.author);
  const patternMap = new Map(patterns.map(p => [p.rule_name, Number(p.count || 0)]));
  const dangerFiles = await queries.getDangerZoneFiles(projectId);
  const suppressionMap = await queries.getSuppressionMap(projectId, meta.author);

  const intentCheck = await validateIntent(
    ticketUrl,
    files.map(f => f.filename),
    (url) => require('../github/fetcher').fetchIssueText(url, githubToken)
  );

  if (intentCheck.hasWarning) {
    onFinding({ event: 'intent_warning', data: { message: intentCheck.message } });
  }

  let totalFindings = 0;
  let criticalCount = 0;
  let warningCount = 0;
  let infoCount = 0;

  for (const file of enrichableFiles) {
    if (!file.lines.length) continue;

    const allLineContents = file.lines.map(l => l.content);
    const isDangerZone = dangerFiles.has(file.filename);

    for (let li = 0; li < file.lines.length; li++) {
      const line = file.lines[li];
      const surroundingLines = allLineContents.slice(Math.max(0, li - 3), Math.min(allLineContents.length, li + 4));
      const hits = runRules(line, file.filename, patterns, surroundingLines);

      for (const hit of hits) {
        const suppressionKey = `${file.filename}::${hit.rule_name}`;
        const suppressionLevel = Number(suppressionMap.get(suppressionKey) || 0);

        const baseThreshold = Number(ruleThresholds[hit.rule_name] ?? 65);
        const escalatedThreshold = patternMap.get(hit.rule_name) >= 3 ? Math.max(40, baseThreshold - 10) : baseThreshold;

        const mlResult = await scoreFeatures(hit.features || []);
        if (!hit.isDeterministic && mlResult.score < escalatedThreshold) continue;

        const weight = Number(ruleWeights[hit.rule_name] ?? 1);
        const confidence = Math.min(100, (mlResult.score || 0) * weight);
        let severity = hit.isDeterministic || confidence >= 85 ? hit.severity : mlResult.severity;
        let falsePositiveLevel = 0;

        if (suppressionLevel >= 2) {
          falsePositiveLevel = 2;
        } else if (suppressionLevel === 1) {
          falsePositiveLevel = 1;
          severity = 'info';
        }

        const findingId = await queries.insertFinding({
          project_id: projectId,
          pr_id: prId,
          filename: file.filename,
          line_number: line.lineNo,
          rule_name: hit.rule_name,
          severity,
          confidence,
          message: hit.message,
          fix_hint: hit.fix_hint,
          author: meta.author,
          false_positive: falsePositiveLevel,
        });

        if (falsePositiveLevel === 0) {
          await queries.upsertPattern(projectId, meta.author, hit.rule_name);
        }

        const findingData = {
          id: findingId,
          project_id: projectId,
          pr_id: prId,
          filename: file.filename,
          line_number: line.lineNo,
          rule_name: hit.rule_name,
          severity,
          confidence,
          message: hit.message,
          fix_hint: hit.fix_hint,
          author: meta.author,
          isDangerZone,
          false_positive: falsePositiveLevel,
        };

        if (falsePositiveLevel === 0) {
          totalFindings += 1;
          if (severity === 'critical') criticalCount += 1;
          else if (severity === 'warning') warningCount += 1;
          else infoCount += 1;
        }

        onFinding({ event: 'finding', data: findingData });
      }
    }
  }

  if (process.env.ENABLE_LOGIC_REVIEW === 'true' && process.env.GROQ_API_KEY && !existingPrId) {
    onFinding({ event: 'logic_review_start', data: { chunks: chunks.length } });

    const logicFindings = await reviewAllChunks(chunks, (findingEvent) => {
      onFinding({ event: findingEvent.type, data: findingEvent.data });
    });

    for (const lf of logicFindings) {
      if (lf.severity === 'suggestion') continue;
      const logicRuleName = `logic:${lf.functionName}`;
      const suppressionKey = `${lf.filename}::${logicRuleName}`;
      const suppressionLevel = Number(suppressionMap.get(suppressionKey) || 0);
      const falsePositiveLevel = suppressionLevel >= 2 ? 2 : suppressionLevel === 1 ? 1 : 0;
      const effectiveSeverity = falsePositiveLevel === 1 ? 'info' : lf.severity;

      await queries.insertFinding({
        project_id: projectId,
        pr_id: prId,
        filename: lf.filename,
        line_number: lf.line,
        rule_name: logicRuleName,
        severity: effectiveSeverity,
        confidence: lf.confidence,
        message: lf.message,
        fix_hint: lf.fix,
        author: meta.author,
        false_positive: falsePositiveLevel,
      });

      if (falsePositiveLevel === 0) {
        if (effectiveSeverity === 'critical') criticalCount += 1;
        else if (effectiveSeverity === 'warning') warningCount += 1;
        else infoCount += 1;
        totalFindings += 1;
      }
    }

    onFinding({ event: 'logic_review_complete', data: { count: logicFindings.length } });
  }

  const riskScore = Math.min(100, criticalCount * 6 + warningCount * 2);
  await queries.updatePRStatus({ id: prId, status: 'complete', risk_score: riskScore });

  await queries.updateProfileStats(projectId, meta.author, {
    critical: criticalCount,
    warning: warningCount,
    info: infoCount,
  });
  await queries.recalculateWeights(projectId, meta.author);

  return { prId, totalFindings, riskScore, author: meta.author };
}

module.exports = { analyzePR };
