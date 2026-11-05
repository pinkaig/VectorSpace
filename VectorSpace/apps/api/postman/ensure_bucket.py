"""Create the media bucket in a local MinIO if it is missing.

A fresh MinIO volume (local Docker, or the CI job) has no buckets, and the media and library requests in
the Postman collection then fail with 500. Reads the same S3_* settings as the API, so it points wherever
the API points. Refuses anything that is not localhost, so it never touches R2.

Run from apps/api:  python postman/ensure_bucket.py
"""

import sys
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import boto3  # noqa: E402
from botocore.exceptions import ClientError  # noqa: E402

from app.config import get_settings  # noqa: E402


def main() -> int:
    settings = get_settings()
    host = urlparse(settings.s3_endpoint_url).hostname
    if host not in ("localhost", "127.0.0.1"):
        print(f"S3_ENDPOINT_URL points at {host}, not a local MinIO. Nothing done.", file=sys.stderr)
        return 1
    s3 = boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
        region_name="us-east-1",
    )
    try:
        s3.head_bucket(Bucket=settings.s3_bucket)
        print(f"Bucket {settings.s3_bucket} already exists.")
    except ClientError:
        s3.create_bucket(Bucket=settings.s3_bucket)
        print(f"Created bucket {settings.s3_bucket}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
