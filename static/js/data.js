// ============================================
//  POI 模拟数据库 — 美团AI出行规划
//  位置感知：POI 坐标根据用户实际位置动态生成
// ============================================

// POI 模板（不含固定坐标，运行时根据用户位置生成）
const POI_TEMPLATES = [
  // ============ 餐饮 ============
  { id: "e001", name: "海底捞火锅", category: "餐饮", subcategory: "火锅",
    rating: 4.8, price: 150, priceLabel: "￥150/人",
    hours: "11:00-03:00", tags: ["火锅", "服务好", "聚会"], familyFriendly: 3,
    meituanUrl: "https://meituan.com/shop/e001", meituanScheme: "meituan://shop/e001",
    emoji: "🍲", stayMinutes: 90, needReserve: true },
  { id: "e002", name: "大董烤鸭", category: "餐饮", subcategory: "中式正餐",
    rating: 4.7, price: 280, priceLabel: "￥280/人",
    hours: "11:00-21:30", tags: ["烤鸭", "京菜", "商务宴请"], familyFriendly: 4,
    meituanUrl: "https://meituan.com/shop/e002", meituanScheme: "meituan://shop/e002",
    emoji: "🦆", stayMinutes: 90, needReserve: true },
  { id: "e003", name: "西贝莜面村", category: "餐饮", subcategory: "西北菜",
    rating: 4.6, price: 100, priceLabel: "￥100/人",
    hours: "10:30-21:30", tags: ["西北菜", "亲子友好", "儿童餐"], familyFriendly: 5,
    meituanUrl: "https://meituan.com/shop/e003", meituanScheme: "meituan://shop/e003",
    emoji: "🍜", stayMinutes: 75, needReserve: false },
  { id: "e004", name: "胡大饭馆", category: "餐饮", subcategory: "小龙虾",
    rating: 4.5, price: 160, priceLabel: "￥160/人",
    hours: "10:00-02:00", tags: ["小龙虾", "夜宵", "网红"], familyFriendly: 2,
    meituanUrl: "https://meituan.com/shop/e004", meituanScheme: "meituan://shop/e004",
    emoji: "🦞", stayMinutes: 90, needReserve: true },
  { id: "e005", name: "喜茶", category: "餐饮", subcategory: "茶饮",
    rating: 4.4, price: 30, priceLabel: "￥30/人",
    hours: "10:00-22:00", tags: ["茶饮", "网红", "打卡"], familyFriendly: 3,
    meituanUrl: "https://meituan.com/shop/e005", meituanScheme: "meituan://shop/e005",
    emoji: "🧋", stayMinutes: 20, needReserve: false },
  { id: "e006", name: "云海肴云南菜", category: "餐饮", subcategory: "云南菜",
    rating: 4.5, price: 110, priceLabel: "￥110/人",
    hours: "10:30-22:00", tags: ["云南菜", "清淡", "环境好"], familyFriendly: 4,
    meituanUrl: "https://meituan.com/shop/e006", meituanScheme: "meituan://shop/e006",
    emoji: "🍄", stayMinutes: 80, needReserve: true },
  { id: "e007", name: "很久以前羊肉串", category: "餐饮", subcategory: "烧烤",
    rating: 4.6, price: 130, priceLabel: "￥130/人",
    hours: "11:00-02:00", tags: ["烧烤", "夜宵", "聚会"], familyFriendly: 2,
    meituanUrl: "https://meituan.com/shop/e007", meituanScheme: "meituan://shop/e007",
    emoji: "🍖", stayMinutes: 100, needReserve: false },
  { id: "e008", name: "鼎泰丰", category: "餐饮", subcategory: "中式点心",
    rating: 4.7, price: 150, priceLabel: "￥150/人",
    hours: "11:00-21:30", tags: ["小笼包", "精致", "家庭聚餐"], familyFriendly: 5,
    meituanUrl: "https://meituan.com/shop/e008", meituanScheme: "meituan://shop/e008",
    emoji: "🥟", stayMinutes: 75, needReserve: true },
  { id: "e009", name: "乐凯撒披萨", category: "餐饮", subcategory: "西餐",
    rating: 4.3, price: 80, priceLabel: "￥80/人",
    hours: "11:00-22:00", tags: ["披萨", "亲子", "快速"], familyFriendly: 4,
    meituanUrl: "https://meituan.com/shop/e009", meituanScheme: "meituan://shop/e009",
    emoji: "🍕", stayMinutes: 60, needReserve: false },
  { id: "e010", name: "南门涮肉", category: "餐饮", subcategory: "火锅",
    rating: 4.6, price: 120, priceLabel: "￥120/人",
    hours: "10:30-22:00", tags: ["火锅", "聚会", "传统"], familyFriendly: 4,
    meituanUrl: "https://meituan.com/shop/e010", meituanScheme: "meituan://shop/e010",
    emoji: "🥘", stayMinutes: 90, needReserve: false },

  // ============ 景点 ============
  { id: "s001", name: "城市中心公园", category: "景点", subcategory: "公园",
    rating: 4.5, price: 0, priceLabel: "免费",
    hours: "06:00-21:00", tags: ["公园", "划船", "跑步"], familyFriendly: 5,
    meituanUrl: "https://meituan.com/shop/s001", meituanScheme: "meituan://shop/s001",
    emoji: "🌳", stayMinutes: 120, needReserve: false },
  { id: "s002", name: "当代艺术区", category: "景点", subcategory: "艺术区",
    rating: 4.6, price: 0, priceLabel: "免费",
    hours: "10:00-18:00", tags: ["艺术", "拍照", "文艺"], familyFriendly: 3,
    meituanUrl: "https://meituan.com/shop/s002", meituanScheme: "meituan://shop/s002",
    emoji: "🎨", stayMinutes: 120, needReserve: false },
  { id: "s003", name: "城市主题乐园", category: "景点", subcategory: "主题乐园",
    rating: 4.4, price: 299, priceLabel: "￥299/人",
    hours: "09:30-21:00", tags: ["游乐园", "刺激", "亲子"], familyFriendly: 4,
    meituanUrl: "https://meituan.com/shop/s003", meituanScheme: "meituan://shop/s003",
    emoji: "🎢", stayMinutes: 300, needReserve: true },
  { id: "s004", name: "滨水商业街区", category: "景点", subcategory: "商业街区",
    rating: 4.5, price: 0, priceLabel: "免费",
    hours: "10:00-22:00", tags: ["购物", "滨水", "夜景"], familyFriendly: 4,
    meituanUrl: "https://meituan.com/shop/s004", meituanScheme: "meituan://shop/s004",
    emoji: "🌊", stayMinutes: 90, needReserve: false },
  { id: "s005", name: "民族文化园", category: "景点", subcategory: "文化园",
    rating: 4.3, price: 90, priceLabel: "￥90/人",
    hours: "08:30-17:30", tags: ["民族文化", "亲子", "教育"], familyFriendly: 5,
    meituanUrl: "https://meituan.com/shop/s005", meituanScheme: "meituan://shop/s005",
    emoji: "🏯", stayMinutes: 150, needReserve: true },
  { id: "s006", name: "潮流商业街", category: "景点", subcategory: "商业街区",
    rating: 4.5, price: 0, priceLabel: "免费",
    hours: "10:00-22:00", tags: ["潮流", "街拍", "夜生活"], familyFriendly: 2,
    meituanUrl: "https://meituan.com/shop/s006", meituanScheme: "meituan://shop/s006",
    emoji: "🛍️", stayMinutes: 90, needReserve: false },
  { id: "s007", name: "古典园林", category: "景点", subcategory: "公园",
    rating: 4.4, price: 0, priceLabel: "免费",
    hours: "06:00-21:00", tags: ["古典园林", "安静", "散步"], familyFriendly: 4,
    meituanUrl: "https://meituan.com/shop/s007", meituanScheme: "meituan://shop/s007",
    emoji: "🏮", stayMinutes: 60, needReserve: false },

  // ============ 亲子 ============
  { id: "k001", name: "城市动物园", category: "亲子", subcategory: "动物园",
    rating: 4.6, price: 19, priceLabel: "￥19/人",
    hours: "07:30-18:00", tags: ["动物", "亲子必去", "教育"], familyFriendly: 5,
    meituanUrl: "https://meituan.com/shop/k001", meituanScheme: "meituan://shop/k001",
    emoji: "🐼", stayMinutes: 180, needReserve: true },
  { id: "k002", name: "科技馆", category: "亲子", subcategory: "博物馆",
    rating: 4.7, price: 30, priceLabel: "￥30/人",
    hours: "09:30-17:00(周一闭馆)", tags: ["科技", "互动", "儿童"], familyFriendly: 5,
    meituanUrl: "https://meituan.com/shop/k002", meituanScheme: "meituan://shop/k002",
    emoji: "🔬", stayMinutes: 180, needReserve: true },
  { id: "k003", name: "亲子乐园", category: "亲子", subcategory: "儿童乐园",
    rating: 4.3, price: 80, priceLabel: "￥80/人",
    hours: "09:00-18:00", tags: ["儿童乐园", "户外", "亲子"], familyFriendly: 5,
    meituanUrl: "https://meituan.com/shop/k003", meituanScheme: "meituan://shop/k003",
    emoji: "🎠", stayMinutes: 120, needReserve: false },
  { id: "k004", name: "乐高探索中心", category: "亲子", subcategory: "室内乐园",
    rating: 4.5, price: 180, priceLabel: "￥180/人",
    hours: "10:00-20:00", tags: ["乐高", "室内", "动手"], familyFriendly: 5,
    meituanUrl: "https://meituan.com/shop/k004", meituanScheme: "meituan://shop/k004",
    emoji: "🧱", stayMinutes: 150, needReserve: true },
  { id: "k005", name: "奈尔宝家庭中心", category: "亲子", subcategory: "室内乐园",
    rating: 4.6, price: 398, priceLabel: "￥398/一大一小",
    hours: "10:00-21:00", tags: ["高端亲子", "室内", "一整天"], familyFriendly: 5,
    meituanUrl: "https://meituan.com/shop/k005", meituanScheme: "meituan://shop/k005",
    emoji: "🎪", stayMinutes: 240, needReserve: true },
  { id: "k006", name: "儿童购物区", category: "亲子", subcategory: "综合",
    rating: 4.4, price: 0, priceLabel: "免费(消费另计)",
    hours: "10:00-22:00", tags: ["亲子购物", "喷泉", "遛娃"], familyFriendly: 5,
    meituanUrl: "https://meituan.com/shop/k006", meituanScheme: "meituan://shop/k006",
    emoji: "👶", stayMinutes: 90, needReserve: false },

  // ============ 休闲娱乐 ============
  { id: "f001", name: "密室逃脱·长古世家", category: "休闲娱乐", subcategory: "密室逃脱",
    rating: 4.6, price: 198, priceLabel: "￥198/人",
    hours: "10:00-23:00", tags: ["密室", "沉浸", "团建"], familyFriendly: 1,
    meituanUrl: "https://meituan.com/shop/f001", meituanScheme: "meituan://shop/f001",
    emoji: "🔐", stayMinutes: 120, needReserve: true },
  { id: "f002", name: "纯K·KTV", category: "休闲娱乐", subcategory: "KTV",
    rating: 4.4, price: 120, priceLabel: "￥120/人",
    hours: "12:00-06:00", tags: ["KTV", "聚会", "唱歌"], familyFriendly: 1,
    meituanUrl: "https://meituan.com/shop/f002", meituanScheme: "meituan://shop/f002",
    emoji: "🎤", stayMinutes: 180, needReserve: true },
  { id: "f003", name: "万达影城", category: "休闲娱乐", subcategory: "电影院",
    rating: 4.5, price: 60, priceLabel: "￥60/人",
    hours: "09:00-01:00", tags: ["IMAX", "电影", "约会"], familyFriendly: 3,
    meituanUrl: "https://meituan.com/shop/f003", meituanScheme: "meituan://shop/f003",
    emoji: "🎬", stayMinutes: 150, needReserve: true },
  { id: "f004", name: "水裹·汤泉", category: "休闲娱乐", subcategory: "汤泉",
    rating: 4.7, price: 299, priceLabel: "￥299/人",
    hours: "全天24小时", tags: ["泡汤", "汗蒸", "放松"], familyFriendly: 2,
    meituanUrl: "https://meituan.com/shop/f004", meituanScheme: "meituan://shop/f004",
    emoji: "♨️", stayMinutes: 240, needReserve: true },
  { id: "f005", name: "轰趴馆·乌托邦", category: "休闲娱乐", subcategory: "轰趴馆",
    rating: 4.5, price: 150, priceLabel: "￥150/人",
    hours: "10:00-02:00", tags: ["桌游", "台球", "团建"], familyFriendly: 1,
    meituanUrl: "https://meituan.com/shop/f005", meituanScheme: "meituan://shop/f005",
    emoji: "🎱", stayMinutes: 240, needReserve: true },
  { id: "f006", name: "猫咖·喵星球", category: "休闲娱乐", subcategory: "猫咖",
    rating: 4.3, price: 68, priceLabel: "￥68/人",
    hours: "11:00-21:00", tags: ["撸猫", "放松", "打卡"], familyFriendly: 3,
    meituanUrl: "https://meituan.com/shop/f006", meituanScheme: "meituan://shop/f006",
    emoji: "🐱", stayMinutes: 60, needReserve: false },

  // ============ 购物 ============
  { id: "m001", name: "城市购物中心", category: "购物", subcategory: "购物中心",
    rating: 4.6, price: 0, priceLabel: "免费(消费另计)",
    hours: "10:00-22:00", tags: ["购物中心", "餐饮", "电影院"], familyFriendly: 4,
    meituanUrl: "https://meituan.com/shop/m001", meituanScheme: "meituan://shop/m001",
    emoji: "🏬", stayMinutes: 120, needReserve: false },
  { id: "m002", name: "高端百货", category: "购物", subcategory: "高端百货",
    rating: 4.7, price: 0, priceLabel: "免费(消费另计)",
    hours: "10:00-22:00", tags: ["奢侈品", "高端", "百货"], familyFriendly: 2,
    meituanUrl: "https://meituan.com/shop/m002", meituanScheme: "meituan://shop/m002",
    emoji: "💎", stayMinutes: 120, needReserve: false },
  { id: "m003", name: "综合商业体", category: "购物", subcategory: "购物中心",
    rating: 4.5, price: 0, priceLabel: "免费(消费另计)",
    hours: "10:00-22:00", tags: ["购物中心", "美食街", "亲子"], familyFriendly: 4,
    meituanUrl: "https://meituan.com/shop/m003", meituanScheme: "meituan://shop/m003",
    emoji: "🛒", stayMinutes: 120, needReserve: false },
  { id: "m004", name: "生活购物中心", category: "购物", subcategory: "购物中心",
    rating: 4.5, price: 0, priceLabel: "免费(消费另计)",
    hours: "10:00-22:00", tags: ["购物中心", "亲子", "电影院"], familyFriendly: 4,
    meituanUrl: "https://meituan.com/shop/m004", meituanScheme: "meituan://shop/m004",
    emoji: "🏢", stayMinutes: 120, needReserve: false },
  { id: "m005", name: "天幕商业街", category: "购物", subcategory: "商业街区",
    rating: 4.3, price: 0, priceLabel: "免费(消费另计)",
    hours: "10:00-22:00", tags: ["天幕", "街区", "打卡"], familyFriendly: 3,
    meituanUrl: "https://meituan.com/shop/m005", meituanScheme: "meituan://shop/m005",
    emoji: "✨", stayMinutes: 60, needReserve: false },
];

