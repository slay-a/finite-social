# Finite Social

A swipeable tech news reader with AI-powered article explanations and a built-in LeetCode/NeetCode practice feed. Built with Expo + React Native.

## What it does

- **Feed** — swipe through top stories from ~14 sources (Hacker News, Reddit, TechCrunch, Wired, …). Filter by topic: AI, Dev, Startups, Security, Science, Repos.
- **Explain** — tap any article for a jargon-free AI breakdown, then ask follow-ups.
- **Code** — swipeable LeetCode/NeetCode problems with on-demand AI explanations and complexity analysis.
- **Bookmarks, themes, and account** — Supabase auth, light/dark/custom themes, saved articles.

## Stack

- Expo SDK 54 · React Native 0.81 · expo-router
- Supabase (auth + edge functions for AI calls)
- OpenAI (via a `ai-chat` edge function)
- RevenueCat for subscriptions

## Running locally

```bash
npm install
cp .env.local.example .env.local   # fill in your Supabase keys
npx expo start
```

The app expects these in `.env.local` (or EAS Secrets for builds):

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

OpenAI calls are proxied through the `supabase/functions/ai-chat` edge function so the API key never ships with the client. Deploy it with:

```bash
npx supabase functions deploy ai-chat --no-verify-jwt
npx supabase secrets set OPENAI_API_KEY=sk-...
```

> **Note:** `--no-verify-jwt` is required — ES256 JWTs from newer Supabase projects silently 401 at the gateway otherwise.

## Project layout

```
app/            # expo-router screens
  (auth)/       # login, signup
  (tabs)/       # feed, code, settings
src/
  components/   # ArticleCard, ExplainSheet, …
  context/      # Auth, App, Theme, Subscription
  lib/          # supabase, aiService, leetcodeApi, …
supabase/
  functions/    # ai-chat, delete-account
```
