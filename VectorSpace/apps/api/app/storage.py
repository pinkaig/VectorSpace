"""boto3 presigned URL generation against the MinIO instance (S3-compatible)."""

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
        endpoint_url=settings.minio_endpoint_url,
        aws_access_key_id=settings.minio_root_user,
        aws_secret_access_key=settings.minio_root_password,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )


def generate_presigned_upload_url(storage_key: str, content_type: str, expires_in: int = 900) -> str:
    settings = get_settings()
    client = get_s3_client()
    return client.generate_presigned_url(
        "put_object",
        Params={"Bucket": settings.minio_bucket, "Key": storage_key, "ContentType": content_type},
        ExpiresIn=expires_in,
    )


def generate_presigned_download_url(storage_key: str, expires_in: int = 900) -> str:
    settings = get_settings()
    client = get_s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.minio_bucket, "Key": storage_key},
        ExpiresIn=expires_in,
    )


def head_object(storage_key: str) -> tuple[int, str] | None:
    """(size in bytes, content type) of a stored object, or None if nothing is there yet.

    Used to confirm an upload: a presigned PUT cannot cap the size, so the real size and type
    are checked here after the browser says it finished.
    """
    settings = get_settings()
    client = get_s3_client()
    try:
        response = client.head_object(Bucket=settings.minio_bucket, Key=storage_key)
    except client.exceptions.ClientError as error:
        if error.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
            return None
        raise
    return int(response.get("ContentLength", 0)), str(response.get("ContentType", ""))


def delete_object(storage_key: str) -> None:
    settings = get_settings()
    get_s3_client().delete_object(Bucket=settings.minio_bucket, Key=storage_key)