// ============================================
//  动态 POI 数据层
//  根据用户位置实时生成周边 POI 坐标
// ============================================

let _poiCache = null;
let _poiCacheKey = null;

// 为每个POI模板生成基于用户位置的散点坐标
function _scatterAround(lat, lng, index, total) {
  // 使用确定性随机，相同位置+索引 → 相同偏移
  const seed = Math.sin(index * 127.1 + lat * 10 + lng * 10) * 43758.5453;
  const r = (0.5 + Math.abs(seed % 1) * 0.95) * 5; // 0.5km ~ 5km
  const angle = ((index / total) * Math.PI * 2 + seed) % (Math.PI * 2);

  // 纬度: 1度 ≈ 111km, 经度: 1度 ≈ 111km * cos(lat)
  const latOffset = (Math.cos(angle) * r) / 111;
  const lngOffset = (Math.sin(angle) * r) / (111 * Math.cos(lat * Math.PI / 180));

  return {
    lat: lat + latOffset,
    lng: lng + lngOffset,
  };
}

// 获取当前用户位置下的完整 POI 列表
function getPOIDatabase(userLat, userLng) {
  const key = `${userLat.toFixed(4)},${userLng.toFixed(4)}`;
  if (_poiCache && _poiCacheKey === key) return _poiCache;

  _poiCache = POI_TEMPLATES.map((tpl, i) => {
    const pos = _scatterAround(userLat, userLng, i, POI_TEMPLATES.length);
    return { ...tpl, lat: pos.lat, lng: pos.lng };
  });

  _poiCacheKey = key;
  return _poiCache;
}

