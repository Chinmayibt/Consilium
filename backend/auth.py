from datetime import datetime, timedelta
from typing import Any, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from .config import settings

# Use bcrypt_sha256 to safely handle long passwords without 72-byte limit issues
pwd_context = CryptContext(schemes=["bcrypt_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def _create_token(
    subject: str,
    expires_delta: timedelta,
    secret: str,
    algorithm: str,
) -> str:
    now = datetime.utcnow()
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, secret, algorithm=algorithm)


def create_access_token(user_id: str) -> str:
    expire = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return _create_token(
        subject=user_id,
        expires_delta=expire,
        secret=settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )


def create_refresh_token(user_id: str) -> str:
    expire = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    return _create_token(
        subject=user_id,
        expires_delta=expire,
        secret=settings.JWT_REFRESH_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_token(token: str, refresh: bool = False) -> Optional[str]:
    secret = settings.JWT_REFRESH_SECRET if refresh else settings.JWT_SECRET
    try:
        payload = jwt.decode(token, secret, algorithms=[settings.JWT_ALGORITHM])
        return str(payload.get("sub"))
    except JWTError:
        return None

