from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import get_settings

settings = get_settings()


def _normalize_database_url(database_url: str) -> tuple[str, dict]:
    parts = urlsplit(database_url)
    query_params = dict(parse_qsl(parts.query, keep_blank_values=True))
    connect_args = {}

    ssl_value = query_params.pop("ssl", None) or query_params.pop("sslmode", None)
    if ssl_value:
        connect_args["ssl"] = "require"

    normalized_url = urlunsplit(
        (parts.scheme, parts.netloc, parts.path, urlencode(query_params), parts.fragment)
    )

    if "supabase.com" in parts.netloc:
        connect_args.setdefault(
            "server_settings",
            {"application_name": "roadassist"},
        )

    return normalized_url, connect_args


database_url, connect_args = _normalize_database_url(settings.DATABASE_URL)

engine = create_async_engine(
    database_url,
    echo=settings.APP_ENV == "development",
    pool_size=10,
    max_overflow=20,
    connect_args=connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
