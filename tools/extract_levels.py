import re, json, os

path = r"c:\D\gitHub\MatchExpert\Assets\MatchExpert\MatchExpert.unity"
out_dir = r"c:\D\gitHub\MatchExpert2\assets\resources\levels"
os.makedirs(out_dir, exist_ok=True)

with open(path, "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()

gos = {}
for m in re.finditer(r"--- !u!1 &(\d+)\nGameObject:\n(.*?)(?=\n--- !u!|\Z)", content, re.S):
    gid, body = m.group(1), m.group(2)
    nm = re.search(r"m_Name: (.+)", body)
    comps = re.findall(r"component: \{fileID: (\d+)\}", body)
    gos[gid] = {"name": nm.group(1).strip() if nm else "?", "comps": comps}

comp2go = {c: gid for gid, info in gos.items() for c in info["comps"]}

go_tr = {}
tr_info = {}
for tag in ("4", "224"):
    for m in re.finditer(rf"--- !u!{tag} &(\d+)\n(?:Transform|RectTransform):\n(.*?)(?=\n--- !u!|\Z)", content, re.S):
        tid, body = m.group(1), m.group(2)
        gm = re.search(r"m_GameObject: \{fileID: (\d+)\}", body)
        if not gm:
            continue
        children = []
        if "m_Children:" in body:
            chunk = body.split("m_Children:", 1)[1]
            chunk = re.split(r"\nm_[A-Z]", chunk, maxsplit=1)[0]
            children = re.findall(r"\{fileID: (\d+)\}", chunk)
        pm = re.search(r"m_Father: \{fileID: (\d+)\}", body)
        father = pm.group(1) if pm else "0"
        go = gm.group(1)
        tr_info[tid] = {"go": go, "father": father, "children": children}
        go_tr[go] = tid

mode_parents = {}
for gid, info in gos.items():
    n = info["name"]
    if n in ("gameLevelData_Easy", "gameLevelData_Normal", "gameLevelData_Hard"):
        mode_parents[n.split("_")[1].lower()] = gid

def extract_strings(body: str):
    m = re.search(r"levelData:\n((?:  - .+\n)*  - .+)", body)
    if not m:
        return []
    return [s.strip() for s in re.findall(r"  - (.+)", m.group(1))]

level_by_go = {}
for m in re.finditer(r"--- !u!114 &(\d+)\nMonoBehaviour:\n(.*?)(?=\n--- !u!|\Z)", content, re.S):
    mid, body = m.group(1), m.group(2)
    if "levelData:" not in body:
        continue
    go = comp2go.get(mid)
    if not go:
        continue
    strings = extract_strings(body)
    level_by_go[go] = strings

print("level_by_go", len(level_by_go))

def parse_level(strings, level_id, mode):
    if not strings or len(strings) < 4:
        return None
    def ints(s):
        s = (s or "").strip()
        if not s or s == "null":
            return []
        return [int(x) for x in s.split(",") if x.strip() != ""]
    other = ints(strings[0])
    floors = ints(strings[1])
    positions = ints(strings[2])
    types = ints(strings[3])
    # pad types if needed
    if len(types) < len(positions):
        types = types + [0] * (len(positions) - len(types))
    return {
        "id": level_id,
        "mode": mode,
        "levelNum": other[0] if other else level_id,
        "gridMode": other[1] if len(other) > 1 else 0,
        "scale": other[2] if len(other) > 2 else 0,
        "symbolTypes": other[3] if len(other) > 3 else 4,
        "floorCounts": floors,
        "positions": positions,
        "tileTypes": types,
    }

meta = {
    "levelMax": 180,
    "source": "MatchExpert.unity gameLevelData_Easy/Normal/Hard",
    "fields": {
        "levelNum": "关卡编号",
        "gridMode": "0=偶数层9x9奇数层8x8; 1=偶数层8x8奇数层9x9 (f从0起)",
        "scale": "桌面缩放: 1 + scale*0.05",
        "symbolTypes": "本关花色数量",
        "floorCounts": "每层方块数",
        "positions": "格子编号(按层拼接)",
        "tileTypes": "0普通1问号2冰3火4水5石6槌",
    },
    "layout": {
        "cellSize": 120,
        "origin9": {"x": -480, "y": 480},
        "origin8": {"x": -420, "y": 420},
    },
}

result = {"meta": meta, "easy": [], "normal": [], "hard": []}

for mode, pgid in sorted(mode_parents.items()):
    tid = go_tr[pgid]
    child_tids = tr_info[tid]["children"]
    ordered = []
    for ctid in child_tids:
        if ctid not in tr_info:
            continue
        cgo = tr_info[ctid]["go"]
        name = gos[cgo]["name"]
        if not re.match(r"levelData\d+$", name):
            print(mode, "skip non-level child", name)
            continue
        strings = level_by_go.get(cgo)
        # id from name
        lid = int(name.replace("levelData", ""))
        parsed = parse_level(strings, lid, mode)
        if not parsed:
            print(mode, "FAIL", name, "nstrings", 0 if not strings else len(strings), strings[:1] if strings else None)
            continue
        ordered.append(parsed)
    ordered.sort(key=lambda x: x["id"])
    # ensure 1..180 contiguous
    by_id = {x["id"]: x for x in ordered}
    final = []
    for i in range(1, 181):
        if i not in by_id:
            raise SystemExit(f"missing {mode} level {i}")
        item = by_id[i]
        item["id"] = i
        final.append(item)
    result[mode] = final
    print(mode, "OK", len(final), "L1 blocks", final[0]["positions"].__len__(), "L180", final[179]["positions"].__len__())

# write
with open(os.path.join(out_dir, "all_levels.json"), "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, separators=(",", ":"))

for mode in ("easy", "normal", "hard"):
    with open(os.path.join(out_dir, f"{mode}.json"), "w", encoding="utf-8") as f:
        json.dump({"meta": meta, "levels": result[mode]}, f, ensure_ascii=False, separators=(",", ":"))

with open(os.path.join(out_dir, "sample_easy_first3.json"), "w", encoding="utf-8") as f:
    json.dump(result["easy"][:3], f, ensure_ascii=False, indent=2)

print("sizes:")
for fn in sorted(os.listdir(out_dir)):
    print(f"  {fn}: {os.path.getsize(os.path.join(out_dir, fn))} bytes")
