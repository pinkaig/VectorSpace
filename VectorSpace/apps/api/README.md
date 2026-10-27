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
