const queries = require('../db/queries');
const { fetchMergedPRs, fetchPRFiles } = require('../github/fetcher');
const { analyzePR } = require('../analysis/pipeline');

const HISTORICAL_ANALYSIS_LIMIT = 20;

async function startHistoricalImport(projectId, githubRepo, githubToken, limit = 30) {
  console.log(`[import] Starting ${githubRepo} (${limit} PRs)`);

  try {
    await queries.updateProjectImportStatus(projectId, 'running', 0);
    const [owner, repo] = githubRepo.split('/');
    const mergedPRs = await fetchMergedPRs(owner, repo, limit, githubToken);

    let imported = 0;

    for (const pr of mergedPRs) {
      try {
        const files = await fetchPRFiles(owner, repo, pr.number, githubToken);
        await queries.insertPR({
          project_id: projectId,
          pr_url: pr.html_url,
          repo: githubRepo,
          pr_number: pr.number,
          pr_title: pr.title,
          author: pr.user.login,
          files_count: files.length,
          is_historical: true,
          status: 'imported',
          risk_score: null,
        });

        imported += 1;
        await queries.updateProjectImportStatus(projectId, 'running', imported);
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (e) {
        console.error(`[import] PR #${pr.number} error:`, e.message);
      }
    }

    await queries.updateProjectImportStatus(projectId, 'done', imported);
    console.log(`[import] Done: ${imported} PRs imported`);

    // After import, automatically analyze the most recent historical PRs
    startHistoricalAnalysis(projectId, githubToken);
  } catch (err) {
    console.error('[import] Fatal:', err.message);
    await queries.updateProjectImportStatus(projectId, 'error', 0);
  }
}

async function startHistoricalAnalysis(projectId, githubToken) {
  try {
    const unanalyzedPRs = await queries.getUnanalyzedHistoricalPRs(projectId, HISTORICAL_ANALYSIS_LIMIT);
    if (unanalyzedPRs.length === 0) {
      console.log(`[historical-analysis] No unanalyzed PRs for project ${projectId}`);
      return;
    }

    console.log(`[historical-analysis] Analyzing ${unanalyzedPRs.length} historical PRs for project ${projectId}`);
    await queries.updateProjectAnalysisStatus(projectId, 'running', 0, unanalyzedPRs.length);

    let analyzed = 0;

    for (const pr of unanalyzedPRs) {
      try {
        console.log(`[historical-analysis] Analyzing PR #${pr.pr_number} (${pr.author})...`);

        await analyzePR(pr.pr_url, null, projectId, githubToken, () => {}, pr.id);

        analyzed += 1;
        await queries.updateProjectAnalysisStatus(projectId, 'running', analyzed, unanalyzedPRs.length);
        console.log(`[historical-analysis] PR #${pr.pr_number} done (${analyzed}/${unanalyzedPRs.length})`);

        // Rate limit: 3 seconds between analyses to avoid Groq API rate limits
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (e) {
        console.error(`[historical-analysis] PR #${pr.pr_number} error:`, e.message);
        // Mark as analyzed even on error to avoid retry loops
        analyzed += 1;
        await queries.updateProjectAnalysisStatus(projectId, 'running', analyzed, unanalyzedPRs.length);
      }
    }

    await queries.updateProjectAnalysisStatus(projectId, 'done', analyzed, unanalyzedPRs.length);
    console.log(`[historical-analysis] Done: ${analyzed}/${unanalyzedPRs.length} PRs analyzed`);
  } catch (err) {
    console.error('[historical-analysis] Fatal:', err.message);
    await queries.updateProjectAnalysisStatus(projectId, 'error', 0, 0);
  }
}

module.exports = { startHistoricalImport, startHistoricalAnalysis };
