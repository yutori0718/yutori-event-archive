"""MHDB (mhdb-wilds-data) の merged JSON から、サイト用の軽量データ data/mh-wilds.json を生成する。

使い方:
  git clone --depth 1 https://github.com/LartTyler/mhdb-wilds-data.git
  python3 tools/build-mh-wilds-data.py mhdb-wilds-data/output/merged
"""
import json
import sys
from pathlib import Path

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else "mhdb-wilds-data/output/merged")
OUT = Path(__file__).resolve().parent.parent / "data" / "mh-wilds.json"

WEAPON_FILES = [
    ("GreatSword", "great-sword", "大剣"),
    ("LongSword", "long-sword", "太刀"),
    ("SwordShield", "sword-shield", "片手剣"),
    ("DualBlades", "dual-blades", "双剣"),
    ("Hammer", "hammer", "ハンマー"),
    ("HuntingHorn", "hunting-horn", "狩猟笛"),
    ("Lance", "lance", "ランス"),
    ("Gunlance", "gunlance", "ガンランス"),
    ("SwitchAxe", "switch-axe", "スラッシュアックス"),
    ("ChargeBlade", "charge-blade", "チャージアックス"),
    ("InsectGlaive", "insect-glaive", "操虫棍"),
    ("LightBowgun", "light-bowgun", "ライトボウガン"),
    ("HeavyBowgun", "heavy-bowgun", "ヘビィボウガン"),
    ("Bow", "bow", "弓"),
]


def load(name):
    return json.loads((SRC / name).read_text(encoding="utf-8"))


def ja(names):
    return (names or {}).get("ja") or (names or {}).get("en") or ""


def inputs(d):
    return {str(k): v for k, v in (d or {}).items()}


def skills(d):
    return {str(k): v for k, v in (d or {}).items()}


def main():
    used_items = set()
    used_skills = set()

    # スキル
    skill_list = load("Skill.json")
    skill_map = {
        str(s["game_id"]): {"n": ja(s["names"]), "k": s["kind"], "max": max((r["level"] for r in s["ranks"]), default=1)}
        for s in skill_list
    }

    # 武器
    weapons = []
    for file, kind, _ in WEAPON_FILES:
        for w in load(f"weapons/{file}.json"):
            c = w.get("crafting") or {}
            entry = {
                "id": f"{kind}:{w['game_id']}",
                "t": kind,
                "n": ja(w["names"]),
                "r": w["rarity"],
                "atk": w.get("attack_raw"),
                "aff": w.get("affinity") or 0,
                "sl": w.get("slots") or [],
                "sk": skills(w.get("skills")),
                "z": c.get("zenny_cost") or 0,
                "in": inputs(c.get("inputs")),
            }
            if c.get("previous_id") is not None:
                entry["prev"] = f"{kind}:{c['previous_id']}"
            el = [s for s in (w.get("specials") or []) if s.get("kind") in ("element", "status")]
            if el:
                entry["el"] = [el[0].get("element") or el[0].get("status"), el[0].get("raw"), bool(el[0].get("hidden"))]
            used_items.update(entry["in"])
            used_skills.update(entry["sk"])
            weapons.append(entry)

    # 防具
    armor = []
    for s in load("Armor.json"):
        pieces = []
        for p in s["pieces"]:
            c = p.get("crafting") or {}
            piece = {
                "id": f"{s['game_id']}:{p['kind']}",
                "p": p["kind"],
                "n": ja(p["names"]),
                "def": (p.get("defense") or {}).get("base"),
                "sl": p.get("slots") or [],
                "sk": skills(p.get("skills")),
                "z": c.get("price") or 0,
                "in": inputs(c.get("inputs")),
            }
            used_items.update(piece["in"])
            used_skills.update(piece["sk"])
            pieces.append(piece)
        armor.append({"id": str(s["game_id"]), "n": ja(s["names"]), "r": s["rarity"], "pc": pieces})

    # 護石
    charms = []
    for a in load("Amulet.json"):
        for i, r in enumerate(a["ranks"]):
            rec = inputs((r.get("recipe") or {}).get("inputs"))
            entry = {
                "id": f"{a['game_id']}:{i}",
                "n": ja(r["names"]),
                "r": r.get("rarity"),
                "lv": r.get("level"),
                "sk": skills(r.get("skills")),
                "z": r.get("price") or 0,
                "in": rec,
            }
            if a.get("is_random"):
                entry["rand"] = True
            used_items.update(rec)
            used_skills.update(entry["sk"])
            charms.append(entry)

    # 装飾品（珠）
    decorations = []
    for d in load("Accessory.json"):
        entry = {
            "id": str(d["game_id"]),
            "n": ja(d["names"]),
            "r": d["rarity"],
            "lv": d["level"],
            "on": d["allowed_on"],
            "sk": skills(d.get("skills")),
        }
        used_skills.update(entry["sk"])
        decorations.append(entry)

    # モンスター & 入手先
    monsters = []
    sources = {}
    for m in load("LargeMonsters.json"):
        mid = str(m["game_id"])
        monsters.append({"id": mid, "n": ja(m["names"])})
        for rw in m.get("rewards") or []:
            key = (mid, rw["rank"])
            item_sources = sources.setdefault(str(rw["item_id"]), {})
            src = item_sources.setdefault(key, {"k": set(), "c": 0})
            src["k"].add(rw["kind"])
            src["c"] = max(src["c"], rw.get("chance") or 0)

    # 素材（アイテム）
    items = []
    for it in load("Item.json"):
        iid = str(it["game_id"])
        if it["kind"] != "material" and iid not in used_items:
            continue
        entry = {"id": iid, "n": ja(it["names"]), "r": it["rarity"], "k": it["kind"], "c": it.get("icon_color")}
        desc = ja(it.get("descriptions"))
        if desc:
            entry["d"] = desc.replace("\r\n", "")
        src = sources.get(iid)
        if src:
            entry["src"] = [
                [mid, rank, sorted(v["k"]), v["c"]]
                for (mid, rank), v in sorted(src.items(), key=lambda kv: (kv[0][1] != "high", -kv[1]["c"]))
            ]
        items.append(entry)

    missing = used_items - {i["id"] for i in items}
    if missing:
        print("warning: unknown item ids", sorted(missing))

    data = {
        "source": "MHDB (https://github.com/LartTyler/mhdb-wilds-data)",
        "weaponTypes": [{"id": kind, "n": name} for _, kind, name in WEAPON_FILES],
        "skills": {k: v for k, v in skill_map.items() if k in used_skills},
        "items": items,
        "monsters": monsters,
        "weapons": weapons,
        "armor": armor,
        "charms": charms,
        "decorations": decorations,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)",
          {k: len(v) for k, v in data.items() if isinstance(v, (list, dict))})


if __name__ == "__main__":
    main()
