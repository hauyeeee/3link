// src/App.jsx
import React, { useState, useEffect } from 'react';
import { pricingData } from './pricingData';
import { calculatePrice } from './priceEngine';
import { db, storage } from './firebase';
import { collection, addDoc, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

import Admin from './Admin'; 
import Sales from './Sales';

const hkIslandKeywords = [
  '港島', '中環', '上環', '西營盤', '堅尼地城', '西環', '半山', '山頂', '金鐘', 
  '灣仔', '銅鑼灣', '天后', '炮台山', '北角', '鰂魚涌', '太古', '西灣河', '筲箕灣', 
  '杏花邨', '柴灣', '小西灣', '薄扶林', '數碼港', '香港仔', '黃竹坑', '深水灣', 
  '淺水灣', '赤柱', '大潭', '石澳', '跑馬地', '大坑', '海洋公園'
];

function App() {
  if (window.location.pathname === '/admin') return <Admin />;
  if (window.location.pathname === '/sales') return <Sales />;

  const [salesCode, setSalesCode] = useState('');
  const [category, setCategory] = useState('crossBorder'); 
  const [date, setDate] = useState(''); 
  const [time, setTime] = useState('14:00');
  const [routeKey, setRouteKey] = useState('深圳 (南山/福田/羅湖)');
  const [destination, setDestination] = useState('九龍');
  const [isCrossSea, setIsCrossSea] = useState(false); 
  const [hours, setHours] = useState(3);
  const [isRemote, setIsRemote] = useState(false);
  const [currency, setCurrency] = useState('RMB');
  const [paymentMethod, setPaymentMethod] = useState('AlipayCN');

  // 👇 升級：將地址分拆做上車同落車兩個 State
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  
  const [luggageCount, setLuggageCount] = useState(0);
  const [remarks, setRemarks] = useState('');

  const [receiptFile, setReceiptFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalMarkup, setGlobalMarkup] = useState(0);

  useEffect(() => {
    const fetchMarkup = async () => {
      const snap = await getDoc(doc(db, "settings", "pricing"));
      if (snap.exists()) setGlobalMarkup(snap.data().markup || 0);
    };
    fetchMarkup();
  }, []);

  // 👇 升級：檢查兩個地址是否包含港島字眼
  useEffect(() => {
    const fullAddress = (pickupAddress + ' ' + dropoffAddress).toLowerCase();
    const hasHKIsland = hkIslandKeywords.some(kw => fullAddress.includes(kw));
    
    if (category === 'crossBorder') {
      if (hasHKIsland && destination !== '港島') setDestination('港島');
    } else if (category === 'local') {
      setIsCrossSea(hasHKIsland);
    }
  }, [pickupAddress, dropoffAddress, category, destination]);

  const handleCategoryChange = (e) => {
    const newCategory = e.target.value;
    setCategory(newCategory);
    if (newCategory === 'local') setRouteKey('九龍-同區');
    if (newCategory === 'crossBorder') setRouteKey('深圳 (南山/福田/羅湖)');
  };

  const baseResult = calculatePrice({
    category, routeKey, destination, time, isCrossSea, hours: parseInt(hours, 10), isRemote
  });

  const finalRmbTotal = baseResult.total + globalMarkup;
  const finalRmbDeposit = Math.round(finalRmbTotal * 0.5);

  const rate = pricingData.settings.exchangeRates[currency];
  const symbol = pricingData.settings.currencySymbols[currency];
  const displayTotal = Math.round(finalRmbTotal * rate);
  const displayDeposit = Math.round(finalRmbDeposit * rate);

  const handleSubmit = async () => {
    if (!date) return alert("請選擇用車日期！");
    
    // 👇 升級：確保兩個地址都有填寫
    if (!pickupAddress.trim() || !dropoffAddress.trim()) {
      return alert("請填齊詳細的「上車地址」及「落車地址」！");
    }
    
    // 🛡️ 防偷雞攔截系統
    if (category === 'crossBorder') {
      const fullAddressToCheck = pickupAddress + ' ' + dropoffAddress;
      
      if (routeKey.includes('深圳')) {
        const otherCities = ['廣州', '番禺', '東莞', '中山', '佛山', '珠海', '惠州', '澳門'];
        const foundCity = otherCities.find(kw => fullAddressToCheck.includes(kw));
        if (foundCity) {
          return alert(`⚠️ 系統偵測到你的地址位於「${foundCity}」，與所選的「深圳」路線不符！\n請於上方選擇正確的城市路線。`);
        }
      }

      if (!routeKey.includes('機場') && ['機場', '寶安', '白雲', 'T1', 'T2', '航站'].some(kw => fullAddressToCheck.includes(kw))) {
        if (!window.confirm(`⚠️ 系統偵測到你的地址包含「機場」相關字眼。\n請確認是否需要接送機服務？\n(如不是去機場，請按「確定」繼續；否則請按「取消」並更改路線)`)) {
          return;
        }
      }
    }

    if (!receiptFile) return alert("麻煩請先上傳入數紙或截圖！");
    
    setIsSubmitting(true);

    try {
      const fileName = `receipts/${Date.now()}_${receiptFile.name}`;
      const storageRef = ref(storage, fileName);
      const snapshot = await uploadBytes(storageRef, receiptFile);
      const downloadURL = await getDownloadURL(snapshot.ref);

      const orderData = {
        salesCode: salesCode.toUpperCase() || '無',
        category: category,
        routeDetail: category === 'charter' ? `包車 ${hours} 小時 (偏遠: ${isRemote})` : `${routeKey} -> ${destination} (過海自動偵測: ${isCrossSea || destination === '港島'})`,
        date: date, 
        time: time,
        
        // 👇 升級：將兩個地址合併成一個字串儲存，後台同微信完全唔使改 Code 就食得落！
        detailedAddress: `${pickupAddress} ➡️ ${dropoffAddress}`,
        
        luggageCount: parseInt(luggageCount, 10) || 0,
        remarks: remarks || '無',
        currency: currency,
        markup: globalMarkup,
        paymentMethod: paymentMethod,
        totalAmount: displayTotal,
        depositAmount: displayDeposit,
        receiptUrl: downloadURL,
        status: '🔴 老闆處理中',
        isBalancePaid: false,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, "orders"), orderData);
      alert("✅ 成功落單！老闆會盡快確認並派車。");
      window.location.reload(); 
    } catch (error) {
      console.error("落單失敗: ", error);
      alert("落單失敗，請聯絡客服。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '500px', margin: '40px auto', padding: '20px', fontFamily: 'Arial, sans-serif', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', borderRadius: '12px', backgroundColor: '#fff' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#333' }}>🚗 三地通落單</h2>
        <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #1976d2', background: '#e3f2fd', color: '#1976d2', fontWeight: 'bold', cursor: 'pointer' }}>
          <option value="RMB">🇨🇳 RMB (¥)</option>
          <option value="HKD">🇭🇰 HKD (HK$)</option>
          <option value="MOP">🇲🇴 MOP (MOP$)</option>
        </select>
      </div>
      
      <div style={{ marginBottom: '15px' }}>
        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>推薦碼 (Sales Code): </label>
        <input type="text" placeholder="例如 A01 (非必填)" value={salesCode} onChange={(e) => setSalesCode(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box', textTransform: 'uppercase' }} />
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

      <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        {category === 'charter' ? (
          <>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>包車時數: </label>
            <input type="number" min="3" value={hours} onChange={(e) => setHours(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '15px', boxSizing: 'border-box' }} />
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={isRemote} onChange={(e) => setIsRemote(e.target.checked)} style={{ marginRight: '8px', width: '18px', height: '18px' }} />
              含偏遠地區 (+1小時)
            </label>
          </>
        ) : (
          <>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>選擇路線: </label>
            <select value={routeKey} onChange={(e) => setRouteKey(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '15px', boxSizing: 'border-box' }}>
              {Object.keys(pricingData[category]).map(key => (
                <option key={key} value={key}>{key}</option>
              ))}
            </select>
            {category === 'crossBorder' && !routeKey.includes('珠海') && !routeKey.includes('澳門') && (
              <>
                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>香港目的地: </label>
                <select value={destination} onChange={(e) => setDestination(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '15px', boxSizing: 'border-box' }}>
                  <option value="九龍">九龍 / 新界</option>
                  <option value="港島">香港島 (+¥100)</option>
                </select>
              </>
            )}
            
            {(isCrossSea || destination === '港島') && (category !== 'charter') && (
               <div style={{ color: '#d32f2f', fontSize: '14px', marginTop: '10px', fontWeight: 'bold' }}>
                 *系統偵測到地址位於過海範圍，已自動加上過海附加費 (+¥100)
               </div>
            )}
          </>
        )}
      </div>

      {/* 👇 升級：將地址分拆為上下兩格 */}
      <div style={{ marginBottom: '15px', background: '#fffde7', padding: '15px', borderRadius: '8px', border: '1px solid #fff59d' }}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', color: '#f57f17' }}>📍 詳細上車地址: <span style={{color:'red'}}>*</span></label>
          <input type="text" placeholder="例如：深圳南山區萬象天地" value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', color: '#f57f17' }}>🏁 詳細落車地址: <span style={{color:'red'}}>*</span></label>
          <input type="text" placeholder="例如：香港沙田第一城12座" value={dropoffAddress} onChange={(e) => setDropoffAddress(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>用車日期: <span style={{color:'red'}}>*</span></label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>用車時間: <span style={{color:'red'}}>*</span></label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
        </div>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>行李數量:</label>
        <input type="number" min="0" value={luggageCount} onChange={(e) => setLuggageCount(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>備註 (Note):</label>
        <textarea placeholder="例如：需要BB車、自備輪椅、帶寵物..." value={remarks} onChange={(e) => setRemarks(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box', minHeight: '80px', resize: 'vertical' }} />
      </div>

      <hr style={{ border: '0.5px solid #eee', margin: '20px 0' }} />
      
      <div style={{ background: '#e8f5e9', borderLeft: '5px solid #4caf50', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#2e7d32' }}>應付總額: {symbol} {displayTotal}</h3>
        <h3 style={{ margin: 0, color: '#d32f2f' }}>✅ 需付 50% 訂金: {symbol} {displayDeposit}</h3>
      </div>

      <div style={{ background: '#e3f2fd', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #64b5f6' }}>
        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '10px', color: '#1565c0' }}>💳 付款方式:</label>
        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box', marginBottom: '15px', fontSize: '16px', background: '#f5f5f5' }}>
          <option value="AlipayCN">🇨🇳 內地支付寶 (Alipay)</option>
        </select>

        <div style={{ padding: '15px', background: '#fff', borderRadius: '6px', border: '1px dashed #64b5f6', textAlign: 'center' }}>
          {paymentMethod === 'AlipayCN' && (
            <div>
              <p style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 'bold' }}>戶口名稱: YY (**宜)</p>
              <img src="/alipay.jpg" alt="支付寶 QR Code" style={{ width: '220px', maxWidth: '100%', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
              <p style={{ margin: '15px 0 0 0', fontSize: '15px', color: '#d32f2f', fontWeight: 'bold' }}>
                *請掃描上方 QR Code，轉帳 <span style={{ fontSize: '18px' }}>¥ {finalRmbDeposit}</span> 人民幣，並截圖上傳。
              </p>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>上傳付款截圖: <span style={{color:'red'}}>*</span></label>
        <input type="file" accept="image/*" onChange={(e) => setReceiptFile(e.target.files[0])} style={{ width: '100%', padding: '10px', border: '1px dashed #1976d2', borderRadius: '6px', background: '#f5f5f5' }} />
      </div>
      
      <button onClick={handleSubmit} disabled={isSubmitting} style={{ width: '100%', padding: '15px', fontSize: '18px', fontWeight: 'bold', background: isSubmitting ? '#ccc' : '#1976d2', color: '#fff', border: 'none', borderRadius: '8px', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
        {isSubmitting ? '上傳及發送訂單中...' : '確認並提交訂單'}
      </button>
    </div>
  );
}

export default App;