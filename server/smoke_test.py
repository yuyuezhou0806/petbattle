"""Run a disposable end-to-end check against a deployed Pet Battle API."""

import json
import os
import uuid
import urllib.error
import urllib.request

import psycopg


BASE_URL = os.getenv("SMOKE_BASE_URL", "https://petbattle.mapleai.top")


def request(path: str, method: str = "GET", body=None, token: str | None = None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    call = urllib.request.Request(f"{BASE_URL}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(call, timeout=30) as response:
            content = response.read()
            return response.status, json.loads(content) if content else None
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {path} failed: {error.code} {detail}") from error


def main() -> None:
    username = f"codexverify_{uuid.uuid4().hex[:8]}"
    password = f"Verify-{uuid.uuid4().hex}"
    token = None
    checks: list[str] = []
    try:
        status, auth = request("/api/auth/register", "POST", {"username": username, "password": password, "display_name": "部署验证"})
        assert status == 201
        token = auth["token"]
        checks.append("register")

        _, initial = request("/api/game/state", token=token)
        assert initial["player"]["tickets"] == 3
        checks.append("state")

        pet = {
            "name": "验证伙伴", "species": "中华田园猫", "element": "森林", "level": 3,
            "hp": 112, "attack": 34, "speciesId": "cat", "breedId": "lihua", "breedName": "狸花猫",
            "traits": [], "equipment": {},
        }
        _, saved = request("/api/game/pet", "PUT", pet, token)
        assert saved["pet"]["name"] == "验证伙伴" and saved["cards"][0]["rarity"] == "common"
        checks.append("pet-card")

        _, checkin = request("/api/game/check-in", "POST", {}, token)
        assert checkin["player"]["checkedIn"] is True
        checks.append("check-in")

        _, draw = request("/api/game/equipment/draw", "POST", {}, token)
        assert draw["gear"]["id"]
        checks.append("equipment")

        _, adventure = request("/api/game/adventure", "POST", {"stageId": "park"}, token)
        assert adventure["player"]["energy"] == 4
        checks.append("adventure")
    finally:
        if token:
            try:
                request("/api/auth/logout", "POST", {}, token)
                checks.append("logout")
            except Exception:
                pass
        database_url = os.getenv("DATABASE_URL")
        if database_url:
            with psycopg.connect(database_url) as connection:
                connection.execute("DELETE FROM users WHERE username=%s", (username,))

    print("Smoke test passed: " + ", ".join(checks))


if __name__ == "__main__":
    main()
