import Link from 'next/link';

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.5rem',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: '2.5rem', margin: 0 }}>สุกี้ผีน้อย</h1>
      <p style={{ color: '#555', margin: 0 }}>
        ระบบสั่งอาหารร้านบุฟเฟต์ — หน้านี้ใช้สำหรับทดสอบว่า deploy สำเร็จ
      </p>

      <nav
        style={{
          display: 'flex',
          gap: '1rem',
          marginTop: '1rem',
        }}
      >
        <Link
          href="/generate-qr"
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            background: '#111',
            color: '#fff',
            textDecoration: 'none',
          }}
        >
          สร้าง QR Code โต๊ะ
        </Link>
        <Link
          href="/kitchen"
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            border: '1px solid #111',
            color: '#111',
            textDecoration: 'none',
          }}
        >
          หน้าครัว
        </Link>
      </nav>
    </main>
  );
}
