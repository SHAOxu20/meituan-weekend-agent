// ============================================
//  主应用逻辑 — 美团AI出行规划
//  定位、UI控制、流程编排
// ============================================

const App = {
  userLocation: null,

  // 获取当前用户位置下的POI数据库
  _getPoiDb() {
    const loc = this.userLocation || DEFAULT_LOCATION;
    return getPOIDatabase(loc.lat, loc.lng);
  },
  currentPlan: null,
  currentTab: "home",

  // ==================== 初始化 ====================
  init() {
    // 隐藏启动屏
    setTimeout(() => {
      document.getElementById("splash").classList.add("hide");
    }, 1500);

    // 获取定位（优先 GPS → IP 定位 → 默认）
    this.requestLocation();
    AmapService.init().catch(() => {});

    // 绑定事件
    this._bindEvents();

    // 初始化快捷操作
    this._updateQuickActions("initial");
  },

  _bindEvents() {
    // 监听页面可见性
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) this.requestLocation();
    });
  },

  // ==================== 定位（四级降级：高德GPS → 浏览器GPS → 高德IP → 默认） ====================
  requestLocation() {
    const tryAmapGPS = () => {
      return AmapService.getCurrentPosition().catch(() => Promise.reject("amap gps failed"));
    };

    const tryBrowserGPS = () => {
      if (!navigator.geolocation) return Promise.reject("not supported");
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              address: `GPS (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`,
              name: "浏览器定位",
              source: "browser_gps",
            });
          },
          (err) => reject(err.message),
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 300000 }
        );
      });
    };

    const tryAmapIP = () => {
      return AmapService.ipLocation().catch(() => {
        // 回退到免费 IP 服务
        return fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(3000) })
          .then(r => r.json())
          .then(data => {
            if (data.latitude && data.longitude) {
              return {
                lat: data.latitude, lng: data.longitude,
                address: [data.city, data.region, data.country_name].filter(Boolean).join(", "),
                source: "ipapi",
              };
            }
            throw new Error("ipapi failed");
          });
      });
    };

    const fallback = () => {
      return { ...DEFAULT_LOCATION, source: "default" };
    };

    tryAmapGPS()
      .then(loc => { this._setLocation(loc); AmapService.reverseGeocode(loc.lat, loc.lng).then(addr => {
        this.userLocation.address = addr.address;
        this.userLocation.city = addr.city;
        this._updateLocationDisplay();
      }).catch(() => {}); })
      .catch(() => {
        tryBrowserGPS()
          .then(loc => this._setLocation(loc))
          .catch(() => {
            tryAmapIP()
              .then(loc => this._setLocation(loc))
              .catch(() => {
                this._setLocation(fallback());
                App.toast("定位失败，使用默认位置");
              });
          });
      });
  },
  _setLocation(loc) {
    this.userLocation = loc;
    this._updateLocationDisplay();
  },

  _updateLocationDisplay() {
    const el = document.getElementById("locationText");
    if (el && this.userLocation) {
      const addr = this.userLocation.address || this.userLocation.name;
      el.textContent = addr.length > 12 ? addr.slice(0, 12) + "..." : addr;
    }
  },

  // ==================== Tab 切换 ====================
  switchTab(tab) {
    this.currentTab = tab;

    // 更新 tab 样式
    document.querySelectorAll(".tab-item").forEach(el => {
      el.classList.toggle("active", el.dataset.tab === tab);
    });

    // 切换屏幕
    document.querySelectorAll(".screen").forEach(el => el.classList.remove("active"));
    const screenMap = { home: "homeScreen", chat: "chatScreen", route: "routeScreen" };
    const screenId = screenMap[tab];
    if (screenId) {
      const screen = document.getElementById(screenId);
      if (screen) screen.classList.add("active");
    }

    // 如果切换到行程tab但没有规划，回到首页
    if (tab === "route" && !this.currentPlan) {
      this.switchTab("home");
      this.toast("请先生成行程方案");
    }
  },

  // ==================== 首页消息 ====================
  sendHomeMessage() {
    const input = document.getElementById("homeChatInput");
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    this.switchTab("chat");
    this._addChatBubble("user", text);
    this._processUserMessage(text);
  },

  // ==================== 对话消息 ====================
  sendChatMessage() {
    const input = document.getElementById("chatInput");
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    this._addChatBubble("user", text);
    this._processUserMessage(text);
  },

  _processUserMessage(text) {
    this._showTyping();

    // 判断是否为调整请求（有现有方案 + 包含调整关键词）
    const isAdjust = this.currentPlan && /换|改|调整|替换|换一[个下]|加一[个下]|增加|去掉|删除|缩短|只看|高分|高评分|便宜/.test(text);

    setTimeout(() => {
      this._hideTyping();

      if (isAdjust) {
        this._handleAdjustment(text);
      } else {
        // 新规划流程
        const parsed = Chat.parseIntent(text);
        const response = Chat.generateResponse(text, parsed);
        this._addChatBubble("agent", response);
        this._updateQuickActions("confirm");
        setTimeout(() => this._generatePlan(parsed), 800);
      }
    }, 800);
  },

  _handleAdjustment(text) {
    if (!this.currentPlan) return;

    let newPlan = null;
    let response = "";

    // 匹配调整类型
    const catMap = { "餐饮": "餐饮", "吃饭": "餐饮", "餐厅": "餐饮",
                     "景点": "景点", "公园": "景点",
                     "亲子": "亲子", "儿童": "亲子",
                     "购物": "购物", "逛街": "购物",
                     "休闲": "休闲娱乐", "娱乐": "休闲娱乐", "玩": "休闲娱乐" };

    // "换一个XX"
    const replaceMatch = text.match(/换一?[个下]?(\S{1,3})/);
    if (replaceMatch) {
      const cat = catMap[replaceMatch[1]] || replaceMatch[1];
      newPlan = Planner.replaceStop(this.currentPlan, cat);
      response = `好的，帮你换了${cat || "一个"}选择 ✅`;
    }

    // "加一个XX"
    if (!newPlan) {
      const addMatch = text.match(/加一?[个下]?(\S{1,3})/);
      if (addMatch) {
        const cat = catMap[addMatch[1]] || addMatch[1];
        newPlan = Planner.addStop(this.currentPlan, cat);
        response = `好的，帮你增加了${cat || "一个新去处"} ✅`;
      }
    }

    // "缩短"/"去掉"
    if (!newPlan && /缩短|去掉|删除|减[少去]|太[多长]/.test(text)) {
      newPlan = Planner.removeLastStop(this.currentPlan);
      response = "好的，帮你精简了行程 ✅";
    }

    // "高评分"/"高分"
    if (!newPlan && /高分|高评分/.test(text)) {
      newPlan = Planner.filterByHighRating(this.currentPlan);
      response = "好的，只保留评分 4.5 以上的点位 ✅";
    }

    // 兜底：当作新规划
    if (!newPlan) {
      const parsed = Chat.parseIntent(text);
      response = Chat.generateResponse(text, parsed);
      this._addChatBubble("agent", response);
      setTimeout(() => this._generatePlan(parsed), 800);
      return;
    }

    this.currentPlan = newPlan;
    this._addChatBubble("agent", response + "\n\n行程已更新，点击下方 **「行程」** 标签查看 →");
    this._renderRoute();
    this._updateQuickActions("adjust");
    this.switchTab("route");
    this.toast("行程已更新");
  },

  _generatePlan(parsedState) {
    this._showLoading("正在通过高德搜索周边...");

    const loc = this.userLocation || DEFAULT_LOCATION;

    // 优先使用高德真实POI搜索
    const useAmap = AmapService.isAvailable();

    const doPlan = (pois) => {
      const preferences = {
        budget: parsedState.budget,
        durationHours: parsedState.duration,
        participantCount: parsedState.participants,
        hasKids: parsedState.hasKids,
        poiCategories: null,
        specialRequests: parsedState.specialRequests,
      };

      this.currentPlan = Planner.plan(loc, preferences, parsedState.mode, pois);
      this._hideLoading();

      const summary = this._buildPlanSummary();
      this._addChatBubble("agent", summary);
      this._renderRoute();
      this.switchTab("route");

      const source = pois ? "高德实时POI" : "模拟数据";
      this.toast(`✨ 行程规划完成 (${source})`);
    };

    if (useAmap) {
      AmapService.searchNearby(loc.lat, loc.lng, [], 5000)
        .then(pois => {
          if (pois.length >= 5) {
            doPlan(pois);
          } else {
            // POI太少，回退模拟数据
            console.log("[App] 高德POI不足(" + pois.length + ")，使用模拟数据");
            doPlan(null);
          }
        })
        .catch(() => {
          console.log("[App] 高德搜索失败，使用模拟数据");
          doPlan(null);
        });
    } else {
      // 模拟延迟后使用模拟数据
      setTimeout(() => doPlan(null), 800);
    }
  },

  _buildPlanSummary() {
    const plan = this.currentPlan;
    if (!plan) return "";

    let html = `<b>📋 行程方案已生成：</b>\n`;
    html += `<div style="margin-top:8px;">`;
    for (const stop of plan.stops) {
      html += `<div class="chat-poi-card" onclick="App._showPoiDetail('${stop.id}')">`;
      html += `<div class="poi-img">${stop.emoji}</div>`;
      html += `<div class="poi-info">`;
      html += `<div class="name">${stop.order}. ${stop.name}</div>`;
      html += `<div class="meta">⭐${stop.rating} · ${stop.priceLabel} · ${stop.arrivalTime}-${stop.departureTime}</div>`;
      html += `</div></div>`;
    }
    html += `</div>`;
    html += `\n点击下方<b>「行程」</b>查看完整路线 →`;
    return html;
  },

  // ==================== 快速启动 ====================
  quickStart(mode) {
    this.switchTab("chat");
    const label = mode === "family" ? "家庭出行" : "好友结伴";
    const text = mode === "family"
      ? `周末想带孩子出去玩半天，家庭出行`
      : `周末约朋友一起出去玩半天，4个人`;

    this._addChatBubble("user", text);

    // 预设状态
    const preset = mode === "family"
      ? { mode: "family", duration: 5, participants: 3, budget: 200, hasKids: true, specialRequests: ["喜欢户外活动"] }
      : { mode: "friends", duration: 5, participants: 4, budget: 150, hasKids: false, specialRequests: ["想去打卡拍照"] };

    this._showTyping();
    setTimeout(() => {
      this._hideTyping();
      Chat.state = { ...preset };
      const response = Chat.generateResponse(text, Chat.state);
      this._addChatBubble("agent", response);
      this._updateQuickActions("confirm");
      setTimeout(() => this._generatePlan(preset), 800);
    }, 1000);
  },

  // ==================== 路线渲染 ====================
  _renderRoute() {
    const plan = this.currentPlan;
    if (!plan) return;

    // Header
    const badge = document.getElementById("routeBadge");
    badge.textContent = plan.mode === "family" ? "👨‍👩‍👧 家庭出行" : "🎉 好友结伴";
    badge.className = "route-badge " + plan.mode;

    const summary = document.getElementById("routeSummary");
    const hours = Math.round(plan.totalDuration / 60);
    summary.textContent = `共${plan.stops.length}站 · 约${hours}小时`;

    // Timeline
    const timeline = document.getElementById("routeTimeline");
    let html = "";

    for (let i = 0; i < plan.stops.length; i++) {
      const stop = plan.stops[i];

      // 中转信息
      if (stop.transit && stop.transit.distance > 0) {
        html += `<div class="stop-transit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
          ${stop.transit.emoji} ${stop.transit.label} ${stop.transit.distance}km · ${stop.transit.minutes}分钟
        </div>`;
      }

      const typeClass = stop.category === "餐饮" ? "eat" : stop.category === "亲子" ? "play" : stop.category === "购物" ? "shop" : stop.category === "休闲娱乐" ? "play" : "rest";

      html += `<div class="timeline-stop">
        <div class="timeline-stop-marker">${stop.order}</div>
        <div class="timeline-stop-card" onclick="App._showPoiDetail('${stop.id}')">
          <span class="stop-type-badge ${typeClass}">${stop.subcategory || stop.category}</span>
          <div class="stop-name">${stop.emoji} ${stop.name}</div>
          <div class="stop-meta">
            <span>⭐ ${stop.rating}</span>
            <span>💰 ${stop.priceLabel}</span>
            <span>⏱ ${stop.arrivalTime}-${stop.departureTime}</span>
          </div>
          <div class="stop-actions">
            <button class="stop-btn secondary" onclick="event.stopPropagation(); App._viewOnMeituan('${stop.id}')">美团查看</button>
            <button class="stop-btn primary" onclick="event.stopPropagation(); App._bookSingle('${stop.id}')">立即预约</button>
          </div>
        </div>
      </div>`;
    }

    timeline.innerHTML = html || '<div style="padding:40px;text-align:center;color:#888;">暂无行程数据</div>';
  },

  // ==================== POI 详情弹窗 ====================
  _showPoiDetail(poiId) {
    const poi = this._getPoiDb().find(p => p.id === poiId);
    if (!poi) return;

    const content = document.getElementById("poiModalContent");
    content.innerHTML = `
      <div class="poi-detail">
        <div class="poi-detail-header">
          <div class="poi-detail-img">${poi.emoji}</div>
          <div class="poi-detail-info">
            <div class="poi-detail-name">${poi.name}</div>
            <div class="poi-detail-category">${poi.category} · ${poi.subcategory || ""}</div>
            <div class="poi-detail-rating">
              <span class="stars">★★★★★</span> <span>${poi.rating}</span>
            </div>
          </div>
        </div>
        <div class="poi-detail-meta">
          <div class="poi-detail-meta-item">
            <div class="label">人均消费</div>
            <div class="value">${poi.priceLabel}</div>
          </div>
          <div class="poi-detail-meta-item">
            <div class="label">营业时间</div>
            <div class="value" style="font-size:13px;">${poi.hours}</div>
          </div>
          <div class="poi-detail-meta-item">
            <div class="label">标签</div>
            <div class="value" style="font-size:13px;">${poi.tags.join(" · ")}</div>
          </div>
          <div class="poi-detail-meta-item">
            <div class="label">亲子友好</div>
            <div class="value">${"⭐".repeat(poi.familyFriendly)}</div>
          </div>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-secondary" onclick="App._viewOnMeituan('${poi.id}')" style="flex:1;">
            美团查看详情
          </button>
          <button class="btn btn-primary" onclick="App._bookSingle('${poi.id}')" style="flex:1;">
            立即预约
          </button>
        </div>
      </div>
    `;

    document.getElementById("poiModal").classList.add("active");
  },

  closePoiModal() {
    document.getElementById("poiModal").classList.remove("active");
  },

  // ==================== 美团跳转 ====================
  _viewOnMeituan(poiId) {
    const poi = this._getPoiDb().find(p => p.id === poiId);
    if (!poi) return;

    const scheme = poi.meituanScheme || `meituan://shop/${poiId}`;
    const fallback = poi.meituanUrl || `https://i.meituan.com/shop/${poiId}`;

    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = scheme;
    document.body.appendChild(iframe);

    setTimeout(() => {
      document.body.removeChild(iframe);
      window.open(fallback, "_blank");
      App.toast(`正在跳转到美团: ${poi.name}`);
    }, 1500);
  },

  _bookSingle(poiId) {
    const poi = this._getPoiDb().find(p => p.id === poiId);
    if (!poi) return;

    this._showBooking([poi]);
  },

  // ==================== 一键预订全部 ====================
  bookAll() {
    if (!this.currentPlan || !this.currentPlan.stops) {
      this.toast("暂无行程数据");
      return;
    }

    const pois = this.currentPlan.stops
      .filter(s => s.needReserve)
      .map(s => this._getPoiDb().find(p => p.id === s.id))
      .filter(Boolean);

    if (pois.length === 0) {
      this.toast("当前行程无需预订");
      return;
    }

    this._showBooking(pois);
  },

  _showBooking(pois) {
    const content = document.getElementById("bookingModalContent");
    let itemsHtml = pois.map(p => `
      <div class="booking-item">
        <div>
          <div class="booking-item-name">${p.emoji} ${p.name}</div>
          <div style="font-size:12px;color:#888;">${p.priceLabel}</div>
        </div>
        <div class="booking-item-status confirmed">✓ 已预约</div>
      </div>
    `).join("");

    content.innerHTML = `
      <div class="booking-detail">
        <div class="booking-header">
          <div class="booking-success-icon">✅</div>
          <div class="booking-title">预约成功！</div>
          <div class="booking-subtitle">已为你完成以下场所的预约/下单</div>
        </div>
        <div class="booking-items">${itemsHtml}</div>
        <div style="margin-top:16px;padding:12px;background:#FFF9E6;border-radius:8px;font-size:13px;color:#996A00;">
          💡 提示：实际使用请通过<b>美团APP</b>完成支付确认。点击下方按钮可跳转至美团确认订单。
        </div>
        <button class="btn btn-primary" style="width:100%;margin-top:16px;" onclick="App._openMeituanApp()">
          打开美团APP确认订单
        </button>
        <button class="btn btn-secondary" style="width:100%;margin-top:8px;" onclick="App.closeBookingModal()">
          关闭
        </button>
      </div>
    `;

    document.getElementById("bookingModal").classList.add("active");
  },

  closeBookingModal() {
    document.getElementById("bookingModal").classList.remove("active");
  },

  _openMeituanApp() {
    const scheme = "meituan://home";
    const fallback = "https://i.meituan.com/";

    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = scheme;
    document.body.appendChild(iframe);

    setTimeout(() => {
      document.body.removeChild(iframe);
      window.open(fallback, "_blank");
      App.toast("正在跳转美团APP...");
    }, 1500);
  },

  // ==================== 调整方案 ====================
  adjustPlan() {
    this.switchTab("chat");
    this._addChatBubble("agent", "想怎么调整行程呢？你可以说：\n• 换一个餐饮\n• 加一个购物\n• 缩短行程\n• 只看高评分的");
    this._updateQuickActions("adjust");
    document.getElementById("chatInput").focus();
  },

  // ==================== 分享 ====================
  sharePlan() {
    if (!this.currentPlan) return;

    const text = Planner.generateShareText(this.currentPlan);

    if (navigator.share) {
      navigator.share({ title: "周末出行规划", text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => {
        App.toast("行程已复制到剪贴板");
      }).catch(() => {
        App.toast("分享功能暂不可用");
      });
    }
  },

  // ==================== 定位选择器 ====================
  showLocationPicker() {
    const content = document.getElementById("locationModalContent");
    content.innerHTML = `
      <div class="location-picker">
        <div class="location-current" onclick="App._useCurrentLocation()">
          <div class="loc-icon">📍</div>
          <div class="loc-info">
            <div class="loc-label">使用当前定位</div>
            <div class="loc-addr">${this.userLocation?.address || "获取定位中..."}</div>
          </div>
        </div>
        <div style="font-size:14px;font-weight:600;margin-bottom:8px;">或手动输入地址：</div>
        <div class="location-search">
          <input type="text" id="manualAddress" placeholder="输入地址，如：上海市黄浦区">
          <button onclick="App._setManualAddress()">确定</button>
        </div>
        <div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:8px;">
          ${["城市中心", "商业步行街", "滨水街区", "CBD商圈", "大学城周边"].map(addr =>
            `<div style="padding:8px 14px;background:#f5f5f5;border-radius:16px;font-size:13px;cursor:pointer;" onclick="App._quickAddress('${addr}')">${addr}</div>`
          ).join("")}
        </div>
      </div>
    `;
    document.getElementById("locationModal").classList.add("active");
  },

  closeLocationModal() {
    document.getElementById("locationModal").classList.remove("active");
  },

  _useCurrentLocation() {
    this.requestLocation();
    AmapService.init().catch(() => {});
    this.closeLocationModal();
    this.toast("正在重新定位...");
  },

  _setManualAddress() {
    const input = document.getElementById("manualAddress");
    const addr = input?.value?.trim();
    if (!addr) return;

    const coordMap = {
      "市中心": { lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng },
      "商业街": { lat: DEFAULT_LOCATION.lat + 0.01, lng: DEFAULT_LOCATION.lng + 0.01 },
      "滨水区": { lat: DEFAULT_LOCATION.lat - 0.008, lng: DEFAULT_LOCATION.lng + 0.012 },
      "CBD": { lat: DEFAULT_LOCATION.lat - 0.012, lng: DEFAULT_LOCATION.lng - 0.005 },
      "大学城": { lat: DEFAULT_LOCATION.lat + 0.015, lng: DEFAULT_LOCATION.lng - 0.01 },
    };

    let coord = null;
    for (const [key, val] of Object.entries(coordMap)) {
      if (addr.includes(key)) { coord = val; break; }
    }

    if (coord) {
      this.userLocation = { ...coord, address: addr, name: addr };
    } else {
      const offset = (addr.length % 10) * 0.005;
      this.userLocation = {
        lat: DEFAULT_LOCATION.lat + offset,
        lng: DEFAULT_LOCATION.lng + offset,
        address: addr,
        name: addr,
      };
    }

    this._updateLocationDisplay();
    this.closeLocationModal();
    this.toast(`定位已更新: ${addr}`);
  },

  _quickAddress(addr) {
    document.getElementById("manualAddress").value = addr;
    this._setManualAddress();
  },

  // ==================== 导航 ====================
  goHome() {
    this.switchTab("home");
  },

  // ==================== 工具方法 ====================
  _addChatBubble(role, text) {
    const container = document.getElementById("chatMessages");
    const div = document.createElement("div");
    div.className = `chat-bubble ${role}`;

    if (role === "agent" && text.includes("<")) {
      div.innerHTML = text.replace(/\n/g, "<br>");
    } else {
      div.textContent = text;
    }

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  },

  _showTyping() {
    const container = document.getElementById("chatMessages");
    const div = document.createElement("div");
    div.className = "chat-bubble typing";
    div.id = "typingBubble";
    div.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  },

  _hideTyping() {
    const el = document.getElementById("typingBubble");
    if (el) el.remove();
  },

  _updateQuickActions(type) {
    const container = document.getElementById("quickActions");
    const actions = Chat.quickReplies[type] || [];
    container.innerHTML = actions.map(a =>
      `<div class="quick-action-chip" onclick="App._quickReply('${a}')">${a}</div>`
    ).join("");
  },

  _quickReply(text) {
    document.getElementById("chatInput").value = text;
    this.sendChatMessage();
  },

  _showLoading(text) {
    document.getElementById("loadingText").textContent = text || "加载中...";
    document.getElementById("loadingOverlay").classList.add("active");
  },

  _hideLoading() {
    document.getElementById("loadingOverlay").classList.remove("active");
  },

  toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => el.classList.remove("show"), 2000);
  },
};

// 启动应用
document.addEventListener("DOMContentLoaded", () => App.init());







