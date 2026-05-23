// ============================================
//  多源定位融合引擎 — 仿美团位置获取逻辑
//  GPS + 传感器 + 多采样融合 + 坐标纠偏
// ============================================

const LocationEngine = {

  // ==================== 配置 ====================
  config: {
    sampleCount: 5,            // GPS 采样次数
    sampleInterval: 800,       // 采样间隔 (ms)
    timeout: 15000,            // 总超时
    accuracyThreshold: 50,     // 精度阈值 (米)，超过视为低质量
    outlierStdDev: 2.0,        // 异常值剔除标准差倍数
    enableSensors: true,       // 是否启用设备传感器
    enableGCJ02: true,         // 是否启用 GCJ-02 纠偏
  },

  // 采样缓存
  _samples: [],
  _sensorData: {
    accelerometer: null,
    gyroscope: null,
    isMoving: false,
  },

  // ==================== 主入口：获取融合定位 ====================
  getPosition(options = {}) {
    const cfg = { ...this.config, ...options };
    this._samples = [];
    this._sensorData = { accelerometer: null, gyroscope: null, isMoving: false };

    // 并行：GPS 采样 + 传感器监听
    const gpsPromise = this._collectGPSSamples(cfg);
    const sensorPromise = cfg.enableSensors ? this._collectSensorData(cfg) : Promise.resolve(null);

    return Promise.all([gpsPromise, sensorPromise]).then(([gpsResult, sensorResult]) => {
      // 融合传感器数据修正
      if (sensorResult && sensorResult.isMoving) {
        gpsResult.isMoving = true;
        gpsResult.confidence = Math.min(1, gpsResult.confidence + 0.1);
      }

      // GCJ-02 纠偏
      if (cfg.enableGCJ02 && gpsResult.lat && gpsResult.lng) {
        const gcj = this._wgs84ToGcj02(gpsResult.lat, gpsResult.lng);
        gpsResult.gcjLat = gcj.lat;
        gpsResult.gcjLng = gcj.lng;
      }

      // 逆地理编码获取地址
      return this._reverseGeocode(gpsResult);
    });
  },

  // ==================== GPS 多采样采集 ====================
  _collectGPSSamples(cfg) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error("Geolocation not supported"));
      }

      let samplesCollected = 0;
      let resolved = false;

      const collectOne = () => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            this._samples.push({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              altitude: pos.coords.altitude,
              altitudeAccuracy: pos.coords.altitudeAccuracy,
              heading: pos.coords.heading,
              speed: pos.coords.speed,
              timestamp: pos.timestamp,
            });

            samplesCollected++;

            if (samplesCollected >= cfg.sampleCount) {
              if (!resolved) {
                resolved = true;
                resolve(this._fuseSamples());
              }
            } else {
              setTimeout(collectOne, cfg.sampleInterval);
            }
          },
          (err) => {
            // 单个采样失败不中断，继续尝试
            samplesCollected++;
            if (samplesCollected >= cfg.sampleCount) {
              if (!resolved && this._samples.length > 0) {
                resolved = true;
                resolve(this._fuseSamples());
              } else if (!resolved) {
                resolved = true;
                reject(err);
              }
            } else if (!resolved) {
              setTimeout(collectOne, cfg.sampleInterval);
            }
          },
          {
            enableHighAccuracy: true,
            timeout: cfg.timeout / 2,
            maximumAge: 0, // 不使用缓存
          }
        );
      };

      collectOne();

      // 全局超时
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          if (this._samples.length >= 2) {
            resolve(this._fuseSamples());
          } else {
            reject(new Error("GPS timeout, insufficient samples"));
          }
        }
      }, cfg.timeout);
    });
  },

  // ==================== 多采样加权融合 ====================
  _fuseSamples() {
    const samples = this._samples;
    if (samples.length === 0) return null;
    if (samples.length === 1) {
      return {
        lat: samples[0].lat,
        lng: samples[0].lng,
        accuracy: samples[0].accuracy,
        altitude: samples[0].altitude,
        heading: samples[0].heading,
        speed: samples[0].speed,
        sampleCount: 1,
        confidence: 1,
        source: "gps",
        rawSamples: samples,
      };
    }

    // Step 1: 异常值过滤 — 剔除精度过低或偏离均值过远的点
    const filtered = this._filterOutliers(samples);

    // Step 2: 精度加权平均
    const fused = this._weightedAverage(filtered);

    // Step 3: 计算置信度
    const confidence = Math.min(1,
      (filtered.length / samples.length) * 0.4 +  // 有效采样率
      (1 - Math.min(fused.accuracy, 100) / 100) * 0.4 + // 精度分数
      (this._sensorData.isMoving ? 0 : 0.2)       // 静止加分
    );

    return {
      lat: fused.lat,
      lng: fused.lng,
      accuracy: fused.accuracy,
      altitude: fused.altitude,
      heading: fused.heading,
      speed: fused.speed,
      sampleCount: samples.length,
      validSamples: filtered.length,
      confidence: parseFloat(confidence.toFixed(2)),
      source: "gps_fused",
      rawSamples: samples,
    };
  },

  // ==================== 异常值过滤 ====================
  _filterOutliers(samples) {
    // 第一轮: 精度阈值过滤
    let filtered = samples.filter(s => s.accuracy <= this.config.accuracyThreshold);

    // 如果全被过滤，放宽到 100m
    if (filtered.length < 2) {
      filtered = samples.filter(s => s.accuracy <= 100);
    }
    if (filtered.length === 0) filtered = samples;

    // 第二轮: 统计离群过滤
    if (filtered.length >= 3) {
      const lats = filtered.map(s => s.lat);
      const lngs = filtered.map(s => s.lng);

      const meanLat = lats.reduce((a, b) => a + b) / lats.length;
      const meanLng = lngs.reduce((a, b) => a + b) / lngs.length;

      const stdLat = Math.sqrt(lats.reduce((s, v) => s + (v - meanLat) ** 2, 0) / lats.length);
      const stdLng = Math.sqrt(lngs.reduce((s, v) => s + (v - meanLng) ** 2, 0) / lngs.length);

      const threshold = this.config.outlierStdDev;
      filtered = filtered.filter(s =>
        Math.abs(s.lat - meanLat) <= threshold * stdLat &&
        Math.abs(s.lng - meanLng) <= threshold * stdLng
      );
    }

    return filtered.length > 0 ? filtered : samples;
  },

  // ==================== 精度加权平均 ====================
  _weightedAverage(samples) {
    // 精度加权: weight = 1 / accuracy²
    const weights = samples.map(s => {
      const acc = Math.max(s.accuracy, 1); // 防止除零
      return 1 / (acc * acc);
    });
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    // 加权经纬度
    let lat = 0, lng = 0, alt = 0, speed = 0, heading = 0;
    let altCount = 0, speedCount = 0, headingCount = 0;

    for (let i = 0; i < samples.length; i++) {
      const w = weights[i] / totalWeight;
      lat += samples[i].lat * w;
      lng += samples[i].lng * w;

      if (samples[i].altitude != null) {
        alt += samples[i].altitude * w;
        altCount++;
      }
      if (samples[i].speed != null) {
        speed += samples[i].speed;
        speedCount++;
      }
      if (samples[i].heading != null) {
        heading += samples[i].heading;
        headingCount++;
      }
    }

    // 融合精度：加权调和平均
    const accuracy = totalWeight > 0
      ? Math.sqrt(1 / (weights.reduce((s, w) => s + w, 0) / samples.length))
      : samples[0].accuracy;

    return {
      lat: parseFloat(lat.toFixed(7)),
      lng: parseFloat(lng.toFixed(7)),
      accuracy: parseFloat(accuracy.toFixed(1)),
      altitude: altCount > 0 ? parseFloat((alt / altCount).toFixed(1)) : null,
      heading: headingCount > 0 ? parseFloat((heading / headingCount).toFixed(1)) : null,
      speed: speedCount > 0 ? parseFloat((speed / speedCount).toFixed(1)) : null,
    };
  },

  // ==================== 设备传感器数据采集 ====================
  _collectSensorData(cfg) {
    return new Promise((resolve) => {
      let accelData = null;
      let gyroData = null;
      let resolved = false;

      const finish = () => {
        if (!resolved) {
          resolved = true;
          const isMoving = this._detectMovement(accelData, gyroData);
          this._sensorData = { accelerometer: accelData, gyroscope: gyroData, isMoving };
          resolve({ isMoving, accelerometer: accelData, gyroscope: gyroData });
        }
      };

      // 加速度计
      if (window.DeviceMotionEvent) {
        const accelHandler = (e) => {
          if (e.acceleration) {
            accelData = {
              x: e.acceleration.x, y: e.acceleration.y, z: e.acceleration.z,
              timestamp: Date.now(),
            };
          }
        };
        window.addEventListener("devicemotion", accelHandler, { once: false });

        // 陀螺仪
        const gyroHandler = (e) => {
          gyroData = {
            alpha: e.alpha, beta: e.beta, gamma: e.gamma,
            timestamp: Date.now(),
          };
        };
        window.addEventListener("deviceorientation", gyroHandler, { once: false });

        // 采集 2 秒后停止
        setTimeout(() => {
          window.removeEventListener("devicemotion", accelHandler);
          window.removeEventListener("deviceorientation", gyroHandler);
          finish();
        }, 2000);
      } else {
        // 桌面端无传感器，直接完成
        setTimeout(finish, 500);
      }
    });
  },

  // 运动检测
  _detectMovement(accel, gyro) {
    if (!accel) return false;

    // 计算加速度幅值
    const mag = Math.sqrt(
      (accel.x || 0) ** 2 + (accel.y || 0) ** 2 + (accel.z || 0) ** 2
    );

    // 重力 ≈ 9.8, 显著偏离说明在运动
    const deviation = Math.abs(mag - 9.8);

    // 陀螺仪旋转速率
    let rotationRate = 0;
    if (gyro) {
      rotationRate = Math.abs(gyro.alpha || 0) + Math.abs(gyro.beta || 0) + Math.abs(gyro.gamma || 0);
    }

    return deviation > 1.5 || rotationRate > 30;
  },

  // ==================== WGS-84 → GCJ-02 坐标纠偏 ====================
  // 中国火星坐标系转换（高德/腾讯/Google中国使用）
  _wgs84ToGcj02(wgLat, wgLng) {
    const PI = Math.PI;
    const a = 6378245.0;    // 长半轴
    const ee = 0.00669342162296594323; // 偏心率平方

    const transformLat = (x, y) => {
      let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
      ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
      ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
      ret += (160.0 * Math.sin(y / 12.0 * PI) + 320.0 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0;
      return ret;
    };

    const transformLng = (x, y) => {
      let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
      ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
      ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0;
      ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0;
      return ret;
    };

    const isOutOfChina = (lat, lng) => {
      return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
    };

    if (isOutOfChina(wgLat, wgLng)) {
      return { lat: wgLat, lng: wgLng };
    }

    let dLat = transformLat(wgLng - 105.0, wgLat - 35.0);
    let dLng = transformLng(wgLng - 105.0, wgLat - 35.0);
    const radLat = wgLat / 180.0 * PI;
    let magic = Math.sin(radLat);
    magic = 1 - ee * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * PI);
    dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * PI);

    return {
      lat: parseFloat((wgLat + dLat).toFixed(7)),
      lng: parseFloat((wgLng + dLng).toFixed(7)),
    };
  },

  // ==================== 逆地理编码 ====================
  _reverseGeocode(result) {
    if (!result || !result.lat) return Promise.resolve(result);

    // 优先高德
    if (typeof AmapService !== "undefined" && AmapService.isAvailable()) {
      return AmapService.reverseGeocode(result.gcjLat || result.lat, result.gcjLng || result.lng)
        .then(addr => {
          result.address = addr.address;
          result.city = addr.city;
          result.district = addr.district;
          result.province = addr.province;
          return result;
        })
        .catch(() => result);
    }

    // 回退 Nominatim
    return fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${result.lat}&lon=${result.lng}&zoom=18&accept-language=zh`,
      { headers: { "User-Agent": "MeituanLocationEngine/1.0" }, signal: AbortSignal.timeout(3000) }
    )
      .then(r => r.json())
      .then(data => {
        if (data && data.display_name) {
          result.address = data.display_name;
          result.city = data.address?.city || data.address?.town || "";
        }
        return result;
      })
      .catch(() => result);
  },

  // ==================== 工具：输出标准化位置数据 ====================
  formatOutput(result) {
    return {
      location: {
        wgs84: { lat: result.lat, lng: result.lng },
        gcj02: result.gcjLat ? { lat: result.gcjLat, lng: result.gcjLng } : null,
      },
      accuracy: result.accuracy,
      altitude: result.altitude,
      heading: result.heading,
      speed: result.speed,
      address: result.address || "",
      city: result.city || "",
      district: result.district || "",
      province: result.province || "",
      confidence: result.confidence || 0,
      isMoving: result.isMoving || false,
      samples: {
        total: result.sampleCount || 0,
        valid: result.validSamples || 0,
      },
      source: result.source || "unknown",
      timestamp: Date.now(),
    };
  },
};
