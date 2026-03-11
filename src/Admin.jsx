// src/Admin.jsx
import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';

function Admin() {
  const [orders, setOrders] = useState([]);

  // 1. 實時監聽 Firebase 訂單
  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOrders(ordersData);
    });
    return () => unsubscribe();
  }, []);

  // 2. 老闆自己接單
  const handleTakeOrder = async (orderId) => {
    await updateDoc(doc(db, "orders", orderId), {
      status: '✅ 老闆自己做'
    });
  };

  // 3. 一鍵派畀晴晴 (透過 Server醬/方糖)
  const handleSendToQingQing = async (order) => {
    // ⚠️ 請將下面呢串換做晴晴嘅 Server醬 SendKey！
    const SEND_KEY = "SCT321029TCR1JlFNdwxfJQoZaLRHd0Rw8"; 
    
    const title = `🚗 新單: ${order.routeDetail}`;
    const desp = `
### 收到已付訂金新單！
- **路線:** ${order.routeDetail}
- **時間:** ${order.time}
- **已收訂金:** ${order.currency} ${order.depositAmount}
- **Sales Code:** ${order.salesCode}

晴晴請盡快安排司機！
    `;

    try {
      // 呼叫 Server醬 API 發送微信
      await fetch(`https://sctapi.ftqq.com/${SEND_KEY}.send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ title: title, desp: desp })
      });

      // 更新 Firebase 狀態
      await updateDoc(doc(db, "orders", order.id), {
        status: '📤 已發給晴晴'
      });
      
      alert("✅ 已經成功發送微信通知畀晴晴！");
    } catch (error) {
      console.error("發送失敗", error);
      alert("發送微信失敗，請檢查網絡或 SendKey！");
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2 style={{ color: '#1976d2', borderBottom: '2px solid #1976d2', paddingBottom: '10px' }}>
        👨‍💼 三地通 - 老闆調度中心
      </h2>
      
      {orders.length === 0 ? <p>暫時未有訂單...</p> : null}

      {orders.map(order => (
        <div key={order.id} style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '15px', marginBottom: '15px', background: order.status.includes('老闆') ? '#e8f5e9' : (order.status.includes('晴晴') ? '#fff3e0' : '#fff') }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <strong style={{ fontSize: '18px' }}>{order.routeDetail}</strong>
            <span style={{ background: '#333', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '14px' }}>
              {order.status}
            </span>
          </div>
          
          <p style={{ margin: '5px 0' }}>🕒 用車時間：<strong>{order.time}</strong></p>
          <p style={{ margin: '5px 0' }}>💰 應收訂金：<strong>{order.currency} {order.depositAmount}</strong> (總數 {order.totalAmount})</p>
          <p style={{ margin: '5px 0' }}>👤 Sales Code：{order.salesCode}</p>

          <div style={{ marginTop: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <a href={order.receiptUrl} target="_blank" rel="noreferrer" style={{ padding: '8px 15px', background: '#e0e0e0', textDecoration: 'none', color: '#333', borderRadius: '4px', fontWeight: 'bold' }}>
              🖼️ 查看入數紙
            </a>
            
            {order.status === '🔴 老闆處理中' && (
              <>
                <button onClick={() => handleTakeOrder(order.id)} style={{ padding: '8px 15px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                  🙋‍♂️ 好單！我自己接
                </button>
                <button onClick={() => handleSendToQingQing(order)} style={{ padding: '8px 15px', background: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                  📲 派畀晴晴搵車
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default Admin;