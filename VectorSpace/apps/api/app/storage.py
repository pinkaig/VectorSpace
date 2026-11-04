"""boto3 presigned URL generation against an S3-compatible bucket (MinIO locally, R2/S3 deployed)."""

from __future__ import annotations

from functools import lru_cache

import boto3
from botocore.client import Config

from .config import get_settings


@lru_cache
def get_s3_client():
    settings = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )


def generate_presigned_upload_url(
    storage_key: str, content_type: str, expires_in: int = 900, cache_control: str | None = None
) -> str:
    """A presigned PUT. A cache_control becomes part of the signature, so the browser must send
    that exact Cache-Control header with the upload or the bucket answers SignatureDoesNotMatch."""
    settings = get_settings()
    client = get_s3_client()
    params = {"Bucket": settings.s3_bucket, "Key": storage_key, "ContentType": content_type}
    if cache_control:
        params["CacheControl"] = cache_control
    return client.generate_presigned_url("put_object", Params=params, ExpiresIn=expires_in)


def generate_presigned_download_url(storage_key: str, expires_in: int = 900) -> str:
    settings = get_settings()
    client = get_s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket, "Key": storage_key},
        ExpiresIn=expires_in,
    )


def public_url(storage_key: str) -> str:
    """The CDN address of a public-prefix object. An empty base URL means the public prefix is
    not configured yet, which is a configuration error rather than a reason to sign."""
    settings = get_settings()
    if not settings.s3_public_base_url:
        raise RuntimeError("S3_PUBLIC_BASE_URL is not set; a library asset has no public address")
    return f"{settings.s3_public_base_url.rstrip('/')}/{storage_key}"


def head_object(storage_key: str) -> tuple[int, str] | None:
    """(size in bytes, content type) of a stored object, or None if nothing is there yet.

    Used to confirm an upload: a presigned PUT cannot cap the size, so the real size and type
    are checked here after the browser says it finished.
    """
    settings = get_settings()
    client = get_s3_client()
    try:
        response = client.head_object(Bucket=settings.s3_bucket, Key=storage_key)
    except client.exceptions.ClientError as error:
        if error.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
            return None
        raise
    return int(response.get("ContentLength", 0)), str(response.get("ContentType", ""))


def delete_object(storage_key: str) -> None:
    settings = get_settings()
    get_s3_client().delete_object(Bucket=settings.s3_bucket, Key=storage_key)
