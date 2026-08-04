# Chef Rulo Brand Brain — Editorial System and Asado Idea Library

> Status: Draft for review  
> Language: British English  
> Purpose: Preserve the key editorial decisions, architecture principles, and approved content ideas developed for Chef Rulo.

---

# 1. Executive Summary

Chef Rulo is not building a system that copies Instagram creators.

Chef Rulo is building an editorial system with memory.

The central principle is:

> Knowledge creates ideas.  
> Ideas create briefs.  
> Briefs create content.  
> Research only improves presentation.

The Brand Brain is the permanent source of truth.

The Content Maker is the software that consumes it.

These two responsibilities must remain separate.

---

# 2. Repository Responsibilities

## `chef-rulo-brand-brain`

This repository contains:

- brand positioning
- editorial principles
- writing style
- editorial territories
- canonical articles
- permanent idea libraries
- approved examples
- content patterns
- AI editorial instructions

It contains knowledge and editorial assets.

It should not contain application code.

## `chefrulo_content-maker`

This repository contains:

- research pipelines
- idea-generation commands
- brief generation
- script generation
- production workflows
- publishing workflows
- dashboards
- local data
- integrations

It contains software.

It consumes the Brand Brain through `BRAND_BRAIN_PATH`.

---

# 3. Core Architecture Decision

The system must contain two independent engines.

## Research Intelligence Engine

### Purpose

Understand what performs well on Instagram.

### Inputs

- influencer accounts
- competitor accounts
- educational creators
- food creators
- reel performance data
- engagement patterns

### Outputs

- top-performing posts
- hook patterns
- format patterns
- reel duration trends
- CTA patterns
- emotional patterns
- posting frequency
- saturated topics
- emerging opportunities
- reports and dashboards for Eduardo

### Non-negotiable rule

This engine must never decide what Chef Rulo talks about.

It must not generate Chef Rulo ideas.

It must not write scripts.

It only observes the market.

---

## Editorial Content Engine

### Purpose

Create original Chef Rulo content.

### Inputs

- Brand Brain
- canonical articles
- editorial territories
- permanent idea libraries
- approved briefs
- approved reel examples
- writing rules
- editorial manifesto

### Outputs

- content ideas
- briefs
- reel scripts
- carousels
- newsletters
- articles
- podcasts
- future formats

### Non-negotiable rule

This engine must never start from influencer content.

Its ideas must come from Chef Rulo knowledge.

---

# 4. Canonical Editorial Flow

```text
Brand Brain
    ↓
Canonical Article
    ↓
Permanent Idea Library
    ↓
Approved Brief
    ↓
Script or Carousel Structure
    ↓
Production
    ↓
Publication
```

Research enters only after the idea and brief already exist:

```text
Trend Report
    ↓
Hook refinement
Pacing refinement
CTA refinement
Presentation refinement
```

Research may improve how something is presented.

Research may never replace the subject, story or cultural insight.

---

# 5. Editorial Positioning

Chef Rulo exists to help people discover Argentine culture through food, stories and hospitality.

The brand must not communicate:

- Argentine superiority
- British inferiority
- nationalism
- cultural competition
- stereotypes
- arrogance
- unsupported claims of authenticity

The brand should communicate:

- curiosity
- hospitality
- cultural translation
- generosity
- craft
- memory
- family
- patience
- connection

Chef Rulo is:

- a host before an expert
- an educator before a salesman
- a storyteller before a promoter
- a cultural bridge, not a cultural judge

Preferred language:

- “In many Argentine homes…”
- “In Argentina, we often…”
- “In my family…”
- “One common tradition is…”
- “British and Argentine butchery use different systems…”

Avoid:

- “This is the correct way.”
- “This is the authentic way.”
- “British people do this wrong.”
- “Every Argentine family does this.”
- “Real Argentines always…”

The central brand idea is:

> People may arrive for the food.  
> They stay for the stories.  
> They return because they felt welcome.

---

# 6. Content Taxonomy

The system uses two different axes.

## Brand Pillars

These are commercial or strategic brand categories.

Examples:

- Product & Craft
- Culture & Identity
- Education
- Experiences
- Community

They answer:

> Which part of the brand does this content support?

## Editorial Territories

