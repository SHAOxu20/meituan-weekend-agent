# 美团AI · 周末出行规划 Agent

> 面向美团生态的AI智能体，助力用户高效完成周末出行规划。
> 适配手机端，从定位→POI检索→路线规划→跳转美团下单全流程。

## 快速开始

直接用浏览器打开 `index.html` 即可运行（推荐Chrome手机模式）。

```bash
# 方式1：直接打开
start index.html

# 方式2：本地服务器（推荐，定位功能需要HTTPS或localhost）
npx serve .        # 或 python -m http.server 8080
```

## 功能演示

1. **定位获取**: 自动获取GPS定位，或手动输入/选择地址
2. **智能对话**: 输入 "周六下午带老婆孩子出去玩半天" 自动理解需求
3. **双模式规划**: 家庭出行/好友结伴两种路线模式
4. **行程展示**: 时间线展示各站点顺序、距离、停留时长
5. **美团跳转**: 一键预约/下单，支持唤起美团APP

## 文件说明

| 文件 | 说明 |
|------|------|
| `index.html` | 应用入口 |
| `static/css/style.css` | 样式表 |
| `static/js/data.js` | POI模拟数据 |
| `static/js/app.js` | 主应用逻辑 |
| `static/js/planner.js` | 路线规划引擎 |
| `static/js/chat.js` | 对话交互模块 |
| `DESIGN.md` | 设计文档 |
