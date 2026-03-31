# STATSTRO 2026 Website

## Overview
Conference website for **STATSTRO 2026: Sampling, Simulation, and Scientific Discovery**, a 2-day interdisciplinary astrostatistics workshop at the University of Toronto, July 16-17, 2026.

## Tech Stack
- **Jekyll** on **GitHub Pages** (auto-builds from `main` branch)
- Sass for styles, vanilla JS for interactivity
- No build tools or CI/CD required — push to main and GitHub Pages handles the rest

## Design System: "Cosmic Cartographer"
Sampling and simulation as exploring/mapping unknown territory. Antique star charts meet modern computational aesthetics.

### Colors
| Token | Hex | Usage |
|-------|-----|-------|
| Navy | `#0B1D3A` | Primary background, dark sections |
| Gold | `#D4A843` | Accents, headings, highlights, links |
| Cream | `#F5F0E8` | Light backgrounds, body text on dark |
| Teal | `#2A9D8F` | Secondary accent, data viz, buttons |
| Coral | `#C45B3E` | Tertiary accent, alerts, highlights |

### Typography
- **Headings:** Playfair Display (Google Fonts)
- **Body:** Inter (Google Fonts)

## Content Editing
All conference content lives in `_data/` YAML files. To update:
- **Speakers:** Edit `_data/speakers.yml`
- **Schedule:** Edit `_data/schedule_day1.yml` or `_data/schedule_day2.yml`
- **Organizers:** Edit `_data/organizers.yml`
- **Sponsors:** Edit `_data/sponsors.yml`

Organizers can edit these directly in the GitHub web UI — no local setup needed.

## File Organization
```
_config.yml          → Site metadata and Jekyll settings
_data/               → All content (speakers, schedule, sponsors, etc.)
_includes/           → HTML partials for each section
_layouts/            → Page layout templates
_sass/               → Sass partials (design tokens, components)
assets/css/          → Sass entry point
assets/js/           → Hero animation + main scripts
assets/images/       → Speaker photos, sponsor logos
index.html           → Main single-page site
code-of-conduct.md   → Standalone Code of Conduct page
```

## Local Development
```bash
bundle install
bundle exec jekyll serve
# Site available at http://localhost:4000
```

## Deployment
Push to `main` branch. GitHub Pages auto-builds and deploys. Domain: statstro.com (DNS configured via Squarespace).

## Image Guidelines
- **Speaker photos:** Square crop, ~300x300px, JPEG, placed in `assets/images/speakers/`
- **Sponsor logos:** PNG with transparent background, ~200px wide, in `assets/images/logos/`
