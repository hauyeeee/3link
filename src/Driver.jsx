// src/Driver.jsx
import React, { useState } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';

function Driver() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [partnerOrders, setPartnerOrders] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const handleLogin = async () => {
    if (!loginId || !password) return alert("請輸入登入名稱及密碼！");

    setIsLoading(true);
    try {
      // 1. 驗證司機/晴晴密碼
      const driverDoc = await getDoc(doc(db, "drivers", loginId));
      if (!driverDoc.exists() || driverDoc.data().password !== password) {
        setIsLoading(false);
        return alert("❌ 密碼錯誤 或 查無此人！");
      }

      // 2. 搵出派咗畀佢嘅單 (根據 partnerId)
      const qOrders = query(collection(db, "orders"), where("partnerId", "==", loginId));
      const snapshotOrders = await getDocs(qOrders);
      const orders = snapshotOrders.docs.map(d => ({ id: d.id, ...d.data() }));
      orders.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      
      // 3. 搵提現紀錄
      const qWithdraw = query(collection(db, "withdrawals"), where("userId", "==", loginId));
      const snapshotWithdraw = await getDocs(qWithdraw);
      const withdrawData = snapshotWithdraw.docs.map(d => ({ id: d.id, ...d.data() }));
      
      setPartnerOrders(orders);
      setWithdrawals(withdrawData);
      setIsLoggedIn(true);
    } catch (error) {
      alert("查詢失敗，請檢查網絡。");
    } finally {
      setIsLoading(false);
    }
  };

  // 👇 計糧：讀取 Admin 派單時計好嘅 partnerEarnings
  const totalEarnings = partnerOrders.reduce((sum, order) => sum + (order.partnerEarnings || 0), 0);
  const totalWithdrawn = withdrawals.reduce((sum, w) => sum + w.amount, 0);
  const availableBalance = totalEarnings - totalWithdrawn;

  const handleWithdraw = async () => {
    if (availableBalance < 500) return alert("❌ 餘額必須滿 ¥500 才可提現！");
    if (!window.confirm(`確定要提現結算 ¥${availableBalance} 嗎？`)) return;
    
    setIsWithdrawing(true);
    try {
      await addDoc(collection(db, "withdrawals"), {
        userId: loginId,
        role: loginId === 'QINGQING' ? '晴晴 (外判)' : '車隊司機',
        amount: availableBalance,
        status: '⏳ 處理中',
        createdAt: serverTimestamp()
      });
      alert("✅ 結算申請已提交給老闆！");
      handleLogin(); // 刷新
    } catch (e) { alert("提交失敗"); } finally { setIsWithdrawing(false); }
  };

  if (!isLoggedIn) {
    return (
      <div style={{ maxWidth: '400px', margin: '40px auto', padding: '20px', fontFamily: 'Arial, sans-serif', background: '#f5f5f5', borderRadius: '8px' }}>
        <h2 style={{ color: '#4caf50', textAlign: 'center' }}>🚕 車隊及合作夥伴系統</h2>
        <input type="text" placeholder="登入名稱 (例如: 榮哥 / QINGQING)" value={loginId} onChange={e=>setLoginId(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '10px', boxSizing: 'border-box' }} />
        <input type="password" placeholder="密碼" value={password} onChange={e=>setPassword(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '20px', boxSizing: 'border-box' }} />
        <button onClick={handleLogin} disabled={isLoading} style={{ width: '100%', padding: '15px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>{isLoading ? '登入中...' : '登入查看派單'}</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2 style={{ color: '#4caf50', borderBottom: '2px solid #4caf50', paddingBottom: '10px' }}>🚕 司機 / 合作夥伴中心 ({loginId})</h2>
      
      <div style={{ background: '#e8f5e9', padding: '20px', borderRadius: '8px', border: '1px solid #4caf50', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#2e7d32' }}>💰 你的結算戶口</h3>
        <p>歷史總接單收入：¥ {totalEarnings}</p>
        <p>已結算 / 提現中：¥ {totalWithdrawn}</p>
        <hr />
        <h2 style={{ color: '#d32f2f' }}>可結算餘額：¥ {availableBalance}</h2>
        <button onClick={handleWithdraw} disabled={isWithdrawing || availableBalance < 500} style={{ width: '100%', padding: '12px', background: availableBalance >= 500 ? '#1976d2' : '#ccc', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>
          {isWithdrawing ? '處理中...' : availableBalance >= 500 ? '申請結算款項' : '未滿 ¥500 無法結算'}
        </button>
      </div>

      <h3>📋 你的派單紀錄：</h3>
      {partnerOrders.map(order => (
        <div key={order.id} style={{ border: '1px solid #eee', padding: '15px', borderRadius: '6px', marginBottom: '10px', background: '#fafafa', borderLeft: '5px solid #1976d2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <strong>{order.routeDetail}</strong>
            <span style={{ color: 'green', fontWeight: 'bold' }}>賺 ¥{order.partnerEarnings}</span>
          </div>
          <p style={{ margin: '5px 0' }}>📍 地址：{order.detailedAddress}</p>
          <p style={{ margin: '5px 0' }}>📅 時間：{order.date} {order.time}</p>
          <p style={{ margin: '5px 0' }}>📝 備註：{order.remarks}</p>
        </div>
      ))}
    </div>
  );
}

export default Driver;