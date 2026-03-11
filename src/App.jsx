// src/App.jsx
import React, { useState } from 'react';
import { pricingData } from './pricingData';
import { calculatePrice } from './priceEngine';

function App() {
  // 基礎狀態
  const [salesCode, setSalesCode] = useState('');
  const [category, setCategory] = useState('crossBorder'); // 'crossBorder', 'local', 'charter'
  const [time, setTime] = useState('14:00');
  
  // 跨境/本地 狀態
  const [routeKey, setRouteKey] = useState('深圳 (南山/福田/羅湖)');
  const [destination, setDestination] = useState('九龍');
  const [isCrossSea, setIsCrossSea] = useState(false);
  
  // 包車 狀態
  const [hours, setHours] = useState(3);
  const [isRemote, setIsRemote] = useState(false);

  // 貨幣狀態
  const [currency, setCurrency] = useState('RMB');

  // 當 Category 改變時，重置預設選項，防止報價出錯
  const handleCategoryChange = (e) => {
    const newCategory = e.target.value;
    setCategory(newCategory);
    if (newCategory === 'local') setRouteKey('九龍-同區');
    if (newCategory === 'crossBorder') setRouteKey('深圳 (南山/福田/羅湖)');
  };

  // 實時計算基礎價錢 (RMB)
  const baseResult = calculatePrice({
    category,
    routeKey,
    destination,
    time,
    isCrossSea,
    hours: parseInt(hours, 10),
    isRemote
  });

  // 匯率轉換邏輯
  const rate = pricingData.settings.exchangeRates[currency];
  const symbol = pricingData.settings.currencySymbols[currency];
  
  // 四捨五入做整數，方便客入數
  const displayTotal = Math.round(baseResult.total * rate);
  const displayDeposit = Math.round(baseResult.deposit * rate);

  return (
    <div style={{ maxWidth: '500px', margin: '40px auto', padding: '20px', fontFamily: 'Arial, sans-serif', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', borderRadius: '12px', backgroundColor: '#fff' }}>
      
      {/* 頂部：標題與貨幣切換 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#333' }}>🚗 三地通落單</h2>
        <select 
          value={currency} 
          onChange={(e) => setCurrency(e.target.value)}
          style={{ padding: '8px', borderRadius: '6px', border: '1px solid #1976d2', background: '#e3f2fd', color: '#1976d2', fontWeight: 'bold', cursor: 'pointer' }}
        >
          <option value="RMB">🇨🇳 RMB (¥)</option>
          <option value="HKD">🇭🇰 HKD (HK$)</option>
          <option value="MOP">🇲🇴 MOP (MOP$)</option>
        </select>
      </div>
      
      <div style={{ marginBottom: '15px' }}>
        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>推薦碼 (Sales Code): </label>
        <input type="text" placeholder="例如 A01 (非必填)" value={salesCode} onChange={(e) => setSalesCode(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
      </div>
      
      <hr style={{ border: '0.5px solid #eee', margin: '20px 0' }} />

      <div style={{ marginBottom: '15px' }}>
        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>服務類型: </label>
        <select value={category} onChange={handleCategoryChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', boxSizing: 'border-box' }}>
          <option value="crossBorder">🌍 跨境接送 (中/港/澳)</option>
          <option value="local">🇭🇰 本地接送 (香港)</option>
          <option value="charter">⏱️ 按時包車 (最少3小時)</option>
        </select>
      </div>

      {/* 動態表單區域 */}
      <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        
        {category === 'charter' ? (
          // --- 包車介面 ---
          <>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>包車時數: </label>
            <input type="number" min="3" value={hours} onChange={(e) => setHours(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '15px', boxSizing: 'border-box' }} />
            
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={isRemote} onChange={(e) => setIsRemote(e.target.checked)} style={{ marginRight: '8px', width: '18px', height: '18px' }} />
              含偏遠地區 (+1小時) <br/><small style={{ color: '#666', marginLeft: '5px' }}>(元/天/屯/機場/大埔/粉嶺/上水)</small>
            </label>
          </>
        ) : (
          // --- 單程介面 (本地 或 跨境) ---
          <>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>選擇路線: </label>
            <select value={routeKey} onChange={(e) => setRouteKey(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '15px', boxSizing: 'border-box' }}>
              {Object.keys(pricingData[category]).map(key => (
                <option key={key} value={key}>{key}</option>
              ))}
            </select>

            {/* 只有普通跨境單先需要揀目的地 (港島加錢邏輯) */}
            {category === 'crossBorder' && !routeKey.includes('珠海') && !routeKey.includes('澳門') && (
              <>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>香港目的地: </label>
                <select value={destination} onChange={(e) => setDestination(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '15px', boxSizing: 'border-box' }}>
                  <option value="九龍">九龍 / 新界</option>
                  <option value="港島">香港島 (+¥100)</option>
                </select>
              </>
            )}

            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={isCrossSea} onChange={(e) => setIsCrossSea(e.target.checked)} style={{ marginRight: '8px', width: '18px', height: '18px' }} />
              額外過海路線 (+¥100)
            </label>
          </>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>用車時間 (00:00-06:00 自動加深夜費): </label>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
      </div>

      <hr style={{ border: '0.5px solid #eee', margin: '20px 0' }} />
      
      {/* 報價顯示區 (自動切換貨幣) */}
      <div style={{ background: '#e8f5e9', borderLeft: '5px solid #4caf50', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#2e7d32' }}>應付總額: {symbol} {displayTotal}</h3>
        <h3 style={{ margin: 0, color: '#d32f2f' }}>✅ 需付 50% 訂金: {symbol} {displayDeposit}</h3>
      </div>
      
      <button 
        onClick={() => alert(`即將前往付款！\n金額: ${symbol}${displayDeposit}\nSales Code: ${salesCode || '無'}`)}
        style={{ width: '100%', padding: '15px', fontSize: '18px', fontWeight: 'bold', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', transition: '0.3s' }}
      >
        確認並上傳入數紙
      </button>
    </div>
  );
}

export default App;