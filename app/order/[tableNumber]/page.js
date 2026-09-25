'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

const ADULT_PRICE = 289;
const CHILD_PRICE = 145;
const MAX_CART_LINES = 10; // สูงสุด 10 รายการต่อการส่งออเดอร์ 1 ครั้ง

export default function OrderPage({ params }) {
  // ⚠️ Next.js เวอร์ชันนี้ params เป็น Promise เสมอ ต้อง unwrap ด้วย use() ก่อนใช้งาน
  // ห้ามเขียน const { tableNumber } = params; ตรงๆ เด็ดขาด
  const { tableNumber } = use(params);

  // 'loading' | 'not_open' | 'ordering' | 'closed'
  const [phase, setPhase] = useState('loading');
  const [session, setSession] = useState(null); // { id, table_number, adult_count, child_count }

  const [categories, setCategories] = useState([]);
  const [itemsByCategory, setItemsByCategory] = useState({});
  const [activeCategoryId, setActiveCategoryId] = useState(null);

  const [qtyByItem, setQtyByItem] = useState({}); // { [itemId]: 1-5 } ตัวเลือกจำนวนก่อนกดเพิ่มลงตะกร้า
  const [cart, setCart] = useState([]); // [{ itemId, name, quantity }]
  const [cartOpen, setCartOpen] = useState(false);
  const [cartError, setCartError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [orderSentMessage, setOrderSentMessage] = useState(false);

  const [showBillConfirm, setShowBillConfirm] = useState(false);
  const [billing, setBilling] = useState(false);
  const [billingError, setBillingError] = useState('');

  // ---------- โหลดข้อมูล session + เมนู ----------
  useEffect(() => {
    let isCancelled = false;

    async function init() {
      setPhase('loading');

      const { data: sessionRows, error: sessionError } = await supabase
        .from('sessions')
        .select('id, table_number, adult_count, child_count, status')
        .eq('table_number', tableNumber)
        .eq('status', 'open')
        .limit(1);

      if (isCancelled) return;

      if (sessionError || !sessionRows || sessionRows.length === 0) {
        setPhase('not_open');
        return;
      }

      setSession(sessionRows[0]);

      const [{ data: categoryRows }, { data: itemRows }] = await Promise.all([
        supabase.from('menu_categories').select('id, name, sort_order').order('sort_order', { ascending: true }),
        supabase.from('menu_items').select('id, category_id, name'),
      ]);

      if (isCancelled) return;

      const safeCategories = categoryRows || [];
      const grouped = {};
      (itemRows || []).forEach((item) => {
        if (!grouped[item.category_id]) grouped[item.category_id] = [];
        grouped[item.category_id].push(item);
      });

      setCategories(safeCategories);
      setItemsByCategory(grouped);
      setActiveCategoryId(safeCategories.length > 0 ? safeCategories[0].id : null);
      setPhase('ordering');
    }

    init();

    return () => {
      isCancelled = true;
    };
  }, [tableNumber]);

  const activeItems = useMemo(
    () => itemsByCategory[activeCategoryId] || [],
    [itemsByCategory, activeCategoryId]
  );

  const cartTotalQuantity = useMemo(
    () => cart.reduce((sum, line) => sum + line.quantity, 0),
    [cart]
  );

  function getQty(itemId) {
    return qtyByItem[itemId] || 1;
  }

  function setQty(itemId, value) {
    const clamped = Math.min(5, Math.max(1, Number(value) || 1));
    setQtyByItem((prev) => ({ ...prev, [itemId]: clamped }));
  }

  function addToCart(item) {
    const quantity = getQty(item.id);
    setCartError('');

    setCart((prev) => {
      const existingIndex = prev.findIndex((line) => line.itemId === item.id);

      if (existingIndex >= 0) {
        // มีอยู่แล้วในตะกร้า -> รวมจำนวนเพิ่มเข้าไป (ไม่เพิ่มจำนวนบรรทัดใหม่)
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
        };
        return updated;
      }

      if (prev.length >= MAX_CART_LINES) {
        setCartError(`ตะกร้าเต็มแล้ว (สูงสุด ${MAX_CART_LINES} รายการต่อการส่งออเดอร์)`);
        return prev;
      }

      return [...prev, { itemId: item.id, name: item.name, quantity }];
    });
  }

  function removeFromCart(itemId) {
    setCart((prev) => prev.filter((line) => line.itemId !== itemId));
  }

  function clearCart() {
    setCart([]);
    setQtyByItem({});
  }

  async function handleSubmitOrder() {
    if (cart.length === 0 || !session) return;
    setSubmitting(true);
    setCartError('');

    try {
      const { error } = await supabase.from('orders').insert({
        session_id: session.id,
        table_number: tableNumber,
        items: cart.map((line) => ({ name: line.name, quantity: line.quantity })),
        status: 'received',
      });

      if (error) throw error;

      clearCart();
      setCartOpen(false);
      setOrderSentMessage(true);
      setTimeout(() => setOrderSentMessage(false), 2500);
    } catch (err) {
      console.error(err);
      setCartError('ส่งออเดอร์ไม่สำเร็จ: ' + (err.message || 'ไม่ทราบสาเหตุ'));
    } finally {
      setSubmitting(false);
    }
  }

  const billTotal = session ? session.adult_count * ADULT_PRICE + session.child_count * CHILD_PRICE : 0;

  async function handleConfirmBilling() {
    if (!session) return;
    setBilling(true);
    setBillingError('');

    try {
      const { error } = await supabase
        .from('sessions')
        .update({ status: 'closed' })
        .eq('id', session.id)
        .eq('status', 'open');

      if (error) throw error;

      setShowBillConfirm(false);
      setPhase('closed');
    } catch (err) {
      console.error(err);
      setBillingError('ปิดโต๊ะไม่สำเร็จ: ' + (err.message || 'ไม่ทราบสาเหตุ'));
    } finally {
      setBilling(false);
    }
  }

  // ---------- หน้าจอตามสถานะ ----------

  if (phase === 'loading') {
    return (
      <main style={styles.centerScreen}>
        <p style={styles.centerText}>กำลังตรวจสอบโต๊ะ...</p>
      </main>
    );
  }

  if (phase === 'not_open') {
    return (
      <main style={styles.centerScreen}>
        <p style={styles.centerBigText}>โต๊ะนี้ยังไม่เปิดใช้งาน</p>
        <p style={styles.centerText}>กรุณาแจ้งพนักงาน</p>
      </main>
    );
  }

  if (phase === 'closed') {
    return (
      <main style={styles.centerScreen}>
        <p style={styles.centerBigText}>ขอบคุณที่ใช้บริการ 🙏</p>
      </main>
    );
  }

  // phase === 'ordering'
  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <span style={styles.tableLabel}>โต๊ะ {tableNumber}</span>
        <button type="button" style={styles.billButton} onClick={() => setShowBillConfirm(true)}>
          เรียกเก็บเงิน
        </button>
      </header>

      <nav style={styles.tabBar}>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setActiveCategoryId(category.id)}
            style={{
              ...styles.tabButton,
              ...(category.id === activeCategoryId ? styles.tabButtonActive : {}),
            }}
          >
            {category.name}
          </button>
        ))}
      </nav>

      <section style={styles.menuList}>
        {activeItems.length === 0 && <p style={styles.emptyText}>ไม่มีเมนูในหมวดนี้</p>}

        {activeItems.map((item) => (
          <div key={item.id} style={styles.menuItemCard}>
            <span style={styles.menuItemName}>{item.name}</span>

            <div style={styles.menuItemControls}>
              <div style={styles.qtyStepper}>
                <button
                  type="button"
                  style={styles.qtyButton}
                  onClick={() => setQty(item.id, getQty(item.id) - 1)}
                  aria-label="ลดจำนวน"
                >
                  −
                </button>
                <span style={styles.qtyValue}>{getQty(item.id)}</span>
                <button
                  type="button"
                  style={styles.qtyButton}
                  onClick={() => setQty(item.id, getQty(item.id) + 1)}
                  aria-label="เพิ่มจำนวน"
                >
                  +
                </button>
              </div>

              <button type="button" style={styles.addButton} onClick={() => addToCart(item)}>
                + ใส่ตะกร้า
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* พื้นที่กันไม่ให้เนื้อหาโดนตะกร้าลอยบัง */}
      <div style={{ height: '96px' }} />

      {cartTotalQuantity > 0 && !cartOpen && (
        <button type="button" style={styles.floatingCartBar} onClick={() => setCartOpen(true)}>
          🛒 ดูตะกร้า ({cartTotalQuantity} รายการ)
        </button>
      )}

      {orderSentMessage && <div style={styles.toast}>ส่งออเดอร์แล้ว ✅</div>}

      {cartOpen && (
        <div style={styles.overlay} onClick={() => setCartOpen(false)}>
          <div style={styles.cartSheet} onClick={(e) => e.stopPropagation()}>
            <div style={styles.cartSheetHeader}>
              <h2 style={styles.cartTitle}>ตะกร้าของคุณ</h2>
              <button type="button" style={styles.closeButton} onClick={() => setCartOpen(false)}>
                ✕
              </button>
            </div>

            {cart.length === 0 ? (
              <p style={styles.emptyText}>ยังไม่มีรายการในตะกร้า</p>
            ) : (
              <div style={styles.cartLines}>
                {cart.map((line) => (
                  <div key={line.itemId} style={styles.cartLine}>
                    <span style={styles.cartLineName}>
                      {line.name} × {line.quantity}
                    </span>
                    <button
                      type="button"
                      style={styles.removeButton}
                      onClick={() => removeFromCart(line.itemId)}
                    >
                      ลบ
                    </button>
                  </div>
                ))}
              </div>
            )}

            {cartError && <p style={styles.errorText}>{cartError}</p>}

            <button
              type="button"
              style={{
                ...styles.primaryButton,
                ...(cart.length === 0 || submitting ? styles.buttonDisabled : {}),
              }}
              disabled={cart.length === 0 || submitting}
              onClick={handleSubmitOrder}
            >
              {submitting ? 'กำลังส่ง...' : 'ส่งออเดอร์'}
            </button>
          </div>
        </div>
      )}

      {showBillConfirm && session && (
        <div style={styles.overlay}>
          <div style={styles.confirmBox}>
            <h2 style={styles.confirmTitle}>ยืนยันเรียกเก็บเงิน</h2>
            <p style={styles.confirmLine}>โต๊ะ {tableNumber}</p>
            <p style={styles.confirmLine}>
              ผู้ใหญ่ {session.adult_count} × {ADULT_PRICE} บาท
            </p>
            <p style={styles.confirmLine}>
              เด็ก {session.child_count} × {CHILD_PRICE} บาท
            </p>
            <p style={styles.billTotal}>รวม {billTotal.toLocaleString()} บาท</p>

            {billingError && <p style={styles.errorText}>{billingError}</p>}

            <div style={styles.confirmButtonRow}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => setShowBillConfirm(false)}
                disabled={billing}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                style={styles.dangerButton}
                onClick={handleConfirmBilling}
                disabled={billing}
              >
                {billing ? 'กำลังปิด...' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Styles: สไตล์เมนูร้านอาหารบนมือถือ ปุ่มใหญ่กดง่ายด้วยนิ้วโป้ง ----------
const styles = {
  centerScreen: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    textAlign: 'center',
    gap: '0.75rem',
  },
  centerText: {
    fontSize: '1.25rem',
    color: '#555',
    margin: 0,
  },
  centerBigText: {
    fontSize: '1.75rem',
    fontWeight: 700,
    margin: 0,
  },
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '520px',
    margin: '0 auto',
    paddingBottom: '1rem',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 1.25rem',
    background: '#111',
    color: '#fff',
  },
  tableLabel: {
    fontSize: '1.4rem',
    fontWeight: 700,
  },
  billButton: {
    fontSize: '1rem',
    fontWeight: 700,
    padding: '0.6rem 1rem',
    borderRadius: '10px',
    border: 'none',
    background: '#f5a623',
    color: '#111',
    cursor: 'pointer',
  },
  tabBar: {
    position: 'sticky',
    top: '58px',
    zIndex: 19,
    display: 'flex',
    gap: '0.5rem',
    overflowX: 'auto',
    padding: '0.75rem 1rem',
    background: '#fff',
    borderBottom: '1px solid #eee',
  },
  tabButton: {
    flexShrink: 0,
    fontSize: '1.05rem',
    fontWeight: 600,
    padding: '0.65rem 1.1rem',
    borderRadius: '999px',
    border: '2px solid #ddd',
    background: '#fff',
    color: '#333',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  tabButtonActive: {
    background: '#111',
    borderColor: '#111',
    color: '#fff',
  },
  menuList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.9rem',
    padding: '1rem',
  },
  emptyText: {
    color: '#888',
    fontSize: '1.1rem',
    textAlign: 'center',
  },
  menuItemCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    padding: '1rem',
    borderRadius: '16px',
    border: '1px solid #eee',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  menuItemName: {
    fontSize: '1.25rem',
    fontWeight: 700,
  },
  menuItemControls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
  },
  qtyStepper: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  qtyButton: {
    width: '44px',
    height: '44px',
    fontSize: '1.5rem',
    fontWeight: 700,
    borderRadius: '12px',
    border: '2px solid #ddd',
    background: '#fafafa',
    color: '#111',
    cursor: 'pointer',
  },
  qtyValue: {
    fontSize: '1.3rem',
    fontWeight: 700,
    minWidth: '1.5rem',
    textAlign: 'center',
  },
  addButton: {
    fontSize: '1.05rem',
    fontWeight: 700,
    padding: '0.75rem 1.1rem',
    borderRadius: '12px',
    border: 'none',
    background: '#111',
    color: '#fff',
    cursor: 'pointer',
  },
  floatingCartBar: {
    position: 'fixed',
    left: '1rem',
    right: '1rem',
    bottom: '1rem',
    maxWidth: '488px',
    margin: '0 auto',
    fontSize: '1.2rem',
    fontWeight: 700,
    padding: '1rem',
    borderRadius: '16px',
    border: 'none',
    background: '#f5a623',
    color: '#111',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
    zIndex: 30,
  },
  toast: {
    position: 'fixed',
    left: '50%',
    top: '1.25rem',
    transform: 'translateX(-50%)',
    background: '#1e8e3e',
    color: '#fff',
    fontSize: '1.1rem',
    fontWeight: 700,
    padding: '0.75rem 1.5rem',
    borderRadius: '999px',
    zIndex: 60,
    boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 50,
  },
  cartSheet: {
    width: '100%',
    maxWidth: '520px',
    background: '#fff',
    borderTopLeftRadius: '24px',
    borderTopRightRadius: '24px',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    maxHeight: '80vh',
    overflowY: 'auto',
  },
  cartSheetHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cartTitle: {
    fontSize: '1.5rem',
    margin: 0,
  },
  closeButton: {
    width: '40px',
    height: '40px',
    fontSize: '1.25rem',
    borderRadius: '999px',
    border: 'none',
    background: '#f0f0f0',
    cursor: 'pointer',
  },
  cartLines: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  cartLine: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 0',
    borderBottom: '1px solid #f0f0f0',
  },
  cartLineName: {
    fontSize: '1.15rem',
    fontWeight: 600,
  },
  removeButton: {
    fontSize: '0.95rem',
    fontWeight: 600,
    padding: '0.5rem 0.9rem',
    borderRadius: '10px',
    border: '1px solid #d9291c',
    background: '#fff',
    color: '#d9291c',
    cursor: 'pointer',
  },
  primaryButton: {
    fontSize: '1.3rem',
    fontWeight: 700,
    padding: '1rem',
    borderRadius: '14px',
    border: 'none',
    background: '#111',
    color: '#fff',
    cursor: 'pointer',
    width: '100%',
  },
  buttonDisabled: {
    background: '#999',
    cursor: 'not-allowed',
  },
  secondaryButton: {
    fontSize: '1.15rem',
    fontWeight: 600,
    padding: '0.85rem 1rem',
    borderRadius: '12px',
    border: '2px solid #333',
    background: '#fff',
    color: '#333',
    cursor: 'pointer',
    flex: 1,
  },
  dangerButton: {
    fontSize: '1.15rem',
    fontWeight: 700,
    padding: '0.85rem 1rem',
    borderRadius: '12px',
    border: 'none',
    background: '#d9291c',
    color: '#fff',
    cursor: 'pointer',
    flex: 1,
  },
  confirmBox: {
    background: '#fff',
    borderRadius: '20px',
    padding: '2rem 1.5rem',
    width: '100%',
    maxWidth: '420px',
    margin: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    alignSelf: 'center',
  },
  confirmTitle: {
    fontSize: '1.4rem',
    margin: '0 0 0.5rem 0',
    textAlign: 'center',
  },
  confirmLine: {
    fontSize: '1.15rem',
    margin: 0,
    textAlign: 'center',
  },
  billTotal: {
    fontSize: '1.5rem',
    fontWeight: 700,
    textAlign: 'center',
    margin: '0.5rem 0',
  },
  confirmButtonRow: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '1rem',
  },
  errorText: {
    fontSize: '1rem',
    color: '#d9291c',
    fontWeight: 600,
    textAlign: 'center',
  },
};
