// src/Sales.jsx
import React, { useState } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';

function Sales() {
  const [inputCode, setInputCode] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [salesOrders, setSalesOrders] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const COMMISSION_PER_ORDER = 50;

  const handleSearch = async () => {
    const code = inputCode.toUpperCase();
    if (!code || !inputPassword) return alert("請輸入 Sales Code 同密碼！");

    setIsLoading(true);
    try {
      const userDoc = await getDoc(doc(db, "sales_users", code));
      if (!userDoc.exists() || userDoc.data().password !== inputPassword) {
        setIsLoading(false);
        return alert("❌ 密碼錯誤 或 查無此人！請聯絡老闆。");
      }

      const qOrders = query(collection(db, "orders"), where("salesCode", "==", code));
      const snapshotOrders = await getDocs(qOrders);
      const orders = snapshotOrders.docs.map(d => ({ id: d.id, ...d.data() }));
      orders.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      
      const qWithdraw = query(collection(db, "withdrawals"), where("salesCode", "==", code));
      const snapshotWithdraw = await getDocs(qWithdraw);
      const withdrawData = snapshotWithdraw.docs.map(d => ({ id: d.id, ...d.data() }));
      withdrawData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

      setSalesOrders(orders);
      setWithdrawals(withdrawData);
      setHasSearched(true);
    } catch (error) {
      alert("查詢失敗，請檢查網絡。");
    } finally {
      setIsLoading(false);
    }
  };

  const totalCommission = salesOrders.length * COMMISSION_PER_ORDER;
  const totalWithdrawn = withdrawals.reduce((sum, w) => sum + w.amount, 0);
  const availableBalance = totalCommission - totalWithdrawn;

  const handleWithdraw = async () => {
    if (availableBalance < 1000) return alert("❌ 餘額必須滿 ¥1000 才可提現！");
    if (!window.confirm(`確定要提現 ¥${availableBalance} 嗎？\n預計 3 個工作天內處理。`)) return;
    
    setIsWithdrawing(true);
    try {
      await addDoc(collection(db, "withdrawals"), {
        salesCode: inputCode.toUpperCase(),
        amount: availableBalance,
        status: '⏳ 處理中 (3個工作天)',
        createdAt: serverTimestamp()
      });
      alert("✅ 提現申請已提交！老闆會盡快處理。");
      handleSearch();
    } catch (e) {
      alert("提交失敗");
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2 style={{ color: '#ff9800', borderBottom: '2px solid #ff9800', paddingBottom: '10px' }}>
        🤝 合作夥伴查數與提現系統
      </h2>
      
      {!hasSearched ? (
        <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
            <label>Sales Code:</label>
            <input type="text" value={inputCode} onChange={(e) => setInputCode(e.target.value)} style={{ padding: '10px', fontSize: '16px', textTransform: 'uppercase' }} />
            <label>密碼 (PIN):</label>
            <input type="password" value={inputPassword} onChange={(e) => setInputPassword(e.target.value)} style={{ padding: '10px', fontSize: '16px' }} />
          </div>
          <button onClick={handleSearch} disabled={isLoading} style={{ width: '100%', padding: '12px', background: '#ff9800', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
            {isLoading ? '驗證中...' : '登入系統'}
          </button>
        </div>
      ) : (
        <>
          <div style={{ background: '#fff3e0', padding: '20px', borderRadius: '8px', border: '1px solid #ff9800', marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#e65100' }}>💰 財務總覽 ({inputCode.toUpperCase()})</h3>
            <p style={{ margin: '5px 0' }}>歷史總佣金：¥ {totalCommission}</p>
            <p style={{ margin: '5px 0' }}>已提現/處理中：¥ {totalWithdrawn}</p>
            <hr style={{ border: '0.5px solid #ffcc80' }}/>
            <h2 style={{ margin: '10px 0', color: '#d32f2f' }}>可提現餘額：¥ {availableBalance}</h2>
            
            <button onClick={handleWithdraw} disabled={isWithdrawing || availableBalance < 1000} style={{ width: '100%', padding: '12px', background: availableBalance >= 1000 ? '#4caf50' : '#ccc', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: availableBalance >= 1000 ? 'pointer' : 'not-allowed' }}>
              {isWithdrawing ? '提交中...' : availableBalance >= 1000 ? '申請提現 (全部)' : '未滿 ¥1000 無法提現'}
            </button>
            <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#666', textAlign: 'center' }}>*提現申請需時約 3 個工作天處理</p>
          </div>

          <h3 style={{ color: '#333' }}>📋 你的訂單紀錄：</h3>
          {salesOrders.length === 0 && <p style={{color: '#666'}}>尚無接單紀錄</p>}
          {salesOrders.map(order => (
            <div key={order.id} style={{ border: '1px solid #eee', padding: '15px', borderRadius: '6px', marginBottom: '10px', background: '#fafafa', borderLeft: '4px solid #4caf50' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong style={{ fontSize: '16px', textDecoration: order.status.includes('取消') ? 'line-through' : 'none' }}>{order.routeDetail}</strong>
                <span style={{ color: order.status.includes('取消') ? '#ccc' : 'green', fontWeight: 'bold' }}>+¥{order.status.includes('取消') ? '0' : COMMISSION_PER_ORDER}</span>
              </div>
              {/* 👇 Sales 版面都顯示返日期 */}
              <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '14px' }}>用車時間：{order.date || '未註明'} {order.time}</p>
              <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '14px' }}>
                狀態：<span style={{ color: order.status.includes('取消') ? '#999' : '#1976d2', fontWeight: 'bold' }}>{order.status}</span>
              </p>
            </div>
          ))}

          <h3 style={{ color: '#333', marginTop: '30px' }}>🧾 提現紀錄：</h3>
          {withdrawals.length === 0 && <p style={{color: '#666'}}>尚無提現紀錄</p>}
          {withdrawals.map(w => (
            <div key={w.id} style={{ border: '1px solid #eee', padding: '10px', borderRadius: '6px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
              <span>提現 ¥{w.amount}</span>
              <span style={{ color: w.status.includes('✅') ? 'green' : 'orange', fontWeight: 'bold' }}>{w.status}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default Sales;