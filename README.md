# 美团AI · 周末出行规划 Agent

> 面向美团生态的AI智能体 — 接收自然语言，自动完成定位→POI检索→双模式路线规划→美团下单

## 快速开始

直接用浏览器打开 `index.html`，或本地服务器：

```bash
npx serve .          # Node.js
python -m http.server 8080   # Python
```

手机端访问建议用 HTTPS（定位 API 要求），可用 GitHub Pages 部署或 `npx serve` + ngrok。

## 在线演示

https://shaoxu20.github.io/meituan-weekend-agent/

## 功能

- **智能定位**: 高德 GPS → 浏览器 GPS → IP 定位 → 默认，四级降级
- **真实 POI**: 高德地图实时搜索周边餐饮/景点/亲子/购物/休闲，自动回退模拟数据
- **双模式规划**: 家庭出行（亲子友好·节奏舒缓） / 好友结伴（打卡聚会·紧凑高效）
- **路线优化**: 贪心最近邻 + 多因子评分，标注时间线 + 站间距离
- **方案调整**: 支持"换一个餐饮""加一个景点""缩短行程""只看高评分"
- **美团联动**: `meituan://` Deep Link 唤起 APP，网页版自动降级
- **一键预订**: 模拟下单流程，展示预约确认状态

## 文件结构

| 文件 | 职责 |
|------|------|
| `index.html` | 移动端 SPA 入口 |
| `static/css/style.css` | 美团品牌色系 + 移动端适配 |
| `static/js/data.js` | POI 模拟数据库 + 位置感知散点算法 |
| `static/js/amap.js` | 高德 API 封装 + Mock 回退 |
| `static/js/planner.js` | 双模式路线规划引擎 |
| `static/js/chat.js` | NLP 意图识别 + 对话管理 |
| `static/js/app.js` | 主控逻辑 + UI 编排 |
| `DESIGN.md` | 设计文档（Tool 链路 + Planning 策略 + 异常处理） |
