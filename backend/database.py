from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.database import Database
from .config import settings

client: AsyncIOMotorClient | None = None
db: Database | None = None


def get_client() -> AsyncIOMotorClient:
    global client, db
    if client is None:
        client = AsyncIOMotorClient(settings.MONGODB_URI)
        db_name = settings.MONGODB_DB_NAME or "projectai"
        db = client[db_name]
    return client


def get_db() -> Database:
    global db
    if db is None:
        get_client()
    assert db is not None
    return db

