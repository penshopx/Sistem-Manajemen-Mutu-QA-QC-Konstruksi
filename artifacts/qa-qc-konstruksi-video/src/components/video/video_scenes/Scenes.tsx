import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

const EASE = [0.16, 1, 0.3, 1] as const;

function SceneFrame({
  children,
  tone = 'navy',
}: {
  children: ReactNode;
  tone?: 'navy' | 'rust' | 'sand';
}) {
  const backgrounds = {
    navy: 'linear-gradient(125deg, #10212b 0%, #173540 57%, #0d1c26 100%)',
    rust: 'linear-gradient(120deg, #602f2e 0%, #a24d35 52%, #242d30 100%)',
    sand: 'linear-gradient(125deg, #d9c9b0 0%, #ecdfca 48%, #a6b6ae 100%)',
  };
  return (
    <motion.div
      className="scene-layer"
      initial={{ opacity: 0, clipPath: 'polygon(0 0, 0 0, 0 100%, 0 100%)' }}
      animate={{ opacity: 1, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}
      exit={{ opacity: 0, clipPath: 'polygon(100% 0, 100% 0, 100% 100%, 100% 100%)' }}
      transition={{ duration: .8, ease: EASE }}
      style={{ background: backgrounds[tone] }}
    >
      {children}
    </motion.div>
  );
}

function Reveal({
  children,
  delay = 0,
  y = 20,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ delay, duration: .7, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

function DotField({ count = 18 }: { count?: number }) {
  return (
    <div className="scene-layer pointer-events-none" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <motion.span
          key={index}
          style={{
            background: index % 4 === 0 ? 'var(--color-accent)' : 'var(--color-secondary)',
            borderRadius: '50%',
            height: `${.18 + (index % 3) * .1}vmin`,
            left: `${(index * 17) % 100}%`,
            opacity: .12 + (index % 5) * .035,
            position: 'absolute',
            top: `${(index * 29) % 100}%`,
            width: `${.18 + (index % 3) * .1}vmin`,
          }}
          animate={{ y: [0, -12, 0], opacity: [.15, .4, .15] }}
          transition={{ duration: 3 + (index % 4), repeat: Infinity, delay: index * .08, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

function Signal({ x = '50%', y = '50%', rotate = 0 }: { x?: string; y?: string; rotate?: number }) {
  return (
    <motion.div
      aria-hidden="true"
      style={{
        background: 'var(--color-primary)',
        height: '1px',
        left: x,
        opacity: .8,
        position: 'absolute',
        top: y,
        transform: `rotate(${rotate}deg)`,
        transformOrigin: 'left center',
        width: '18vmin',
      }}
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: .8, delay: .25, ease: EASE }}
    />
  );
}

export function Scene01() {
  return (
    <SceneFrame>
      <div className="scene-content">
        <DotField />
        <motion.div
          className="scene-layer grid-surface"
          animate={{ backgroundPosition: ['0 0', '4vmin 4vmin'] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          style={{
            background: 'radial-gradient(circle, rgba(242,184,75,.36), transparent 65%)',
            borderRadius: '50%',
            height: '58vmin',
            position: 'absolute',
            right: '-8vmin',
            top: '-17vmin',
            width: '58vmin',
          }}
          animate={{ scale: [1, 1.08, 1], rotate: [0, 8, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div style={{ alignItems: 'center', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', position: 'relative', textAlign: 'center', zIndex: 10 }}>
          <Reveal delay={.1}><div className="eyebrow">SISTEM MANAJEMEN PENGENDALIAN MUTU</div></Reveal>
          <Reveal delay={.35}><div className="orange-rule" style={{ margin: '3vmin auto' }} /></Reveal>
          <Reveal delay={.5}><h1 className="display" style={{ color: '#f4efe6', fontSize: 'clamp(3.5rem, 11vmin, 9.5rem)', lineHeight: .88, margin: 0, maxWidth: '14ch' }}>Mutu bukan<br /><span style={{ color: 'var(--color-accent)' }}>berkas terakhir.</span></h1></Reveal>
          <Reveal delay={1}><p className="body-copy" style={{ fontSize: 'clamp(1rem, 2vmin, 1.5rem)', margin: '4vmin auto 0', maxWidth: '35ch' }}>Mutu adalah jejak keputusan yang terbaca, sejak rencana sampai serah terima.</p></Reveal>
        </div>
        <motion.div
          className="mono"
          style={{ color: 'rgba(244,239,230,.58)', fontSize: 'clamp(.55rem, 1vmin, .8rem)', position: 'absolute', right: '6vmin', top: '6vmin' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: .9, duration: .8 }}
        >
          QA / QC — 01 / 10
        </motion.div>
      </div>
    </SceneFrame>
  );
}

export function Scene02() {
  const fragments = [
    { label: 'SPREADSHEET', x: '45%', y: '16%', rotate: -8, tone: '#d8c7a9' },
    { label: 'PAPER FORM', x: '65%', y: '38%', rotate: 6, tone: '#ede0c9' },
    { label: 'FOTO', x: '42%', y: '58%', rotate: 8, tone: '#b7c5c2' },
    { label: 'CHAT', x: '75%', y: '68%', rotate: -5, tone: '#cbb49a' },
  ];
  return (
    <SceneFrame tone="rust">
      <div className="scene-content" style={{ display: 'flex', alignItems: 'center' }}>
        <div className="scene-layer grid-surface" style={{ opacity: .2 }} />
        <DotField count={12} />
        <div style={{ flex: '0 0 45%', position: 'relative', zIndex: 10 }}>
          <Reveal delay={.1}><div className="eyebrow">MASALAH OPERASIONAL</div></Reveal>
          <Reveal delay={.35}><h2 className="display headline-wide" style={{ margin: '1.5vmin 0 0', maxWidth: '12ch' }}>Data tercecer.<br /><span style={{ color: '#f6c576' }}>Risiko membesar.</span></h2></Reveal>
          <Reveal delay={.7}><p className="body-copy" style={{ marginTop: '2vmin' }}>Ketika catatan hidup di banyak tempat, satu pertanyaan sederhana menjadi mahal: “Bukti yang benar ada di mana?”</p></Reveal>
        </div>
        <div style={{ flex: 1, position: 'relative', height: '100%' }}>
        {fragments.map((item, index) => (
          <motion.div
            key={item.label}
            className="paper-card"
            style={{ left: item.x, padding: '1.6vmin 2vmin', position: 'absolute', top: item.y, transform: `rotate(${item.rotate}deg)`, width: '16vmin' }}
            initial={{ opacity: 0, scale: .7, rotate: item.rotate - 14 }}
            animate={{ opacity: .88, scale: 1, rotate: item.rotate, y: [0, -1.2 * (index + 1), 0] }}
            transition={{ delay: .55 + index * .16, duration: .7, y: { duration: 3.4 + index, repeat: Infinity, ease: 'easeInOut' }, ease: EASE }}
          >
            <div className="mono" style={{ color: item.tone === '#b7c5c2' ? '#18313d' : '#7d4b36', fontSize: 'clamp(.6rem, 1.2vmin, 1rem)' }}>{item.label}</div>
            <div style={{ borderBottom: '2px solid rgba(24,49,61,.25)', marginTop: '1.5vmin', width: '75%' }} />
            <div style={{ borderBottom: '2px solid rgba(24,49,61,.17)', marginTop: '1vmin', width: '52%' }} />
          </motion.div>
        ))}
        </div>
        <Signal x="28%" y="47%" rotate={-17} />
        <Signal x="56%" y="56%" rotate={-24} />
        <motion.div
          className="mono"
          style={{ bottom: '6vmin', color: 'rgba(255,242,220,.58)', fontSize: 'clamp(.55rem, 1vmin, .8rem)', position: 'absolute', right: '6vmin' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          02 / 10 — FRAGMENTASI
        </motion.div>
      </div>
    </SceneFrame>
  );
}

export function Scene03() {
  return (
    <SceneFrame>
      <div className="scene-content" style={{ display: 'flex', alignItems: 'center', gap: '4vmin' }}>
        <div className="scene-layer grid-surface" />
        <motion.div
          style={{ border: '1px solid rgba(242,184,75,.3)', borderRadius: '50%', height: '64vmin', position: 'absolute', right: '-17vmin', top: '-15vmin', width: '64vmin' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
        />
        <div style={{ flex: 1, zIndex: 10 }}>
          <Reveal delay={.1}><div className="eyebrow">KENDALI DIMULAI DI DEPAN</div></Reveal>
          <Reveal delay={.35}><h2 className="display headline-wide" style={{ margin: '1.5vmin 0 0', maxWidth: '10ch' }}>Satu rencana.<br /><span style={{ color: 'var(--color-accent)' }}>Satu kendali.</span></h2></Reveal>
          <Reveal delay={.72}><p className="body-copy" style={{ marginTop: '2vmin' }}>Quality Plan / RMK menerjemahkan komitmen mutu. ITP mengubahnya menjadi titik kendali yang jelas.</p></Reveal>
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <motion.div className="glass-card" style={{ padding: '3vmin', width: '45vmin' }} initial={{ opacity: 0, x: 45, rotateY: 18 }} animate={{ opacity: 1, x: 0, rotateY: 0 }} transition={{ delay: 1, duration: .9, ease: EASE }}>
          <div className="mono" style={{ color: 'var(--color-accent)', fontSize: 'clamp(.55rem, 1.2vmin, .9rem)' }}>QUALITY PLAN / RMK</div>
          <div style={{ alignItems: 'center', display: 'flex', gap: '2vmin', margin: '3vmin 0' }}>
            <div style={{ background: 'var(--color-primary)', height: '6vmin', width: '6vmin' }} />
            <div><strong className="display" style={{ fontSize: 'clamp(1.5rem, 4vmin, 3rem)' }}>ITP</strong><div className="micro-label" style={{ fontSize: 'clamp(.65rem, 1.2vmin, .9rem)' }}>Inspection & Test Plan</div></div>
          </div>
          <div style={{ display: 'grid', gap: '1.2vmin' }}>
            {['Hold point', 'Witness point', 'Acceptance criteria'].map((label, index) => (
              <motion.div key={label} style={{ alignItems: 'center', display: 'flex', gap: '1.2vmin' }} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.25 + index * .13 }}>
                <span style={{ background: index === 0 ? 'var(--color-primary)' : 'var(--color-success)', borderRadius: '50%', height: '1vmin', width: '1vmin' }} />
                <span style={{ color: 'var(--color-text-secondary)', fontSize: 'clamp(.65rem, 1.3vmin, .95rem)' }}>{label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
        </div>
        <div className="mono" style={{ bottom: '6vmin', color: 'var(--color-text-muted)', fontSize: 'clamp(.55rem, 1vmin, .8rem)', position: 'absolute', right: '6vmin' }}>03 / 10 — RENCANA / KENDALI</div>
      </div>
    </SceneFrame>
  );
}

export function Scene04() {
  return (
    <SceneFrame tone="sand">
      <div className="scene-content" style={{ display: 'flex', alignItems: 'center', color: '#18313d', gap: '6vmin' }}>
        <div className="scene-layer" style={{ background: 'url("' + import.meta.env.BASE_URL + 'assets/blueprint-grid.png") center / cover', mixBlendMode: 'multiply', opacity: .16 }} />
        <div style={{ flex: 1, zIndex: 10 }}>
          <Reveal delay={.1}><div className="eyebrow" style={{ color: '#a24d35' }}>EKSEKUSI DI LAPANGAN</div></Reveal>
          <Reveal delay={.35}><h2 className="display headline-wide" style={{ margin: '1.5vmin 0 0', maxWidth: '11ch' }}>Rencana<br /><span style={{ color: '#a24d35' }}>menjadi bukti.</span></h2></Reveal>
          <Reveal delay={.72}><p className="body-copy" style={{ color: '#49666a', marginTop: '2vmin' }}>MIR, WIR, dan checklist harian mengikat pekerjaan aktual pada standar yang disepakati.</p></Reveal>
        </div>
        <div style={{ flex: 1 }}>
        <motion.div className="glass-card" style={{ background: 'rgba(244,239,230,.8)', borderColor: 'rgba(24,49,61,.18)', color: '#18313d', padding: '3.5vmin', width: '100%', position: 'relative' }} initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: .9, duration: .8, ease: EASE }}>
          <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}><span className="mono" style={{ color: '#a24d35', fontSize: 'clamp(.65rem, 1.2vmin, .9rem)' }}>WIR-0248</span><span style={{ color: '#337e67', fontSize: 'clamp(.7rem, 1.3vmin, .95rem)' }}>TERBUKA</span></div>
          <div style={{ borderBottom: '2px solid rgba(24,49,61,.2)', margin: '2vmin 0 1.5vmin' }} />
          <div className="display" style={{ fontSize: 'clamp(2rem, 5vmin, 4rem)' }}>Pengecoran<br />balok lantai 3</div>
          <div style={{ display: 'flex', gap: '1vmin', marginTop: '2.5vmin' }}>{['MIR', 'WIR', 'CHECKLIST'].map((label, index) => <span key={label} style={{ background: index === 1 ? '#a24d35' : '#d3ded8', color: index === 1 ? '#fff2dc' : '#49666a', fontFamily: 'var(--font-mono)', fontSize: 'clamp(.55rem, 1vmin, .75rem)', padding: '1vmin 1.4vmin' }}>{label}</span>)}</div>
          <motion.div className="scan-line" style={{ bottom: '10vmin', background: 'linear-gradient(90deg, transparent, #a24d35, transparent)' }} animate={{ x: ['-35%', '35%', '-35%'] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }} />
        </motion.div>
        </div>
        <div className="mono" style={{ bottom: '6vmin', color: '#6b8587', fontSize: 'clamp(.55rem, 1vmin, .8rem)', position: 'absolute', right: '6vmin' }}>04 / 10 — MIR • WIR • HARIAN</div>
      </div>
    </SceneFrame>
  );
}

export function Scene05() {
  return (
    <SceneFrame>
      <div className="scene-content" style={{ display: 'flex', alignItems: 'center', gap: '5vmin', position: 'relative', zIndex: 10 }}>
        <motion.div className="scene-layer" style={{ background: 'url("' + import.meta.env.BASE_URL + 'assets/site-evidence.png") center / cover', opacity: .42 }} animate={{ scale: [1, 1.04, 1], x: [0, -8, 0] }} transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }} />
        <div className="scene-layer" style={{ background: 'linear-gradient(90deg, #10212b 3%, rgba(16,33,43,.88) 45%, rgba(16,33,43,.15) 100%)' }} />
        <div style={{ flex: 1, zIndex: 10 }}>
          <Reveal delay={.1}><div className="eyebrow">BUKTI YANG DAPAT DIPERCAYA</div></Reveal>
          <Reveal delay={.35}><h2 className="display headline-wide" style={{ margin: '1.5vmin 0 0', maxWidth: '10ch' }}>Material diuji.<br /><span style={{ color: 'var(--color-accent)' }}>Lokasi terbaca.</span></h2></Reveal>
          <Reveal delay={.74}><p className="body-copy" style={{ marginTop: '2vmin' }}>Hasil uji material dan evidence geo-tagged menyatukan angka, foto, waktu, dan titik pekerjaan.</p></Reveal>
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
        <motion.div className="glass-card" style={{ padding: '3vmin', width: '42vmin' }} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: .8, ease: EASE }}>
          <div className="mono" style={{ color: 'var(--color-accent)', fontSize: 'clamp(.65rem, 1.2vmin, .9rem)' }}>EVIDENCE PACK</div>
          <div style={{ alignItems: 'end', display: 'flex', gap: '2vmin', marginTop: '3vmin' }}>
            <div className="display" style={{ fontSize: 'clamp(3rem, 7vmin, 6rem)', lineHeight: .8 }}>28.4</div><span className="micro-label" style={{ marginBottom: '1vmin', fontSize: 'clamp(.65rem, 1.2vmin, .9rem)' }}>MPa<br />hasil tekan</span>
          </div>
          <div style={{ alignItems: 'center', display: 'flex', gap: '1.2vmin', marginTop: '2.5vmin' }}><span style={{ background: 'var(--color-success)', borderRadius: '50%', display: 'block', height: '1.2vmin', width: '1.2vmin' }} /><span style={{ color: 'var(--color-text-secondary)', fontSize: 'clamp(.65rem, 1.2vmin, .9rem)' }}>-6.9142, 107.6098 · 14:32</span></div>
        </motion.div>
        </div>
        <div className="mono" style={{ bottom: '6vmin', color: 'rgba(244,239,230,.64)', fontSize: 'clamp(.55rem, 1vmin, .8rem)', position: 'absolute', right: '6vmin' }}>05 / 10 — UJI + GEO-TAG</div>
      </div>
    </SceneFrame>
  );
}

export function Scene06() {
  return (
    <SceneFrame tone="rust">
      <div className="scene-content" style={{ alignItems: 'center', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', position: 'relative', textAlign: 'center', zIndex: 10 }}>
        <div className="scene-layer grid-surface" style={{ opacity: .22 }} />
        <Reveal delay={.1}><div className="eyebrow">KETIDAKSESUAIAN BUKAN JALAN BUNTU</div></Reveal>
        <Reveal delay={.35}><h2 className="display headline-wide" style={{ margin: '1.5vmin 0 0', maxWidth: '14ch' }}>Temukan. <span style={{ color: '#f6c576' }}>Perbaiki.</span> Buktikan.</h2></Reveal>
        <Reveal delay={.8}><p className="body-copy" style={{ color: '#f5d8c0', margin: '3vmin auto 0', maxWidth: '40ch' }}>NCR dan CAPA mengubah temuan menjadi tindakan yang terukur—lalu kembali ke re-inspeksi.</p></Reveal>
        <div style={{ alignItems: 'center', display: 'flex', gap: '3vmin', justifyContent: 'center', marginTop: '7vmin' }}>
          {['NCR', 'CAPA', 'RE-INSPEKSI'].map((label, index) => (
            <motion.div key={label} style={{ alignItems: 'center', display: 'flex', gap: '3vmin' }} initial={{ opacity: 0, scale: .6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: .8 + index * .28, duration: .5, ease: EASE }}>
              <div className="glass-card" style={{ alignItems: 'center', borderColor: index === 2 ? 'var(--color-accent)' : 'rgba(255,255,255,.25)', display: 'flex', height: '14vmin', justifyContent: 'center', padding: '1vmin', width: '14vmin' }}><span className="display" style={{ color: index === 2 ? 'var(--color-accent)' : '#fff2dc', fontSize: 'clamp(1rem, 2.5vmin, 2rem)', textAlign: 'center' }}>{label}</span></div>
              {index < 2 && <span aria-hidden="true" style={{ background: 'var(--color-accent)', height: '2px', width: '4vmin' }} />}
            </motion.div>
          ))}
        </div>
        <div className="mono" style={{ bottom: '6vmin', color: 'rgba(255,242,220,.58)', fontSize: 'clamp(.55rem, 1vmin, .8rem)', position: 'absolute', right: '6vmin' }}>06 / 10 — NCR / CAPA / RE-INSPEKSI</div>
      </div>
    </SceneFrame>
  );
}

export function Scene07() {
  return (
    <SceneFrame>
      <div className="scene-content" style={{ display: 'flex', alignItems: 'center', gap: '5vmin', position: 'relative', zIndex: 10 }}>
        <motion.div className="scene-layer grid-surface" animate={{ opacity: [.35, .6, .35] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} />
        <div style={{ flex: 1 }}>
          <Reveal delay={.1}><div className="eyebrow">DOKUMEN TERKENDALI</div></Reveal>
          <Reveal delay={.35}><h2 className="display headline-wide" style={{ margin: '1.5vmin 0 0', maxWidth: '11ch' }}>Versi benar.<br /><span style={{ color: 'var(--color-accent)' }}>Audit siap.</span></h2></Reveal>
          <Reveal delay={.75}><p className="body-copy" style={{ marginTop: '2vmin' }}>Dokumen, revisi, persetujuan, dan audit internal berada dalam satu sumber kebenaran.</p></Reveal>
        </div>
        <div style={{ flex: 1, position: 'relative', height: '100%' }}>
          <motion.div className="paper-card" style={{ padding: '3.5vmin', position: 'absolute', right: '4vmin', top: '12vmin', transform: 'rotate(5deg)', width: '38vmin', zIndex: 2 }} initial={{ opacity: 0, y: -30, rotate: -9 }} animate={{ opacity: 1, y: 0, rotate: 5 }} transition={{ delay: .95, duration: .8, ease: EASE }}>
            <div className="mono" style={{ color: '#a24d35', fontSize: 'clamp(.6rem, 1.2vmin, .9rem)' }}>CONTROLLED DOCUMENT</div>
            <div className="display" style={{ fontSize: 'clamp(2.5rem, 5vmin, 4rem)', marginTop: '2vmin' }}>RMK<br />Rev. 03</div>
            <div style={{ borderTop: '2px solid rgba(24,49,61,.3)', marginTop: '2.5vmin', paddingTop: '1.5vmin' }}><span className="micro-label" style={{ color: '#527078', fontSize: 'clamp(.65rem, 1.2vmin, .9rem)' }}>Disetujui · 12.06.24</span></div>
            <motion.div style={{ border: '3px solid #337e67', color: '#337e67', fontFamily: 'var(--font-mono)', fontSize: 'clamp(.65rem, 1.3vmin, .95rem)', padding: '1vmin', position: 'absolute', right: '2.5vmin', top: '15vmin', transform: 'rotate(-12deg)' }} animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 2.2, repeat: Infinity }}>AUDITED</motion.div>
          </motion.div>
          <motion.div className="glass-card" style={{ padding: '2vmin 2.5vmin', position: 'absolute', right: '24vmin', bottom: '15vmin', width: '30vmin', zIndex: 3 }} initial={{ opacity: 0, x: 25 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.25, duration: .6, ease: EASE }}>
            <div className="mono" style={{ color: 'var(--color-success)', fontSize: 'clamp(.6rem, 1.2vmin, .9rem)' }}>AUDIT TRAIL</div>
            <div className="display" style={{ fontSize: 'clamp(2rem, 4vmin, 3.5rem)', marginTop: '1vmin' }}>100%</div>
            <div className="micro-label" style={{ fontSize: 'clamp(.65rem, 1.2vmin, .9rem)' }}>revisi terlacak</div>
          </motion.div>
        </div>
        <div className="mono" style={{ bottom: '6vmin', color: 'var(--color-text-muted)', fontSize: 'clamp(.55rem, 1vmin, .8rem)', position: 'absolute', right: '6vmin' }}>07 / 10 — KONTROL + AUDIT</div>
      </div>
    </SceneFrame>
  );
}

export function Scene08() {
  return (
    <SceneFrame tone="sand">
      <div className="scene-content" style={{ display: 'flex', alignItems: 'center', color: '#18313d', gap: '5vmin', position: 'relative', zIndex: 10 }}>
        <div className="scene-layer" style={{ background: 'radial-gradient(circle at 78% 22%, rgba(242,184,75,.55), transparent 26%), linear-gradient(135deg, transparent 50%, rgba(16,33,43,.07) 50%)' }} />
        <div style={{ flex: '0 0 45%' }}>
          <Reveal delay={.1}><div className="eyebrow" style={{ color: '#a24d35' }}>DARI DATA MENJADI KEPUTUSAN</div></Reveal>
          <Reveal delay={.35}><h2 className="display headline-wide" style={{ margin: '1.5vmin 0 0', maxWidth: '11ch' }}>Satu layar.<br /><span style={{ color: '#a24d35' }}>Gambaran utuh.</span></h2></Reveal>
          <Reveal delay={.75}><p className="body-copy" style={{ color: '#49666a', marginTop: '2vmin' }}>Dashboard dan laporan membuat status mutu terbaca—untuk bertindak sebelum masalah membesar.</p></Reveal>
        </div>
        <div style={{ flex: 1 }}>
        <motion.div className="glass-card" style={{ background: '#173540', padding: '3.5vmin', width: '100%' }} initial={{ opacity: 0, scale: .88 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1, duration: .9, ease: EASE }}>
          <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}><span className="mono" style={{ color: '#f4efe6', fontSize: 'clamp(.65rem, 1.2vmin, .9rem)' }}>QUALITY OVERVIEW</span><span style={{ color: '#7fd5ae', fontSize: 'clamp(.65rem, 1.2vmin, .9rem)' }}>LIVE</span></div>
          <div style={{ alignItems: 'end', display: 'flex', gap: '1vmin', margin: '3vmin 0 2vmin' }}><div className="display" style={{ color: '#f4efe6', fontSize: 'clamp(3rem, 7vmin, 6rem)', lineHeight: .85 }}>87.6</div><span className="micro-label" style={{ marginBottom: '1vmin', fontSize: 'clamp(.65rem, 1.2vmin, .9rem)' }}>quality index</span></div>
          <div style={{ background: '#31545d', height: '1.5vmin', overflow: 'hidden' }}><motion.div style={{ background: 'linear-gradient(90deg, #a24d35, #f2b84b)', height: '100%', transformOrigin: 'left', width: '87.6%' }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.3, duration: 1 }} /></div>
          <div style={{ display: 'flex', gap: '2vmin', marginTop: '3vmin' }}>{[['Open NCR', '12'], ['Inspected', '248'], ['On track', '94%']].map(([label, value]) => <div key={label} style={{ borderLeft: '2px solid #49666a', flex: 1, paddingLeft: '1.5vmin' }}><div className="display" style={{ color: '#f4efe6', fontSize: 'clamp(1.5rem, 3.5vmin, 3rem)' }}>{value}</div><div className="micro-label" style={{ fontSize: 'clamp(.6rem, 1.2vmin, .9rem)' }}>{label}</div></div>)}</div>
        </motion.div>
        </div>
        <div className="mono" style={{ bottom: '6vmin', color: '#6b8587', fontSize: 'clamp(.55rem, 1vmin, .8rem)', position: 'absolute', right: '6vmin' }}>08 / 10 — DASHBOARD + LAPORAN</div>
      </div>
    </SceneFrame>
  );
}

export function Scene09() {
  return (
    <SceneFrame>
      <div className="scene-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', position: 'relative', zIndex: 10 }}>
        <div className="scene-layer grid-surface" />
        <Reveal delay={.1}><div className="eyebrow">SATU SISTEM. BANYAK PERAN.</div></Reveal>
        <Reveal delay={.35}><h2 className="display headline-wide" style={{ margin: '1.5vmin 0 0', maxWidth: '20ch' }}>Bekerja sesuai <span style={{ color: 'var(--color-accent)' }}>kompetensi.</span></h2></Reveal>
        <Reveal delay={.75}><p className="body-copy" style={{ margin: '2.5vmin auto 0', maxWidth: '50ch' }}>Peran lapangan, Quality Engineer, QA Engineer, hingga manajer proyek bergerak dalam alur yang sama.</p></Reveal>
        <motion.div className="glass-card" style={{ padding: '3.5vmin', width: '65vmin', marginTop: '5.5vmin' }} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: .8, ease: EASE }}>
          <div className="mono" style={{ color: 'var(--color-accent)', fontSize: 'clamp(.65rem, 1.2vmin, .9rem)', textAlign: 'left', marginBottom: '2.5vmin' }}>SELARAS DENGAN SKKNI</div>
          <div style={{ display: 'grid', gap: '2vmin' }}>{[['333-2013', 'Pelaksana lapangan'], ['387-2013', 'Pengendalian mutu'], ['145-2019', 'Manajemen konstruksi']].map(([code, label], index) => <motion.div key={code} style={{ alignItems: 'center', display: 'flex', gap: '3vmin', borderBottom: index < 2 ? '1px solid rgba(255,255,255,0.1)' : 'none', paddingBottom: index < 2 ? '2vmin' : '0' }} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.2 + index * .15 }}><span className="display" style={{ color: index === 1 ? 'var(--color-primary)' : '#f4efe6', fontSize: 'clamp(1.5rem, 3vmin, 2.5rem)', minWidth: '14vmin', textAlign: 'left' }}>{code}</span><span className="micro-label" style={{ fontSize: 'clamp(.7rem, 1.3vmin, .95rem)' }}>{label}</span></motion.div>)}</div>
        </motion.div>
        <div className="mono" style={{ bottom: '6vmin', color: 'var(--color-text-muted)', fontSize: 'clamp(.55rem, 1vmin, .8rem)', position: 'absolute', right: '6vmin' }}>09 / 10 — ROLE-BASED WORK</div>
      </div>
    </SceneFrame>
  );
}

export function Scene10() {
  return (
    <SceneFrame tone="rust">
      <div className="scene-content" style={{ alignItems: 'center', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', position: 'relative', textAlign: 'center', zIndex: 10 }}>
        <motion.div className="scene-layer grid-surface" style={{ opacity: .22 }} animate={{ backgroundPosition: ['0 0', '4vmin 4vmin'] }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }} />
        <motion.div style={{ border: '1px solid rgba(246,197,118,.55)', borderRadius: '50%', height: '80vmin', left: '50%', position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)', width: '80vmin' }} animate={{ rotate: 360, scale: [1, 1.04, 1] }} transition={{ rotate: { duration: 28, repeat: Infinity, ease: 'linear' }, scale: { duration: 6, repeat: Infinity, ease: 'easeInOut' } }} />
        <Reveal delay={.1}><div className="eyebrow">MUTU YANG TERLIHAT ADALAH MUTU YANG TERKENDALI</div></Reveal>
        <Reveal delay={.42}><h2 className="display" style={{ fontSize: 'clamp(4rem, 10vmin, 11rem)', lineHeight: .82, margin: '3vmin auto 0', maxWidth: '14ch' }}>Jejak yang<br /><span style={{ color: '#f6c576' }}>tak putus.</span></h2></Reveal>
        <Reveal delay={.9}><p className="body-copy" style={{ color: '#f5d8c0', fontSize: 'clamp(1rem, 2vmin, 1.5rem)', margin: '4vmin auto 0' }}>Traceability. Compliance. Continuous improvement.</p></Reveal>
        <motion.div className="mono" style={{ bottom: '7vmin', color: '#ffe0a9', fontSize: 'clamp(.55rem, 1vmin, .78rem)', position: 'absolute', right: '6vmin' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.35, duration: 1 }}>QA / QC KONSTRUKSI · 10 / 10</motion.div>
      </div>
    </SceneFrame>
  );
}