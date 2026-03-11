// src/Admin.jsx
import React, { useState, useEffect } from 'react';
import { db, storage } from './firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, getDoc, setDoc, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function Admin() {
  const [activeTab, setActiveTab] = useState('orders'); 
  const [orders, setOrders] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [salesUsers, setSalesUsers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [markup, setMarkup] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const [newSalesCode, setNewSalesCode] = useState('');
  const [newSalesPwd, setNewSalesPwd] = useState('');
  const [newDriverName, setNewDriverName] = useState('');
  const [selectedDriverForOrder, setSelectedDriverForOrder] = useState({});
  const [balanceFiles, setBalanceFiles] = useState({});
  const [isUploadingBalance, setIsUploadingBalance] = useState(false);

  const COMMISSION_PER_ORDER = 50; 

  useEffect(() => {
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
    return () => { unsubOrders(); unsubWithdraw(); unsubSales(); unsubDrivers(); };
  }, []);

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
    await setDoc(doc(db, "sales_users", newSalesCode.toUpperCase()), { password: newSalesPwd });
    setNewSalesCode(''); setNewSalesPwd('');
    alert("✅ 成功加入新 Sales！");
  };

  const handleAddDriver = async () => {
    if(!newDriverName) return alert("填司機名！");
    await addDoc(collection(db, "drivers"), { name: newDriverName });
    setNewDriverName('');
    alert("✅ 成功加入新司機！");
  };

  const handleApproveWithdrawal = async (wId) => {
    await updateDoc(doc(db, "withdrawals", wId), { status: '✅ 已打款' });
    alert("已標記為已打款！");
  };

  const handleAssignDriver = async (orderId) => {
    const driverName = selectedDriverForOrder[orderId] || "老闆親自出馬";
    await updateDoc(doc(db, "orders", orderId), { status: `✅ 內部派單 (${driverName})` });
    alert(`已經將張單派畀：${driverName}！`);
  };

  const handleSendToQingQing = async (order) => {
    const SEND_KEY = "呢度填方糖SendKey"; 
    const qingQingDeposit = order.depositAmount - ((order.markup || 0) / 2);
    
    // 👇 加入人數同車型去 WeChat 通知
    const vehicleText = order.requireEightSeater ? '8人大車' : '標準6人車';
    const desp = `### 新單！\n- **路線:** ${order.routeDetail}\n- **詳細地址:** ${order.detailedAddress || '未提供'}\n- **用車時間:** ${order.date || '未註明'} ${order.time}\n- **車型及人數:** ${vehicleText} (${order.passengerCount || 1} 人)\n- **行李:** ${order.luggageCount || 0} 件\n- **備註:** ${order.remarks || '無'}\n\n- **已收訂金(底價):** ¥${qingQingDeposit}`;

    try {
      await fetch(`https://sctapi.ftqq.com/${SEND_KEY}.send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ title: `🚗 派單: ${order.routeDetail}`, desp: desp })
      });
      await updateDoc(doc(db, "orders", order.id), { status: '📤 外判給晴晴' });
      alert("✅ 成功派畀晴晴！");
    } catch (e) { alert("發送失敗！"); }
  };

  const handleCancelOrder = async (orderId) => {
    if (window.confirm("⚠️ 確定要取消呢張單？")) {
      await updateDoc(doc(db, "orders", orderId), { status: '❌ 已取消' });
    }
  };

  const handleSettleBalance = async (orderId) => {
    const file = balanceFiles[orderId];
    if (!file) return alert("⚠️ 請先選擇尾數入數紙 / 轉帳截圖！");
    if (!window.confirm("✅ 確定要上傳此截圖並確認收妥尾數？")) return;

    setIsUploadingBalance(true);
    try {
      const fileName = `balance_receipts/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, fileName);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      await updateDoc(doc(db, "orders", orderId), { isBalancePaid: true, balanceReceiptUrl: downloadURL });
      alert("✅ 尾數紀錄已更新並儲存截圖！");
      setBalanceFiles(prev => ({...prev, [orderId]: null}));
    } catch (error) {
      alert("上傳失敗，請重試！");
    } finally {
      setIsUploadingBalance(false);
    }
  };

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const thisMonthOrders = orders.filter(order => {
    if (!order.createdAt || order.status.includes('取消')) return false;
    const d = order.createdAt.toDate();
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const thisMonthRevenue = thisMonthOrders.reduce((sum, order) => {
    const rate = order.currency === 'HKD' ? 1.08 : (order.currency === 'MOP' ? 1.11 : 1);
    return sum + Math.round((order.totalAmount || 0) / rate);
  }, 0);

  const thisMonthCommissionOrders = thisMonthOrders.filter(o => o.salesCode && o.salesCode !== '無');
  const thisMonthTotalCommission = thisMonthCommissionOrders.length * COMMISSION_PER_ORDER;

  const salesLeaderboard = {};
  thisMonthCommissionOrders.forEach(o => { salesLeaderboard[o.salesCode] = (salesLeaderboard[o.salesCode] || 0) + 1; });
  const sortedSales = Object.entries(salesLeaderboard).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ maxWidth: '900px', margin: '30px auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2 style={{ color: '#1976d2', textAlign: 'center', marginBottom: '20px' }}>👨‍💼 三地通 - 老闆最高指揮中心</h2>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
        <button onClick={() => setActiveTab('orders')} style={{ flex: 1, padding: '15px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '8px', border: 'none', background: activeTab === 'orders' ? '#1976d2' : '#e0e0e0', color: activeTab === 'orders' ? 'white' : '#333' }}>📝 派單與操作</button>
        <button onClick={() => setActiveTab('hr')} style={{ flex: 1, padding: '15px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '8px', border: 'none', background: activeTab === 'hr' ? '#1976d2' : '#e0e0e0', color: activeTab === 'hr' ? 'white' : '#333' }}>⚙️ 人事與財務</button>
        <button onClick={() => setActiveTab('dashboard')} style={{ flex: 1, padding: '15px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '8px', border: 'none', background: activeTab === 'dashboard' ? '#1976d2' : '#e0e0e0', color: activeTab === 'dashboard' ? 'white' : '#333' }}>📊 生意大數據</button>
      </div>

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
            
            return (
              <div key={order.id} style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '15px', marginBottom: '15px', background: bgColor, opacity: isCancelled ? 0.7 : 1 }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <strong style={{ fontSize: '18px', textDecoration: isCancelled ? 'line-through' : 'none' }}>{order.routeDetail}</strong>
                  <span style={{ background: isCancelled ? '#9e9e9e' : '#333', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '14px' }}>{order.status}</span>
                </div>
                
                <div style={{ background: '#f0f8ff', padding: '10px', borderRadius: '6px', marginBottom: '10px', borderLeft: '4px solid #1976d2' }}>
                  <p style={{ margin: '0 0 5px 0', fontSize: '15px' }}>📍 <strong>詳細地址：</strong>{order.detailedAddress || '未填寫'}</p>
                  <p style={{ margin: '0 0 5px 0' }}>📅 <strong>用車時間：</strong>{order.date || '未註明'} {order.time}</p>
                  {/* 👇 後台顯示人數同車型 */}
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
                
                <div style={{ marginTop: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {order.status === '🔴 老闆處理中' && !isCancelled && (
                    <>
                      <div style={{ display: 'flex', border: '1px solid #4caf50', borderRadius: '4px', overflow: 'hidden' }}>
                        <select onChange={(e) => setSelectedDriverForOrder({...selectedDriverForOrder, [order.id]: e.target.value})} style={{ padding: '8px', border: 'none', outline: 'none', background: '#e8f5e9' }}>
                          <option value="老闆親自出馬">老闆親自出馬</option>
                          {drivers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                        </select>
                        <button onClick={() => handleAssignDriver(order.id)} style={{ padding: '8px 15px', background: '#4caf50', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>🙋‍♂️ 自己接</button>
                      </div>
                      <button onClick={() => handleSendToQingQing(order)} style={{ padding: '8px 15px', background: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>📲 派畀晴晴</button>
                    </>
                  )}
                  <div style={{ flex: 1 }}></div>
                  {!order.isBalancePaid && !isCancelled && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#fff', padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}>
                      <input type="file" accept="image/*" onChange={(e) => setBalanceFiles({...balanceFiles, [order.id]: e.target.files[0]})} style={{ maxWidth: '180px', fontSize: '12px' }} />
                      <button onClick={() => handleSettleBalance(order.id)} disabled={isUploadingBalance} style={{ padding: '6px 12px', background: isUploadingBalance ? '#ccc' : '#1976d2', color: 'white', border: 'none', borderRadius: '4px', cursor: isUploadingBalance ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                        {isUploadingBalance ? '上傳中...' : '提交尾數截圖'}
                      </button>
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
            <h3 style={{ margin: '0 0 15px 0', color: '#f57f17' }}>💸 處理 Sales 提現申請</h3>
            {withdrawals.filter(w => w.status.includes('⏳')).map(w => (
              <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '10px' }}>
                <span><strong>{w.salesCode}</strong> 申請提現：<strong style={{color: 'red'}}>¥{w.amount}</strong></span>
                <button onClick={() => handleApproveWithdrawal(w.id)} style={{ padding: '8px 15px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>✅ 確認已轉帳</button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, background: '#f5f5f5', padding: '20px', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 15px 0' }}>🧑‍💼 開設 Sales 帳號</h3>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}><input type="text" placeholder="Code" value={newSalesCode} onChange={e=>setNewSalesCode(e.target.value)} style={{ width: '40%', padding: '8px' }}/><input type="text" placeholder="密碼" value={newSalesPwd} onChange={e=>setNewSalesPwd(e.target.value)} style={{ width: '40%', padding: '8px' }}/><button onClick={handleAddSales} style={{ width: '20%', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px' }}>新增</button></div>
              <ul style={{ paddingLeft: '20px', margin: 0 }}>{salesUsers.map(u => <li key={u.id}><strong>{u.id}</strong> (密碼: {u.password})</li>)}</ul>
            </div>
            <div style={{ flex: 1, background: '#f5f5f5', padding: '20px', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 15px 0' }}>🚕 車隊司機名單</h3>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}><input type="text" placeholder="司機名" value={newDriverName} onChange={e=>setNewDriverName(e.target.value)} style={{ width: '75%', padding: '8px' }}/><button onClick={handleAddDriver} style={{ width: '25%', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '4px' }}>加入</button></div>
              <ul style={{ paddingLeft: '20px', margin: 0 }}>{drivers.map(d => <li key={d.id}>{d.name}</li>)}</ul>
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
          <h3 style={{ borderBottom: '2px solid #ccc', paddingBottom: '10px' }}>🏆 本月 Sales 龍虎榜</h3>
          <div style={{ background: '#fafafa', borderRadius: '8px', border: '1px solid #ddd', overflow: 'hidden' }}>
            {sortedSales.map((sales, i) => (
              <div key={sales[0]} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', borderBottom: '1px solid #eee', background: i === 0 ? '#fff9c4' : 'transparent' }}>
                <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '👏'} {sales[0]}</span>
                <span style={{ fontSize: '18px' }}>{sales[1]} 單 <span style={{ color: 'green', fontWeight: 'bold' }}>(賺 ¥{sales[1] * COMMISSION_PER_ORDER})</span></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;