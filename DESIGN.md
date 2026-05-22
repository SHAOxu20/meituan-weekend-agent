# 美团AI · 周末出行规划 Agent — 设计文档

## 概述

面向美团生态的AI智能体，接收自然语言需求，自动完成定位→POI检索→路线规划→美团下单的全流程。采用 Tool-based Agent 架构，每个功能模块封装为独立Tool，支持 Mock API 回退。

## Tool 调用链路

```
用户输入 "周六下午带娃出去玩半天"
    │
    ├─ Tool: Chat.parseIntent()
    │    解析: mode=family, duration=5h, hasKids=true
    │    Mock: 正则+NLP关键词词典 (chat.js:36)
    │
    ├─ Tool: AmapService.getCurrentPosition()
    │    获取GPS坐标 + 逆地理编码地址
    │    降级链: 高德GPS → 浏览器GPS → IP定位 → 默认
    │    Mock: 失败时回退 DEFAULT_LOCATION (data.js:263)
    │
    ├─ Tool: AmapService.searchNearby(lat, lng, categories, 5km)
    │    搜索周边餐饮/景点/亲子/购物/休闲5大品类
    │    真实: 高德 PlaceSearch API (amap.js:89)
    │    Mock: getNearbyPOIs() 动态散点POI (data.js:231)
    │    触发: POI<5 或 Amap SDK 未加载
    │
    ├─ Tool: Planner.plan(location, preferences, mode, pois)
    │    双模式路线规划引擎 (planner.js)
    │    ┌─ _calcModeScore()     模式偏好评分
    │    ├─ _buildRoute()        贪婪最近邻构造
    │    └─ _optimizeTimeline()  时间线标注
    │
    └─ Tool: App._showBooking(pois)
          模拟美团下单 → 展示预约状态 → Deep Link 跳转
          Mock: 本地生成订单确认UI (app.js:510)
```

## Planning 策略

**输入**: 用户自然语言 → 解析为 (模式, 人数, 时长, 预算, 偏好)

**Step 1 — POI 检索**: 以用户坐标为中心，5km 半径搜索周边 POI。高德真实数据优先，不足 5 条自动回退模拟数据（基于用户坐标动态散点生成，保证位置感知）。

**Step 2 — 模式加权**: 对每条 POI 计算 `modeScore`：
- 家庭模式: `familyFriendly × 2 + 亲子品类 +10 - KTV/密室 -10`
- 好友模式: `(5 - familyFriendly) × 1.5 + 密室/KTV/轰趴 +10`

**Step 3 — 贪婪路线构建**: 从起点出发，每轮选最优下一点（`modeScore × 0.5 + rating × 0.2 - distance × 0.1 - price × 0.2`），最多 5-6 站，实时检查剩余时间。

**Step 4 — 时间线优化**: 标注到达/离开时间，15 分钟站间缓冲。家庭模式 9:30 出发，好友模式 13:00 出发。

**Step 5 — 输出**: 行程清单 + 美团 Deep Link + 一键预订

**调整方案**: 检测"换/加/删/高评分"关键词 → `Planner.replaceStop/addStop/removeLastStop/filterByHighRating` → 重新渲染路线

## 核心 Tool 模块

| Tool | 文件 | Mock 策略 |
|------|------|-----------|
| `AmapService.getCurrentPosition()` | amap.js | GPS 失败 → 浏览器 GPS → IP 定位 → 默认上海 |
| `AmapService.searchNearby()` | amap.js | 高德 API → POI<5 回退 getNearbyPOIs() |
| `AmapService.reverseGeocode()` | amap.js | 高德逆地理 → 静默失败，保留坐标显示 |
| `AmapService.ipLocation()` | amap.js | 高德 IP API → ipapi.co → ip-api.com |
| `getPOIDatabase(lat, lng)` | data.js | 30+ POI 模板 × 确定性散点算法 |
| `Planner.plan()` | planner.js | 纯算法，无外部依赖 |
| `Chat.parseIntent()` | chat.js | 正则词典解析，默认值兜底 |
| `App._showBooking()` | app.js | 本地模拟订单确认，meituan:// scheme |

## 异常处理机制

| 异常场景 | 降级策略 | 用户感知 |
|----------|----------|----------|
| 高德 SDK 加载失败 | `AmapService.isAvailable()=false` → 全量使用模拟数据 | 正常规划，无感知 |
| GPS 定位超时/拒绝 | 四级降级链，最终默认上海 | Toast 提示，继续可用 |
| 高德 POI 搜索返回<5条 | 自动切换 `getNearbyPOIs()` 模拟数据 | Toast 显示数据来源 |
| 高德 POI 无评分字段 | 确定性 hash 生成 3.5-5.0 评分 | 无 NaN，正常显示 |
| 用户输入无法解析 | 默认 family 模式，5小时，3人 | 正常生成方案 |
| 美团 APP 未安装 | `meituan://` 1.5s 超时 → 网页版 | 自动降级，无报错 |
| 调整请求匹配失败 | 回退为新规划流程 | 重新生成方案 |
| clipboar/write 无权限 | 静默失败 | Toast 提示不可用 |
| 行程站点全部需预订 | `needReserve=true` 全部展示 | 一键预订全部 |

## 技术栈

原生 HTML/CSS/JS，零构建步骤。高德 JS API v2.0 提供定位+POI+路线。CSS Variables 美团品牌色 #FFD100。480px 移动端适配。
