source "https://rubygems.org"

# Plain Jekyll on the current 4.x line — replaces the legacy `github-pages` meta-gem
# (which pinned old, GitHub-server-matched versions and lagged modern Ruby).
# The site is now built and deployed by GitHub Actions (see .github/workflows/jekyll.yml).
gem "jekyll", "~> 4.4"

# WEBrick left Ruby's standard library in 3.0, but `jekyll serve` still needs it.
gem "webrick", "~> 1.9"

# Jekyll plugins go here. None are required today; common additions:
group :jekyll_plugins do
  # gem "jekyll-sitemap"
  # gem "jekyll-seo-tag"
  # gem "jekyll-feed"
end
