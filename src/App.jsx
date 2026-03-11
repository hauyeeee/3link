// src/App.jsx
import React, { useState, useEffect } from 'react';
import { pricingData } from './pricingData';
import { calculatePrice } from './priceEngine';
import { db, storage } from './firebase';
import { collection, addDoc, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

import Admin from './Admin'; 
import Sales from './Sales';

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
  
  // 👇 預設並暫時只鎖定為 內地支付寶
  const [paymentMethod, setPaymentMethod] = useState('AlipayCN');

  const [detailedAddress, setDetailedAddress] = useState('');
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
    if (!detailedAddress.trim()) return alert("請填寫詳細上車/落車地址！");
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
        routeDetail: category === 'charter' ? `包車 ${hours} 小時 (偏遠: ${isRemote})` : `${routeKey} -> ${destination} (過海: ${isCrossSea})`,
        date: date, 
        time: time,
        detailedAddress: detailedAddress,
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
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={isCrossSea} onChange={(e) => setIsCrossSea(e.target.checked)} style={{ marginRight: '8px', width: '18px', height: '18px' }} />
              額外過海路線 (+¥100)
            </label>
          </>
        )}
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>詳細上車及落車地址: <span style={{color:'red'}}>*</span></label>
        <input type="text" placeholder="例如：深圳萬象天地 ➡️ 沙田第一城" value={detailedAddress} onChange={(e) => setDetailedAddress(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
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

      {/* 👇 支付寶 QR Code 顯示區 (其他選項已隱藏) */}
      <div style={{ background: '#e3f2fd', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #64b5f6' }}>
        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '10px', color: '#1565c0' }}>💳 付款方式:</label>
        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box', marginBottom: '15px', fontSize: '16px', background: '#f5f5f5' }}>
          <option value="AlipayCN">🇨🇳 內地支付寶 (Alipay)</option>
          {/* 👇 將來想重開，剷走呢兩行 Comment 符號就得 
          <option value="FPS">🇭🇰 轉數快 (FPS)</option>
          <option value="AlipayHK">🇭🇰 AlipayHK (香港本地支付寶)</option>
          <option value="MPay">🇲🇴 MPay (澳門錢包)</option>
          */}
        </select>

        <div style={{ padding: '15px', background: '#fff', borderRadius: '6px', border: '1px dashed #64b5f6', textAlign: 'center' }}>
          {paymentMethod === 'AlipayCN' && (
            <div>
              <p style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 'bold' }}>戶口名稱: YY (**宜)</p>
              
              {/* 顯示 public 資料夾入面嘅 alipay.jpg */}
              <img src="/alipay.jpg" alt="支付寶 QR Code" style={{ width: '220px', maxWidth: '100%', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
              
              {/* 提示客人準確嘅人民幣金額 */}
              <p style={{ margin: '15px 0 0 0', fontSize: '15px', color: '#d32f2f', fontWeight: 'bold' }}>
                *請掃描上方 QR Code，轉帳 <span style={{ fontSize: '18px' }}>¥ {finalRmbDeposit}</span> 人民幣，並截圖上傳。
              </p>
            </div>
          )}
          
          {/* 👇 其他隱藏咗嘅付款資料
          {paymentMethod === 'FPS' && <p style={{ margin: 0 }}>FPS ID: <strong>1234567</strong><br/>戶口名稱: <strong>3LINK COMPANY LTD</strong></p>}
          {paymentMethod === 'AlipayHK' && <p style={{ margin: 0 }}>電話: <strong>9876 5432</strong><br/>戶口名稱: <strong>* CHAN</strong></p>}
          {paymentMethod === 'MPay' && <p style={{ margin: 0 }}>電話: <strong>6666 8888</strong></p>}
          */}
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