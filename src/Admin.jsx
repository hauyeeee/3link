// src/Admin.jsx
import React, { useState, useEffect } from 'react';
import { db, storage } from './firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, getDoc, setDoc, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// 👇 將你舊有嘅路線檔案重新連接近來，準備幫佢搬家！
import { pricingData } from './pricingData'; 

function Admin() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const ADMIN_SECRET = "888888"; 

  const [activeTab, setActiveTab] = useState('orders'); 
  
  const [orders, setOrders] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [salesUsers, setSalesUsers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [markup, setMarkup] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const [newSalesCode, setNewSalesCode] = useState('');
  const [newSalesPwd, setNewSalesPwd] = useState('');
  const [newSalesCommission, setNewSalesCommission] = useState('20'); 

  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverPwd, setNewDriverPwd] = useState('');
  
  const [selectedDriverForOrder, setSelectedDriverForOrder] = useState({});
  const [balanceFiles, setBalanceFiles] = useState({});
  const [isUploadingBalance, setIsUploadingBalance] = useState(false);
  const [customFees, setCustomFees] = useState({});

  const [routePrices, setRoutePrices] = useState({ crossBorder: {}, local: {} });
  const [newRouteCategory, setNewRouteCategory] = useState('crossBorder');
  const [newRouteName, setNewRouteName] = useState('');
  const [newRoutePrice, setNewRoutePrice] = useState('');

  const handleLogin = () => {
    if (passwordInput === ADMIN_SECRET) {
      setIsLoggedIn(true);
    } else { 
      alert("❌ 密碼錯誤！這不是你能進來的地方。"); 
      setPasswordInput(''); 
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return; 

    const unsubOrders = onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), snap => {
      setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubWithdraw = onSnapshot(query(collection(db, "withdrawals"), orderBy("createdAt", "desc")), snap => {
      setWithdrawals(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubSales = onSnapshot(collection(db, "sales_users"), snap => {
      setSalesUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubDrivers = onSnapshot(collection(db, "drivers"), snap => {
      setDrivers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    
    getDoc(doc(db, "settings", "pricing")).then(snap => { 
      if (snap.exists()) setMarkup(snap.data().markup || 0); 
    });

    getDoc(doc(db, "settings", "routePrices")).then(snap => {
      if (snap.exists()) {
        setRoutePrices(snap.data());
      }
    });

    return () => { unsubOrders(); unsubWithdraw(); unsubSales(); unsubDrivers(); };
  }, [isLoggedIn]);

  // 👇 救命魔法：一鍵搬家功能
  const handleImportOldRoutes = async () => {
    if (!window.confirm("⚠️ 確定要將舊有 pricingData 的所有路線匯入雲端嗎？")) return;
    setIsSaving(true);
    try {
      const migratedData = {
        crossBorder: pricingData.crossBorder || {},
        local: pricingData.local || {}
      };
      await setDoc(doc(db, "settings", "routePrices"), migratedData);
      setRoutePrices(migratedData);
      alert("✅ 恭喜老闆！舊路線已全數完美復活並上傳雲端！客人落單頁面已經恢復正常！");
    } catch (e) {
      alert("匯入失敗: " + e.message);
    }
    setIsSaving(false);
  };

  const handleAddRoute = async () => {
    if (!newRouteName || !newRoutePrice) return alert("請填寫路線名稱及價錢！");
    const updatedRoutes = { ...routePrices };
    if (!updatedRoutes[newRouteCategory]) updatedRoutes[newRouteCategory] = {};
    updatedRoutes[newRouteCategory][newRouteName] = Number(newRoutePrice);
    
    setRoutePrices(updatedRoutes);
    await setDoc(doc(db, "settings", "routePrices"), updatedRoutes);
    setNewRouteName(''); setNewRoutePrice('');
    alert("✅ 成功加入新路線！");
  };

  const handleDeleteRoute = async (category, routeName) => {
    if (!window.confirm(`⚠️ 確定要刪除路線：${routeName}？`)) return;
    const updatedRoutes = { ...routePrices };
    delete updatedRoutes[category][routeName]; 
    setRoutePrices(updatedRoutes);
    await setDoc(doc(db, "settings", "routePrices"), updatedRoutes);
  };

  const handleSaveMarkup = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, "settings", "pricing"), { markup: Number(markup) });
      alert(`✅ 成功！客人依家落單會自動加 ¥${markup}！`);
    } catch (e) { alert("儲存失敗"); }
    setIsSaving(false);
  };

  const handleAddSales = async () => {
    if(!newSalesCode || !newSalesPwd) return alert("填齊 Code 同密碼先！");
    await setDoc(doc(db, "sales_users", newSalesCode.toUpperCase()), { password: newSalesPwd, commissionRate: Number(newSalesCommission) || 20 });
    setNewSalesCode(''); setNewSalesPwd(''); setNewSalesCommission('20'); alert("✅ 成功加入新 Sales！");
  };

  const handleAddDriver = async () => {
    if(!newDriverName || !newDriverPwd) return alert("填齊司機名同密碼！");
    await setDoc(doc(db, "drivers", newDriverName), { name: newDriverName, password: newDriverPwd });
    setNewDriverName(''); setNewDriverPwd(''); alert("✅ 成功加入新司機 / 合作夥伴！");
  };

  const handleApproveWithdrawal = async (wId) => {
    await updateDoc(doc(db, "withdrawals", wId), { status: '✅ 已打款' });
    alert("已標記為已打款！");
  };

  const handleFeeChange = (orderId, field, value) => {
    const current = customFees[orderId] || {};
    setCustomFees({ ...customFees, [orderId]: { ...current, [field]: Number(value) } });
  };

  const handleAssignDriver = async (order, feeState) => {
    const driverName = selectedDriverForOrder[order.id] || "老闆親自出馬";
    let driverEarnings = 0;
    if (driverName !== "老闆親自出馬") driverEarnings = (order.baseRmbPrice || 0) - feeState.driverFee; 
    await updateDoc(doc(db, "orders", order.id), { status: `✅ 內部派單 (${driverName})`, partnerId: driverName, partnerEarnings: driverEarnings, salesCommission: feeState.salesComm, platformFeeDeducted: feeState.driverFee });
    alert(`已經將張單派畀：${driverName}！`);
  };

  const handleSendToQingQing = async (order, feeState) => {
    const qingQingEarnings = (order.baseRmbPrice || 0) - feeState.qingqingFee - feeState.salesComm;
    const SEND_KEY = "呢度填方糖SendKey"; 
    const desp = `### 新單！\n- **路線:** ${order.routeDetail}\n- **詳細地址:** ${order.detailedAddress || '未提供'}\n- **用車時間:** ${order.date || '未註明'} ${order.time}\n- **車型及人數:** ${order.requireEightSeater ? '8人大車' : '標準6人車'} (${order.passengerCount || 1} 人)\n- **行李:** ${order.luggageCount || 0} 件\n- **備註:** ${order.remarks || '無'}\n\n- **結算畀你嘅錢 (淨肉):** ¥${qingQingEarnings}`;
    try {
      await fetch(`https://sctapi.ftqq.com/${SEND_KEY}.send`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ title: `🚗 派單: ${order.routeDetail}`, desp: desp }) });
      await updateDoc(doc(db, "orders", order.id), { status: '📤 外判給晴晴', partnerId: 'QINGQING', partnerEarnings: qingQingEarnings, salesCommission: feeState.salesComm, platformFeeDeducted: feeState.qingqingFee });
      alert(`✅ 成功派畀晴晴！`);
    } catch (e) { alert("發送失敗！"); }
  };

  const handleCancelOrder = async (orderId) => {
    if (window.confirm("⚠️ 確定要取消呢張單？")) await updateDoc(doc(db, "orders", orderId), { status: '❌ 已取消' });
  };

  const handleSettleBalance = async (orderId) => {
    const file = balanceFiles[orderId];
    if (!file) return alert("⚠️ 請先選擇尾數入數紙 / 轉帳截圖！");
    setIsUploadingBalance(true);
    try {
      const fileName = `balance_receipts/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, fileName);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      await updateDoc(doc(db, "orders", orderId), { isBalancePaid: true, balanceReceiptUrl: downloadURL });
      alert("✅ 尾數紀錄已更新！");
      setBalanceFiles(prev => ({...prev, [orderId]: null}));
    } catch (error) { alert("上傳失敗，請重試！"); } finally { setIsUploadingBalance(false); }
  };

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const thisMonthOrders = orders.filter(order => !order.status.includes('取消') && order.createdAt?.toDate().getMonth() === currentMonth && order.createdAt?.toDate().getFullYear() === currentYear);
  const thisMonthRevenue = thisMonthOrders.reduce((sum, order) => {
    const rate = order.currency === 'HKD' ? 1.08 : (order.currency === 'MOP' ? 1.11 : 1);
    return sum + Math.round((order.totalAmount || 0) / rate);
  }, 0);
  const salesCommissionMap = {};
  salesUsers.forEach(u => { salesCommissionMap[u.id] = u.commissionRate || 20; });
  const thisMonthCommissionOrders = thisMonthOrders.filter(o => o.salesCode && o.salesCode !== '無');
  let thisMonthTotalCommission = 0;
  const salesLeaderboard = {};
  thisMonthCommissionOrders.forEach(o => {
    const rate = o.salesCommission !== undefined ? o.salesCommission : (salesCommissionMap[o.salesCode] || 20);
    thisMonthTotalCommission += rate;
    if (!salesLeaderboard[o.salesCode]) salesLeaderboard[o.salesCode] = { count: 0, earnings: 0 };
    salesLeaderboard[o.salesCode].count += 1;
    salesLeaderboard[o.salesCode].earnings += rate;
  });
  const sortedSales = Object.entries(salesLeaderboard).sort((a, b) => b[1].count - a[1].count);

  if (!isLoggedIn) {
    return (
      <div style={{ maxWidth: '400px', margin: '100px auto', padding: '30px', fontFamily: 'Arial, sans-serif', background: '#fff', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', textAlign: 'center' }}>
        <h2 style={{ color: '#d32f2f', margin: '0 0 10px 0' }}>🔒 最高指揮中心</h2>
        <input type="password" placeholder="請輸入系統管理員密碼" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box', marginBottom: '20px', fontSize: '16px', textAlign: 'center', letterSpacing: '3px' }} />
        <button onClick={handleLogin} style={{ width: '100%', padding: '15px', background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>進入系統</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '30px auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ color: '#1976d2', margin: 0 }}>👨‍💼 三地通 - 老闆最高指揮中心</h2>
        <button onClick={() => setIsLoggedIn(false)} style={{ padding: '8px 15px', background: '#f5f5f5', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}>登出</button>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', flexWrap: 'wrap' }}>
        <button onClick={() => setActiveTab('orders')} style={{ flex: '1 1 20%', padding: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '8px', border: 'none', background: activeTab === 'orders' ? '#1976d2' : '#e0e0e0', color: activeTab === 'orders' ? 'white' : '#333' }}>📝 派單與操作</button>
        <button onClick={() => setActiveTab('routes')} style={{ flex: '1 1 20%', padding: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '8px', border: 'none', background: activeTab === 'routes' ? '#9c27b0' : '#e0e0e0', color: activeTab === 'routes' ? 'white' : '#333' }}>🗺️ 路線與定價</button>
        <button onClick={() => setActiveTab('hr')} style={{ flex: '1 1 20%', padding: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '8px', border: 'none', background: activeTab === 'hr' ? '#1976d2' : '#e0e0e0', color: activeTab === 'hr' ? 'white' : '#333' }}>⚙️ 人事與財務</button>
        <button onClick={() => setActiveTab('dashboard')} style={{ flex: '1 1 20%', padding: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '8px', border: 'none', background: activeTab === 'dashboard' ? '#1976d2' : '#e0e0e0', color: activeTab === 'dashboard' ? 'white' : '#333' }}>📊 生意大數據</button>
      </div>

      {activeTab === 'routes' && (
        <div>
          <div style={{ background: '#f3e5f5', padding: '20px', borderRadius: '8px', border: '1px solid #ce93d8', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: '#7b1fa2' }}>➕ 新增路線定價</h3>
              {/* 👇 呢個就係救命按鈕！ */}
              <button 
                onClick={handleImportOldRoutes} 
                disabled={isSaving}
                style={{ padding: '8px 15px', background: '#ff9800', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
              >
                {isSaving ? '匯入中...' : '📥 一鍵還原舊有路線'}
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <select value={newRouteCategory} onChange={(e) => setNewRouteCategory(e.target.value)} style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}>
                <option value="crossBorder">🌍 跨境接送</option>
                <option value="local">🇭🇰 本地接送</option>
              </select>
              <input type="text" placeholder="路線名稱 (如: 深圳機場)" value={newRouteName} onChange={(e) => setNewRouteName(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} />
              <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #ccc', borderRadius: '4px', padding: '0 10px' }}>
                <span style={{ color: '#666', fontWeight: 'bold' }}>¥</span>
                <input type="number" placeholder="底價" value={newRoutePrice} onChange={(e) => setNewRoutePrice(e.target.value)} style={{ padding: '10px 5px', border: 'none', outline: 'none', width: '80px' }} />
              </div>
              <button onClick={handleAddRoute} style={{ padding: '10px 20px', background: '#9c27b0', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>新增</button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#1976d2' }}>🌍 跨境接送 (目前定價)</h3>
              {Object.keys(routePrices.crossBorder || {}).length === 0 && <p style={{color: '#999'}}>請點擊右上角「一鍵還原舊有路線」</p>}
              {Object.entries(routePrices.crossBorder || {}).map(([name, price]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #eee', alignItems: 'center' }}>
                  <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{name}</span>
                  <div>
                    <span style={{ color: 'green', fontWeight: 'bold', marginRight: '15px' }}>¥ {price}</span>
                    <button onClick={() => handleDeleteRoute('crossBorder', name)} style={{ background: 'none', border: 'none', color: '#d32f2f', cursor: 'pointer', fontWeight: 'bold' }}>刪除</button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ flex: 1, background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#1976d2' }}>🇭🇰 本地接送 (目前定價)</h3>
              {Object.keys(routePrices.local || {}).length === 0 && <p style={{color: '#999'}}>請點擊右上角「一鍵還原舊有路線」</p>}
              {Object.entries(routePrices.local || {}).map(([name, price]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #eee', alignItems: 'center' }}>
                  <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{name}</span>
                  <div>
                    <span style={{ color: 'green', fontWeight: 'bold', marginRight: '15px' }}>¥ {price}</span>
                    <button onClick={() => handleDeleteRoute('local', name)} style={{ background: 'none', border: 'none', color: '#d32f2f', cursor: 'pointer', fontWeight: 'bold' }}>刪除</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div>
          <div style={{ background: '#e3f2fd', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #1976d2' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#1976d2' }}>⚙️ 價格操控 (全局加價)</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <label>每張單在底價上增加：¥</label>
              <input type="number" value={markup} onChange={(e) => setMarkup(e.target.value)} style={{ padding: '8px', width: '100px', borderRadius: '4px', border: '1px solid #ccc', fontWeight: 'bold' }} />
              <button onClick={handleSaveMarkup} disabled={isSaving} style={{ padding: '8px 15px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>儲存生效</button>
            </div>
          </div>

          <h3 style={{ borderBottom: '2px solid #ccc', paddingBottom: '10px' }}>📥 訂單調度與追數中心</h3>
          {orders.map(order => {
            const balance = order.totalAmount - order.depositAmount;
            const isCancelled = order.status.includes('取消');
            const bgColor = isCancelled ? '#f5f5f5' : (order.status.includes('內部') ? '#e8f5e9' : (order.status.includes('晴晴') ? '#fff3e0' : '#fff'));
            
            let defaultSalesComm = 0;
            if (order.salesCode && order.salesCode !== '無') {
              const salesUser = salesUsers.find(u => u.id === order.salesCode);
              defaultSalesComm = salesUser ? (salesUser.commissionRate || 20) : 20;
            }

            const feeState = {
              driverFee: customFees[order.id]?.driverFee ?? 100,
              qingqingFee: customFees[order.id]?.qingqingFee ?? 50,
              salesComm: customFees[order.id]?.salesComm ?? defaultSalesComm
            };

            return (
              <div key={order.id} style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '15px', marginBottom: '15px', background: bgColor, opacity: isCancelled ? 0.7 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <strong style={{ fontSize: '18px', textDecoration: isCancelled ? 'line-through' : 'none' }}>{order.routeDetail}</strong>
                  <span style={{ background: isCancelled ? '#9e9e9e' : '#333', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '14px' }}>{order.status}</span>
                </div>
                
                <div style={{ background: '#f0f8ff', padding: '10px', borderRadius: '6px', marginBottom: '10px', borderLeft: '4px solid #1976d2' }}>
                  <p style={{ margin: '0 0 5px 0', fontSize: '15px' }}>📍 <strong>詳細地址：</strong>{order.detailedAddress || '未填寫'}</p>
                  <p style={{ margin: '0 0 5px 0' }}>📅 <strong>用車時間：</strong>{order.date || '未註明'} {order.time}</p>
                  <p style={{ margin: '0 0 5px 0' }}>🧑‍🤝‍🧑 <strong>人數及車型：</strong>{order.passengerCount || 1} 人 ({order.requireEightSeater ? '8人大車' : '標準6人車'})</p>
                  <p style={{ margin: '0 0 5px 0' }}>🧳 <strong>行李：</strong>{order.luggageCount || 0} 件</p>
                  {order.remarks && order.remarks !== '無' && <p style={{ margin: '0', color: '#e65100' }}>📝 <strong>備註：</strong>{order.remarks}</p>}
                </div>

                <p style={{ margin: '5px 0' }}>👤 Sales: {order.salesCode} | 💳 支付: {order.paymentMethod}</p>
                
                <div style={{ background: isCancelled ? '#eee' : '#fff9c4', padding: '10px', borderRadius: '6px', margin: '10px 0', border: '1px dashed #fbc02d' }}>
                  <p style={{ margin: '0 0 5px 0' }}>總面價：<strong>{order.currency} {order.totalAmount}</strong> (已收訂金: {order.depositAmount})</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h4 style={{ margin: 0, color: '#d32f2f' }}>⚠️ 應收尾數：{order.currency} {balance}</h4>
                    {order.isBalancePaid ? <span style={{ background: '#4caf50', color: 'white', padding: '3px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>✅ 已收齊尾數</span> : (!isCancelled && <span style={{ background: '#f44336', color: 'white', padding: '3px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>未收尾數</span>)}
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <a href={order.receiptUrl} target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: '#1976d2', textDecoration: 'underline' }}>🔗 查看訂金入數紙</a>
                    {order.balanceReceiptUrl && <a href={order.balanceReceiptUrl} target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: '#2e7d32', textDecoration: 'underline' }}>🔗 查看尾數入數紙</a>}
                  </div>
                </div>
                
                {order.status === '🔴 老闆處理中' && !isCancelled && (
                  <div style={{ background: '#fff3e0', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #ffcc80' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#e65100' }}>⚙️ 派單結算調整</h4>
                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '15px' }}>
                      <label style={{ fontSize: '13px', display: 'flex', flexDirection: 'column' }}>內部扣費 (¥):<input type="number" value={feeState.driverFee} onChange={e => handleFeeChange(order.id, 'driverFee', e.target.value)} style={{ padding: '6px', marginTop: '4px', border: '1px solid #ccc', borderRadius: '4px' }} /></label>
                      <label style={{ fontSize: '13px', display: 'flex', flexDirection: 'column' }}>晴晴扣費 (¥):<input type="number" value={feeState.qingqingFee} onChange={e => handleFeeChange(order.id, 'qingqingFee', e.target.value)} style={{ padding: '6px', marginTop: '4px', border: '1px solid #ccc', borderRadius: '4px' }} /></label>
                      <label style={{ fontSize: '13px', display: 'flex', flexDirection: 'column' }}>Sales佣金 (¥):<input type="number" value={feeState.salesComm} disabled={order.salesCode === '無'} onChange={e => handleFeeChange(order.id, 'salesComm', e.target.value)} style={{ padding: '6px', marginTop: '4px', border: '1px solid #ccc', borderRadius: '4px', background: order.salesCode === '無' ? '#eee' : '#fff' }} /></label>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ display: 'flex', border: '1px solid #4caf50', borderRadius: '4px', overflow: 'hidden' }}>
                        <select onChange={(e) => setSelectedDriverForOrder({...selectedDriverForOrder, [order.id]: e.target.value})} style={{ padding: '8px', border: 'none', outline: 'none', background: '#e8f5e9' }}>
                          <option value="老闆親自出馬">老闆親自出馬</option>
                          {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        <button onClick={() => handleAssignDriver(order, feeState)} style={{ padding: '8px 15px', background: '#4caf50', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>🙋‍♂️ 內部接單</button>
                      </div>
                      <button onClick={() => handleSendToQingQing(order, feeState)} style={{ padding: '8px 15px', background: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>📲 派畀晴晴</button>
                    </div>
                  </div>
                )}
                
                <div style={{ marginTop: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}></div>
                  {!order.isBalancePaid && !isCancelled && order.status !== '🔴 老闆處理中' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#fff', padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}>
                      <input type="file" accept="image/*" onChange={(e) => setBalanceFiles({...balanceFiles, [order.id]: e.target.files[0]})} style={{ maxWidth: '180px', fontSize: '12px' }} />
                      <button onClick={() => handleSettleBalance(order.id)} disabled={isUploadingBalance} style={{ padding: '6px 12px', background: isUploadingBalance ? '#ccc' : '#1976d2', color: 'white', border: 'none', borderRadius: '4px', cursor: isUploadingBalance ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '12px' }}>{isUploadingBalance ? '上傳中...' : '提交尾數截圖'}</button>
                    </div>
                  )}
                  {!isCancelled && <button onClick={() => handleCancelOrder(order.id)} style={{ padding: '8px 15px', background: 'transparent', color: '#d32f2f', border: '1px solid #d32f2f', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>❌ 取消訂單</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'hr' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#fff9c4', padding: '20px', borderRadius: '8px', border: '1px solid #fbc02d' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#f57f17' }}>💸 提現申請審批</h3>
            {withdrawals.filter(w => w.status.includes('⏳')).map(w => (
              <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '10px' }}>
                <span><strong>{w.userId || w.salesCode}</strong> 提現：<strong style={{color: 'red'}}>¥{w.amount}</strong></span>
                <button onClick={() => handleApproveWithdrawal(w.id)} style={{ padding: '8px 15px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>✅ 確認已打款</button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, background: '#f5f5f5', padding: '20px', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 15px 0' }}>🧑‍💼 開設 Sales 帳號</h3>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '15px', flexWrap: 'wrap' }}>
                <input type="text" placeholder="Code" value={newSalesCode} onChange={e=>setNewSalesCode(e.target.value)} style={{ width: '28%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                <input type="text" placeholder="密碼" value={newSalesPwd} onChange={e=>setNewSalesPwd(e.target.value)} style={{ width: '28%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                <div style={{ display: 'flex', alignItems: 'center', width: '28%', background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}>
                  <span style={{ padding: '0 5px', color: '#666' }}>¥</span>
                  <input type="number" placeholder="預設佣金" value={newSalesCommission} onChange={e=>setNewSalesCommission(e.target.value)} style={{ width: '100%', padding: '8px', border: 'none', outline: 'none' }} />
                </div>
                <button onClick={handleAddSales} style={{ width: '10%', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', minWidth: '50px' }}>新增</button>
              </div>
            </div>
            <div style={{ flex: 1, background: '#f5f5f5', padding: '20px', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 15px 0' }}>🚕 開設 司機/晴晴 帳號</h3>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}>
                <input type="text" placeholder="登入名稱" value={newDriverName} onChange={e=>setNewDriverName(e.target.value)} style={{ width: '40%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                <input type="text" placeholder="登入密碼" value={newDriverPwd} onChange={e=>setNewDriverPwd(e.target.value)} style={{ width: '35%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                <button onClick={handleAddDriver} style={{ width: '20%', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>新增</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div>
          <h3 style={{ borderBottom: '2px solid #ccc', paddingBottom: '10px' }}>📅 本月實時戰況 ({currentMonth + 1}月)</h3>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '30px' }}>
            <div style={{ flex: '1 1 250px', background: '#e3f2fd', padding: '20px', borderRadius: '12px', border: '1px solid #90caf9' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#1565c0' }}>💰 本月總營業額 (折合人民幣)</p>
              <h2 style={{ margin: 0, color: '#1976d2', fontSize: '32px' }}>¥ {thisMonthRevenue}</h2>
            </div>
            <div style={{ flex: '1 1 250px', background: '#fff3e0', padding: '20px', borderRadius: '12px', border: '1px solid #ffcc80' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#e65100' }}>💸 本月應付佣金</p>
              <h2 style={{ margin: 0, color: '#f57c00', fontSize: '32px' }}>¥ {thisMonthTotalCommission}</h2>
            </div>
            <div style={{ flex: '1 1 250px', background: '#e8f5e9', padding: '20px', borderRadius: '12px', border: '1px solid #a5d6a7' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#2e7d32' }}>📈 本月扣佣後營收 (未扣車資)</p>
              <h2 style={{ margin: '0', color: '#4caf50', fontSize: '32px' }}>¥ {thisMonthRevenue - thisMonthTotalCommission}</h2>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;