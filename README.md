# TechWire

A fully automated, **zero-cost** technology news aggregation site.

No database. No paid APIs. No cloud integrations. The **Git repository is the database** — every article is a Markdown file in `content/posts/`, rendered into pure static HTML by Next.js and served free from Cloudflare Pages or GitHub Pages.

A scheduled GitHub Action scrapes tech sources every 5 hours, rewrites each story into an original analytical briefing using a free AI tier (Gemini 1.5 Flash or Groq), commits the new Markdown, and the push triggers an automatic redeploy.

```
RSS / HN / Reddit ──▶ extract ──▶ de-duplicate ──▶ free AI rewrite ──▶ .md commit ──▶ static rebuild
        └──────────────────── all inside GitHub Actions, $0/month ────────────────────┘
```

---

## Table of contents

- [Cost breakdown](#cost-breakdown)
- [Directory map](#directory-map)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Getting a free AI key](#getting-a-free-ai-key)
- [The scraper](#the-scraper)
- [Deployment](#deployment)
- [AdSense setup](#adsense-setup)
- [Content format](#content-format)
- [Customisation](#customisation)
- [Troubleshooting](#troubleshooting)

---

## Cost breakdown

| Component | Service | Cost |
|---|---|---|
| Hosting + CDN | Cloudflare Pages / GitHub Pages | **$0** (unlimited bandwidth on Cloudflare) |
| Database | Git repository (Markdown files) | **$0** |
| Automation | GitHub Actions (~2 min/run × 5 runs/day) | **$0** (free on public repos) |
| AI rewriting | Gemini 1.5 Flash or Groq free tier | **$0** |
| **Total** | | **$0 / month** |

---

## Directory map

```
techwire/
├── .github/
│   └── workflows/
│       ├── scrape-and-publish.yml   # Autopilot: cron every 5h → scrape → AI → commit
│       └── deploy.yml               # Build static export → GitHub Pages
│
├── app/                             # Next.js App Router (all statically exported)
│   ├── layout.jsx                   # Root shell: header, footer, AdSense loader, JSON-LD
│   ├── globals.css                  # Hand-written CSS — no framework, tiny critical path
│   ├── page.jsx                     # Home: lead story + river + sidebar
│   ├── not-found.jsx                # 404
│   ├── posts/[slug]/page.jsx        # Article page (SSG one HTML file per .md)
│   ├── archive/page.jsx             # Full chronological index
│   ├── category/[silo]/page.jsx     # ★ The 5 silo hub pages (SSG)
│   ├── topics/
│   │   ├── page.jsx                 # Topic cloud
│   │   └── [topic]/page.jsx         # Per-topic archive (SSG from keywords)
│   ├── about/page.jsx               # Curation-index disclosure   ┐
│   ├── privacy-policy/page.jsx      # GDPR/CCPA + AdSense cookies ├ required for AdSense
│   ├── terms-of-service/page.jsx    # IP, acceptable use, liability┘
│   ├── contact/page.jsx             # Contact + corrections policy
│   ├── sitemap.js                   # → /sitemap.xml
│   ├── robots.js                    # → /robots.txt
│   └── rss.xml/route.js             # → /rss.xml
│
├── components/
│   ├── AdUnit.jsx                   # Responsive <ins class="adsbygoogle"> container
│   ├── AdsenseScript.jsx            # Loads the AdSense script after hydration
│   ├── ImageCredit.jsx              # "Photo by X on Unsplash" attribution caption
│   ├── Header.jsx  Footer.jsx
│   ├── Nav.jsx                      # Silo navigation (desktop bar + mobile menu)
│   ├── PostCard.jsx                 # Teaser card w/ next/image
│   ├── Sidebar.jsx                  # Sticky desktop rail + sidebar ad
│   ├── Prose.jsx                    # Renders build-time article HTML
│   └── JsonLd.jsx                   # Structured data
│
├── content/
│   ├── posts/                       # ★ THE DATABASE — one .md per article
│   │   └── *.md
│   └── .scraper-state.json          # Processed-URL memory (auto-managed)
│
├── lib/
│   ├── posts.js                     # fs + path + gray-matter parsing, topics, related, RSS
│   ├── silos.mjs                    # ★ The 5-category taxonomy + classifier
│   └── constants.mjs                # Shared Unsplash utm constants
│
├── public/
│   └── images/
│       └── thumbnails/              # Unsplash feature images, committed by the bot
│
├── scripts/
│   ├── scrape.mjs                   # ★ Main pipeline orchestrator
│   ├── selftest.mjs                 # Offline pipeline test suite (no network/API key)
│   ├── postbuild.mjs                # .nojekyll, CNAME, ads.txt, 404.html
│   ├── config.mjs                   # Sources, thresholds, blocklists
│   └── lib/
│       ├── sources.mjs              # RSS / Atom / Hacker News / Reddit collectors
│       ├── extract.mjs              # Dependency-free readability extractor
│       ├── ai.mjs                   # Gemini + Groq clients, prompt, output validation
│       ├── unsplash.mjs             # Licensed feature images + attribution capture
│       ├── store.mjs                # De-duplication + Markdown writer
│       └── utils.mjs                # slugify, similarity, retry, fetch, logging
│
├── site.config.mjs                  # Site name, URL, nav, ad slots — edit this first
├── next.config.mjs                  # output: 'export', unoptimized images
├── .env.example                     # Copy to .env.local
└── package.json
```

---

## Quick start

```bash
git clone https://github.com/<you>/techwire.git
cd techwire
npm install

cp .env.example .env.local     # then add an AI key (see below)

npm run dev                    # http://localhost:3000
```

Other commands:

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server with hot reload |
| `npm run build` | Static export into `./out` (+ postbuild extras) |
|  Serve the built `./out` locally | Serve the built `./out` locally |
| `npm run scrape` | Run the full pipeline: scrape → AI → write Markdown |
| `npm run scrape:dry` | Collect and rank candidates only — **no AI calls, no files written** |
| `node scripts/selftest.mjs` | Offline test suite for the pipeline (41 assertions, no network) |

Useful scraper flags:

```bash
node scripts/scrape.mjs --limit 2            # publish at most 2 articles
node scripts/scrape.mjs --provider groq      # force a provider
node scripts/scrape.mjs --dry-run            # preview the queue
LOG_LEVEL=debug node scripts/scrape.mjs      # show every skip decision
```

---

## Environment variables

Copy `.env.example` → `.env.local`. Nothing here is required just to run the **site**; only the scraper needs a key.

### Secrets (never commit — GitHub → Settings → Secrets → Actions)

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | one of the two | Google AI Studio key |
| `GROQ_API_KEY` | one of the two | Groq Cloud key |
| `UNSPLASH_ACCESS_KEY` | recommended | Unsplash Access Key for licensed feature images |

### Public config (GitHub → Settings → Variables → Actions)

| Variable | Default | Description |
|---|---|---|
| `AI_PROVIDER` | auto | `gemini` or `groq`; auto-detected from whichever key exists |
| `GEMINI_MODEL` | `gemini-1.5-flash-latest` | Model override |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Model override |
| `MAX_POSTS_PER_RUN` | `4` | Publish cap per run |
| `MAX_AGE_HOURS` | `48` | Ignore stories older than this |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |
| `UNSPLASH_APP_NAME` | `techwire` | Registered Unsplash app name; used as `utm_source` |
| `NEXT_PUBLIC_SITE_URL` | `https://techwire.pages.dev` | Canonical origin for SEO tags |
| `NEXT_PUBLIC_BASE_PATH` | *(empty)* | Only for GitHub Pages **project** sites, e.g. `/techwire` |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | *(empty)* | `ca-pub-…`; blank keeps ad slots inert |
| `NEXT_PUBLIC_ADSLOT_*` | *(empty)* | Per-slot AdSense ids |
| `CUSTOM_DOMAIN` | *(empty)* | Writes a `CNAME` into the build output |

---

## Getting a free AI key

**Option A — Google Gemini 1.5 Flash** (recommended: generous free tier, strong long-context handling)

1. Go to <https://aistudio.google.com/app/apikey>
2. *Create API key* → copy it
3. `GEMINI_API_KEY=...` in `.env.local`, and add it as a GitHub Actions secret

**Option B — Groq** (fastest inference, free developer tier)

1. Go to <https://console.groq.com/keys>
2. Create a key → copy it
3. `GROQ_API_KEY=...`

At 4 articles per run × 5 runs/day = 20 generations/day, both providers sit comfortably inside their free limits.

---

## Feature images and Unsplash attribution

By default the scraper falls back to the source article's Open Graph image. That image is **copyrighted by the publisher**, and hotlinking it is the kind of thing AdSense review flags. Setting an Unsplash key replaces it with a properly licensed, properly attributed photo.

Get a free key at <https://unsplash.com/oauth/applications> → *New Application* → copy the **Access Key** into `UNSPLASH_ACCESS_KEY`.

### What the scraper captures

For each article the AI returns 2-3 **concrete, photographable** terms (`image_keywords` — e.g. "data center", "server rack") separate from the SEO keywords, because abstract phrases like "market consolidation" match no stock photography. The scraper searches `orientation=landscape` with those terms, progressively broadening if there are no results, then extracts:

| Field | Source in the API response |
|---|---|
| Photographer name | `user.name` |
| Photographer profile URL | `user.links.html` + `?utm_source=<app>&utm_medium=referral` |
| Image file | `urls.regular`, saved to `public/images/thumbnails/<slug>.jpg` |

It also pings `links.download_location`, which the [Unsplash API guidelines](https://help.unsplash.com/en/articles/2511245) require whenever a photo is used. Results lacking a name or profile URL are skipped rather than published uncredited.

Images are **downloaded and committed**, not hotlinked — so the site keeps working if Unsplash is unreachable, and the images are served from your own CDN.

### Front-matter written

```yaml
image: "/images/thumbnails/slug.jpg"
image_credit_name: "John Doe"
image_credit_url: "https://unsplash.com/@johndoe?utm_source=techwire&utm_medium=referral"
```

The two `image_credit_*` keys are **omitted entirely** when there is no credit, so hand-written posts stay clean.

### How it renders

`components/ImageCredit.jsx` renders directly beneath the hero image, and only when `image_credit_name` exists:

> *Photo by [John Doe](#) on [Unsplash](#)*

Styled via the `.image-credit` class in `app/globals.css` — 0.75rem, italic, muted, `margin-top: 8px`. Visually unobtrusive but unambiguous to an AdSense reviewer. (This project uses hand-written CSS rather than Tailwind; the class is the equivalent of `text-xs text-gray-500 mt-2 italic`.)

### Storage note

Each thumbnail is roughly 100–200KB and is committed to the repo. At 4 articles per run × 5 runs/day that is about **100–250 MB per year**. Well within GitHub's limits for a long while, but if you run this for years, periodically prune thumbnails for old posts or switch to hotlinking `urls.regular` instead.

---

## The scraper

`scripts/scrape.mjs` runs this sequence:

1. **Collect** — pulls RSS/Atom from TechCrunch, The Verge, Ars Technica, Engadget and Wired, plus the Hacker News front page (Algolia API) and `r/technology` / `r/programming`. Every source is fetched in parallel; a source that fails is logged and skipped, never fatal.
2. **De-duplicate** — reads the front-matter of every existing file in `content/posts/` and rejects a candidate if the normalized `source_url` already exists, or if its title is ≥72% similar (Jaccard over significant tokens) to a published headline. This catches the same story covered by five outlets.
3. **Filter** — drops paywalled/blocked domains, low-signal headlines (deals, "Ask HN", giveaways) and anything older than `MAX_AGE_HOURS`.
4. **Rank & diversify** — scores by freshness, community score and metadata richness, then interleaves outlets so one prolific feed can't dominate a run.
5. **Extract** — a dependency-free readability implementation scores page blocks by paragraph density, strips nav/promo/boilerplate, and pulls Open Graph metadata for the hero image.
6. **Generate** — sends the text to Gemini or Groq with a prompt enforcing AdSense policy (originality, no plagiarism, no sensationalism, unique analytical value) and SEO structure (keyworded H1 of 50–65 chars, 140–155 char meta description, 4–6 H2s with H3s, 800–1200 words, snippet-optimised opening, forward-looking close). Output is strict JSON.
7. **Validate** — rejects short bodies, strips duplicate H1s, demotes stray H1s to H2, normalises keywords, and skips anything the model flags with confidence < 0.4.
8. **Illustrate** — if `UNSPLASH_ACCESS_KEY` is set, downloads a licensed feature image and captures the photographer's name and profile URL (see above). Failures here never drop the article; it just falls back to the source image.
9. **Write** — saves `slug-title.md` with the exact front-matter contract, and records processed URLs in `content/.scraper-state.json`.

Tune sources, thresholds and blocklists in `scripts/config.mjs`.

### Testing without a key

```bash
npm run scrape:dry              # see what it would publish
node scripts/selftest.mjs       # verify parsers/dedupe/writer against local fixtures
```

---

## Deployment

### Cloudflare Pages (recommended — unlimited bandwidth)

Cloudflare builds the site itself on every push, so there is nothing to upload
by hand and no workflow to maintain. Roughly five minutes end to end.

#### 1. Push the repo to GitHub

Cloudflare deploys from a branch, so the code has to be on GitHub first.

```bash
git push origin main
```

#### 2. Create the Pages project

1. Go to <https://dash.cloudflare.com> and sign in (a free account is enough).
2. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Authorise Cloudflare for your GitHub account, then pick the `techwire` repo.
4. Press **Begin setup**.

#### 3. Build settings

Enter exactly these values:

| Field | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | **Next.js (Static HTML Export)** |
| Build command | `npm run build` |
| Build output directory | `out` |
| Root directory | *(leave empty)* |

#### 4. Environment variables

Still on the setup screen, open **Environment variables (advanced)** and add:

| Variable | Value | Why |
| --- | --- | --- |
| `NODE_VERSION` | `20` | Cloudflare still defaults to an older Node; the build needs 20+ |
| `NEXT_PUBLIC_SITE_URL` | `https://<project>.pages.dev` | Canonical URLs, `sitemap.xml`, `rss.xml` and JSON-LD are absolute |

Leave `NEXT_PUBLIC_BASE_PATH` **empty** — that is only for GitHub Pages project
sites. Setting it on Cloudflare will break every asset path.

You do **not** need `GEMINI_API_KEY` or `GROQ_API_KEY` here. Cloudflare only
builds pages from Markdown that already exists; the AI keys live in GitHub
Secrets, where the scraper actually runs.

#### 5. Deploy

Press **Save and Deploy**. The first build takes 2–3 minutes. When it finishes
you get a live URL at `https://<project>.pages.dev`.

> If you guessed the URL wrong in step 4, fix `NEXT_PUBLIC_SITE_URL` under
> **Settings → Environment variables** now that you know the real one, then
> **Deployments → Retry deployment**. Canonical tags and the sitemap are baked
> in at build time, so they only pick up the change on a rebuild.

#### 6. Turn off the GitHub Pages workflow

Two hosts publishing the same repo wastes Actions minutes and gets confusing.
Either delete `.github/workflows/deploy.yml`, or disable it under
**Actions → Deploy to GitHub Pages → ⋯ → Disable workflow**.

Keep `scrape-and-publish.yml` enabled — that is the autopilot, and it is what
triggers Cloudflare rebuilds by committing new articles.

#### Custom domain (optional)

1. **Your Pages project → Custom domains → Set up a domain**, enter the domain.
2. If the domain is already on Cloudflare, the DNS record is created for you.
   Otherwise add the `CNAME` it shows you at your registrar.
3. Update `NEXT_PUBLIC_SITE_URL` to the new domain and redeploy so canonical
   URLs follow. HTTPS is provisioned automatically.

`CUSTOM_DOMAIN` in `.env` is only needed for GitHub Pages (it writes a `CNAME`
file). Cloudflare ignores it.

#### How updates work from here

```
scrape-and-publish.yml (every 5h)
  └─ commits new Markdown to main
       └─ Cloudflare sees the push
            └─ runs npm run build
                 └─ live in ~2 min
```

Nothing to click. The same happens for any change you push yourself.

#### Caching

`scripts/postbuild.mjs` writes an `out/_headers` file that Cloudflare reads
automatically:

- `/_next/static/*` — cached one year, immutable (filenames are content-hashed)
- HTML — `max-age=0, must-revalidate`, so new articles appear immediately

HTML is deliberately never cached at the edge. Global CSS is embedded directly
by `RootLayout` while Next renders each static document, so an exported page
cannot depend on a separate stylesheet request. This remains true even if a host
runs `next build` directly instead of invoking npm lifecycle hooks.

#### Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Build fails, `Unsupported engine` / syntax errors | `NODE_VERSION` missing. Add it as `20` and redeploy. |
| Build succeeds, site 404s | Output directory is not `out`. |
| Pages load but images and JS 404 | `NEXT_PUBLIC_BASE_PATH` is set. Clear it and redeploy. |
| Pages appear as unstyled browser-default HTML | Redeploy the current revision. It embeds the global stylesheet in every static HTML document, so no CSS asset request can fail. Keep the build command as `npm run build`. |
| Canonical URLs point at `techwire.pages.dev` | `NEXT_PUBLIC_SITE_URL` still holds the default. Update and rebuild. |
| New articles not appearing | Check the **Actions** tab — the scraper commits, Cloudflare only reacts to the push. |
| Scrape run is green but no article was published | Open the run summary: it now prints candidates attempted / published / failed. A run that attempts candidates and publishes none exits non-zero, so a green tick with zero posts should no longer be possible. |
| Scraper log shows `Gemini HTTP 404 … model is not served` | The configured model id no longer exists. Google retired the Gemini 1.5 family in late 2025. Set the `GEMINI_MODEL` variable to a current model, e.g. `gemini-2.5-flash`. |
| A commit lands but no Cloudflare deployment starts | The commit message must not contain `[skip ci]` / `[CI Skip]` / `[CF-Pages-Skip]`. Cloudflare Pages honours these markers and skips the build **without showing a check run**, so it looks like nothing happened. The autopilot no longer adds one. |
| Scraper log shows `No AI key reached this job` | The key is an *environment* secret, not a *repository* secret. Environment-scoped secrets are only exposed to jobs that declare that `environment:`. Re-add it under **Settings → Secrets and variables → Actions → Repository secrets**. |
| Every commit has a red X from "Deploy to GitHub Pages" | That workflow is manual-only now, since this project deploys via Cloudflare. It failed on every push because GitHub Pages was never enabled. |

### GitHub Pages

1. **Settings → Pages → Source: GitHub Actions**
2. Push to `main` — `deploy.yml` builds and deploys automatically
3. For a **project** site (`user.github.io/techwire`), the workflow sets `NEXT_PUBLIC_BASE_PATH` from the Pages config automatically. For a **user** site or custom domain, leave it empty and set the `CUSTOM_DOMAIN` variable.

### Enabling the autopilot

1. Add `GEMINI_API_KEY` or `GROQ_API_KEY` under **Settings → Secrets and variables → Actions → Secrets**
2. **Settings → Actions → General → Workflow permissions → Read and write permissions**
3. **Actions** tab → *Scrape and Publish* → **Run workflow** to test immediately

> Scheduled workflows are disabled automatically on public repos after 60 days without activity. The content commits keep it alive; if the repo goes quiet, re-enable it from the Actions tab.

---

## AdSense setup

The ad containers are already in place and render as empty, reserved boxes until you add a publisher id — so there is **no layout shift** when ads switch on.

Slot positions (exactly as required):

| Position | Component | Where |
|---|---|---|
| Below the H1 | `<AdUnit variant="below-title" />` | `app/posts/[slug]/page.jsx`, directly under the title |
| Mid-article | `<AdUnit variant="in-article" />` | injected between content halves, split at an `<h2>` boundary |
| Sticky sidebar | `<AdUnit variant="sidebar" />` | `components/Sidebar.jsx`, desktop ≥1024px only |
| Footer | `<AdUnit variant="footer" />` | `app/layout.jsx`, sitewide |

To activate:

1. Apply at <https://adsense.google.com> — you need real content and the legal pages (both already built)
2. Set `NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX`
3. Create ad units in AdSense and set each `NEXT_PUBLIC_ADSLOT_*` id
4. Rebuild — `postbuild.mjs` writes `ads.txt` automatically from your publisher id

**Approval checklist (all handled by this repo):** original analytical content ✓ · `/privacy-policy` with cookie + GDPR/CCPA disclosure ✓ · `/terms-of-service` ✓ · `/about` disclosing the curation model ✓ · `/contact` ✓ · source attribution on every article ✓ · `ads.txt` ✓ · mobile responsive ✓ · fast Core Web Vitals ✓

> Build 20–30 articles before applying. Let the autopilot run for about a week first.

---

## Content silos

The site is organised into five fixed, high-traffic categories defined in `lib/silos.mjs`:

| | Category | Covers | URL |
|---|---|---|---|
| 🤖 | Artificial Intelligence | LLMs, neural networks, automation tools | `/category/artificial-intelligence` |
| 📱 | Gadgets & Hardware | Smartphones, chips, laptops, wearables | `/category/gadgets-hardware` |
| 💻 | Software & Dev | Apps, open source, programming updates | `/category/software-dev` |
| 🔒 | Cybersecurity | Privacy, patches, data security | `/category/cybersecurity` |
| 🚀 | Startups & Business | Funding, market shifts, mergers | `/category/startups-business` |

Unlike the free-form `keywords` field (which generates long-tail `/topics/*` pages), silos are a **closed set**. That gives the site a stable information architecture, predictable internal linking and clean navigation.

**How a post gets its silo**, in priority order:

1. The `category` field in front-matter, set by the AI pipeline, which picks from the five slugs.
2. Otherwise, keyword and title pattern-matching in `classifyPost()`. Multi-word matches score higher than single words, keyword matches outrank title matches, and a breadth bonus favours the silo matching the most distinct terms — so a chip story that merely mentions AI stays in Hardware.
3. If nothing matches, it falls back to the first silo rather than being orphaned from the nav.

To change the taxonomy, edit `SILOS` in `lib/silos.mjs`. Nav, footer, category pages, sitemap, homepage browser and card badges all derive from that one array.

### Navigation behaviour

- **Desktop (≥1000px):** one horizontal row using the short labels (AI, Hardware, Software, Security, Business) so all five fit beside the brand without wrapping.
- **Mobile (<1000px):** a hamburger disclosure menu showing full category names with their descriptions. Closes on route change, on Escape, and on backdrop click; locks body scroll while open; all rows are 52px touch targets.

---

## Content format

Every file in `content/posts/` follows this contract:

```yaml
---
title: "SEO Target Title Here"
description: "150-character meta description here."
date: "YYYY-MM-DD"
keywords: ["tech", "ai", "gadgets"]
category: "artificial-intelligence"
image: "/images/thumbnails/slug.jpg"
image_credit_name: "John Doe"
image_credit_url: "https://unsplash.com/@johndoe?utm_source=techwire&utm_medium=referral"
source_url: "https://originalsource.com/article"
source_name: "Original Outlet"
author: "TechWire Desk"
---

## First H2 subheading

Body markdown. No H1 here — it is rendered from `title`.
```

`title`, `description`, `date`, `keywords`, `image` and `source_url` are the required six; `category`, `image_credit_name`, `image_credit_url`, `source_name` and `author` are optional — omit `category` and the silo is inferred from keywords. When both `image_credit_*` fields are present the attribution caption renders under the hero image; omit them and it disappears. `keywords` drive the auto-generated topic pages and related-article matching. Hand-written files work exactly the same as generated ones — just drop a `.md` in the folder.

---

## Customisation

| Goal | File |
|---|---|
| Site name, tagline, nav, ad slots | `site.config.mjs` |
| Colours, typography, layout | `app/globals.css` (CSS custom properties at the top) |
| Categories, emoji, classifier keywords | `lib/silos.mjs` → `SILOS` |
| Add/remove scrape sources | `scripts/config.mjs` → `SOURCES` |
| Change the AI editorial voice | `scripts/lib/ai.mjs` → `SYSTEM_PROMPT` |
| Publishing cadence | `.github/workflows/scrape-and-publish.yml` → `cron` |
| Dedupe strictness | `scripts/config.mjs` → `duplicateThreshold` |

The light/dark theme follows the OS setting automatically via `prefers-color-scheme`.

---

## Troubleshooting

**Scraper publishes nothing.** Usually correct behaviour — everything was a duplicate. Run `LOG_LEVEL=debug npm run scrape` to see each skip reason.

**"No AI key found".** Set `GEMINI_API_KEY` or `GROQ_API_KEY` in `.env.local` locally, or as an Actions secret in CI.

**Action can't push.** Settings → Actions → General → Workflow permissions → **Read and write**.

**CSS/JS missing on GitHub Pages.** `NEXT_PUBLIC_BASE_PATH` must match your repo subpath (`/techwire`), and `.nojekyll` must exist — `postbuild.mjs` writes it.

**Ads not showing.** New AdSense accounts take time to fill; confirm `ads.txt` resolves at your domain root and that the publisher id matches.

**No image attribution appears.** The caption only renders when both `image_credit_name` and `image_credit_url` are in the front-matter. Without `UNSPLASH_ACCESS_KEY` the scraper falls back to the source's Open Graph image, which has no credit data.

**Extraction returns too little text.** Some sites block bots or render client-side. Those candidates are skipped automatically; add persistent offenders to `BLOCKED_DOMAINS` in `scripts/config.mjs`.

---

## License

MIT for the code. Published articles are original editorial content; each credits and links to the reporting that prompted it.