These are subject-matter areas.

Examples:

- Argentine Table Culture
- Argentine Cooking Techniques
- Fire and Grilling
- Argentine Butchery
- Family Memory
- Rituals and Traditions
- Migration and Cultural Exchange

They answer:

> What is this piece actually about?

A content brief should contain both.

```json
{
  "brandPillar": "Culture & Identity",
  "editorialTerritory": "Argentine Table Culture",
  "topic": "Why food is served in stages during an asado",
  "contentPattern": "Cultural Doorway"
}
```

These two systems must not be collapsed into one.

---

# 7. Idea Library Principle

The Idea Library is not a collection of random social posts.

It is a permanent editorial asset.

Each idea should:

- originate in a canonical article
- express one clear question
- contain one core insight
- be reusable across multiple formats
- remain valuable beyond current trends
- avoid invented personal memories
- avoid unsupported facts
- preserve the Chef Rulo voice

Ideas should not be regenerated every time.

Once an idea is approved, it remains part of the Brand Brain.

---

# 8. Recommended File Placement

Given the current repository structure:

```text
knowledge/
├── 00-foundation/
├── 10-editorial-territories/
└── 40-patterns/
```

add the following directories:

```text
knowledge/
├── 15-idea-library/
│   └── asado.md
└── 20-articles/
    └── asado.md
```

This is consistent with the current Content Maker contract:

```text
knowledge/20-articles/<slug>.md
knowledge/15-idea-library/<slug>.md
```

## Where this document belongs

Use this document as a migration and consolidation reference.

Recommended location:

```text
knowledge/00-foundation/07-editorial-system-and-asado-library.md
```

Then split the permanent content into:

```text
knowledge/20-articles/asado.md
knowledge/15-idea-library/asado.md
```

The architecture sections belong in foundation documents.

The actual Asado ideas belong in the Idea Library.

Do not leave the ideas only inside this consolidation document.

---

# 9. Canonical Asado Article — Key Knowledge to Preserve

The canonical Asado article should include, at minimum, the following knowledge.

## Asado is more than barbecue

“Barbecue” describes a cooking method.

“Asado” describes a social ritual around fire, food, hospitality and time.

The translation is useful, but incomplete.

## The gathering begins before the meal

An asado begins when:

- someone invites others
- the fire is prepared
- guests arrive
- drinks are opened
- people gather around the grill

It does not begin only when food reaches the table.

## The asador is a host

The asador does not simply cook meat.

The role includes:

- managing the fire
- understanding timing
- serving people
- watching the meal
- creating rhythm
- caring for guests

The asador is often the last person to sit down.

## The fire matters more than expensive equipment

Argentine asado depends on:

- ember management
- patience
- observation
- heat distribution
- experience

Large flames are not the objective.

Glowing embers do most of the cooking.

## Food arrives in stages

Different cuts have different cooking times.

The meal follows the fire rather than a fixed serving schedule.

Choripán often arrives first while slower cuts continue cooking.

## Every family has its own version

There is no single universal asado.

Families differ in:

- cuts
- seasoning
- fire
- timing
- side dishes
- order of service
- rituals

The editorial voice must acknowledge variety.

## The real subject is hospitality

Meat matters.

But the deeper subject is:

- invitation
- family
- memory
- patience
- conversation
- belonging

---

# 10. Asado Editorial Idea Library

## IDEA 001 ⭐ — The Fire Is the First Guest

**Question**

Why does an Argentine asado begin long before anyone eats?

**Pattern**

Cultural Doorway

**Core Insight**

Lighting the fire marks the true beginning of the gathering.

**Why People Care**

The fire slows everyone down before the meal begins.

**Possible Hook**

> The first guest at an Argentine asado is not a person. It is the fire.

**Possible Outputs**

- Reel
- Carousel
- Newsletter
- Podcast

---

## IDEA 002 ⭐ — An Asado Is Not Just a Barbecue

**Question**

Why do Argentines say that asado is more than a barbecue?

**Pattern**

Myth vs Reality

**Core Insight**

Barbecue describes a cooking technique. Asado describes a social ritual.

**Possible Hook**

> Calling an asado a barbecue is not wrong. It just does not tell the whole story.

