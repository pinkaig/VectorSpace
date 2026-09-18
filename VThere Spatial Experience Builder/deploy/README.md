# Production deploy

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
   ssh-keygen -t ed25519 -C "vthere-deploy" -f ./vthere_deploy_key -N ""
   # copy vthere_deploy_key.pub content into the VM:
   ssh <admin-user>@<vm-host> "sudo tee -a /home/deploy/.ssh/authorized_keys" < vthere_deploy_key.pub
   ssh <admin-user>@<vm-host> "sudo chmod 600 /home/deploy/.ssh/authorized_keys && sudo chown -R deploy:deploy /home/deploy/.ssh"
   ```

   Keep `vthere_deploy_key` (the private half) out of git. It goes into the
   GitHub Actions secret `DEPLOY_SSH_KEY` (see below).

4. **Create the deploy directory and clone the repo:**

   ```bash
   sudo -u deploy mkdir -p /srv/vthere
   sudo -u deploy git clone <repo-url> /srv/vthere
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
   `/srv/vthere/.env.prod` (used by `docker compose --env-file`):

   ```bash
   sudo -u deploy tee /srv/vthere/.env.prod > /dev/null <<'EOF'
   DOMAIN=app.example.com
   POSTGRES_DB=vthere
   POSTGRES_USER=vthere_app
   POSTGRES_PASSWORD=<generate a strong password>
   MINIO_ENDPOINT_URL=https://<your-s3-compatible-endpoint>
   MINIO_ROOT_USER=<access key>
   MINIO_ROOT_PASSWORD=<secret key>
   MINIO_BUCKET=vthere-media
   AUTH0_DOMAIN=
   AUTH0_AUDIENCE=
   EOF
   sudo chmod 600 /srv/vthere/.env.prod
   ```

8. **First manual bring-up** (verifies the stack before wiring CI to it):

   ```bash
   cd /srv/vthere/"VThere Spatial Experience Builder"
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
   - `DEPLOY_PATH` — `/srv/vthere`
3. Run the `deploy` workflow manually from the Actions tab
   (`workflow_dispatch`) and approve it in the environment gate.

## Rollback

```bash
ssh deploy@<vm-host>
cd /srv/vthere && git log --oneline -5   # find the last known-good commit
git checkout <sha> -- .
cd "VThere Spatial Experience Builder"
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```
