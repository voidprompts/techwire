---
title: "The Open Source License Shift Enterprises Cannot Ignore"
description: "Source-available licenses are replacing true open source in infrastructure software. Analysis of what changes for enterprise buyers, forks and vendor leverage."
date: "2025-09-18"
keywords: ["open source", "software licensing", "enterprise software", "developer tools", "cloud computing"]
image: "/images/seed-licensing.jpg"
source_url: "https://example.com/open-source-licensing"
source_name: "Example Tech Wire"
author: "TechWire Desk"
---

A steady procession of infrastructure companies has now moved core products away from permissive open source licenses toward source-available terms that restrict commercial redistribution. Each individual move gets framed as a narrow response to cloud providers reselling someone else's work. Taken together, they represent something larger: the collapse of a business model that the industry spent fifteen years assuming was settled.

## What actually changed, in plain terms

A permissive license such as Apache 2.0 or MIT lets anyone use, modify and resell the software, including as a hosted service, with essentially no obligation beyond attribution. A source-available license lets you read and modify the code but prohibits offering it as a competing managed service. The code is visible; the commercial freedom is not.

The distinction matters legally and practically. Software under a source-available license is not open source under the Open Source Initiative's definition, which means it fails procurement checklists, cannot be included in certain distributions, and disqualifies itself from some public-sector tenders. Companies making the switch are trading ecosystem reach for revenue protection, and they generally know it.

### Why the original model stopped working

The open-core bargain assumed a specific sequence: give away the engine, build a community, sell the management layer and enterprise features on top. It worked while the vendor was the only credible operator of its own software.

Cloud providers broke that assumption. A hyperscaler can take a popular open source database, wrap it in its own control plane, integrate it with its identity and billing systems, and sell it to customers who were never going to evaluate the original vendor. The provider captures the revenue; the vendor captures the maintenance burden. That is not free riding in a legal sense — permissive licenses explicitly allow it — but it is a structural mismatch between who funds development and who monetises it.

## The consequences for enterprise buyers

### Procurement complexity returns

Legal teams spent years building comfort with a small set of well-understood licenses. Source-available terms are bespoke, vary between vendors, and often contain ambiguity about what counts as a competing service. An internal platform team offering a database to other business units inside the same company is usually fine — but "usually" is doing real work in that sentence, and it is the kind of ambiguity that slows deals.

### Exit costs rise quietly

The practical value of an open source dependency is not only the price. It is the assurance that if the vendor fails, gets acquired, or raises prices unreasonably, you can keep running the software and hire someone else to maintain it. Source-available terms weaken that assurance without removing it entirely. Buyers should price the difference explicitly rather than treating "we have the source code" as equivalent to the protection they had before.

### Fork risk cuts both ways

Several high-profile relicensing events have produced community forks maintained under foundation governance. For buyers, a fork is genuinely useful leverage — but only if it sustains real engineering investment. Forks that attract multiple commercially motivated maintainers tend to persist. Forks that depend on volunteer goodwill tend to decay within a couple of release cycles.

## How to evaluate a source-available dependency

A short, practical checklist for teams making this decision:

1. **Identify the exact restricted activity.** Most licenses only prohibit offering the software as a service to third parties. Confirm whether your use case is even touched.
2. **Check the change-date clause.** Some licenses convert to a permissive license after a fixed period, typically three or four years. That materially changes the long-term risk.
3. **Assess the fork's health.** Count distinct corporate contributors in the last six months, not GitHub stars.
4. **Negotiate the ambiguity away.** If the license is unclear about your scenario, get written clarification as part of the contract rather than relying on interpretation.
5. **Budget for the migration you hope never to run.** Knowing the rough cost of moving off a dependency is the entire basis of your negotiating position.

## The counter-argument worth taking seriously

There is a legitimate case that this shift improves the ecosystem. Unfunded critical infrastructure is a genuine and well-documented problem; maintainer burnout is real, and the security consequences of underfunded dependencies have been expensive. A licensing model that reliably funds full-time maintenance produces better-maintained software than one that depends on the goodwill of people with day jobs.

The honest assessment is that both things are true. Relicensing does concentrate control in a single vendor, and it does, in many cases, fund the sustained engineering that keeps the project viable. Which effect dominates depends almost entirely on the specific project's governance and the credibility of its fork.

## What to watch next

Watch whether foundation-governed forks retain corporate contributors past their second year, because that is the point at which initial political enthusiasm gives way to ordinary maintenance work. Watch whether hyperscalers respond by funding neutral alternatives more seriously, which would be the clearest signal that the relicensing strategy is working as intended. And watch procurement policy at large regulated buyers, since a formal preference for OSI-approved licenses would put real commercial pressure on the trend in a way that developer sentiment alone has not.
