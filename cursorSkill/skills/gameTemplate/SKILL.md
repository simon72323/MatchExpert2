---
name: game-template
description: >-
  Unity「匹配大師」類層疊三消移植到 Cocos Creator 3.8 的分階段開發模板。
  當使用者要繼續 MatchExpert2、規劃移植步驟、查對照表、或依階段補功能
  （素材／骨架／MVP／特殊牌／道具／地圖／結算／廣告；皮膚／連擊刻意不做）時使用。
---

# Skill: MatchExpert → Cocos 遊戲移植模板（gameTemplate）

你正在把 Unity 專案 **MatchExpert**（匹配大師／層疊三消）完整移植到 Cocos Creator **3.8.x** 專案 **MatchExpert2**。項目大，**必須分階段**；每階段可交付、可預覽，再往下做。

## 專案路徑

| 角色 | 路徑 |
|------|------|
| Unity 來源 | `c:\D\gitHub\MatchExpert` |
| Cocos 目標 | `c:\D\gitHub\MatchExpert2` |
| 模組對照表 | `MatchExpert2/assets/resources/config/migration_map.json` |
| 本 Skill | `MatchExpert2/cursorSkill/skills/gameTemplate/SKILL.md` |

## 何時使用本 Skill

- 使用者說「繼續做」「下一階段」「移植進度」「依計劃開發」
- 要新增對局／地圖／彈窗／道具／皮膚／存檔等功能
- 要對齊 Unity 腳本行為（先讀 C#，再寫 TS）

**寫碼前強制**：先讀對應 Unity C# 與現有 Cocos TS，再改；勿憑記憶發明規則。

---

## 總覽：8 階段

```
0 盤點對照 → 1 素材 → 2 骨架場景 → 3 對局MVP → 4 特殊牌+道具
→ 5 地圖經濟+皮膚 → 6 UI彈窗打磨+多語+套圖 → 7 廣告/分享/上架打磨
```

| 階段 | 目標 | 狀態（依對話進度更新） |
|------|------|------------------------|
| 0 | 盤點腳本／素材／關卡，產出對照表 | ✅ 完成 |
| 1 | 素材進 Cocos、關卡 JSON 抽出 | ✅ 完成 |
| 2 | GameApp／場景／存檔／音效／載入骨架 | ✅ 完成 |
| 3 | 點擊、組牌、三消、遮擋、勝負 UI、計時（**不算星**） | ✅ 完成 |
| 4 | 特殊牌 + 道具列 | ✅ 完成 |
| 5 | 地圖、暫停、結算（皮膚商店已移除） | ✅ 完成（**不做連擊／皮膚**，見「刻意不做」） |
| 6 | 難度／Toast／i18n／LevelPop／語系／**主介面套圖** | ✅ 進行中（HUD／地圖／彈窗已套 resources/ui） |
| 7 | 廣告／分享／IAP 骨架＋安全區／合圖／建置直屏 | ✅ 完成（真 SDK 金鑰需填 sdk_config + 掛 MatchExpertSdk） |

### 已知坑（補充）
- **不可**在同一節點同時掛 `Sprite` + `Graphics`（會直接 throw，導致 GameApp.onLoad 中斷、彈窗全沒）
- UI 九宮格：Unity `spriteBorder` → 執行期 `SpriteFrame.inset*` + `Sprite.Type.SLICED`（見 `UiSpriteUtil.ts`）
- **棋盤座標**：必須用 Unity 邏輯座標（`cellSize=120`，origin9/8）；縮放只掛 `BoardRoot`（`calcBoardRootScale` = fit×(1+scale×0.05)）。**禁止**再對 `boardX/Y` 額外乘 0.75
- **符號視覺**：對齊 Unity `creatLevelSymbol`——box `134×138@(7,-9)`、icon `118×118@(1,-1)`（見 `TILE_VISUAL`）

### 刻意不做／已移除
- **方塊升星**（`StarUpPop`／blockStar）：存檔可讀舊欄位，不再生效
- **連擊**（Unity `GameBatter`／`pic_batterBg`／過關 combo 金幣）：Cocos **不做**；HUD／結算／獎勵皆不含連擊
- **普通／困難難度**：遊戲內**只保留簡單（easy）**；`levels/normal.ts`、`levels/hard.ts`（及對應 JSON）檔案保留但不載入、不進選關。地圖無難度切換列。關卡數以 easy 為準（目前 **180**，對齊 Unity `levelMax`）
- **皮膚功能**（`SkinShopPop`／換膚／地圖與暫停入口）：Cocos **不做**；`SkinCatalog` 僅載入固定皮膚 0 貼圖；存檔 `selectSkin`／`buySkin` 可讀舊欄位但不驅動 UI
- **關卡星級／回打舊關**：地圖只顯示**下一關**按鈕；過關推進進度後不可選舊關；HUD／結算／存檔**不算星星**（`levelStar` 欄位可讀舊值但不寫入）
使用者說「繼續做」時：從上表第一個 ⬜ 開始；若其指定功能，對照階段內容執行。

---