// ============================================
//  出行方式 & 速度估算
// ============================================
const TRAVEL_MODES = {
  walk: { label: "步行", speed: 5, emoji: "🚶" },
  bike: { label: "骑行", speed: 15, emoji: "🚲" },
  drive: { label: "驾车", speed: 40, emoji: "🚗" },
  transit: { label: "公交/地铁", speed: 25, emoji: "🚇" },
};

// 计算两点距离 (Haversine, km)
function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 估算出行时间 (min)
function calcTravelTime(distKm, mode) {
  const speed = TRAVEL_MODES[mode] ? TRAVEL_MODES[mode].speed : 25;
  return Math.round((distKm / speed) * 60 + 5);
}

// 获取周边POI
function getNearbyPOIs(lat, lng, radiusKm = 5) {
  const db = getPOIDatabase(lat, lng);
  return db
    .map(poi => ({ ...poi, distance: calcDistance(lat, lng, poi.lat, poi.lng) }))
    .filter(poi => poi.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);
}

// 按类别筛选
function filterPOIsByCategory(pois, categories) {
  if (!categories || categories.length === 0) return pois;
  return pois.filter(p => categories.includes(p.category));
}

// 按预算筛选
function filterPOIsByBudget(pois, maxBudget) {
  if (!maxBudget) return pois;
  return pois.filter(p => p.price <= maxBudget);
}

// 按评分筛选
function filterPOIsByRating(pois, minRating) {
  if (!minRating) return pois;
  return pois.filter(p => p.rating >= minRating);
}

// 默认位置（最终降级，通常会被 IP 定位覆盖）
const DEFAULT_LOCATION = {
  lat: 31.2304, lng: 121.4737,
  address: "上海市黄浦区",
  name: "上海市中心",
};

// 兼容旧代码的全局 POI_DATABASE（默认使用上海坐标）
const POI_DATABASE = getPOIDatabase(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng);