**Possible Outputs**

- Reel
- Carousel
- Brand Story
- Article

---

## IDEA 003 ⭐ — Choripán Is a Welcome, Not a Starter

**Question**

Why is choripán often served before the main cuts?

**Pattern**

Tradition

**Core Insight**

Choripán welcomes guests while slower cuts continue cooking.

**Possible Hook**

> The first bite of an asado is not about hunger. It is about making people feel welcome.

**Possible Outputs**

- Reel
- Carousel
- Newsletter

---

## IDEA 004 ⭐ — The Asador Does Not Cook for Himself

**Question**

Why is the asador often the last person to sit down?

**Pattern**

Hospitality

**Core Insight**

The asador’s job is not only to cook. It is to care for the fire, the food and the people.

**Possible Hook**

> At many Argentine asados, the person cooking is the last person to eat.

**Possible Outputs**

- Reel
- Carousel
- Brand Story
- Podcast

---

## IDEA 005 ⭐ — Fire Before Food

**Question**

Why does every asado begin with preparing the fire?

**Pattern**

Technique + Culture

**Core Insight**

The fire creates rhythm and gives people a natural place to gather.

**Possible Outputs**

- Reel
- Carousel
- Educational Post

---

## IDEA 006 — Every Cut Has Its Own Moment

**Question**

Why is the meat not served all at once?

**Pattern**

Education

**Core Insight**

Different muscles need different cooking times. The meal follows the rhythm of the fire.

**Possible Hook**

> At an Argentine asado, the food does not arrive late. It arrives when each cut is ready.

**Possible Outputs**

- Reel
- Carousel
- Newsletter

---

## IDEA 007 ⭐ — The Fire Matters More Than the Grill

**Question**

What is the biggest mistake people make when upgrading their barbecue?

**Pattern**

Myth vs Reality

**Core Insight**

Understanding fire matters more than owning expensive equipment.

**Possible Hook**

> A better fire will improve your asado more than a more expensive grill.

**Possible Outputs**

- Reel
- Carousel
- Educational Video

---

## IDEA 008 ⭐ — The Best Asados Are Never Rushed

**Question**

Why can an Argentine asado not be hurried?

**Pattern**

Life Lesson

**Core Insight**

Good food, good company and good conversation all require time.

**Possible Hook**

> The meat is not the reason an asado lasts for hours.

**Possible Outputs**

- Reel
- Carousel
- Newsletter
- Podcast

---

## IDEA 009 — Nobody Owns the Conversation

**Question**

Why does everyone gather around the fire?

**Pattern**

Cultural Observation

**Core Insight**

The fire creates a shared space. People move in and out, and the conversation belongs to everyone.

**Possible Outputs**

- Reel
- Carousel
- Newsletter

---

## IDEA 010 ⭐ — The Fire Teaches You to Pay Attention

**Question**

What is the first skill every asador must learn?

**Pattern**

Technique + Philosophy

**Core Insight**

Fire constantly changes. The asador must observe, understand and adapt.

**Possible Hook**

> Fire does not follow instructions. It teaches you to pay attention.

**Possible Outputs**

- Reel
- Carousel
- Newsletter

---

## IDEA 011 — Every Family Has Its Own Asado

**Question**

Is there one correct way to make an Argentine asado?

**Pattern**

Myth vs Reality

**Core Insight**

Traditions vary from family to family.

**Possible Hook**

> Ask three Argentine families how to make an asado and you may get five answers.

**Possible Outputs**

- Reel
- Carousel
- Article

---

## IDEA 012 ⭐ — An Asado Begins With an Invitation

**Question**

What is the first ingredient of an asado?

**Pattern**

Cultural Doorway

**Core Insight**

Before meat, fire or wine, someone says: “Come over.”

**Possible Hook**

> The first ingredient of an asado is an invitation.

**Possible Outputs**

- Reel
- Carousel
- Newsletter
- Brand Story

---

## IDEA 013 — There Is No Best Seat

**Question**

Where is the best place to stand during an asado?

**Pattern**

Cultural Observation

**Core Insight**

People naturally move between the grill, table, kitchen and garden.

**Possible Outputs**

- Reel
- Carousel
- Newsletter

---

