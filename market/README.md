# Market catalog entries

The DSH market (`dshmarket`) shows the catalog at `awesome-dsh-plugin.com/plugins.json`, which is
**generated** from `github.com/awesome-dsh-plugin/awesome-dsh-plugin`'s `data/plugins/*.yml`. Registering
a plugin is a PR against that repo adding ONE file per plugin — the three here are ready to copy, named
exactly as that repo expects (generate, assets, localize).

The Release tarballs work **without** this step: paste a tarball URL into Settings → Plugins → Add plugin
(or `dsh plugin --profile <p> add <url>`). The catalog entry is what makes a plugin *findable* in the
market UI instead of installed by URL.

Checklist for the PR (from the repo README):

- the repo is public with the `dsh-plugin` topic, and is old enough with enough commits for their CI;
- keep the Release tarballs up to date — the market prefers a published Release tarball over
  build-from-source;
- update an entry by editing only our own `data/plugins/*.yml` and regenerating their README.
