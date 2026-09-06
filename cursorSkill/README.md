# MatchExpert2 Cursor Skills

專案內 Agent Skills（結構參考 `Games-S5G-H5-99916/claude`）。

## 目錄

```
cursorSkill/                 ← 與 assets/ 同層
└── skills/
    └── gameTemplate/
        └── SKILL.md         ← Unity→Cocos 分階段移植模板
```

## 使用方式

在 Cursor 對話中可：

- 直接說「依 gameTemplate skill 繼續做」
- 或 `@cursorSkill/skills/gameTemplate/SKILL.md`

Agent 應讀取該 `SKILL.md`，依階段狀態往下開發，不要重做已完成階段。

## 新增 Skill

在 `skills/<skill-name>/` 新建資料夾，放入 `SKILL.md`（YAML frontmatter：`name` + `description`）。