## 階段 0：盤點與對照表（約 0.5 天）

### 要做
1. 列出 Unity 腳本職責（`Assets/MatchExpert/script/`，約 44 支 C#）
2. 盤點 Prefab／場景節點／關卡資料來源（`gameLevelData_*`、`creatLevelPos*`）
3. 產出 **模組對照表**：Unity 類別 → Cocos 模組路徑
4. 列出不做項（編輯器工具、Terrain、第三方僅 Unity 能用者）

### 產出
- `assets/resources/config/migration_map.json`
- 素材清單（PNG／音效／關卡數量）

### 驗收
- 對照表可對上主流程：Main／Game／Symbol／Save／Map／Pop／Ads

---

## 階段 1：素材移植與整理（約 1–2 天）

### 要做
1. 從 `Assets/MatchExpert` 匯出可用資源（略過 `UI/old`、純 Unity 動畫／材質／Shader、第三方套件）
2. 目錄建議：

```
assets/textures/{bg,ui,skin,fx,mockup}
assets/audio/  → 並拷貝到 assets/resources/audio/（runtime 載入）
assets/resources/{skin,bg,ui,levels,config}
assets/fonts/
tools/extract_levels.py 等
```

3. 關卡：從 `MatchExpert.unity` 抽出 → `resources/levels/{easy,normal,hard}.json`（或內嵌 `scripts/data/levels/*.ts`，避免 `resources.load` JSON 失敗白屏）
4. 對照常數寫入 `game_config.json`／`GameConfig.ts`

### 驗收
- Creator 資源管理器可見圖／音
- 至少一關 JSON／TS 可被程式讀到

### 已知坑
- **runtime 貼圖**必須在 `resources/`（或 Bundle），僅 `textures/` 不夠
- 背景用 **`bg/bg_N`（1024×2048）**，勿用 `skinBg_N`（預覽小圖會被拉歪）

---

## 階段 2：基礎模組骨架（約 1–2 天）

### 要做
建立並串場景：

| Cocos | 對應 Unity |
|-------|------------|
| `GameApp.ts` | MatchExpertMain |
| `SaveData.ts` | Easy Save 3 → `sys.localStorage` |
| `AudioManager`／`BGMManager`／`AudioKey`／`AudioBootstrap` | S5G 音效：initialize → register → play；BGM 走 BGMManager |
| `I18n.ts`／`EventBus.ts`／`UIMgr.ts` | 多語（FALLBACK + i18n.json）／事件／視圖 |
| `LevelRepository.ts` | 關卡載入 |
| `SkinCatalog.ts` | MatchExpertSkinData |
| `AdsService.ts` | stub |
| `Main.scene` | Canvas → Loading／Map／Game＋AudioHost＋GameApp |

場景階層參考：

```
Main
├── Canvas
│   ├── Camera（ORTHO，visibility 含 UI_2D）
│   ├── LoadingView
│   ├── LevelMapView
│   └── GameView + MatchGame
│       ├── BoardRoot
│       └── TableRoot
├── AudioHost
└── GameApp
```

### 驗收
- 預覽可進 Loading → Map／Game 切換
- 存檔讀寫 localStorage 正常

### 已知坑
- 動態節點必須 `Layers.Enum.UI_2D`，否則有 log 無畫面（灰／白屏）
- Camera `orthoHeight` 對齊設計解析度（本專案 720×1280 → 640）

---

## 階段 3：對局 MVP（約 2–3 天）

### 要做
1. `BoardLayout.ts`：層數／格點座標（Unity 格 × **0.75** 縮放）
2. `MatchGame.ts` + `TileSymbol.ts`：
   - 層級遮擋（上層壓住不可點）
   - 點擊進 **7 格**組牌區
   - 同花插入相鄰、**三消**
   - 計時條（180s，消 +3s）；**不做星級**
3. `ResultPop`：勝／敗、下一關／重開／復活／回地圖；過關推進進度＋固定金幣（無星）

### 驗收
- 可玩完一關並看到勝負彈窗
- 遮擋與三消行為大致對齊 Unity

### 已知坑
- `resources.load` 關卡失敗 → 改內嵌 levels TS
- 重開同一關必須 `force` 重建，勿被「同 key 已開始」擋下

---

## 階段 4：特殊牌與道具（約 2 天）

### 特殊牌（對齊 MatchExpertSymbol.typeID）

| ID | 類型 | 行為摘要 |
|----|------|----------|
| 0 | 普通 | 進組牌、三消 |
| 1 | 蓋牌 | 點擊揭開後當普通 |
| 2 | 冰 | 不可點；鄰近進組／三消／水槌破冰 |
| 3 | 火 | 不可點；水滅火 |
| 4 | 水 | 滅火＋鄰近破冰後消失 |
| 5 | 石 | 不可點；槌敲 3 次碎 |
| 6 | 槌 | 敲石＋鄰近破冰後消失 |

### 道具（itemAmount[0..2] + 第 8 格）

