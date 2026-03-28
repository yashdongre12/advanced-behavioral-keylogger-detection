"""
auth.py
-------
Lightweight user authentication utilizing MongoDB.
Requires a running MongoDB instance (default: mongodb://localhost:27017/)

The frontend POSTs to /auth/login and receives a Bearer token.
All protected endpoints check for Authorization: Bearer <token>.
"""

import os
import hashlib
import secrets
import time
from functools import wraps

import pymongo
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

# ─── Configuration ────────────────────────────────────────────────────────────
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "sentinel_db")
_TOKEN_TTL_HOURS  = int(os.getenv("TOKEN_TTL_HOURS", "8"))

# Simple in-memory token store: {token: expiry_timestamp}
_active_tokens: dict[str, float] = {}

router   = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer(auto_error=False)

# ─── MongoDB Connection ───────────────────────────────────────────────────────
mongo_client = pymongo.MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
db = mongo_client[MONGO_DB_NAME]
users_collection = db["users"]

# Attempt to ensure index on app startup (might fail if Mongo is offline)
try:
    users_collection.create_index("username", unique=True)
except Exception:
    pass


# ─── Pydantic models ──────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str
    email: str = ""
    phone_number: str = ""

class LoginResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    expires_in:   int          # seconds


# ─── Token helpers ────────────────────────────────────────────────────────────
def _hash_password(pwd: str) -> str:
    return hashlib.sha256(pwd.encode()).hexdigest()

def _generate_token() -> str:
    return secrets.token_urlsafe(48)

def _issue_token() -> tuple[str, float]:
    token   = _generate_token()
    expiry  = time.time() + _TOKEN_TTL_HOURS * 3600
    _active_tokens[token] = expiry
    # Purge expired tokens while we're here
    expired = [t for t, exp in _active_tokens.items() if exp < time.time()]
    for t in expired:
        del _active_tokens[t]
    return token, expiry

def verify_token(token: str) -> bool:
    """Return True if token is valid and not expired."""
    expiry = _active_tokens.get(token)
    if expiry is None:
        return False
    if time.time() > expiry:
        del _active_tokens[token]
        return False
    return True


# ─── FastAPI dependency ───────────────────────────────────────────────────────
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    FastAPI dependency that validates the Bearer token.
    Inject into any route that requires authentication.
    """
    if credentials is None or not verify_token(credentials.credentials):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return {"authenticated": True}


# ─── Auth endpoints ───────────────────────────────────────────────────────────
@router.post("/register")
def register(body: RegisterRequest):
    """
    POST /auth/register
    Body: { "username": "user", "password": "...", "email": "...", "phone_number": "..." }
    Creates a new user in the MongoDB database.
    """
    try:
        # Check username uniqueness
        if users_collection.find_one({"username": body.username}):
            raise HTTPException(status_code=400, detail="Username already registered.")
        
        # Check phone number uniqueness (if provided)
        if body.phone_number:
            if users_collection.find_one({"phone_number": body.phone_number}):
                raise HTTPException(status_code=400, detail="Phone number already registered.")
            
        hashed_pw = _hash_password(body.password)
        users_collection.insert_one({
            "username":     body.username,
            "password_hash": hashed_pw,
            "email":        body.email,
            "phone_number": body.phone_number,
        })
    except HTTPException:
        raise
    except pymongo.errors.ServerSelectionTimeoutError:
        raise HTTPException(status_code=503, detail="Database connection error. Is MongoDB running?")
        
    return {"detail": "User registered successfully."}


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest):
    """
    POST /auth/login
    Body: { "username": "user", "password": "your_password" }
    Returns a Bearer token valid for TOKEN_TTL_HOURS hours.
    """
    try:
        user = users_collection.find_one({"username": body.username})
    except pymongo.errors.ServerSelectionTimeoutError:
        raise HTTPException(status_code=503, detail="Database connection error. Is MongoDB running?")
        
    if not user or user.get("password_hash") != _hash_password(body.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )
        
    token, expiry = _issue_token()
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        expires_in=int(expiry - time.time()),
    )


@router.post("/logout")
def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Invalidate the current token."""
    if credentials and credentials.credentials in _active_tokens:
        del _active_tokens[credentials.credentials]
    return {"detail": "Logged out."}


@router.get("/verify")
def verify(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Quick check — returns 200 if token is valid, 401 otherwise."""
    if credentials is None or not verify_token(credentials.credentials):
        raise HTTPException(status_code=401, detail="Invalid token.")
    ttl = int(_active_tokens[credentials.credentials] - time.time())
    return {"valid": True, "ttl_seconds": ttl}
