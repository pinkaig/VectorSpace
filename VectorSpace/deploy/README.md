# Production deploy

**Baseline phase:** Stage 5 (production deploy). See [8-stage baseline overview](https://github.com/gsherman01/Project5_Team17_DoReMi-yaki/wiki/Baseline-Implementation-8-Stages).

Docker Compose stack (Caddy reverse proxy + frontend + API + Postgres) fronting
one VM, deployed by `.github/workflows/deploy.yml`.

**Status: infrastructure only.** The GitHub Actions workflow is
`workflow_dispatch`-only — nothing triggers it automatically, and it will fail
immediately without the secrets set up below. Do not wire up automatic
triggers or fill in secrets until an approved deployment provider/VM owner is
confirmed (open question in `SESSION.md`).

## Architecture

```
Internet --443/80--> Caddy --> frontend (nginx, static build)
                          \--> api (FastAPI/uvicorn) --> postgres
```

- Caddy terminates TLS (automatic Let's Encrypt certs via the domain in
  `DOMAIN`) and proxies `/api/*` to the API container, everything else to the
  frontend container.
- Postgres runs as a container with a named volume. For anything beyond a
  single small VM, move this to a managed Postgres instance and drop the
  `postgres` service from `docker-compose.prod.yml`.
- Object storage (MinIO/S3) is **not** included in `docker-compose.prod.yml`
  — production should point `MINIO_ENDPOINT_URL` at a managed S3-compatible
  bucket rather than running MinIO as a single-node container.

## Hosting on Render

Defined by `render.yaml` at the repository root.

```
Browser --> vectorspace      (Render static site, CDN, always on)
        \-> vectorspace-api  (Render free web service, Docker) --> Neon Postgres (free)
cron-job.org --every 10 min--> vectorspace-api /health   (keeps it from sleeping)
```

Live: site https://vectorspace-tuw2.onrender.com, API
https://vectorspace-api.onrender.com (Neon project "Vector Space", Singapore).

| Piece    | Service                         | Free limits that matter                                   |
|----------|---------------------------------|-----------------------------------------------------------|
| Frontend | Render static site              | Never sleeps                                              |
| API      | Render web service (free plan)  | Sleeps after 15 min idle, ~1 min to wake; 750 h/month     |
| Database | Neon                            | 1 GB; wakes in under a second after 5 min idle            |
| Pinger   | cron-job.org                    | Keeps the API awake (750 h covers one service all month)  |

Media uploads (MinIO/S3) are not set up: the bundled models and audio ship
with the frontend. Add an S3-compatible bucket later (e.g. Backblaze B2, 10 GB
free) and set the `MINIO_*` variables on the API if uploads are needed.

### Steps

1. **Neon** (https://neon.tech, sign in with GitHub): create a project, region
   closest to the Render region you will pick (e.g. both Singapore). Copy the
   connection string from *Connect*; it looks like
   `postgresql://user:pw@ep-xxx.aws.neon.tech/neondb?sslmode=require`.
   The API accepts it as is (it switches the scheme to psycopg 3 itself).
2. **Render** (https://render.com, sign in with GitHub, no card): *New >
   Blueprint*, pick this repository. Render reads `render.yaml` and asks for:
   - `DATABASE_URL`: the Neon string from step 1
   - `CORS_ORIGINS`: the static site's address exactly, no trailing slash, e.g.
     `https://vectorspace-tuw2.onrender.com` (Render adds a suffix to the name
     when it is taken; the address cannot be changed later)
   - `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`: leave empty until Auth0 exists

   The Render GitHub app needs access to the repository, so the repo owner
   installs it, or deploy from your own fork.
3. Wait for both deploys, then check `https://vectorspace-api.onrender.com/health`
   returns `{"status":"ok",...}` and the site loads. Migrations run each time the
   API starts (`alembic upgrade head` in the API Dockerfile's `CMD`), since
   Render's pre-deploy step is not on the free plan. Leave Render's *Docker
   Command* field empty.
4. **cron-job.org** (free, no card): create a job that GETs the `/health`
   address above every 10 minutes. This keeps the API from sleeping, so visitors
   never wait for a cold start. (A GitHub Actions schedule would do the same,
   but on a private repo it would use more than the 2,000 free minutes.)

Both services deploy from `Working`, after the team's CI checks pass, so a
broken merge never goes live. The site uses `HashRouter`, so no rewrite rules
are needed.

**Sign-in:** the static site is built without `VITE_API_URL`, so it runs in its
offline mode (role picker, saves in the browser). Production refuses the
`dev|` sign-in the picker uses against a server, so connect the site to the API
(uncomment `VITE_API_URL` in `render.yaml`) only once the browser app signs in
through Auth0.

## One-time VM provisioning

These are concrete commands for a fresh Ubuntu 22.04/24.04 VM (adjust package
manager commands for a different distro). Run as a user with `sudo`.

1. **Update packages and install Docker Engine + Compose plugin:**

   ```bash
   sudo apt-get update && sudo apt-get upgrade -y
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker "$USER"
   # log out/in (or `newgrp docker`) for the group change to take effect
   docker compose version
   ```

2. **Create a dedicated deploy user** (the workflow SSHes in as this user):

   ```bash
   sudo adduser --disabled-password --gecos "" deploy
   sudo usermod -aG docker deploy
   sudo mkdir -p /home/deploy/.ssh
   sudo chmod 700 /home/deploy/.ssh
   ```

3. **Generate a deploy keypair on your own machine (not the VM) and install
   the public half:**

   ```bash
   ssh-keygen -t ed25519 -C "vectorspace-deploy" -f ./vectorspace_deploy_key -N ""
   # copy vectorspace_deploy_key.pub content into the VM:
   ssh <admin-user>@<vm-host> "sudo tee -a /home/deploy/.ssh/authorized_keys" < vectorspace_deploy_key.pub
   ssh <admin-user>@<vm-host> "sudo chmod 600 /home/deploy/.ssh/authorized_keys && sudo chown -R deploy:deploy /home/deploy/.ssh"
   ```

   Keep `vectorspace_deploy_key` (the private half) out of git. It goes into the
   GitHub Actions secret `DEPLOY_SSH_KEY` (see below).

4. **Create the deploy directory and clone the repo:**

   ```bash
   sudo -u deploy mkdir -p /srv/vectorspace
   sudo -u deploy git clone <repo-url> /srv/vectorspace
   ```

5. **Open firewall ports 80 and 443:**

   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

6. **Point DNS** for the chosen domain (an A/AAAA record) at the VM's public
   IP. Caddy will not obtain a TLS certificate until this resolves.

7. **Create the production env file** on the VM at
   `/srv/vectorspace/.env.prod` (used by `docker compose --env-file`):

   ```bash
   sudo -u deploy tee /srv/vectorspace/.env.prod > /dev/null <<'EOF'
   DOMAIN=app.example.com
   POSTGRES_DB=vectorspace
   POSTGRES_USER=vectorspace_app
   POSTGRES_PASSWORD=<generate a strong password>
   MINIO_ENDPOINT_URL=https://<your-s3-compatible-endpoint>
   MINIO_ROOT_USER=<access key>
   MINIO_ROOT_PASSWORD=<secret key>
   MINIO_BUCKET=vectorspace-media
   AUTH0_DOMAIN=
   AUTH0_AUDIENCE=
   EOF
   sudo chmod 600 /srv/vectorspace/.env.prod
   ```

8. **First manual bring-up** (verifies the stack before wiring CI to it):

   ```bash
   cd /srv/vectorspace/VectorSpace
   sudo -u deploy docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
   sudo -u deploy docker compose -f docker-compose.prod.yml ps
   curl -fsS https://app.example.com/health
   ```

## GitHub Actions configuration (do this only once ownership is confirmed)

1. Settings → Environments → create `production`, add required reviewers.
2. Settings → Environments → `production` → Secrets, add:
   - `DEPLOY_HOST` — the VM's public hostname/IP
   - `DEPLOY_USER` — `deploy`
   - `DEPLOY_SSH_KEY` — contents of the private key generated in step 3
   - `DEPLOY_PATH` — `/srv/vectorspace`
3. Run the `deploy` workflow manually from the Actions tab
   (`workflow_dispatch`) and approve it in the environment gate.

## Rollback

```bash
ssh deploy@<vm-host>
cd /srv/vectorspace && git log --oneline -5   # find the last known-good commit
git checkout <sha> -- .
cd VectorSpace
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```