| Index | 功能 | 無庫存 |
|-------|------|--------|
| 0 | 撤回（pickHistory） | 金幣買 1 |
| 1 | 消一組 | 金幣買 1 |
| 2 | 重整（只打亂普通／蓋牌位置） | 金幣買 1 |
| 3 | 第 8 格（本關一次，`itemBuyCoin[3]`） | 扣幣開啟 |

UI：`ItemBar.ts` 掛在 GameView。

### 驗收
- 道具列可見；四種道具可用
- 水／火／冰／石／槌在關卡內可驗證

---

## 階段 5：地圖、暫停、結算（約 2 天）

### 要做
1. `LevelMapView`：進度選關、金幣顯示（**無皮膚入口**）
2. `PausePop`：繼續／重開／商店／回地圖、SFX／BGM
3. ~~`SkinShopPop`~~ → **刻意不做**（見「刻意不做／已移除」）；`SkinCatalog` 只載皮膚 0
4. ~~連擊（GameBatter）~~ → **刻意不做**

### 驗收
- 地圖可選關；暫停可回地圖；無換膚 UI

---

## 階段 6：UI 打磨與多語（✅ 進行中）

### 建議順序
1. ~~難度切換 Easy／Normal／Hard~~ → **已改為僅 easy**（見「刻意不做」）
2. **完整 i18n**（`I18n` + `resources/config/i18n.json`，語系碼 tw／cn／en）
3. **Toast／Tip**（聽 `GameEvents.SHOW_TIP`）
4. **關卡彈窗** LevelPop（進關前確認、開第 8 格選項）
5. 主介面套圖（地圖 `pic_map_btn_*`、HUD、彈窗 `bar_4`、道具角標等）
6. 按鈕縮放 `BtnScaleAnim`（可後置）

> 已移除：方塊升星；連擊不做；**普通／困難不做進遊戲**（資料檔保留）；**皮膚商店／換膚不做**。

### 驗收
- 地圖可選 easy 關（無難度 Tab）；切語系文案變；主畫面非純色塊
---

## 階段 7：廣告／分享／上架（✅ 骨架完成）

1. `AdsService`：Rewarded／Interstitial（stub＋`NativeBridge`）— 復活、道具、第 8 格、過關金幣、每 N 勝插頁 ✅
2. `ShareService`（Web Share／剪貼簿／原生）＋ `IapService`（購買／還原）／`ShopPop` ✅
3. 效能：`TilePool` ✅；`resources/ui|skin/auto-atlas.pac` 合圖 ✅
4. 建置：直豎屏 `device.json`、720×1280、`SafeAreaFit`、說明見 `docs/SDK_SETUP.md` ✅
5. 設定中心：`resources/config/sdk_config.json`（GameId／SKU／分享 URL）✅

真機上架：填 sdk_config → 原生注入 `globalThis.MatchExpertSdk`（範例 `tools/mock_native_sdk.js`）。

---

## 引擎替換對照（必記）

| Unity | Cocos |
|-------|-------|
| DOTween | `cc.tween` |
| Easy Save 3 | `sys.localStorage` + `SaveData` |
| UGUI Image／Button | Sprite／節點 TOUCH + Label／Graphics |
| Unity Ads | `AdsService` stub → SDK |
| Prefab Instantiate | `instantiate` 或程式動態建節點 |

---

## 開發節奏（Agent 執行規範）

1. **一次只推一個可預覽切片**（例如「只做暫停」或「只做皮膚」），做完用 Creator 預覽／MCP 驗
2. 對齊行為時優先讀：
   - `MatchExpert/Assets/MatchExpert/script/MatchExpertGame.cs`
   - `MatchExpertSymbol.cs`
   - 對應 `popWindows/MatchExpert*.cs`
3. 可用 Funplay Cocos MCP：`get_hierarchy`、`execute_javascript`、`run_script_diagnostics`、refresh asset-db
4. **不要**主動 commit／push，除非使用者要求
5. 回覆用繁中、簡短；列出本輪完成與建議下一步

## 使用者說「繼續做」時的預設下一刀

依目前進度，優先：

1. 繼續補齊剩餘介面細節（Creator 預覽對照 Unity）
2. 填入真實 Unity Ads GameId／商店 SKU，原生掛 `MatchExpertSdk`
3. 真機驗證獎勵／插頁／還原購買／分享

若使用者點名功能，以點名為準。

---

## 關鍵檔案速查

```
assets/scripts/core/     GameApp, SdkConfig, NativeBridge, AdsService, IapService, ShareService, SafeAreaFit
assets/resources/config/ sdk_config.json, i18n.json, game_config.json, migration_map.json
docs/SDK_SETUP.md        真 SDK 接線與上架檢查清單
tools/mock_native_sdk.js 瀏覽器假原生橋（除錯）
assets/scripts/audio/    AudioManager, BGMManager, AudioKey, AudioBootstrap
assets/scripts/game/     MatchGame, TileSymbol, BoardLayout, TilePool
assets/scripts/data/     LevelRepository, SkinCatalog, levels/*
assets/scripts/ui/       ResultPop, ItemBar, LevelMapView, PausePop, SkinShopPop, ShopPop, LoadingView
assets/scenes/Main.scene
```
