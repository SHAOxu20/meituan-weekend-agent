// ============================================
//  地理服务模块（无需 API Key）
//  定位: 浏览器 GPS + Nominatim 逆地理编码
//  POI: 用户位置感知的动态模拟数据
// ============================================

const GeoService = {

  // ==================== 定位（浏览器GPS + Nominatim地址） ====================
  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("浏览器不支持定位"));

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          let address = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

          // 尝试逆地理编码获取真实地址
          try {
            const addr = await this.reverseGeocode(lat, lng);
            if (addr) {
              address = addr.displayName || addr.address || address;
            }
          } catch {}

          resolve({
            lat, lng, address,
            name: "GPS 定位",
            source: "gps",
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => reject(err.message),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
      );
    });
  },

  // ==================== 逆地理编码（坐标→地址） ====================
  // 使用免费 Nominatim API (OpenStreetMap)
  reverseGeocode(lat, lng) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&accept-language=zh`;

    return fetch(url, {
      headers: { "User-Agent": "MeituanAITripPlanner/1.0" },
      signal: AbortSignal.timeout(5000),
    })
      .then(r => r.json())
      .then(data => {
        if (data && data.display_name) {
          // 提取简短中文地址
          const addr = data.address || {};
          const shortAddr = [
            addr.city || addr.town || addr.county,
            addr.district || addr.suburb,
            addr.road || addr.pedestrian,
          ].filter(Boolean).join("") || data.display_name;

          return {
            displayName: shortAddr,
            address: data.display_name,
            city: addr.city || addr.town || "",
            district: addr.district || "",
            province: addr.province || addr.state || "",
          };
        }
        return null;
      })
      .catch(() => null);
  },

  // ==================== 地理编码（地址→坐标） ====================
  geocode(address) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&accept-language=zh`;

    return fetch(url, {
      headers: { "User-Agent": "MeituanAITripPlanner/1.0" },
      signal: AbortSignal.timeout(5000),
    })
      .then(r => r.json())
      .then(data => {
        if (data.length > 0) {
          return {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            address: data[0].display_name,
            name: address,
            source: "nominatim",
          };
        }
        throw new Error("地址未找到");
      });
  },

  // ==================== IP 定位 ====================
  ipLocation() {
    // 使用免费 ipapi.co
    return fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(4000) })
      .then(r => r.json())
      .then(data => {
        if (data.latitude && data.longitude) {
          return {
            lat: data.latitude, lng: data.longitude,
            address: [data.city, data.region, data.country_name].filter(Boolean).join(", "),
            city: data.city || "",
            source: "ipapi",
          };
        }
        throw new Error("IP定位失败");
      })
      .catch(() => {
        // 备选: ip-api.com
        return fetch("http://ip-api.com/json/?fields=lat,lon,city,region,country", { signal: AbortSignal.timeout(4000) })
          .then(r => r.json())
          .then(data => {
            if (data.lat !== undefined) {
              return {
                lat: data.lat, lng: data.lon,
                address: [data.city, data.region, data.country].filter(Boolean).join(", "),
                city: data.city || "",
                source: "ip-api",
              };
            }
            throw new Error("IP定位失败");
          });
      });
  },

  // 是否可用（始终可用，因为基于浏览器API和免费服务）
  isAvailable() { return true; },
};

