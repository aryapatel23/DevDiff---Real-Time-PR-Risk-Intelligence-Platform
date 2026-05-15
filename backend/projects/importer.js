const queries = require('../db/queries');
const { fetchMergedPRs, fetchPRFiles } = require('../github/fetcher');

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
    console.log(`[import] Done: ${imported} PRs`);
  } catch (err) {
    console.error('[import] Fatal:', err.message);
    await queries.updateProjectImportStatus(projectId, 'error', 0);
  }
}

module.exports = { startHistoricalImport };
