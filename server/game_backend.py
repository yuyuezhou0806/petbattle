import base64
import json
import os
import re
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import bcrypt
import jwt
import psycopg
import redis
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from psycopg.rows import dict_row
from pydantic import BaseModel, Field, field_validator

router = APIRouter()
bearer = HTTPBearer(auto_error=False)
SESSION_SECONDS = 7 * 24 * 60 * 60
USERNAME_PATTERN = re.compile(r"^[\w\u4e00-\u9fff]{3,24}$", re.UNICODE)
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/var/lib/pet-battle/uploads"))


GEAR_CATALOG = [
    {"id": "leaf-crown", "name": "嫩叶头冠", "slot": "head", "rarity": "普通", "icon": "🌿", "bonus": {"hp": 8}},
    {"id": "runner-band", "name": "追风发带", "slot": "head", "rarity": "稀有", "icon": "🎗️", "bonus": {"speed": 6, "crit": 0.02}},
    {"id": "star-goggles", "name": "星光护目镜", "slot": "head", "rarity": "史诗", "icon": "🥽", "bonus": {"attack": 5, "crit": 0.04}},
    {"id": "cotton-vest", "name": "云朵背心", "slot": "body", "rarity": "普通", "icon": "☁️", "bonus": {"defense": 4}},
    {"id": "trail-cloak", "name": "远行披风", "slot": "body", "rarity": "稀有", "icon": "🧣", "bonus": {"hp": 12, "defense": 4}},
    {"id": "guardian-coat", "name": "守护战衣", "slot": "body", "rarity": "史诗", "icon": "🦺", "bonus": {"hp": 18, "defense": 7}},
    {"id": "bell-charm", "name": "铃铛挂件", "slot": "charm", "rarity": "普通", "icon": "🔔", "bonus": {"speed": 3}},
    {"id": "lucky-cookie", "name": "幸运饼干", "slot": "charm", "rarity": "稀有", "icon": "🍪", "bonus": {"crit": 0.03, "dodge": 0.02}},
    {"id": "moon-medal", "name": "月光勋章", "slot": "charm", "rarity": "史诗", "icon": "🌙", "bonus": {"attack": 6, "speed": 4}},
]
GEAR_BY_ID = {gear["id"]: gear for gear in GEAR_CATALOG}
ADVENTURE_STAGES = {
    "park": {"energy": 1, "power": 120, "coins": 80, "rarity_boost": 0.0},
    "market": {"energy": 2, "power": 155, "coins": 140, "rarity_boost": 0.02},
    "ruins": {"energy": 3, "power": 195, "coins": 200, "rarity_boost": 0.05},
}


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    username VARCHAR(24) NOT NULL,
    display_name VARCHAR(32) NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (LOWER(username));

CREATE TABLE IF NOT EXISTS player_state (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    coins INTEGER NOT NULL DEFAULT 240 CHECK (coins >= 0),
    tickets INTEGER NOT NULL DEFAULT 3 CHECK (tickets >= 0),
    energy INTEGER NOT NULL DEFAULT 5 CHECK (energy >= 0),
    energy_refreshed_on DATE NOT NULL DEFAULT CURRENT_DATE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE player_state ADD COLUMN IF NOT EXISTS energy_refreshed_on DATE NOT NULL DEFAULT CURRENT_DATE;

CREATE TABLE IF NOT EXISTS pets (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(32) NOT NULL,
    species VARCHAR(64) NOT NULL,
    element VARCHAR(16) NOT NULL,
    level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 100),
    hp INTEGER NOT NULL,
    attack INTEGER NOT NULL,
    species_id VARCHAR(24) NOT NULL,
    breed_id VARCHAR(64),
    breed_name VARCHAR(64),
    traits JSONB NOT NULL DEFAULT '[]'::jsonb,
    equipment JSONB NOT NULL DEFAULT '{}'::jsonb,
    image_url TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cards (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    rarity VARCHAR(16) NOT NULL DEFAULT 'common',
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, pet_id, rarity)
);

CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gear_id VARCHAR(64) NOT NULL,
    gear_data JSONB NOT NULL,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS checkins (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    checkin_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, checkin_date)
);
"""


class Credentials(BaseModel):
    username: str
    password: str = Field(min_length=8, max_length=72)
    display_name: str | None = Field(default=None, max_length=32)

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        value = value.strip()
        if not USERNAME_PATTERN.fullmatch(value):
            raise ValueError("用户名需为 3–24 位中文、字母、数字或下划线")
        return value

    @field_validator("password")
    @classmethod
    def validate_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("密码不能超过 72 个 UTF-8 字节")
        return value

    @field_validator("display_name")
    @classmethod
    def validate_display_name(cls, value: str | None) -> str | None:
        value = value.strip() if value else None
        return value or None


class PetPayload(BaseModel):
    name: str = Field(min_length=1, max_length=32)
    species: str = Field(min_length=1, max_length=64)
    element: str = Field(min_length=1, max_length=16)
    level: int = Field(ge=1, le=100)
    hp: int = Field(ge=1, le=100000)
    attack: int = Field(ge=1, le=10000)
    speciesId: str = Field(min_length=1, max_length=24)
    breedId: str | None = Field(default=None, max_length=64)
    breedName: str | None = Field(default=None, max_length=64)
    traits: list[dict[str, Any]] = Field(default_factory=list, max_length=12)
    equipment: dict[str, dict[str, Any]] = Field(default_factory=dict)
    image: str | None = None


class AdventurePayload(BaseModel):
    stageId: str


@dataclass
class AuthContext:
    user_id: uuid.UUID
    jti: str


def database_url() -> str:
    value = os.getenv("DATABASE_URL")
    if not value:
        raise RuntimeError("DATABASE_URL is not configured")
    return value


def redis_client() -> redis.Redis:
    value = os.getenv("REDIS_URL")
    if not value:
        raise RuntimeError("REDIS_URL is not configured")
    return redis.Redis.from_url(value, decode_responses=True)


def connect():
    return psycopg.connect(database_url(), row_factory=dict_row)


def init_backend() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.execute(SCHEMA)
    redis_client().ping()


def close_backend() -> None:
    return None


def public_user(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "username": row["username"],
        "displayName": row["display_name"],
        "createdAt": row["created_at"].isoformat() if row.get("created_at") else None,
    }


def issue_token(user_id: str | uuid.UUID) -> str:
    secret = os.environ["JWT_SECRET"]
    now = datetime.now(timezone.utc)
    jti = secrets.token_urlsafe(24)
    user_id_text = str(user_id)
    payload = {"sub": user_id_text, "jti": jti, "iat": now, "exp": now + timedelta(seconds=SESSION_SECONDS)}
    token = jwt.encode(payload, secret, algorithm="HS256")
    redis_client().setex(f"session:{jti}", SESSION_SECONDS, user_id_text)
    return token


def auth_context(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> AuthContext:
    if not credentials:
        raise HTTPException(401, "请先登录")
    try:
        payload = jwt.decode(credentials.credentials, os.environ["JWT_SECRET"], algorithms=["HS256"])
        user_id = uuid.UUID(payload["sub"])
        jti = payload["jti"]
    except Exception as exc:
        raise HTTPException(401, "登录状态已失效") from exc
    if redis_client().get(f"session:{jti}") != str(user_id):
        raise HTTPException(401, "登录状态已退出")
    return AuthContext(user_id=user_id, jti=jti)


def rate_limit_login(username: str, request: Request) -> str:
    address = request.client.host if request.client else "unknown"
    key = f"auth-attempt:{address}:{username.lower()}"
    client = redis_client()
    attempts = client.incr(key)
    if attempts == 1:
        client.expire(key, 600)
    if attempts > 10:
        raise HTTPException(429, "登录尝试过多，请十分钟后再试")
    return key


def auth_response(user: dict[str, Any]) -> dict[str, Any]:
    return {"token": issue_token(str(user["id"])), "user": public_user(user)}


@router.post("/auth/register", status_code=201)
def register(body: Credentials, request: Request):
    rate_key = rate_limit_login(body.username, request)
    user_id = uuid.uuid4()
    password_hash = bcrypt.hashpw(body.password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("ascii")
    try:
        with connect() as conn:
            user = conn.execute(
                "INSERT INTO users (id, username, display_name, password_hash) VALUES (%s, %s, %s, %s) RETURNING *",
                (user_id, body.username, body.display_name or body.username, password_hash),
            ).fetchone()
            conn.execute("INSERT INTO player_state (user_id) VALUES (%s)", (user_id,))
    except psycopg.errors.UniqueViolation as exc:
        raise HTTPException(409, "这个用户名已被使用") from exc
    redis_client().delete(rate_key)
    return auth_response(user)


@router.post("/auth/login")
def login(body: Credentials, request: Request):
    rate_key = rate_limit_login(body.username, request)
    with connect() as conn:
        user = conn.execute("SELECT * FROM users WHERE LOWER(username) = LOWER(%s)", (body.username,)).fetchone()
    if not user or not bcrypt.checkpw(body.password.encode("utf-8"), user["password_hash"].encode("ascii")):
        raise HTTPException(401, "用户名或密码错误")
    redis_client().delete(rate_key)
    return auth_response(user)


@router.post("/auth/logout", status_code=204)
def logout(context: AuthContext = Depends(auth_context)):
    redis_client().delete(f"session:{context.jti}")
    return None


@router.get("/auth/me")
def me(context: AuthContext = Depends(auth_context)):
    with connect() as conn:
        user = conn.execute("SELECT * FROM users WHERE id = %s", (context.user_id,)).fetchone()
    if not user:
        raise HTTPException(404, "用户不存在")
    return public_user(user)


def save_image(user_id: str, pet_id: str, image: str | None) -> str | None:
    if not image:
        return None
    expected_prefix = f"/uploads/{user_id}/{pet_id}."
    image_path = image.split("?", 1)[0]
    if image_path.startswith(expected_prefix) or image_path.endswith(expected_prefix + "png") or image_path.endswith(expected_prefix + "webp"):
        return image_path[image_path.rfind("/uploads/"):]
    if not image.startswith("data:image/"):
        return None
    try:
        header, encoded = image.split(",", 1)
        raw = base64.b64decode(encoded, validate=True)
    except Exception as exc:
        raise HTTPException(422, "宠物立绘数据无效") from exc
    if len(raw) > 6 * 1024 * 1024:
        raise HTTPException(413, "宠物立绘不能超过 6 MB")
    extension = "webp" if "webp" in header else "png"
    user_dir = UPLOAD_DIR / user_id
    user_dir.mkdir(parents=True, exist_ok=True)
    destination = user_dir / f"{pet_id}.{extension}"
    destination.write_bytes(raw)
    return f"/uploads/{user_id}/{destination.name}"


def pet_to_public(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if not row:
        return None
    return {
        "id": str(row["id"]), "name": row["name"], "species": row["species"], "element": row["element"],
        "level": row["level"], "hp": row["hp"], "attack": row["attack"], "speciesId": row["species_id"],
        "breedId": row["breed_id"], "breedName": row["breed_name"], "traits": row["traits"],
        "equipment": row["equipment"], "image": row["image_url"],
    }


def load_game_state(user_id: str) -> dict[str, Any]:
    today = datetime.now(ZoneInfo("Asia/Shanghai")).date()
    with connect() as conn:
        conn.execute(
            "UPDATE player_state SET energy=5, energy_refreshed_on=%s, updated_at=NOW() WHERE user_id=%s AND energy_refreshed_on < %s",
            (today, user_id, today),
        )
        state = conn.execute("SELECT * FROM player_state WHERE user_id = %s", (user_id,)).fetchone()
        pet = conn.execute("SELECT * FROM pets WHERE user_id = %s", (user_id,)).fetchone()
        cards = conn.execute("SELECT * FROM cards WHERE user_id = %s ORDER BY acquired_at", (user_id,)).fetchall()
        inventory = conn.execute("SELECT gear_data FROM inventory WHERE user_id = %s ORDER BY acquired_at DESC", (user_id,)).fetchall()
        checked_in = bool(conn.execute("SELECT 1 FROM checkins WHERE user_id = %s AND checkin_date = %s", (user_id, today)).fetchone())
    return {
        "player": {"coins": state["coins"], "tickets": state["tickets"], "energy": state["energy"], "checkedIn": checked_in},
        "pet": pet_to_public(pet),
        "cards": [{"id": str(card["id"]), "petId": str(card["pet_id"]), "rarity": card["rarity"], "locked": card["is_locked"], "acquiredAt": card["acquired_at"].isoformat()} for card in cards],
        "inventory": [row["gear_data"] for row in inventory],
    }


@router.get("/game/state")
def game_state(context: AuthContext = Depends(auth_context)):
    return load_game_state(context.user_id)


@router.put("/game/pet")
def save_pet(body: PetPayload, context: AuthContext = Depends(auth_context)):
    with connect() as conn:
        current = conn.execute("SELECT id, image_url FROM pets WHERE user_id = %s", (context.user_id,)).fetchone()
        pet_id = current["id"] if current else uuid.uuid4()
        saved_image = save_image(str(context.user_id), str(pet_id), body.image) if body.image else None
        image_url = saved_image or (current["image_url"] if current else None)
        owned_gear_ids = {row["gear_id"] for row in conn.execute("SELECT gear_id FROM inventory WHERE user_id=%s", (context.user_id,)).fetchall()}
        equipment: dict[str, dict[str, Any]] = {}
        for slot, supplied in body.equipment.items():
            gear_id = supplied.get("id")
            canonical = GEAR_BY_ID.get(gear_id)
            if slot not in {"head", "body", "charm"} or not canonical or canonical["slot"] != slot or gear_id not in owned_gear_ids:
                raise HTTPException(422, "装备数据与云端背包不一致")
            equipment[slot] = canonical
        values = (
            pet_id, context.user_id, body.name.strip(), body.species, body.element, body.level, body.hp, body.attack,
            body.speciesId, body.breedId, body.breedName, json.dumps(body.traits, ensure_ascii=False),
            json.dumps(equipment, ensure_ascii=False), image_url,
        )
        pet = conn.execute(
            """INSERT INTO pets (id, user_id, name, species, element, level, hp, attack, species_id, breed_id, breed_name, traits, equipment, image_url)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s)
               ON CONFLICT (user_id) DO UPDATE SET name=EXCLUDED.name, species=EXCLUDED.species, element=EXCLUDED.element,
               level=EXCLUDED.level, hp=EXCLUDED.hp, attack=EXCLUDED.attack, species_id=EXCLUDED.species_id,
               breed_id=EXCLUDED.breed_id, breed_name=EXCLUDED.breed_name, traits=EXCLUDED.traits,
               equipment=EXCLUDED.equipment, image_url=EXCLUDED.image_url, updated_at=NOW() RETURNING *""",
            values,
        ).fetchone()
        conn.execute(
            "INSERT INTO cards (id, user_id, pet_id, rarity) VALUES (%s, %s, %s, 'common') ON CONFLICT (user_id, pet_id, rarity) DO NOTHING",
            (uuid.uuid4(), context.user_id, pet_id),
        )
    return {"pet": pet_to_public(pet), "cards": load_game_state(context.user_id)["cards"]}


@router.post("/game/check-in")
def check_in(context: AuthContext = Depends(auth_context)):
    today = datetime.now(ZoneInfo("Asia/Shanghai")).date()
    with connect() as conn:
        inserted = conn.execute(
            "INSERT INTO checkins (user_id, checkin_date) VALUES (%s, %s) ON CONFLICT DO NOTHING RETURNING checkin_date",
            (context.user_id, today),
        ).fetchone()
        if not inserted:
            raise HTTPException(409, "今天已经签到过了")
        state = conn.execute(
            "UPDATE player_state SET coins = coins + 120, tickets = tickets + 1, updated_at=NOW() WHERE user_id=%s RETURNING *",
            (context.user_id,),
        ).fetchone()
    return {"message": "签到成功：金币 ×120、装备券 ×1", "player": {"coins": state["coins"], "tickets": state["tickets"], "energy": state["energy"], "checkedIn": True}}


@router.post("/game/equipment/draw")
def equipment_draw(context: AuthContext = Depends(auth_context)):
    roll = secrets.randbelow(10000) / 10000
    rarity = "史诗" if roll < 0.08 else "稀有" if roll < 0.36 else "普通"
    choices = [gear for gear in GEAR_CATALOG if gear["rarity"] == rarity]
    gear = secrets.choice(choices)
    with connect() as conn:
        state = conn.execute("SELECT tickets FROM player_state WHERE user_id=%s FOR UPDATE", (context.user_id,)).fetchone()
        if not state or state["tickets"] < 1:
            raise HTTPException(409, "装备券不足")
        player = conn.execute("UPDATE player_state SET tickets=tickets-1, updated_at=NOW() WHERE user_id=%s RETURNING *", (context.user_id,)).fetchone()
        conn.execute("INSERT INTO inventory (id, user_id, gear_id, gear_data) VALUES (%s, %s, %s, %s::jsonb)", (uuid.uuid4(), context.user_id, gear["id"], json.dumps(gear, ensure_ascii=False)))
    return {"gear": gear, "player": {"coins": player["coins"], "tickets": player["tickets"], "energy": player["energy"]}}


@router.post("/game/adventure")
def adventure(body: AdventurePayload, context: AuthContext = Depends(auth_context)):
    stage = ADVENTURE_STAGES.get(body.stageId)
    if not stage:
        raise HTTPException(404, "冒险地点不存在")
    today = datetime.now(ZoneInfo("Asia/Shanghai")).date()
    with connect() as conn:
        conn.execute(
            "UPDATE player_state SET energy=5, energy_refreshed_on=%s, updated_at=NOW() WHERE user_id=%s AND energy_refreshed_on < %s",
            (today, context.user_id, today),
        )
        player = conn.execute("SELECT * FROM player_state WHERE user_id=%s FOR UPDATE", (context.user_id,)).fetchone()
        pet = conn.execute("SELECT hp, attack, level FROM pets WHERE user_id=%s", (context.user_id,)).fetchone()
        if not pet:
            raise HTTPException(409, "请先创建并保存一只宠物")
        if player["energy"] < stage["energy"]:
            raise HTTPException(409, "冒险体力不足，明日会恢复")
        power = round(pet["hp"] * 0.42 + pet["attack"] * 2.1 + pet["level"] * 2.5 + 55)
        win_chance = max(0.25, min(0.95, 0.58 + (power - stage["power"]) / 180))
        won = secrets.randbelow(10000) / 10000 <= win_chance
        gear = None
        coins = stage["coins"] if won else 0
        if won:
            roll = secrets.randbelow(10000) / 10000
            boost = stage["rarity_boost"]
            rarity = "史诗" if roll < 0.08 + boost else "稀有" if roll < 0.36 + boost else "普通"
            gear = secrets.choice([item for item in GEAR_CATALOG if item["rarity"] == rarity])
            conn.execute(
                "INSERT INTO inventory (id, user_id, gear_id, gear_data) VALUES (%s, %s, %s, %s::jsonb)",
                (uuid.uuid4(), context.user_id, gear["id"], json.dumps(gear, ensure_ascii=False)),
            )
        player = conn.execute(
            "UPDATE player_state SET energy=energy-%s, coins=coins+%s, updated_at=NOW() WHERE user_id=%s RETURNING *",
            (stage["energy"], coins, context.user_id),
        ).fetchone()
    return {
        "won": won,
        "gear": gear,
        "coins": coins,
        "power": power,
        "player": {"coins": player["coins"], "tickets": player["tickets"], "energy": player["energy"]},
    }


@router.patch("/game/cards/{card_id}/lock")
def set_card_lock(card_id: uuid.UUID, locked: bool, context: AuthContext = Depends(auth_context)):
    with connect() as conn:
        card = conn.execute("UPDATE cards SET is_locked=%s WHERE id=%s AND user_id=%s RETURNING *", (locked, card_id, context.user_id)).fetchone()
    if not card:
        raise HTTPException(404, "卡牌不存在")
    return {"id": str(card["id"]), "locked": card["is_locked"]}