## IDEA 014 ⭐ — The Fire Decides, Not the Clock

**Question**

Why do experienced asadores avoid cooking only by time?

**Pattern**

Technique + Philosophy

**Core Insight**

Wind, weather, charcoal, wood and meat all change the cooking.

**Possible Hook**

> A timer cannot see the fire.

**Possible Outputs**

- Reel
- Carousel
- Educational Video

---

## IDEA 015 — Every Guest Has a Job

**Question**

Why does everyone end up helping during an asado?

**Pattern**

Hospitality

**Core Insight**

Even when one person manages the fire, everyone contributes something.

**Possible Outputs**

- Reel
- Carousel
- Newsletter

---

## IDEA 016 ⭐ — Smoke Carries Memories

**Question**

Why can the smell of an asado bring back childhood memories?

**Pattern**

Memory

**Core Insight**

For many Argentines, smoke is closely linked to family gatherings.

**Possible Hook**

> For many Argentines, smoke does not only smell like food. It smells like family.

**Possible Outputs**

- Reel
- Carousel
- Newsletter
- Podcast

---

## IDEA 017 ⭐ — The Embers Do the Cooking

**Question**

Why do Argentines usually avoid cooking over large flames?

**Pattern**

Technique

**Core Insight**

Glowing embers provide controlled, steady heat.

**Possible Hook**

> The best fire is often the one with the smallest flames.

**Possible Outputs**

- Reel
- Carousel
- Educational Post

---

## IDEA 018 — Respect the Fire

**Question**

Why is someone always watching the fire?

**Pattern**

Technique + Hospitality

**Core Insight**

Looking after the fire is another way of looking after the guests.

**Possible Outputs**

- Reel
- Carousel

---

## IDEA 019 — The Fire Is Never Left Alone

**Question**

Why does the asador remain close to the embers?

**Pattern**

Technique

**Core Insight**

Heat changes constantly, so attention is part of the cooking.

**Possible Outputs**

- Reel
- Carousel
- Educational Video

---

## IDEA 020 — Do Not Tell the Asador How to Cook

**Question**

Why do experienced guests avoid giving the asador unsolicited advice?

**Pattern**

Cultural Etiquette

**Core Insight**

Trusting the asador is one of the unspoken rules of the gathering.

**Possible Hook**

> There is one thing experienced guests rarely do at an asado: manage the asador.

**Possible Outputs**

- Reel
- Carousel
- Newsletter

---

## IDEA 021 ⭐ — Every Asado Tells the Story of a Family

**Question**

Why are no two asados exactly the same?

**Pattern**

Family Memory

**Core Insight**

Families inherit rituals, preferences and habits, not only recipes.

**Possible Outputs**

- Reel
- Carousel
- Newsletter
- Podcast

---

## IDEA 022 ⭐ — The Meal Ends, the Asado Does Not

**Question**

When does an asado actually finish?

**Pattern**

Cultural Observation

**Core Insight**

People often stay for dessert, coffee, mate and conversation after the last cut is served.

**Possible Hook**

> The food may be finished, but the asado is not.

**Possible Outputs**

- Reel
- Carousel
- Newsletter

---

# 11. Entraña Editorial Ideas

## Technical Note

The main challenge in Britain is not finding good beef.

The challenge is identifying the correct cut.

In Argentine butchery:

- **entraña** refers to the **outside skirt**
- **falsa entraña** is a different diaphragm muscle
- falsa entraña is commonly sold in Britain as **onglet** or **hanger steak**

They are different cuts, even though their fibres may appear similar.

---

## IDEA 023 ⭐ — Entraña Demands Attention

**Question**

Why is entraña so easy to overcook?

**Pattern**

Technique + Life Lesson

**Core Insight**

Entraña is thin, fast-cooking and unforgiving. It rewards attention.

**Possible Hook**

> Entraña is like a good conversation. If you are not paying attention, it is gone.

**Possible Outputs**

- Reel
- Carousel
- Newsletter

---

## IDEA 024 ⭐ — Finding Real Entraña in Britain

**Question**

Why is it difficult to buy Argentine entraña in the UK?

**Pattern**

British vs Argentine Butchery

**Core Insight**

The challenge is not meat quality. The challenge is finding the right anatomical cut.

