import os

from sqlalchemy import create_engine, text


def database_url() -> str:
    return os.getenv("DATABASE_URL", "postgresql+psycopg://chargedup_app:chargedup_local@localhost:5432/chargedup")


def check_database() -> bool:
    engine = create_engine(database_url(), pool_pre_ping=True)
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
    finally:
        engine.dispose()
