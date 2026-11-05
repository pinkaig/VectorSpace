"""Upload a folder of assets on this computer to the cloud asset library.

The folder is your control copy; the cloud library is made to hold everything in it. It is a client
of the admin API (app/routers/library.py), so it needs no database or bucket credentials, only an
admin's token. Dry run by default: nothing is written until --apply.

    python scripts/sync_library.py C:/Users/me/Desktop/vthere-library --dev-as admin       # what would happen
    python scripts/sync_library.py C:/Users/me/Desktop/vthere-library --dev-as admin --apply
    python scripts/sync_library.py ../../src/content/assets --kind model --dev-as admin    # one flat folder

Folder layout (the first folder decides the kind; files outside these folders are skipped):

    models/        *.glb          props: arrow, pedestal, sign
    environments/  *.glb          rooms
    images/        *.png *.jpg *.jpeg *.webp
    videos/        *.mp4 *.webm
    library.json   optional: {"models/Pedestal.glb": {"title": "Pedestal", "attribution": "CC-BY Jane"}}

Who you are: --dev-as NAME sends "dev|NAME", which only an API running with AUTH_DEV_BYPASS accepts
(local use). Against the deployed API pass an admin's access token with --token or VTHERE_TOKEN.
The API address is --api or VTHERE_API, default http://localhost:8000.

Safe to repeat. The library keys every file by the SHA-256 of its bytes, so a file it already holds
costs one request and no upload, and an interrupted run simply continues. This script never deletes
anything: cloud entries that are not in the folder are listed, and removing them stays an admin's
decision in the library page. A title or attribution in library.json that differs from the cloud
is written to the cloud, so the folder stays the source of truth for those two fields.

The dry run only asks the cloud what it holds. File types and size caps are checked by the API
when --apply runs, because the API is the one place those rules live.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

import httpx

KIND_FOLDERS = {
    "models": "model", "model": "model",
    "environments": "environment", "environment": "environment",
    "images": "image", "image": "image",
    "videos": "video", "video": "video",
}
CONTENT_TYPES = {
    ".glb": "model/gltf-binary",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
    ".mp4": "video/mp4", ".webm": "video/webm",
}
GLB_KINDS = ("model", "environment")
METADATA_FILE = "library.json"
IGNORED_NAMES = {METADATA_FILE, ".ds_store", "thumbs.db", "desktop.ini"}

Upload = Callable[[str, dict[str, str], bytes], None]


@dataclass
class LocalFile:
    path: Path
    relative: str  # forward slashes, the key into library.json
    kind: str
    content_type: str
    size: int
    sha256: str


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def discover(folder: Path, kind_override: str | None = None) -> tuple[list[LocalFile], list[tuple[str, str]]]:
    """Every uploadable file under folder, and (path, reason) for each one that is skipped."""
    files: list[LocalFile] = []
    skipped: list[tuple[str, str]] = []
    for path in sorted(p for p in folder.rglob("*") if p.is_file()):
        relative = path.relative_to(folder).as_posix()
        if path.name.lower() in IGNORED_NAMES or path.name.startswith("."):
            continue
        kind = kind_override or KIND_FOLDERS.get(relative.split("/", 1)[0].lower() if "/" in relative else "")
        if kind is None:
            skipped.append((relative, "not inside models/, environments/, images/ or videos/"))
            continue
        content_type = CONTENT_TYPES.get(path.suffix.lower())
        if content_type is None:
            reason = ".gltf is not accepted, export a single .glb" if path.suffix.lower() == ".gltf" else "file type is not allowed"
            skipped.append((relative, reason))
            continue
        if (path.suffix.lower() == ".glb") != (kind in GLB_KINDS):
            skipped.append((relative, f"a {path.suffix} file does not belong in {kind}"))
            continue
        files.append(LocalFile(path, relative, kind, content_type, path.stat().st_size, file_sha256(path)))
    return files, skipped


def load_metadata(folder: Path) -> dict[str, dict[str, str | None]]:
    path = folder / METADATA_FILE
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return {key: value for key, value in data.items() if isinstance(value, dict)}


def reason_for(response: httpx.Response) -> str:
    try:
        detail = response.json().get("detail", response.text)
    except ValueError:
        detail = response.text
    return f"HTTP {response.status_code}: {str(detail)[:200]}"


def put_to_storage(url: str, headers: dict[str, str], data: bytes) -> None:
    """The bytes go straight to the bucket. A plain request on purpose: the API token must not travel
    to storage, and the signed headers from the ticket are the only ones that may be sent."""
    response = httpx.put(url, content=data, headers=headers, timeout=600)
    if response.status_code >= 400:
        raise httpx.HTTPError(f"the bucket refused the upload ({reason_for(response)})")


def edits_for(asset: dict, meta: dict[str, str | None]) -> dict[str, str | None]:
    """The title/attribution fields library.json sets that the cloud does not already have."""
    return {key: meta[key] for key in ("title", "attribution") if key in meta and meta[key] != asset.get(key)}


def upload_one(client: httpx.Client, upload: Upload, local: LocalFile, meta: dict[str, str | None]) -> dict:
    body = {
        "content_sha256": local.sha256, "filename": local.path.name, "kind": local.kind,
        "content_type": local.content_type, "size_bytes": local.size,
        **{key: value for key, value in meta.items() if key in ("title", "attribution") and value is not None},
    }
    response = client.post("/library/tickets", json=body)
    if response.status_code not in (200, 201):
        raise httpx.HTTPError(reason_for(response))
    ticket = response.json()
    asset = ticket["asset"]
    if ticket.get("upload_url"):  # absent when the library already holds these bytes
        upload(ticket["upload_url"], ticket["upload_headers"], local.path.read_bytes())
        confirmed = client.post(f"/library/{asset['id']}/confirm")
        if confirmed.status_code != 200:
            raise httpx.HTTPError(f"upload finished but the check failed ({reason_for(confirmed)})")
        asset = confirmed.json()
    return asset


def sync(
    client: httpx.Client, folder: Path, apply: bool, upload: Upload = put_to_storage,
    kind_override: str | None = None, out=print,
) -> int:
    """Make the cloud library hold every file in folder. Returns 0 when it did, 1 when any file failed."""
    listing = client.get("/library")
    if listing.status_code in (401, 403):
        out(f"The API refused this login ({reason_for(listing)}). It must be an active admin account.")
        return 1
    listing.raise_for_status()
    cloud = {asset["content_sha256"]: asset for asset in listing.json()}

    files, skipped = discover(folder, kind_override)
    metadata = load_metadata(folder)
    counts = {"uploaded": 0, "present": 0, "updated": 0, "failed": 0}
    seen: dict[str, str] = {}

    for local in files:
        meta = metadata.get(local.relative, {})
        label = f"{local.relative}  ({local.size / 1_000_000:.1f} MB)"
        if local.sha256 in seen:
            out(f"  same     {local.relative}  (identical bytes to {seen[local.sha256]}, uploaded once)")
            continue
        seen[local.sha256] = local.relative
        asset = cloud.get(local.sha256)
        try:
            if asset is None or asset["status"] != "uploaded":
                out(f"  {'upload' if apply else 'would upload':<12} {label}")
                if apply:
                    upload_one(client, upload, local, meta)
                counts["uploaded"] += 1
                continue
            edits = edits_for(asset, meta)
            if not edits:
                out(f"  present      {local.relative}")
                counts["present"] += 1
                continue
            out(f"  {'update' if apply else 'would update':<12} {local.relative}  ({', '.join(edits)})")
            if apply:
                response = client.patch(f"/library/{asset['id']}", json=edits)
                if response.status_code != 200:
                    raise httpx.HTTPError(reason_for(response))
            counts["updated"] += 1
        except (httpx.HTTPError, OSError) as error:
            out(f"  FAILED       {local.relative}: {error}")
            counts["failed"] += 1

    for relative, reason in skipped:
        out(f"  skipped      {relative}  ({reason})")
    local_hashes = {local.sha256 for local in files}
    cloud_only = [a for sha, a in cloud.items() if sha not in local_hashes and a["status"] == "uploaded"]
    for asset in cloud_only:
        out(f"  cloud only   {asset['kind']}/{asset['filename']}  (not in this folder; left alone)")

    verb = "" if apply else "would be "
    out(f"\n{counts['uploaded']} {verb}uploaded, {counts['updated']} {verb}updated, {counts['present']} already in the cloud, "
        f"{len(skipped)} skipped, {counts['failed']} failed.")
    if not apply:
        out("Dry run: nothing was written. Add --apply to do it.")
    return 1 if counts["failed"] else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("folder", type=Path, help="the folder holding your control copy of the assets")
    parser.add_argument("--api", default=os.environ.get("VTHERE_API", "http://localhost:8000"))
    parser.add_argument("--token", default=os.environ.get("VTHERE_TOKEN"), help="an admin's access token")
    parser.add_argument("--dev-as", metavar="NAME", help="local only: act as dev|NAME (needs AUTH_DEV_BYPASS)")
    parser.add_argument("--kind", choices=sorted(set(KIND_FOLDERS.values())), help="treat every file in a flat folder as this kind")
    parser.add_argument("--apply", action="store_true", help="actually upload; without it nothing is written")
    args = parser.parse_args()

    if not args.folder.is_dir():
        print(f"{args.folder} is not a folder")
        return 2
    token = f"dev|{args.dev_as}" if args.dev_as else args.token
    if not token:
        print("No login: pass --token (or set VTHERE_TOKEN) for a real API, or --dev-as admin for a local one")
        return 2

    print(f"{'Uploading' if args.apply else 'Checking'} {args.folder} against {args.api}\n")
    try:
        with httpx.Client(base_url=args.api, headers={"Authorization": f"Bearer {token}"}, timeout=30) as client:
            return sync(client, args.folder, args.apply, kind_override=args.kind)
    except httpx.TransportError as error:
        print(f"Cannot reach the API at {args.api}: {error}")
        return 2


if __name__ == "__main__":
    sys.exit(main())
