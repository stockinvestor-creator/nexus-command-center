import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const BOUNDS = { x: 14, y: 8, z: 4 };
const LINK_DIST = 2.6;

/** Drives rendering at ~40fps only while the tab is visible (frameloop="demand"). */
function Ticker({ active }: { active: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
    if (!active) return;
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      if (t - last > 24) {
        last = t;
        invalidate();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, invalidate]);
  return null;
}

function Network({ count, pointer }: { count: number; pointer: RefObject<{ x: number; y: number }> }) {
  const group = useRef<THREE.Group>(null);
  const pointsGeo = useRef<THREE.BufferGeometry>(null);
  const linesGeo = useRef<THREE.BufferGeometry>(null);

  const { positions, velocities, linePos, lineCol } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * BOUNDS.x;
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * BOUNDS.y;
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * BOUNDS.z;
      velocities[i * 3] = (Math.random() - 0.5) * 0.12;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.12;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
    }
    const maxSeg = count * 6;
    return { positions, velocities, linePos: new Float32Array(maxSeg * 6), lineCol: new Float32Array(maxSeg * 6) };
  }, [count]);

  const cA = useMemo(() => new THREE.Color('#22d3ee'), []);
  const cB = useMemo(() => new THREE.Color('#8b5cf6'), []);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    for (let i = 0; i < count; i++) {
      for (let a = 0; a < 3; a++) {
        const k = i * 3 + a;
        positions[k] += velocities[k] * delta * 6;
        const lim = a === 0 ? BOUNDS.x : a === 1 ? BOUNDS.y : BOUNDS.z;
        if (positions[k] > lim || positions[k] < -lim) velocities[k] *= -1;
      }
    }
    let seg = 0;
    const maxSeg = linePos.length / 6;
    for (let i = 0; i < count && seg < maxSeg; i++) {
      const ix = positions[i * 3], iy = positions[i * 3 + 1], iz = positions[i * 3 + 2];
      for (let j = i + 1; j < count && seg < maxSeg; j++) {
        const dx = ix - positions[j * 3], dy = iy - positions[j * 3 + 1], dz = iz - positions[j * 3 + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < LINK_DIST) {
          const f = (1 - d / LINK_DIST) * 0.55;
          const o = seg * 6;
          linePos[o] = ix; linePos[o + 1] = iy; linePos[o + 2] = iz;
          linePos[o + 3] = positions[j * 3]; linePos[o + 4] = positions[j * 3 + 1]; linePos[o + 5] = positions[j * 3 + 2];
          const c = (i + j) % 3 === 0 ? cB : cA;
          lineCol[o] = c.r * f; lineCol[o + 1] = c.g * f; lineCol[o + 2] = c.b * f;
          lineCol[o + 3] = c.r * f; lineCol[o + 4] = c.g * f; lineCol[o + 5] = c.b * f;
          seg++;
        }
      }
    }
    if (pointsGeo.current) pointsGeo.current.attributes.position.needsUpdate = true;
    if (linesGeo.current) {
      linesGeo.current.setDrawRange(0, seg * 2);
      linesGeo.current.attributes.position.needsUpdate = true;
      linesGeo.current.attributes.color.needsUpdate = true;
    }
    if (group.current && pointer.current) {
      // mouse parallax
      group.current.rotation.y += (pointer.current.x * 0.18 - group.current.rotation.y) * 0.04;
      group.current.rotation.x += (-pointer.current.y * 0.12 - group.current.rotation.x) * 0.04;
    }
  });

  return (
    <group ref={group}>
      <points>
        <bufferGeometry ref={pointsGeo}>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.07} color="#a5f3fc" transparent opacity={0.85} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <lineSegments>
        <bufferGeometry ref={linesGeo}>
          <bufferAttribute attach="attributes-position" args={[linePos, 3]} />
          <bufferAttribute attach="attributes-color" args={[lineCol, 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
    </group>
  );
}

function FloatingShapes({ pointer }: { pointer: RefObject<{ x: number; y: number }> }) {
  const a = useRef<THREE.Mesh>(null);
  const b = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const px = pointer.current?.x ?? 0;
    const py = pointer.current?.y ?? 0;
    if (a.current) {
      a.current.rotation.x = t * 0.08;
      a.current.rotation.y = t * 0.12;
      a.current.position.set(-9 + px * 0.6, 3.5 + Math.sin(t * 0.3) * 0.4 + py * 0.4, -3);
    }
    if (b.current) {
      b.current.rotation.x = -t * 0.1;
      b.current.rotation.z = t * 0.07;
      b.current.position.set(9.5 + px * 0.9, -3.8 + Math.cos(t * 0.25) * 0.5 + py * 0.5, -2);
    }
    if (ring.current) {
      ring.current.rotation.z = t * 0.05;
      ring.current.rotation.x = 1.1 + Math.sin(t * 0.2) * 0.1;
    }
  });
  return (
    <>
      <mesh ref={a}>
        <icosahedronGeometry args={[1.4, 1]} />
        <meshBasicMaterial color="#22d3ee" wireframe transparent opacity={0.14} />
      </mesh>
      <mesh ref={b}>
        <octahedronGeometry args={[1.1, 0]} />
        <meshBasicMaterial color="#a78bfa" wireframe transparent opacity={0.16} />
      </mesh>
      <mesh ref={ring} position={[4, 5, -6]}>
        <torusGeometry args={[3.2, 0.012, 8, 120]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.22} />
      </mesh>
    </>
  );
}

/** Ambient Three.js scene. Lazy-loaded; pauses when the tab is hidden; static under reduced motion. */
export default function ParticleBackground({ shapes = true }: { shapes?: boolean }) {
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const pointer = useRef({ x: 0, y: 0 });
  const count = useMemo(() => (window.innerWidth < 768 ? 55 : window.innerWidth < 1400 ? 95 : 130), []);

  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === 'visible');
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMq = () => setReduced(mq.matches);
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    document.addEventListener('visibilitychange', onVis);
    mq.addEventListener('change', onMq);
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      mq.removeEventListener('change', onMq);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 opacity-60" aria-hidden>
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 12], fov: 60 }}
        gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
      >
        <Ticker active={visible && !reduced} />
        <Network count={count} pointer={pointer} />
        {shapes && <FloatingShapes pointer={pointer} />}
      </Canvas>
    </div>
  );
}
