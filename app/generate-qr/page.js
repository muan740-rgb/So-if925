'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const initialForm = { tableNumber: '', adultCount: '', childCount: '' };

export default function GenerateQrPage() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // session เก่าที่ยังเปิดค้างอยู่ (ถ้ามี) — { id, table_number, adult_count, child_count, created_at }
  const [existingSession, setExistingSession] = useState(null);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);

  // ผลลัพธ์ QR หลังเปิดโต๊ะสำเร็จ
  const [qrResult, setQrResult] = useState(null);
  const [copied, setCopied] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function resetAll() {
    setForm(initialForm);
    setErrorMsg('');
    setExistingSession(null);
    setShowConfirmClose(false);
    setQrResult(null);
    setCopied(false);
  }

  async function handleOpenTable(e) {
    e.preventDefault();
    setErrorMsg('');

    const tableNumber = form.tableNumber.trim();
    const adultCount = form.adultCount.trim();
    const childCount = form.childCount.trim();

    if (!tableNumber || Number.isNaN(Number(tableNumber))) {
      setErrorMsg('กรุณากรอกเลขโต๊ะให้ถูกต้อง');
      return;
    }
    if (adultCount === '' || Number.isNaN(Number(adultCount)) || Number(adultCount) < 0) {
      setErrorMsg('กรุณากรอกจำนวนผู้ใหญ่ให้ถูกต้อง');
      return;
    }
    if (childCount === '' || Number.isNaN(Number(childCount)) || Number(childCount) < 0) {
      setErrorMsg('กรุณากรอกจำนวนเด็กให้ถูกต้อง');
      return;
    }

    setLoading(true);
    try {
      // 1. เช็คก่อนว่าโต๊ะนี้มี session ที่ยัง status = 'open' ค้างอยู่หรือไม่
      // หมายเหตุ: table_number ส่งเป็น string ตามที่กรอกในฟอร์ม
      // ถ้าคอลัมน์ table_number ในฐานข้อมูลจริงเป็น integer ให้แปลงเป็น Number(tableNumber) ก่อนใช้ .eq()
      const { data: existingRows, error: selectError } = await supabase
        .from('sessions')
        .select('id, table_number, adult_count, child_count, created_at')
        .eq('table_number', tableNumber)
        .eq('status', 'open')
        .limit(1);

      if (selectError) throw selectError;

      if (existingRows && existingRows.length > 0) {
        // มี session ค้างอยู่ -> แสดงกล่องเตือน ไม่ insert ใหม่
        setExistingSession(existingRows[0]);
        setLoading(false);
        return;
      }

      // 2. ไม่มี session ค้าง -> insert แถวใหม่
      const { data: inserted, error: insertError } = await supabase
        .from('sessions')
        .insert({
          table_number: tableNumber,
          adult_count: Number(adultCount),
          child_count: Number(childCount),
          status: 'open',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const orderUrl = `${window.location.origin}/order/${tableNumber}`;
      setQrResult({
        tableNumber,
        adultCount: Number(adultCount),
        childCount: Number(childCount),
        url: orderUrl,
        sessionId: inserted?.id ?? null,
      });
    } catch (err) {
      console.error(err);
      setErrorMsg('เกิดข้อผิดพลาด: ' + (err.message || 'ไม่ทราบสาเหตุ'));
    } finally {
      setLoading(false);
    }
  }

  function openConfirmClose() {
    setShowConfirmClose(true);
  }

  function cancelConfirmClose() {
    setShowConfirmClose(false);
  }

  async function confirmCloseOldSession() {
    if (!existingSession) return;
    setClosing(true);
    setErrorMsg('');
    try {
      // update เฉพาะแถวที่ id ตรงกัน "และ" status ยังเป็น 'open' อยู่
      // เพื่อกันการกดซ้ำซ้อน (ถ้ามีคนอื่นปิดไปแล้ว update นี้จะไม่โดนแถวไหนเลย)
      const { data, error } = await supabase
        .from('sessions')
        .update({ status: 'closed' })
        .eq('id', existingSession.id)
        .eq('status', 'open')
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        setErrorMsg('โต๊ะนี้ถูกปิดไปแล้ว กรุณาลองกด "เปิดโต๊ะ" อีกครั้ง');
      }

      // ปิดกล่องยืนยัน + เอากล่องเตือนออก กลับไปที่ฟอร์มเดิม (ค่าที่กรอกไว้ยังอยู่ครบ)
      setShowConfirmClose(false);
      setExistingSession(null);
    } catch (err) {
      console.error(err);
      setErrorMsg('ปิดโต๊ะเดิมไม่สำเร็จ: ' + (err.message || 'ไม่ทราบสาเหตุ'));
    } finally {
      setClosing(false);
    }
  }

  function getElapsedMinutes(createdAt) {
    const created = new Date(createdAt).getTime();
    const diffMs = Date.now() - created;
    return Math.max(0, Math.floor(diffMs / 60000));
  }

  async function handleCopyLink() {
    if (!qrResult) return;
    try {
      await navigator.clipboard.writeText(qrResult.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
      setErrorMsg('คัดลอกลิงก์ไม่สำเร็จ กรุณาคัดลอกด้วยตนเอง');
    }
  }

  // ---------- หน้าจอผลลัพธ์ QR (หลังเปิดโต๊ะสำเร็จ) ----------
  if (qrResult) {
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
      qrResult.url
    )}`;

    return (
      <main style={styles.main}>
        <h1 style={styles.title}>เปิดโต๊ะสำเร็จ ✅</h1>

        <div style={styles.qrBox}>
          <img
            src={qrImageUrl}
            alt={`QR code สำหรับโต๊ะ ${qrResult.tableNumber}`}
            width={300}
            height={300}
            style={styles.qrImage}
          />

          <p style={styles.summaryText}>
            โต๊ะ {qrResult.tableNumber} · ผู้ใหญ่ {qrResult.adultCount} · เด็ก {qrResult.childCount}
          </p>

          <div style={styles.linkRow}>
            <span style={styles.linkText}>{qrResult.url}</span>
            <button type="button" onClick={handleCopyLink} style={styles.copyButton}>
              {copied ? 'คัดลอกแล้ว ✓' : 'คัดลอกลิงก์'}
            </button>
          </div>

          <button type="button" onClick={resetAll} style={styles.primaryButton}>
            เปิดโต๊ะใหม่
          </button>
        </div>
      </main>
    );
  }

  // ---------- หน้าจอฟอร์มเปิดโต๊ะ ----------
  return (
    <main style={styles.main}>
      <h1 style={styles.title}>เปิดโต๊ะลูกค้า</h1>

      {existingSession && (
        <div style={styles.warningBox}>
          <p style={styles.warningText}>
            โต๊ะนี้มีลูกค้าอยู่ระหว่างทานอาหาร กรุณาปิดออเดอร์เดิมก่อน
          </p>
          <button type="button" onClick={openConfirmClose} style={styles.dangerButton}>
            ปิดออเดอร์เดิม
          </button>
        </div>
      )}

      {showConfirmClose && existingSession && (
        <div style={styles.overlay}>
          <div style={styles.confirmBox}>
            <h2 style={styles.confirmTitle}>ยืนยันปิดโต๊ะเดิม</h2>
            <p style={styles.confirmLine}>โต๊ะ {existingSession.table_number}</p>
            <p style={styles.confirmLine}>
              ผู้ใหญ่ {existingSession.adult_count} · เด็ก {existingSession.child_count}
            </p>
            <p style={styles.confirmLine}>
              เปิดมาแล้ว {getElapsedMinutes(existingSession.created_at)} นาที
            </p>

            <div style={styles.confirmButtonRow}>
              <button
                type="button"
                onClick={cancelConfirmClose}
                style={styles.secondaryButton}
                disabled={closing}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmCloseOldSession}
                style={styles.dangerButton}
                disabled={closing}
              >
                {closing ? 'กำลังปิด...' : 'ยืนยันปิดโต๊ะเดิม'}
              </button>
            </div>
          </div>
        </div>
      )}

      {errorMsg && <p style={styles.errorText}>{errorMsg}</p>}

      <form onSubmit={handleOpenTable} style={styles.form}>
        <label style={styles.label}>
          เลขโต๊ะ
          <input
            type="number"
            name="tableNumber"
            value={form.tableNumber}
            onChange={handleChange}
            style={styles.input}
            inputMode="numeric"
            min="0"
            required
          />
        </label>

        <label style={styles.label}>
          จำนวนผู้ใหญ่
          <input
            type="number"
            name="adultCount"
            value={form.adultCount}
            onChange={handleChange}
            style={styles.input}
            inputMode="numeric"
            min="0"
            required
          />
        </label>

        <label style={styles.label}>
          จำนวนเด็ก
          <input
            type="number"
            name="childCount"
            value={form.childCount}
            onChange={handleChange}
            style={styles.input}
            inputMode="numeric"
            min="0"
            required
          />
        </label>

        <button
          type="submit"
          style={{
            ...styles.primaryButton,
            ...(loading || existingSession ? styles.buttonDisabled : {}),
          }}
          disabled={loading || !!existingSession}
        >
          {loading ? 'กำลังตรวจสอบ...' : 'เปิดโต๊ะ'}
        </button>
      </form>
    </main>
  );
}

// ---------- Styles: เรียบง่าย ตัวหนังสือใหญ่ อ่านง่าย ใช้งานเร็วหน้าร้าน ----------
const styles = {
  main: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '2rem 1rem',
    gap: '1.25rem',
    maxWidth: '480px',
    margin: '0 auto',
  },
  title: {
    fontSize: '2rem',
    margin: 0,
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    width: '100%',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    fontSize: '1.25rem',
    fontWeight: 600,
  },
  input: {
    fontSize: '1.75rem',
    padding: '0.75rem 1rem',
    borderRadius: '12px',
    border: '2px solid #ccc',
    width: '100%',
    boxSizing: 'border-box',
  },
  primaryButton: {
    fontSize: '1.5rem',
    fontWeight: 700,
    padding: '1rem',
    borderRadius: '12px',
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
    fontSize: '1.25rem',
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
    fontSize: '1.25rem',
    fontWeight: 700,
    padding: '0.85rem 1rem',
    borderRadius: '12px',
    border: 'none',
    background: '#d9291c',
    color: '#fff',
    cursor: 'pointer',
    flex: 1,
  },
  warningBox: {
    width: '100%',
    background: '#fff3cd',
    border: '3px solid #d9291c',
    borderRadius: '16px',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    alignItems: 'stretch',
  },
  warningText: {
    fontSize: '1.35rem',
    fontWeight: 700,
    color: '#8a1c14',
    margin: 0,
    textAlign: 'center',
  },
  errorText: {
    fontSize: '1.1rem',
    color: '#d9291c',
    fontWeight: 600,
    textAlign: 'center',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    zIndex: 50,
  },
  confirmBox: {
    background: '#fff',
    borderRadius: '20px',
    border: '4px solid #d9291c',
    padding: '2rem 1.5rem',
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  confirmTitle: {
    fontSize: '1.5rem',
    color: '#8a1c14',
    margin: '0 0 0.5rem 0',
    textAlign: 'center',
  },
  confirmLine: {
    fontSize: '1.3rem',
    margin: 0,
    textAlign: 'center',
  },
  confirmButtonRow: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '1rem',
  },
  qrBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    width: '100%',
  },
  qrImage: {
    borderRadius: '12px',
    border: '2px solid #eee',
  },
  summaryText: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: 0,
    textAlign: 'center',
  },
  linkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
  },
  linkText: {
    fontSize: '1rem',
    color: '#333',
    wordBreak: 'break-all',
    textAlign: 'center',
  },
  copyButton: {
    fontSize: '0.95rem',
    fontWeight: 600,
    padding: '0.5rem 0.9rem',
    borderRadius: '8px',
    border: '1px solid #333',
    background: '#f5f5f5',
    color: '#333',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
};
