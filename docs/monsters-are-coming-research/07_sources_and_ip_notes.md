# 07. 来源与 IP 注意事项

## 主要来源

| 来源 | 用途 | 链接 |
| --- | --- | --- |
| Steam 商店页 | 官方名称、开发/发行、类型标签、发售日期、核心描述、系统需求 | https://store.steampowered.com/app/2934220/Monsters_are_Coming/ |
| SteamDB | App ID、价格历史、标签、发布信息交叉核验 | https://steamdb.info/app/2934220/ |
| Raw Fury 游戏页 | 发行方官方介绍、媒体资源入口 | https://rawfury.com/games/monsters-are-coming-rock-road/ |
| Xbox Wire | 2026-04-22 post-launch 更新与 DLC 线索 | https://news.xbox.com/en-us/2026/04/22/monsters-are-coming-post-launch-updates/ |
| Steam DLC 页面 | `Power Corrupts` DLC 信息 | https://store.steampowered.com/app/3813260/Monsters_are_Coming_Power_Corrupts/ |
| Steam 成就页 | 可观察目标、挑战方向参考 | https://steamcommunity.com/stats/2934220/achievements/ |
| PlayerAuctions 指南 | 收集品/内容线索，可信度低于官方资料，仅作辅助 | https://www.playerauctions.com/guide/other/single-player-games/all-collection-items-in-monsters-are-coming-rock-road/ |

## 可信度分级

- A 级：Steam、发行方、开发者、平台官方新闻。
- B 级：SteamDB、Steam 社区成就、媒体评测。
- C 级：玩家攻略、论坛、视频解说。

本文档中的“游戏身份”和“公开可确认点”主要来自 A/B 级来源；具体数值、建筑命名、角色命名和实现方案是复刻开发建议，不代表原作内部设计。

## 法务与平台风险

不要复制：

- 游戏名称、Logo、商标、宣传语。
- 原作图片、模型、音效、音乐、字体、UI 版式。
- 原作剧情文本、角色名、怪物名、建筑名、收集品名。
- 逐帧复刻的地图、关卡、数值表、成就名。
- Steam 页面截图或宣传图作为项目素材。

可以借鉴：

- 高层玩法类型组合。
- “移动基地 + 自动战斗 + 采集建造 + Roguelite”这种抽象机制。
- 公开可观察的节奏经验，但需要重新设计具体实现。

## 建议的差异化方向

- 主题从怪物奇幻改为废土商队、蒸汽堡垒、星际殖民车、海上移动岛等。
- 建造从“城镇模块”改为“车厢/甲板/核心舱”。
- 加入自己的关键机制，例如燃料路线、天气风暴、乘员士气、车厢连接、可拆卸模块。
- 视觉语言使用完全不同的色彩、比例、UI 和角色轮廓。

## 后续调研清单

- 观看 2-3 个完整实况，记录单局节奏、UI 信息密度、失败原因。
- 拆解 Steam 评论，统计玩家夸赞和抱怨关键词。
- 建立竞品表：`Vampire Survivors`、`Brotato`、`Bad North`、`The Wandering Village`、`Against the Storm`。
- 做 5 分钟纸面数值模拟，验证资源获取和敌人预算是否闭环。
