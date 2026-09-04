import json

src = r"c:\D\gitHub\MatchExpert\Assets\MatchExpert\i18n\matchExpert.txt"
out = r"c:\D\gitHub\MatchExpert2\assets\resources\config\i18n.json"
text = open(src, "rb").read().decode("utf-16")
lines = text.splitlines()
header = lines[0].split("\t")
langs = header[1:]
data = {lang: {} for lang in langs}
for line in lines[1:]:
    if not line.strip():
        continue
    parts = line.split("\t")
    while len(parts) < len(header):
        parts.append("")
    key = parts[0].lstrip("^")
    for i, lang in enumerate(langs):
        data[lang][key] = parts[i + 1].replace("\\n", "\n")
with open(out, "w", encoding="utf-8") as f:
    json.dump({"defaultLang": "tw", "langs": langs, "strings": data}, f, ensure_ascii=False, indent=2)
print("i18n keys", len(data["tw"]))

cfg = {
    "levelMax": 180,
    "stageLevel": [20, 30, 35, 40, 45, 50],
    "maxGameTime": 180.0,
    "addTimeOnMatch": 3.0,
    "tableSlots": 7,
    "cellSize": 120,
    "moveTime": 0.4,
    "starUpCoin": [400, 1200, 2400, 4000, 6000, 84000],
    "starExp": [20, 60, 140, 300, 540, 860],
    "starUpGetCoin": [1, 2, 4, 6, 8, 10, 12],
    "skinBuyCoin": [1000, 1500, 2000, 2500, 3000],
    "itemBuyCoin": [80, 150, 100, 400],
    "revivalCoin": 300,
    "defaultCoin": 100,
    "skinCount": 6,
    "blockCount": 21,
    "itemCount": 3,
    "tileType": {
        "0": "normal",
        "1": "hide",
        "2": "ice",
        "3": "fire",
        "4": "water",
        "5": "stone",
        "6": "hammer",
    },
    "itemNames": ["back", "match", "reset", "addSlot"],
    "modes": ["easy", "normal", "hard"],
}
cfg_path = r"c:\D\gitHub\MatchExpert2\assets\resources\config\game_config.json"
with open(cfg_path, "w", encoding="utf-8") as f:
    json.dump(cfg, f, ensure_ascii=False, indent=2)

mapping = {
    "unityToCocos": [
        {"unity": "MatchExpertMain.cs", "cocos": "scripts/core/GameApp.ts", "note": "主流程/視圖切換"},
        {"unity": "MatchExpertGame.cs", "cocos": "scripts/game/MatchGame.ts", "note": "對局核心"},
        {"unity": "MatchExpertSymbol.cs", "cocos": "scripts/game/TileSymbol.ts", "note": "方塊與遮擋"},
        {"unity": "MatchExpertSaveData.cs", "cocos": "scripts/core/SaveData.ts", "note": "localStorage"},
        {"unity": "MatchExpertLevelMap.cs", "cocos": "scripts/ui/LevelMapView.ts", "note": "關卡地圖"},
        {"unity": "MatchExpertLevel.cs", "cocos": "scripts/ui/LevelPop.ts", "note": "關卡彈窗"},
        {"unity": "MatchExpertLoading.cs", "cocos": "scripts/ui/LoadingView.ts", "note": "載入頁"},
        {"unity": "GameBatter.cs", "cocos": "scripts/game/ComboBatter.ts", "note": "連擊"},
        {"unity": "gameLevelData.cs", "cocos": "resources/levels/*.json", "note": "已匯出"},
        {"unity": "MatchExpertSkinData.cs", "cocos": "scripts/data/SkinCatalog.ts", "note": "皮膚圖集"},
        {"unity": "popWindows/*", "cocos": "scripts/ui/pops/*", "note": "各彈窗"},
        {"unity": "unityAds/*", "cocos": "scripts/core/AdsService.ts", "note": "後置 stub"},
        {"unity": "DOTween", "cocos": "cc.tween", "note": "動畫"},
        {"unity": "Easy Save 3", "cocos": "sys.localStorage", "note": "存檔"},
        {"unity": "BtnScaleAnim.cs", "cocos": "scripts/ui/BtnScaleAnim.ts", "note": "按鈕縮放"},
    ],
    "assetFolders": {
        "textures/bg": "背景圖",
        "textures/ui": "介面圖",
        "textures/skin": "皮膚與方塊圖案",
        "textures/fx": "特效圖",
        "textures/mockup": "參考 mockup",
        "audio/bgm": "背景音樂",
        "audio/sfx": "音效",
        "fonts": "字型",
        "i18n": "原始多語系表",
        "resources/levels": "180x3 關卡資料",
        "resources/config": "設定與 i18n JSON",
    },
    "skipped": [
        "UI/old (舊資源)",
        "Unity .anim/.controller/.mat/.shader",
        "Package/Easy Save/DOTween/AllIn1SpriteShader",
        "Plugins/NativeShare (後置)",
        "ScreenShooter 編輯器工具",
        "關卡編輯器 creatLevel*.cs (開發工具)",
    ],
    "phaseStatus": {
        "0_inventory": "done",
        "1_assets": "done",
        "1_levels": "done",
        "2_skeleton": "in_progress",
        "3_core_mvp": "pending",
    },
}
map_path = r"c:\D\gitHub\MatchExpert2\assets\resources\config\migration_map.json"
with open(map_path, "w", encoding="utf-8") as f:
    json.dump(mapping, f, ensure_ascii=False, indent=2)
print("config done")