In Britain, the correct name to ask for is usually **outside skirt**.

Possible places to find it include:

- Argentine butchers
- specialist butchers
- wholesale or central meat markets
- butchers willing to identify the muscle anatomically

**Possible Hook**

> The hardest part of cooking entraña in Britain is not the grill. It is buying the right cut.

**Possible Outputs**

- Reel
- Carousel
- Educational Guide

---

## IDEA 025 ⭐ — Real Entraña vs Falsa Entraña

**Question**

How can you tell the difference between entraña and falsa entraña?

**Pattern**

Education

**Core Insight**

They are two different cuts.

True Argentine entraña is:

- outside skirt
- long
- narrow
- fairly thin
- covered by a tough membrane on both sides

Falsa entraña is:

- a different diaphragm muscle
- positioned closer to the flank
- commonly sold in Britain as onglet or hanger steak

Both can be excellent.

They are not interchangeable.

**Why People Care**

The biggest mistake is not necessarily overcooking the meat.

It is believing you bought entraña when you bought another cut.

**Chef Rulo Tip**

Learn to recognise the muscle before learning how to cook it.

**Possible Hook**

> Most people do not ruin their entraña. They never bought entraña in the first place.

**Possible Outputs**

- Reel
- Carousel
- Butchery Guide
- Article

---

## IDEA 026 ⭐ — How to Recognise Outside Skirt

**Question**

What should real entraña look like at the butcher’s counter?

**Pattern**

Ingredient Identification

**Core Insight**

Outside skirt should appear as a long, narrow and thin piece with a strong membrane on both sides.

Its shape matters more than the label on the packet.

**Possible Hook**

> Do not trust the word “skirt” on the label. Look at the shape of the muscle.

**Possible Outputs**

- Reel
- Carousel
- Visual Guide

---

## IDEA 027 — British and Argentine Butchery Speak Different Languages

**Question**

Why do cut names become confusing when moving between Argentina and Britain?

**Pattern**

Cultural Translation

**Core Insight**

The two butchery systems divide and name the carcass differently.

A direct translation is often misleading.

**Possible Hook**

> The same animal can become two completely different butcher’s maps.

**Possible Outputs**

- Reel
- Carousel
- Article Series

---

# 12. Vacío Editorial Ideas

## Technical Note

Vacío is part of the wider flank area.

In Argentine butchery, muscles are separated in a way that gives vacío a distinct identity and cooking method.

The most prized section is often the **punta del vacío**.

Traditional cooking preserves:

- membrane on one side
- fat on the other

The cut is cooked slowly, often for around three hours.

The embers should not sit directly beneath the meat.

Heat is arranged around it for a gentler cook.

---

## IDEA 028 ⭐ — Why Argentines Fell in Love With Vacío

**Question**

Why did vacío become one of Argentina’s most important asado cuts?

**Pattern**

History + Culture

**Core Insight**

Historically, premium cuts were often exported or consumed by wealthier households.

Working families developed remarkable cooking traditions around other muscles.

Vacío became special through knowledge, patience and care rather than price.

**Possible Hook**

> Some of Argentina’s most loved cuts were never luxury cuts. They became special because people learned how to cook them beautifully.

**Possible Outputs**

- Reel
- Carousel
- Newsletter
- Podcast
- Article

---

## IDEA 029 ⭐ — Why Vacío Is Cut Differently in Argentina

**Question**

Why does Argentine vacío look different from British flank?

**Pattern**

British vs Argentine Butchery

**Core Insight**

Argentine butchers separate muscles according to a different anatomical and culinary tradition.

Vacío is treated as a distinct cooking piece rather than as an undefined section of flank.

**Possible Outputs**

- Reel
- Carousel
- Butchery Guide

---

## IDEA 030 ⭐ — The Membrane and Fat Protect the Meat

**Question**

Why are the membrane and fat traditionally left attached?

**Pattern**

Technique

**Core Insight**

The membrane on one side and fat on the other protect the meat during a long, gentle cook.

Removing both too early changes how the cut responds to heat.

**Possible Hook**

> The parts you are tempted to remove are the parts protecting the vacío.

**Possible Outputs**

- Reel
- Carousel
- Educational Video

