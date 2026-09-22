---
name: lets-test-it
description: >-
  Open the exact page under test on the latest Vercel preview URL so a person
  can try it. Use when the user says "lets test it", "let's test it", or
  references this skill.
---

# Lets test it

When the user says "lets test it" (or references this skill), hand them a preview URL that lands on the page that shows the change, already past Vercel protection.

## Page

Use the route that demonstrates the work in this conversation. If they name a route, use that. Otherwise use the screen last edited (movie detail Similar Films is `/movie/155`).

## Preview URL

1. List READY deployments for this branch on the Selects Vercel project (`prj_uPg3fPiGynB9lFnfwXBnRm4IZ9J8`, team `team_F9UJULDQrBjueLnwoqbhfMna`). Take the newest deployment whose commit is the current HEAD. If HEAD is not deployed yet, push first and wait until that deployment is READY.
2. Call `get_access_to_vercel_url` on `https://<deployment-host>`.
3. Reply with the share URL plus the path, for example `https://<host>/<path>?_vercel_share=...`. Put the share query on the page URL so it opens that page after the bypass cookie is set. If the host only accepts the share param at `/`, give both: the share root, then the exact path to open next.
4. Sign-in if the page is behind the app: open `/join`, then email `selects.preview.0210.speed@example.com`, password `SelectsVerify9`.
5. Open that page and include one screenshot of it in the reply so the link is not the only proof.

Do not deploy to production. Do not invent a preview host.
