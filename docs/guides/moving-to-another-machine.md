# Moving to another machine

This covers moving the whole system — code, credentials, generated media —
from one machine to another, for the same operator. It assumes you're
setting this up on a new laptop of your own, not handing operational access
to someone else; that scenario needs a separate credential/access decision
first (does the new person get a real Instagram publish token? their own
Claude Code login? a read-only Brand Brain clone?) that this guide doesn't
make for you.

Nothing here is Docker or a single binary. This is a Node app plus a handful
of external tools that each carry their own machine-local auth (Claude Code
CLI, `cloudflared`, Meta/OpenAI/Apify tokens), so "packaging" means: get the
same tools installed, then carry over the state that isn't in git.

## What's in git vs. what isn't

Everything under version control (code, `package.json`, docs) comes along
for free with `git clone`. Three things never get committed and have to be
carried over separately:

- `.env.local` — real API tokens (Meta, OpenAI, Apify) and local paths
- `data/` — the SQLite database (ideas, briefs, scripts, carousels) plus
  exported media
- `footage/` — your source video clips per reel script

## Prerequisites on the new machine

Install these before touching this repo:

- Node 20+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) — log in
  with the account that has your Claude Pro/API access
- [`cloudflared`](https://github.com/cloudflare/cloudflared) on `PATH` —
  only needed for step 8 (produce and publish)
- Git

## Steps

**1. On the old machine, clone the repos on the new machine (or transfer a
clone), and pack the local state:**

```bash
npm run machine:pack
```

This writes `../chefrulo-content-maker-migration-<timestamp>.tar.gz`
(pass a path as an argument to choose the location yourself) containing
`.env.local`, `data/`, and `footage/` — whichever of those exist. It never
touches git or `node_modules`.

**2. Move the archive to the new machine over a channel you control** — USB
drive, `rsync` over SSH, AirDrop. Not email, not chat: it contains live
tokens for your real Instagram and OpenAI accounts.

**3. On the new machine**, clone both repos:

```bash
git clone <this-repo-url> chefrulo_content-maker
git clone https://github.com/chefrulo/chef-rulo-brand-brain
```

**4. Unpack the archive into the new checkout:**

```bash
cd chefrulo_content-maker
npm run machine:unpack -- /path/to/chefrulo-content-maker-migration-<timestamp>.tar.gz
```

It refuses to silently clobber an existing `.env.local`/`data/`/`footage/`
in the target checkout — it asks first.

**5. Install and verify:**

```bash
npm install
npm run doctor
```

`doctor` checks the Claude CLI, `cloudflared`, `BRAND_BRAIN_PATH`, and every
API token. Fix whatever it flags — the most common one after a move is
`BRAND_BRAIN_PATH` in `.env.local` still pointing at the old machine's path.

## What this doesn't cover

- Meta/OpenAI/Apify tokens themselves aren't rotated by this process — the
  old machine's tokens keep working on the new one. Rotate them yourself if
  the old machine is being decommissioned or wasn't fully trusted.
- Claude Code CLI auth is per-machine; `npm run doctor` will tell you if
  it's missing, but you log in the normal way, not via the archive.
