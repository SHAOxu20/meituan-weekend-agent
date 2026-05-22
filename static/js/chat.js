// ============================================
//  智能对话模块 — 美团AI出行规划
//  NLP意图识别 + 对话管理
// ============================================

const Chat = {

  // 对话历史
  history: [],

  // 当前解析状态
  state: {
    mode: null,          // "family" | "friends"
    duration: null,      // hours
    budget: null,        // max price
    participants: null,  // count
    hasKids: null,
    specialRequests: [],
    confirmed: false,
  },

  // 快捷回复建议
  quickReplies: {
    initial: ["家庭出行", "好友结伴", "半天行程", "全天行程"],
    confirm: ["没问题，就这样!", "换一个餐饮", "换一个景点", "加一个购物"],
    adjust: ["缩短行程", "增加预算", "只看高评分", "更近的地方"],
  },

  // 意图关键词词典
  intentPatterns: [
    // 家庭模式
    { regex: /(家庭|家人|孩子|娃|小孩|宝宝|亲子|老婆|老公|一家)/i, set: { mode: "family", hasKids: true } },
    // 好友模式
    { regex: /(朋友|好友|闺蜜|兄弟|哥们|聚一聚|组队|约|一起玩)/i, set: { mode: "friends" } },
    // 人数
    { regex: /(\d+)\s*(个|人|位)/, extract: (m) => ({ participants: parseInt(m[1]) }) },
    { regex: /([一二三四五六七八九十])\s*(个|人|位)/, extract: (m) => {
      const map = { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8 };
      return { participants: map[m[1]] || 2 };
    }},
    // 时长
    { regex: /(半天|一下午|3[-\s]*[4-5]\s*小?时|[三四五]\s*小?时)/i, extract: (m) => ({ duration: 5 }) },
    { regex: /(一天|全天|整天|6[-\s]*[7-8]\s*小?时|[六七八]\s*小?时)/i, extract: (m) => ({ duration: 8 }) },
    { regex: /(2[-\s]*[3-4]\s*小?时|[一二两]\s*小?时|短线)/i, extract: (m) => ({ duration: 3 }) },
    // 预算
    { regex: /(便宜|省钱|人均(\\d+以下|低于\\d+)?|预算\\d+|\\d+[块元]以内)/i,
      extract: (m) => {
        const num = m[0].match(/\d+/);
        if (num) return { budget: parseInt(num[0]) };
        return { budget: 100 };
      }},
    { regex: /(随便吃|不在意预算|高端|豪华|贵点)/i, extract: () => ({ budget: 500 }) },
    // 偏好
    { regex: /(火锅)/i, addSpecial: "想涮火锅" },
    { regex: /(烧烤|撸串)/i, addSpecial: "想吃烧烤" },
    { regex: /(清淡|减肥|轻食|沙拉)/i, addSpecial: "偏好清淡饮食" },
    { regex: /(西餐|牛排|披萨|意面)/i, addSpecial: "想吃西餐" },
    { regex: /(日料|寿司|刺身)/i, addSpecial: "想吃日料" },
    { regex: /(户外|公园|自然|散步|踏青)/i, addSpecial: "喜欢户外活动" },
    { regex: /(展览|博物馆|美术馆|艺术)/i, addSpecial: "想看展览" },
    { regex: /(购物|逛街|买)/i, addSpecial: "想购物" },
    { regex: /(电影|看电影)/i, addSpecial: "想看电影" },
    { regex: /(密室|剧本杀|桌游)/i, addSpecial: "想玩密室/桌游" },
    { regex: /(唱歌|KTV)/i, addSpecial: "想去KTV" },
    { regex: /(泡汤|温泉|汗蒸|洗浴)/i, addSpecial: "想泡汤放松" },
    { regex: /(拍照|打卡|网红)/i, addSpecial: "想去打卡拍照" },
  ],

  // 解析用户输入
  parseIntent(input) {
    const result = { ...this.state };

    for (const pattern of this.intentPatterns) {
      const match = input.match(pattern.regex);
      if (match) {
        if (pattern.set) Object.assign(result, pattern.set);
        if (pattern.extract) {
          const extracted = pattern.extract(match);
          if (extracted) Object.assign(result, extracted);
        }
        if (pattern.addSpecial) {
          if (!result.specialRequests) result.specialRequests = [];
          if (!result.specialRequests.includes(pattern.addSpecial)) {
            result.specialRequests.push(pattern.addSpecial);
          }
        }
      }
    }

    // 默认值
    if (!result.mode) result.mode = "family";
    if (!result.duration) result.duration = 5;
    if (!result.participants) result.participants = result.mode === "family" ? 3 : 4;
    if (!result.budget) result.budget = result.mode === "family" ? 200 : 150;

    this.state = result;
    return result;
  },

  // 生成对话回复
  generateResponse(input, parsedState) {
    const responses = [];
    const { mode, duration, participants, budget, hasKids, specialRequests } = parsedState;

    // 开场确认
    const modeLabel = mode === "family" ? "👨‍👩‍👧 家庭出行" : "🎉 好友结伴";
    responses.push(`好的！我理解你的需求：`);

    let details = [];
    details.push(`出行模式：**${modeLabel}**`);
    if (participants) details.push(`人数：${participants}人`);
    if (hasKids) details.push("有小朋友同行 👶");
    if (duration) {
      const label = duration <= 3 ? "短线游玩" : duration <= 5 ? "半天行程" : "全天行程";
      details.push(`时长：约${duration}小时（${label}）`);
    }
    if (budget) details.push(`预算：人均${budget}元以内`);

    responses.push(details.join(" · "));

    if (specialRequests && specialRequests.length > 0) {
      responses.push(`特别偏好：${specialRequests.join("、")}`);
    }

    responses.push(`\n正在为你规划最优路线，请稍候...`);

    return responses.join("\n");
  },

  // 生成调整确认回复
  generateAdjustResponse(request) {
    if (request.includes("换") || request.includes("换一个") || request.includes("换换")) {
      const categories = ["餐饮", "景点", "亲子", "休闲娱乐", "购物"];
      for (const cat of categories) {
        if (request.includes(cat)) {
          return `好的，帮你换一个${cat}选择...`;
        }
      }
      return "好的，帮你调整方案。具体想换哪个环节？";
    }
    if (request.includes("加") || request.includes("增加")) {
      return "好的，帮你增加新的去处，稍等...";
    }
    if (request.includes("减") || request.includes("去掉") || request.includes("取消")) {
      return "好的，帮你精简行程，稍等...";
    }
    if (request.includes("预算") || request.includes("便宜")) {
      return "好的，帮你按新预算调整方案...";
    }
    return "收到，帮你优化路线方案...";
  },

  // 重置状态
  reset() {
    this.state = {
      mode: null, duration: null, budget: null,
      participants: null, hasKids: null,
      specialRequests: [], confirmed: false,
    };
    this.history = [];
  },
};
