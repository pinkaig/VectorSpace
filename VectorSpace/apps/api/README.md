# API baseline

> **Not part of M1.** The M1 deliverable is the frontend editor, which runs in
> the browser and saves to localStorage. This service is scaffolding for a later
> milestone: its business route handlers return HTTP 501 and nothing in the M1
> build calls it. Running it is not required to build, test, or demonstrate M1 —
> use `run.sh` / `run.bat` at the repository root for that.

**Baseline phase:** Stage 3 (backend HTTP surface). See [8-stage baseline overview](https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Baseline-Implementation-8-Stages).

Run from this directory with `uvicorn app.main:app --reload`. The `/health` route is the Phase 0 startup contract; authentication and project persistence are added in later phases.

## Creating the school roster (Auth0)

Nobody signs themselves up: every account is created from a CSV by `app.provision`, which
creates the Auth0 login and the matching `actors` row in one pass. `roster.example.csv`
shows the four columns — `email`, `display_name`, `role` (`admin|teacher|student`) and
`classes`, semicolon-separated. Copy it to `roster.csv` and edit; both `roster.csv` and
`invites.csv` are git-ignored, because one holds students' personal data and the other
holds working password-change links.

The order matters. Run the dry run first; it writes nothing and creates no Auth0 users:

```
python -m app.provision --school-slug demo --school-name "Demo School" --csv roster.csv
python -m app.provision --school-slug demo --csv roster.csv --apply --out invites.csv
```

`--apply` needs `AUTH0_DOMAIN`, `AUTH0_MGMT_CLIENT_ID` and `AUTH0_MGMT_CLIENT_SECRET` set,
`AUTH_DEV_BYPASS` off, and `DATABASE_URL` pointing at the database you mean to write to.
It always talks to the real Management API — there is no local `--apply`; use `app.seed`
for that. Re-running is safe: people already in the school are updated, not duplicated.

The links in `invites.csv` are single-use, so keep the file until they have been handed out.

Two things to know before running this against the cloud database:

- The rows seeded locally carry `dev|…` subjects, which a real tenant can never issue, so
  those accounts stop resolving the moment the deployment points at Auth0. That is
  `get_current_actor` working, not a bug. Delete them once the real roster is in.
- `app.provision` creates accounts and classes only. The demo templates, projects and
  analytics that the landing and showcase pages list come from `app.seed_content`, which
  only `app.seed` calls. A provisioned school therefore starts empty.

## Checking the wiring when a login fails

Two scripts in `scripts/` answer "why can I not sign in", one on each side of the line
Auth0 draws. Both print a layer per check, pass nothing to the next layer when one fails,
and exit non-zero, so either can go in front of a deploy step.

```
python scripts/check_auth0.py --token <access_token> --api http://localhost:8000
python scripts/check_roster.py --csv roster.csv --token <access_token>
```

`check_auth0.py` covers everything up to the token: the API's own config, the tenant's
issuer and JWKS, the `VITE_` values the browser uses, the redirect Auth0 would answer when
you click sign in, the SPA application's callback URLs, and finally `/me` on a running API.

`check_roster.py` picks up where that stops — a valid token with no account behind it — and
separates the four causes that all surface as the same 403: no school, no row for that
person, a row whose `auth0_subject` belongs to a different login, or a row with
`active=false`. The third is the common one, because of the seeded `dev|` subjects
described above; `--relink --apply` moves the real subject onto that address's existing row
(it refuses unless exactly one row matches, and it never creates a person — that stays
`app.provision`'s job).

Neither script writes anything without `--apply`, and `check_roster.py` prints the database
URL with its password masked, so its output is safe to paste into a chat.
