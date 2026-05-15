const axios = require('axios');

async function listUserRepos(githubToken) {
  let page = 1;
  const allRepos = [];

  while (true) {
    const res = await axios.get('https://api.github.com/user/repos', {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
      params: {
        per_page: 100,
        page,
        sort: 'updated',
        affiliation: 'owner,collaborator,organization_member',
      },
      timeout: 15000,
    });

    if (res.data.length === 0) break;

    allRepos.push(...res.data.map(r => ({
      full_name: r.full_name,
      name: r.name,
      owner: r.owner.login,
      private: r.private,
      description: r.description,
      updated_at: r.updated_at,
      language: r.language,
    })));

    if (res.data.length < 100) break;
    page += 1;
  }

  return allRepos.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}

module.exports = { listUserRepos };
