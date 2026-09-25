'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function KitchenPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // รวมออเดอร์ที่เข้ามาใหม่ (INSERT) หรือถูกแก้ไข (UPDATE) เข้ากับ state เดียว
  // - ถ้า status เป็น 'served' -> เอาออกจากจอทันที
  // - ถ้าเป็นออเดอร์เดิมที่มีอยู่แล้ว -> อัปเดตข้อมูล
  // - ถ้าเป็นออเดอร์ใหม่ที่ยังไม่เคยเห็น และ status เป็น received/cooking -> เพิ่มเข้าไปท้ายลิสต์ (ใหม่สุดอยู่ท้ายสุด)
  function upsertOrder(incoming) {
    setOrders((prev) => {
      const existingIndex = prev.findIndex((o) => o.id === incoming.id);

      if (incoming.status === 'served') {
        return prev.filter((o) => o.id !== incoming.id);
      }

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = incoming;
        return updated;
      }

      if (incoming.status === 'received' || incoming.status === 'cooking') {
        return [...prev, incoming].sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at)
        );
      }

      return prev;
    });
  }

  useEffect(() => {
    let isCancelled = false;

    async function loadInitialOrders() {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('id, session_id, table_number, items, status, created_at')
        .in('status', ['received', 'cooking'])
        .order('created_at', { ascending: true });

      if (isCancelled) return;

      if (error) {
        setErrorMsg('โหลดออเดอร์ไม่สำเร็จ: ' + error.message);
      } else {
        setOrders(data || []);
      }
      setLoading(false);
    }

    loadInitialOrders();

    // subscribe realtime ฟังทั้ง INSERT และ UPDATE ของตาราง orders
    const channel = supabase
      .channel('kitchen-orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => upsertOrder(payload.new)
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => upsertOrder(payload.new)
      )
      .subscribe();

    return () => {
      isCancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  async function handleStartCooking(order) {
    // เช็คซ้ำว่า status ยังเป็น 'received' อยู่ตอน update เพื่อกันการกดซ้ำซ้อน
    const { error } = await supabase
      .from('orders')
      .update({ status: 'cooking' })
      .eq('id', order.id)
      .eq('status', 'received');

    if (error) {
      setErrorMsg('เริ่มทำออเดอร์ไม่สำเร็จ: ' + error.message);
      return;
    }

    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, status: 'cooking' } : o))
    );
  }

  async function handleMarkServed(order) {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'served' })
      .eq('id', order.id);

    if (error) {
      setErrorMsg('บันทึกจัดเสิร์ฟไม่สำเร็จ: ' + error.message);
      return;
    }

    // เอาการ์ดออกจากจอทันที ไม่ต้องรอ realtime event
    setOrders((prev) => prev.filter((o) => o.id !== order.id));
  }

  function formatTime(createdAt) {
    return new Date(createdAt).toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function parseItems(items) {
    if (Array.isArray(items)) return items;
    if (typeof items === 'string') {
      try {
        const parsed = JSON.parse(items);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>จอครัว — สุกี้ผีน้อย</h1>
        <span style={styles.orderCount}>{orders.length} ออเดอร์รอดำเนินการ</span>
      </header>

      {errorMsg && <p style={styles.errorText}>{errorMsg}</p>}

      {loading ? (
        <p style={styles.emptyText}>กำลังโหลดออเดอร์...</p>
      ) : orders.length === 0 ? (
        <p style={styles.emptyText}>ยังไม่มีออเดอร์เข้ามา</p>
      ) : (
        <div style={styles.grid}>
          {orders.map((order) => {
            const items = parseItems(order.items);
            const isCooking = order.status === 'cooking';

            return (
              <div
                key={order.id}
                style={{
                  ...styles.card,
                  ...(isCooking ? styles.cardCooking : styles.cardReceived),
                }}
              >
                <div style={styles.cardHeader}>
                  <span style={styles.tableNumber}>โต๊ะ {order.table_number}</span>
                  <span style={styles.orderTime}>{formatTime(order.created_at)}</span>
                </div>

                <ul style={styles.itemList}>
                  {items.map((item, index) => (
                    <li key={index} style={styles.itemLine}>
                      {item.name} × {item.quantity}
                    </li>
                  ))}
                </ul>

                <div style={styles.cardFooter}>
                  {order.status === 'received' && (
                    <button
                      type="button"
                      style={styles.startButton}
                      onClick={() => handleStartCooking(order)}
                    >
                      เริ่มทำ
                    </button>
                  )}

                  <button
                    type="button"
                    style={styles.servedButton}
                    onClick={() => handleMarkServed(order)}
                  >
                    จัดเสิร์ฟแล้ว
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

// ---------- Styles: ตัวหนังสือใหญ่ อ่านจากระยะไกลในครัวได้ ----------
const styles = {
  page: {
    minHeight: '100vh',
    padding: '1.5rem 2rem',
    background: '#1a1a1a',
    color: '#fff',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
    gap: '0.75rem',
  },
  title: {
    fontSize: '2.25rem',
    margin: 0,
  },
  orderCount: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#f5a623',
  },
  errorText: {
    fontSize: '1.2rem',
    color: '#ff6b6b',
    fontWeight: 700,
    marginBottom: '1rem',
  },
  emptyText: {
    fontSize: '1.75rem',
    color: '#aaa',
    textAlign: 'center',
    marginTop: '4rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '1.25rem',
  },
  card: {
    borderRadius: '20px',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    border: '4px solid transparent',
  },
  cardReceived: {
    background: '#2c2c2c',
    borderColor: '#4a90d9',
  },
  cardCooking: {
    background: '#4a2f0a',
    borderColor: '#f5a623',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  tableNumber: {
    fontSize: '2.5rem',
    fontWeight: 800,
  },
  orderTime: {
    fontSize: '1.25rem',
    color: '#ccc',
  },
  itemList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  itemLine: {
    fontSize: '1.5rem',
    fontWeight: 600,
  },
  cardFooter: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: 'auto',
  },
  startButton: {
    flex: 1,
    fontSize: '1.3rem',
    fontWeight: 700,
    padding: '1rem',
    borderRadius: '14px',
    border: 'none',
    background: '#f5a623',
    color: '#111',
    cursor: 'pointer',
  },
  servedButton: {
    flex: 1,
    fontSize: '1.3rem',
    fontWeight: 700,
    padding: '1rem',
    borderRadius: '14px',
    border: 'none',
    background: '#1e8e3e',
    color: '#fff',
    cursor: 'pointer',
  },
};
