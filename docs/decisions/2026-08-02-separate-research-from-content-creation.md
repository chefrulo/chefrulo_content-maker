# Architecture Decision: Separate Research from Content Creation

## Background

After testing the current content generation pipeline, we realised that the system is producing technically correct content, but it doesn't feel like **Chef Rulo**.

The research engine is working well.

The content engine is not.

The reason is architectural.

Today the system uses influencer content as the starting point for idea generation.

That is the wrong source.

Influencers should never define what we talk about.

They should only help us understand **how people currently consume content**.

Our ideas must always originate from our own knowledge base.

---

# New Architecture

We are separating the system into two completely independent engines.

## Engine 1 — Research Intelligence

Purpose:

Understand what is happening on Instagram.

Nothing else.

Inputs:

* Influencers
* Competitors
* Trend accounts
* Educational creators
* Food creators

Outputs:

* Trend reports
* Best performing hooks
* Content formats
* Average reel duration
* CTA patterns
* Emotional patterns
* Posting frequency
* Topics becoming saturated
* Emerging opportunities

This engine NEVER generates content.

It NEVER proposes Chef Rulo posts.

It NEVER writes scripts.

Its only job is to inform humans.

Think of it as market intelligence.

---

## Engine 2 — Editorial Content Engine

Purpose:

Generate original Chef Rulo content.

Inputs:

* Brand Brain
* Editorial Manifesto
* Writing Style
* Content Architecture
* Canonical Articles
* Editorial Territories
* Approved Reel Examples
* Idea Library

Outputs:

* Content ideas
* Briefs
* Reels
* Carousels
* Stories
* Articles
* Newsletters

This engine should NEVER start from influencer content.

Its starting point is always the Brand Brain.

---

# The New Content Flow

Brand Brain

↓

Canonical Article

↓

Idea Library

↓

Approved Brief

↓

Script

↓

Storyboard

↓

Final Reel

---

# The Missing Layer: Idea Library

The system currently jumps directly from an article to a Reel.

That skips the most valuable step.

Instead, every article should first generate a permanent library of ideas.

Example:

Article

Asado

↓

Idea Library

* Why does an asado last five hours?
* Why does the fire matter more than the grill?
* Why is choripán served first?
* What should guests never do?
* Why do Argentines argue about salt?
* What makes an asado different from a barbecue?
* Why is the asador respected?
* Why is meat served in stages?
* Why is asado really about people rather than food?

These ideas become permanent assets.

They are never regenerated.

They simply become available for future content.

---

# Approved Briefs

Each idea should evolve into an approved brief.

A brief contains:

* Hook
* Core message
* Cultural insight
* Personal story (if available)
* Educational value
* CTA

Once approved, the brief becomes reusable.

The Reel Generator should work from approved briefs, not directly from articles.

---

# Role of Research

Research should enrich existing ideas.

Example:

Idea:

"Why is choripán served first?"

Research can contribute:

* Hook styles currently performing well
* Reel pacing
* Editing style
* Caption length
* CTA trends

Research should never replace the original idea.

The idea always belongs to Chef Rulo.

---

# Editorial Principle

We are not building a system that imitates Instagram.

We are building a system that expands the Chef Rulo knowledge base.

The Brand Brain generates ideas.

Research improves presentation.

Those are completely different responsibilities.

---

# Canonical Pipeline

Research Intelligence
↓

Trend Reports

---

Brand Brain
↓

Canonical Articles
↓

Idea Library
↓

Approved Briefs
↓

Scripts
↓

Storyboards
↓

Content

---

# Guiding Principle

Knowledge comes first.

Ideas come from knowledge.

Content comes from ideas.

Research improves content.

Research never creates the editorial direction.

The voice, topics, stories and educational value must always originate from the Brand Brain.

That is what makes Chef Rulo unique and impossible to replicate by simply analysing other creators.
