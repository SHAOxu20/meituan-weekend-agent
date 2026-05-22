// ============================================
//  高德地图 API 集成模块
//  提供真实定位、POI搜索、地理编码、路线规划
//  替换原有的模拟数据层
// ============================================

const AmapService = {
  _ready: false,
  _geolocation: null,
  _geocoder: null,
  _placeSearch: null,

  // 高德 Web JS API Key（在此填入你的 Key）
  // 免费申请: https://console.amap.com/dev/key/app
  API_KEY: "YOUR_AMAP_KEY_HERE",

  // 初始化
  init() {
    return new Promise((resolve, reject) => {
      if (this._ready) return resolve();

      // 检查 AMap SDK 是否已加载
      if (typeof AMap === "undefined") {
        console.warn("[Amap] SDK 未加载，回退到模拟数据");
        return reject(new Error("AMap SDK not loaded"));
      }

      try {
        AMap.plugin(["AMap.Geolocation", "AMap.Geocoder", "AMap.PlaceSearch"], () => {
          this._geolocation = new AMap.Geolocation({
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000,
          });

          this._geocoder = new AMap.Geocoder();

          this._placeSearch = new AMap.PlaceSearch({
            pageSize: 20,
            pageIndex: 1,
            extensions: "all",
          });

          this._ready = true;
          console.log("[Amap] 初始化完成");
          resolve();
        });
      } catch (e) {
        console.warn("[Amap] 初始化失败:", e.message);
        reject(e);
      }
    });
  },

  // ==================== 定位 ====================
  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!this._geolocation) return reject(new Error("未初始化"));

      this._geolocation.getCurrentPosition((status, result) => {
        if (status === "complete" && result.position) {
          const pos = result.position;
          const addr = result.formattedAddress || `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;
          resolve({
            lat: pos.lat,
            lng: pos.lng,
            address: addr,
            name: result.addressComponent?.city || "当前位置",
            source: "amap",
            accuracy: result.accuracy,
            province: result.addressComponent?.province || "",
            city: result.addressComponent?.city || "",
            district: result.addressComponent?.district || "",
          });
        } else {
          console.warn("[Amap] 定位失败:", result.message);
          reject(new Error(result.message || "定位失败"));
        }
      });
    });
  },

  // ==================== 逆地理编码（坐标→地址） ====================
  reverseGeocode(lat, lng) {
    return new Promise((resolve, reject) => {
      if (!this._geocoder) return reject(new Error("未初始化"));

      this._geocoder.getAddress([lng, lat], (status, result) => {
        if (status === "complete" && result.regeocode) {
          resolve({
            address: result.regeocode.formattedAddress || "",
            province: result.regeocode.addressComponent?.province || "",
            city: result.regeocode.addressComponent?.city || "",
            district: result.regeocode.addressComponent?.district || "",
            township: result.regeocode.addressComponent?.township || "",
          });
        } else {
          reject(new Error("逆地理编码失败"));
        }
      });
    });
  },

  // ==================== 地理编码（地址→坐标） ====================
  geocode(address) {
    return new Promise((resolve, reject) => {
      if (!this._geocoder) return reject(new Error("未初始化"));

      this._geocoder.getLocation(address, (status, result) => {
        if (status === "complete" && result.geocodes.length > 0) {
          const geo = result.geocodes[0];
          resolve({
            lat: geo.location.lat,
            lng: geo.location.lng,
            address: geo.formattedAddress || address,
            name: address,
            source: "amap_geocode",
          });
        } else {
          reject(new Error("地理编码失败: " + address));
        }
      });
    });
  },

  // ==================== POI 搜索 ====================
  // 高德POI类型映射表: https://lbs.amap.com/api/webservice/download
  // 餐饮: 050000 | 景点: 110000 | 购物: 060000 | 休闲娱乐: 080000
  _categoryMap: {
    "餐饮": "050000",
    "景点": "110000|140000",
    "亲子": "110000|140000|141200",
    "购物": "060000",
    "休闲娱乐": "080000",
  },

  searchNearby(lat, lng, categories = [], radius = 5000) {
    return new Promise((resolve, reject) => {
      if (!this._placeSearch) return reject(new Error("未初始化"));

      const allResults = [];
      const searchCategories = categories.length > 0 ? categories : Object.keys(this._categoryMap);

      let completed = 0;
      const total = searchCategories.length;

      if (total === 0) { resolve([]); return; }

      searchCategories.forEach((cat) => {
        const amapType = this._categoryMap[cat] || "";
        this._placeSearch.searchNearBy(
          cat,
          [lng, lat],
          radius,
          (status, result) => {
            completed++;
            if (status === "complete" && result.poiList) {
              const pois = result.poiList.pois.map((p) => ({
                id: p.id || `amap_${p.uid}`,
                name: p.name,
                category: cat,
                subcategory: p.type?.split(";")[1] || p.type || "",
                lat: p.location.lat,
                lng: p.location.lng,
                distance: parseFloat(p.distance) / 1000 || 0,
                rating: parseFloat(p.biz_ext?.rating) || (3.5 + Math.random() * 1.5),
                price: p.biz_ext?.cost ? parseFloat(p.biz_ext.cost.replace(/[^0-9]/g, "")) : 0,
                priceLabel: p.biz_ext?.cost || "暂无",
                hours: p.biz_ext?.opentime || "暂无",
                tags: p.tag?.split(",") || [],
                address: p.address || "",
                tel: p.tel || "",
                meituanUrl: `https://i.meituan.com/s/${encodeURIComponent(p.name)}`,
                meituanScheme: `meituan://route/search?q=${encodeURIComponent(p.name)}`,
                emoji: this._getEmoji(cat),
                stayMinutes: cat === "餐饮" ? 75 : cat === "亲子" ? 120 : 90,
                needReserve: true,
                familyFriendly: cat === "亲子" ? 5 : cat === "餐饮" ? 3 : 3,
                source: "amap",
              }));
              allResults.push(...pois);
            }
            if (completed >= total) {
              // 按距离排序，去重
              const seen = new Set();
              const unique = allResults.filter((p) => {
                const key = p.name + p.lat.toFixed(5);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              });
              unique.sort((a, b) => a.distance - b.distance);
              resolve(unique);
            }
          }
        );
      });
    });
  },

  _getEmoji(cat) {
    const map = { "餐饮": "🍽️", "景点": "🏞️", "亲子": "🎠", "购物": "🛍️", "休闲娱乐": "🎮" };
    return map[cat] || "📍";
  },

  // ==================== 驾车路线规划（两站之间） ====================
  getDrivingRoute(fromLat, fromLng, toLat, toLng) {
    return new Promise((resolve, reject) => {
      AMap.plugin("AMap.Driving", () => {
        const driving = new AMap.Driving({ policy: AMap.DrivingPolicy.LEAST_TIME });
        driving.search(
          [fromLng, fromLat],
          [toLng, toLat],
          (status, result) => {
            if (status === "complete" && result.routes.length > 0) {
              const route = result.routes[0];
              resolve({
                distance: parseFloat((route.distance / 1000).toFixed(1)),
                minutes: Math.round(route.time / 60),
                mode: "drive",
                label: "驾车",
                emoji: "🚗",
              });
            } else {
              // 回退：直线距离估算
              const dist = calcDistance(fromLat, fromLng, toLat, toLng);
              resolve({
                distance: parseFloat(dist.toFixed(1)),
                minutes: calcTravelTime(dist, "drive"),
                mode: "drive",
                label: "驾车（估算）",
                emoji: "🚗",
              });
            }
          }
        );
      });
    });
  },

  // ==================== IP定位（高德IP定位API） ====================
  ipLocation() {
    return fetch(`https://restapi.amap.com/v3/ip?key=${this.API_KEY}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "1" && data.rectangle) {
          const [lng1, lat1, lng2, lat2] = data.rectangle.split(";").flatMap((s) => s.split(",").map(Number));
          return {
            lat: (lat1 + lat2) / 2,
            lng: (lng1 + lng2) / 2,
            address: [data.province, data.city].filter(Boolean).join(""),
            city: data.city || "",
            source: "amap_ip",
          };
        }
        throw new Error("IP定位失败");
      });
  },

  // 检查是否可用
  isAvailable() {
    return this._ready;
  },
};
