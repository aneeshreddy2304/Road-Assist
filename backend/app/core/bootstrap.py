from sqlalchemy import text

from app.db.session import engine


async def ensure_schema_updates() -> None:
    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                ALTER TABLE mechanics
                ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'approved'
                """
            )
        )
        await conn.execute(
            text(
                """
                UPDATE mechanics
                SET approval_status = 'approved'
                WHERE approval_status IS NULL
                """
            )
        )