---

## IDEA 031 ⭐ — Vacío Does Not Cook Over Direct Heat

**Question**

Why should the embers not sit directly underneath the vacío?

**Pattern**

Technique

**Core Insight**

Vacío benefits from slow, surrounding heat rather than aggressive heat from below.

The embers are arranged around the cut.

**Possible Hook**

> Great vacío is not attacked by the fire. It is surrounded by it.

**Possible Outputs**

- Reel
- Carousel
- Educational Video

---

## IDEA 032 ⭐ — Three Calm Hours

**Question**

Why can vacío take around three hours to cook?

**Pattern**

Technique + Philosophy

**Core Insight**

Vacío needs time for heat to move gently through the muscle while the outer layers protect it.

**Possible Hook**

> Vacío does not need more heat. It needs more patience.

**Possible Outputs**

- Reel
- Carousel
- Newsletter

---

## IDEA 033 — Why the Punta del Vacío Matters

**Question**

Why is the tip of the vacío often especially valued?

**Pattern**

Ingredient Spotlight

**Core Insight**

Different sections of the same muscle behave differently.

The punta del vacío has its own texture, fat distribution and appeal.

**Note**

This idea should be expanded only with verified detail from the canonical article or Eduardo’s direct knowledge.

**Possible Outputs**

- Reel
- Carousel

---

# 13. Approved Idea Structure

Every new idea in the Brand Brain should use this minimum structure:

```markdown
## IDEA 000 — Title

**Question**

One clear editorial question.

**Pattern**

Cultural Doorway, Technique, Myth vs Reality, Memory, Tradition, etc.

**Core Insight**

The one idea the audience should understand.

**Why People Care**

Why this matters beyond the food itself.

**Possible Hook**

A strong opening line.

**Possible Outputs**

- Reel
- Carousel
- Newsletter
- Podcast

**Source**

Canonical article or verified personal knowledge.

**Status**

Draft / Reviewed / Approved / Published
```

Optional metadata:

```yaml
brandPillar: Culture & Identity
editorialTerritory: Argentine Butchery
signatureIdea: true
status: approved
sourceArticle: asado
```

---

# 14. Rules for the Content Maker

The Content Maker must:

1. read foundation documents before generation
2. read the canonical article
3. select an unused idea from the Idea Library
4. preserve the idea’s subject and insight
5. create a brief
6. allow human approval
7. create format-specific content only after approval

It must not:

- generate ideas from influencer posts
- replace the approved topic with a trend
- invent family memories
- invent historical facts
- use stereotypes
- use “authentic” as an unsupported judgement
- generalise one Argentine household as all of Argentina
- claim British methods are inferior

Research may influence:

- hook style
- pacing
- duration
- on-screen text
- CTA style
- carousel structure
- editing rhythm

Research may not influence:

- the topic
- the cultural meaning
- the core story
- the source knowledge

---

# 15. Immediate Implementation Steps

## Step 1

Create:

```text
knowledge/15-idea-library/
knowledge/20-articles/
```

## Step 2

Save the canonical Asado article as:

```text
knowledge/20-articles/asado.md
```

## Step 3

Create:

```text
knowledge/15-idea-library/asado.md
```

Move sections 10, 11 and 12 of this document into that file.

## Step 4

Save this complete consolidation document as:

```text
knowledge/00-foundation/07-editorial-system-and-asado-library.md
```

Use it as a record of the architectural decisions and migration plan.

## Step 5

Update the root `README.md` to mention:

```text
knowledge/15-idea-library/<slug>.md
knowledge/20-articles/<slug>.md
```

## Step 6

Ensure `chefrulo_content-maker` reads:

```text
BRAND_BRAIN_PATH/knowledge/20-articles/
BRAND_BRAIN_PATH/knowledge/15-idea-library/
```

## Step 7

Treat the ideas above as editorially approved only after Eduardo reviews them.

Technical or historical claims should remain linked to:

- the canonical article
- Eduardo’s direct knowledge
- verified research where needed

---

# 16. Final Principle

Chef Rulo should not use Instagram to decide what it believes.

Chef Rulo should use its own knowledge to decide what it teaches.

Instagram research helps the brand communicate better.

It does not give the brand its identity.
