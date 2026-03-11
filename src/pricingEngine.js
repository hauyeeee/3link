// src/priceEngine.js
import { pricingData } from './pricingData';

export const calculatePrice = ({ category, routeKey, destination, time, isCrossSea, hours, isRemote }) => {
  let price = 0;
  const { settings, charter, local, crossBorder } = pricingData;

  // 1. 判斷服務類型並獲取 Base Price (人民幣)
  if (category === 'charter') {
    // 【包車邏輯】
    const actualHours = Math.max(hours, charter.minHours);
    price = actualHours * charter.hourlyRate;
    if (isRemote) {
      price += (charter.remoteAddHour * charter.hourlyRate);
    }
  } else if (category === 'local') {
    // 【本地單邏輯】
    price = local[routeKey] || 0;
  } else if (category === 'crossBorder') {
    // 【跨境單邏輯】
    price = crossBorder[routeKey] || 0;
    
    // 如果係普通跨境單，去港島自動 +100 (珠海/澳門選項本身已經包咗目的地，所以排除)
    if (destination === '港島' && !routeKey.includes("珠海") && !routeKey.includes("澳門")) {
      price += settings.islandSurcharge;
    }
  }

  // 2. 判斷額外過海費 (User 手動 Tick)
  if (isCrossSea && category !== 'charter') {
    price += settings.crossSeaSurcharge;
  }

  // 3. 判斷深夜附加費 (00:00 - 06:00)
  if (time) {
    const hour = parseInt(time.split(':')[0], 10);
    if (hour >= 0 && hour < 6) {
      price += settings.midnightSurcharge;
    }
  }

  // 回傳結果 (總價 及 50%訂金，均為人民幣基準)
  return {
    total: price,
    deposit: price * 0.5
  };
};