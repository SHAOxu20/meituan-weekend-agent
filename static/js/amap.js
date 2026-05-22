// ============================================
//  高德地图 API 集成模块
//  真实定位、POI搜索、地理编码、路线规划
// ============================================

const AmapService = {
  _ready: false,
  _geolocation: null,
  _geocoder: null,
  _placeSearch: null,

  // 高德 Web JS API Key
  API_KEY: "a4359f00032bd8e52bc378e89604e1aa",

  init() {
    return new Promise((resolve, reject) => {
      if (this._ready) return resolve();
      if (typeof AMap === "undefined") {
        console.warn("[Amap] SDK 未加载，回退模拟数据");
        return reject(new Error("AMap SDK not loaded"));
      }
      try {
        AMap.plugin(["AMap.Geolocation", "AMap.Geocoder", "AMap.PlaceSearch", "AMap.Driving"], () => {
          this._geolocation = new AMap.Geolocation({ enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
          this._geocoder = new AMap.Geocoder();
          this._placeSearch = new AMap.PlaceSearch({ pageSize: 20, pageIndex: 1, extensions: "all" });
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
          resolve({
            lat: pos.lat, lng: pos.lng,
            address: result.formattedAddress || `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`,
            name: result.addressComponent?.city || "当前位置",
            source: "amap", accuracy: result.accuracy,
            province: result.addressComponent?.province || "",
            city: result.addressComponent?.city || "",
            district: result.addressComponent?.district || "",
          });
        } else {
          reject(new Error(result.message || "定位失败"));
        }
      });
    });
  },

  // ==================== 逆地理编码 ====================
  reverseGeocode(lat, lng) {
    return new Promise((resolve, reject) => {
      if (!this._geocoder) return reject(new Error("未初始化"));
      this._geocoder.getAddress([lng, lat], (status, result) => {
        if (status === "complete" && result.regeocode) {
          const c = result.regeocode.addressComponent;
          resolve({
            address: result.regeocode.formattedAddress || "",
            province: c?.province || "", city: c?.city || "",
            district: c?.district || "", township: c?.township || "",
          });
        } else { reject(new Error("逆地理编码失败")); }
      });
    });
  },

  // ==================== 地理编码 ====================
  geocode(address) {
    return new Promise((resolve, reject) => {
      if (!this._geocoder) return reject(new Error("未初始化"));
      this._geocoder.getLocation(address, (status, result) => {
        if (status === "complete" && result.geocodes.length > 0) {
          const g = result.geocodes[0];
          resolve({ lat: g.location.lat, lng: g.location.lng, address: g.formattedAddress || address, name: address, source: "amap_geocode" });
        } else { reject(new Error("地理编码失败")); }
      });
    });
  },

  // ==================== 周边POI搜索 ====================
  searchNearby(lat, lng, categories = [], radius = 5000) {
    return new Promise((resolve, reject) => {
      if (!this._placeSearch) return reject(new Error("未初始化"));

      const catNames = categories.length > 0 ? categories : ["餐饮", "景点", "购物", "休闲娱乐"];
      const allResults = [];
      let done = 0;

      if (catNames.length === 0) { resolve([]); return; }

      catNames.forEach((cat) => {
        this._placeSearch.searchNearBy(cat, [lng, lat], radius, (status, result) => {
          done++;
          if (status === "complete" && result.poiList) {
            result.poiList.pois.forEach((p) => {
              allResults.push({
                id: p.id || `amap_${p.uid}`,
                name: p.name,
                category: cat,
                subcategory: p.type?.split(";")[1] || p.type || "",
                lat: p.location.lat, lng: p.location.lng,
                distance: parseFloat(p.distance) / 1000 || 0,
                rating: parseFloat(p.biz_ext?.rating) || (3.5 + Math.random() * 1.5),
                price: p.biz_ext?.cost ? parseFloat(p.biz_ext.cost.replace(/[^0-9]/g, "")) : 0,
                priceLabel: p.biz_ext?.cost || "暂无",
                hours: p.biz_ext?.opentime || "暂无",
                tags: p.tag?.split(",") || [],
                address: p.address || "", tel: p.tel || "",
                meituanUrl: `https://i.meituan.com/s/${encodeURIComponent(p.name)}`,
                meituanScheme: `meituan://route/search?q=${encodeURIComponent(p.name)}`,
                emoji: ({ "餐饮": "🍽️", "景点": "🏞️", "亲子": "🎠", "购物": "🛍️", "休闲娱乐": "🎮" })[cat] || "📍",
                stayMinutes: cat === "餐饮" ? 75 : cat === "景点" ? 120 : 90,
                needReserve: true,
                familyFriendly: cat === "亲子" ? 5 : cat === "餐饮" ? 3 : 3,
                source: "amap",
              });
            });
          }
          if (done >= catNames.length) {
            const seen = new Set();
            const unique = allResults.filter(p => { const k = p.name + p.lat.toFixed(5); if (seen.has(k)) return false; seen.add(k); return true; });
            unique.sort((a, b) => a.distance - b.distance);
            resolve(unique);
          }
        });
      });
    });
  },

  // ==================== 驾车路线 ====================
  getDrivingRoute(fromLat, fromLng, toLat, toLng) {
    return new Promise((resolve) => {
      AMap.plugin("AMap.Driving", () => {
        const driving = new AMap.Driving({ policy: AMap.DrivingPolicy.LEAST_TIME });
        driving.search([fromLng, fromLat], [toLng, toLat], (status, result) => {
          if (status === "complete" && result.routes.length > 0) {
            const r = result.routes[0];
            resolve({ distance: parseFloat((r.distance / 1000).toFixed(1)), minutes: Math.round(r.time / 60), mode: "drive", label: "驾车", emoji: "🚗" });
          } else {
            const d = calcDistance(fromLat, fromLng, toLat, toLng);
            resolve({ distance: parseFloat(d.toFixed(1)), minutes: calcTravelTime(d, "drive"), mode: "drive", label: "驾车（估算）", emoji: "🚗" });
          }
        });
      });
    });
  },

  // ==================== IP定位 ====================
  ipLocation() {
    return fetch(`https://restapi.amap.com/v3/ip?key=${this.API_KEY}`)
      .then(r => r.json())
      .then(data => {
        if (data.status === "1" && data.rectangle) {
          const [lng1, lat1, lng2, lat2] = data.rectangle.split(";").flatMap(s => s.split(",").map(Number));
          return {
            lat: (lat1 + lat2) / 2, lng: (lng1 + lng2) / 2,
            address: [data.province, data.city].filter(Boolean).join(""),
            city: data.city || "", source: "amap_ip",
          };
        }
        throw new Error("IP定位失败");
      });
  },

  isAvailable() { return this._ready; },
};
