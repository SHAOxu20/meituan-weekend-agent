// ============================================
//  路线规划引擎 — 美团AI出行规划
//  支持家庭模式 & 好友模式，贪心+规则混合策略
// ============================================

const Planner = {

  // 主规划函数
  plan(userLocation, preferences, mode) {
    const {
      budget,
      durationHours = 5,
      poiCategories,
      participantCount = 2,
      hasKids = mode === "family",
    } = preferences;

    // Step 1: 获取周边POI
    let pois = getNearbyPOIs(userLocation.lat, userLocation.lng, 8);

    // Step 2: 按类别筛选(如果指定)
    if (poiCategories && poiCategories.length > 0) {
      pois = filterPOIsByCategory(pois, poiCategories);
    }

    // Step 3: 模式评分加权
    pois = pois.map(poi => ({
      ...poi,
      modeScore: this._calcModeScore(poi, mode, hasKids),
    }));

    // Step 4: 综合排序 → 选出候选池(TOP N)
    pois.sort((a, b) => {
      // 综合评分: modeScore*0.5 + rating*0.2 - distance*0.1 - price*0.2
      const scoreA = a.modeScore * 0.5 + (a.rating / 5) * 0.2 - (a.distance / 8) * 0.1 - (a.price / 500) * 0.2;
      const scoreB = b.modeScore * 0.5 + (b.rating / 5) * 0.2 - (b.distance / 8) * 0.1 - (b.price / 500) * 0.2;
      return scoreB - scoreA;
    });

    // Step 5: 贪婪建路 — 选最多6个点位
    const route = this._buildRoute(pois.slice(0, 30), userLocation, durationHours, mode);

    // Step 6: 计算总时间 & 优化
    const optimized = this._optimizeTimeline(route, userLocation, mode);

    return {
      mode,
      userLocation,
      stops: optimized,
      totalDuration: optimized.reduce((sum, s) => sum + s.stayMinutes + (s.transit?.minutes || 0), 0),
      totalDistance: optimized.reduce((sum, s) => sum + (s.transit?.distance || 0), 0),
      participantCount,
      generatedAt: new Date().toISOString(),
    };
  },

  // 模式适配评分
  _calcModeScore(poi, mode, hasKids) {
    let score = 0;

    if (mode === "family") {
      // 家庭模式偏好: 亲子友好、节奏舒缓、环境好
      score += poi.familyFriendly * 2;
      if (poi.category === "亲子") score += 10;
      if (poi.category === "景点" && poi.subcategory === "公园") score += 5;
      if (poi.subcategory === "火锅") score -= 3; // 不太适合小孩
      if (poi.subcategory === "KTV" || poi.subcategory === "密室逃脱") score -= 10;
      if (poi.subcategory === "烧烤") score -= 2;
      if (poi.price > 200 && poi.category === "餐饮") score -= 2;
      if (poi.tags.includes("安静") || poi.tags.includes("环境好")) score += 3;
    } else {
      // 好友模式偏好: 打卡、趣味、聚会、高性价比
      score += (5 - poi.familyFriendly) * 1.5;
      if (poi.subcategory === "密室逃脱" || poi.subcategory === "KTV" || poi.subcategory === "轰趴馆") score += 10;
      if (poi.subcategory === "烧烤" || poi.subcategory === "小龙虾") score += 5;
      if (poi.category === "休闲娱乐") score += 6;
      if (poi.tags.includes("网红") || poi.tags.includes("打卡")) score += 4;
      if (poi.tags.includes("夜宵") || poi.tags.includes("聚会")) score += 3;
      if (poi.price > 300) score -= 3;
      if (poi.category === "亲子") score -= 5;
    }

    // 预算约束
    if (poi.price <= 0) score += 2; // 免费项目加分

    return score;
  },

  // 贪婪路线构建
  _buildRoute(candidates, start, totalHours, mode) {
    const route = [];
    const usedIds = new Set();
    const maxStops = mode === "family" ? 5 : 6;
    const totalMinutes = totalHours * 60;
    let currentLat = start.lat;
    let currentLng = start.lng;
    let elapsedMinutes = 0;

    // 类别覆盖优先级
    const categoryOrder = mode === "family"
      ? ["景点", "亲子", "餐饮", "购物", "休闲娱乐"]
      : ["休闲娱乐", "餐饮", "购物", "景点", "亲子"];

    // 每轮选最佳下一个点位
    while (route.length < maxStops && elapsedMinutes < totalMinutes) {
      let best = null;
      let bestScore = -Infinity;

      for (const poi of candidates) {
        if (usedIds.has(poi.id)) continue;
        if (poi.price > 500) continue; // 太贵的不选

        const dist = calcDistance(currentLat, currentLng, poi.lat, poi.lng);
        const travelTime = calcTravelTime(dist, mode === "family" ? "drive" : "drive");
        const remaining = totalMinutes - elapsedMinutes - travelTime - poi.stayMinutes;

        if (remaining < -30) continue; // 时间不够，跳过

        // 评分: 模式分 + 距离近 + 类别优先级 + 时间匹配度
        let score = poi.modeScore;

        // 距离惩罚 (越近越好)
        score -= dist * 3;

        // 类别覆盖率奖励
        const catIdx = categoryOrder.indexOf(poi.category);
        if (catIdx >= 0) {
          const catCount = route.filter(s => s.category === poi.category).length;
          if (catCount === 0) score += 8; // 还没这个类别
          else if (catCount === 1) score += 2;
        }

        // 时间匹配度
        if (remaining > 60) score += 3; // 时间充裕

        // 避免同类相邻
        if (route.length > 0 && route[route.length - 1].category === poi.category) {
          score -= 5;
        }

        if (score > bestScore) {
          bestScore = score;
          best = { ...poi, transitDistance: dist, transitMinutes: travelTime };
        }
      }

      if (!best) break;

      usedIds.add(best.id);
      elapsedMinutes += (best.transitMinutes + best.stayMinutes);
      currentLat = best.lat;
      currentLng = best.lng;
      route.push(best);
    }

    return route;
  },

  // 时间线优化
  _optimizeTimeline(route, start, mode) {
    const optimized = [];
    let currentLat = start.lat;
    let currentLng = start.lng;
    let cumulativeMinutes = mode === "family" ? 9 * 60 + 30 : 13 * 60; // 家庭9:30出发, 朋友13:00

    for (let i = 0; i < route.length; i++) {
      const stop = route[i];
      const dist = calcDistance(currentLat, currentLng, stop.lat, stop.lng);
      const travelMode = mode === "family" ? "drive" : "drive";
      const travelTime = calcTravelTime(dist, travelMode);

      const arrival = cumulativeMinutes + travelTime;
      const departure = arrival + stop.stayMinutes;

      optimized.push({
        ...stop,
        order: i + 1,
        transit: {
          distance: parseFloat(dist.toFixed(1)),
          minutes: travelTime,
          mode: travelMode,
          label: TRAVEL_MODES[travelMode].label,
          emoji: TRAVEL_MODES[travelMode].emoji,
        },
        arrivalTime: this._formatTime(arrival),
        departureTime: this._formatTime(departure),
      });

      currentLat = stop.lat;
      currentLng = stop.lng;
      cumulativeMinutes = departure + 15; // 15分钟缓冲
    }

    return optimized;
  },

  _formatTime(totalMinutes) {
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  },

  // 调整方案 (替换某个点位)
  adjust(plan, removeStopIndex, newPreference) {
    const stops = [...plan.stops];
    const removed = stops.splice(removeStopIndex, 1)[0];
    const usedIds = new Set(stops.map(s => s.id));

    // 获取同类别替代
    const alternatives = getNearbyPOIs(plan.userLocation.lat, plan.userLocation.lng, 8)
      .filter(p => p.category === removed.category && !usedIds.has(p.id))
      .sort((a, b) => b.rating - a.rating);

    if (alternatives.length > 0) {
      stops.splice(removeStopIndex, 0, alternatives[0]);
    }

    return { ...plan, stops: this._optimizeTimeline(stops, plan.userLocation, plan.mode) };
  },

  // 生成分享文本
  generateShareText(plan) {
    const modeLabel = plan.mode === "family" ? "家庭出行" : "好友结伴";
    let text = `📋 ${modeLabel}行程规划\n`;
    text += `━━━━━━━━━━━━━━━\n`;
    for (const stop of plan.stops) {
      text += `${stop.emoji} ${stop.order}. ${stop.name}`;
      if (stop.transit) {
        text += `\n   🚗 距上站${stop.transit.distance}km · ${stop.transit.minutes}分钟`;
      }
      text += `\n   ⏱ 停留${stop.stayMinutes}分钟 · ${stop.arrivalTime}-${stop.departureTime}`;
      if (stop.price > 0) text += `\n   💰 ${stop.priceLabel}`;
      text += `\n`;
    }
    text += `━━━━━━━━━━━━━━━\n`;
    text += `📍 起点: ${plan.userLocation.address}\n`;
    text += `⏱ 总时长: ${Math.round(plan.totalDuration / 60)}小时\n`;
    text += `📏 总距离: ${plan.totalDistance.toFixed(1)}km\n`;
    text += `\n✨ 由美团AI生成 · 一键预订 →`;
    return text;
  },
};
