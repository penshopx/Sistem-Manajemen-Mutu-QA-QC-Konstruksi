import {
  SafeFrame,
  VideoCanvas,
  VideoPausedContext,
  type VideoAspectRatio,
  useVideoPlayer,
} from '@/lib/video';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, type ComponentType } from 'react';

import {
  Scene01,
  Scene02,
  Scene03,
  Scene04,
  Scene05,
  Scene06,
  Scene07,
  Scene08,
  Scene09,
  Scene10,
} from './video_scenes/Scenes';

export const SCENE_DURATIONS = {
  opening: 7000,
  fragmentation: 9000,
  plan: 9000,
  execution: 11000,
  evidence: 10000,
  correctiveAction: 10000,
  controlledDocuments: 10000,
  dashboard: 10000,
  roles: 7000,
  closing: 7000,
};

const VIDEO_ASPECT_RATIO: VideoAspectRatio = '16:9';

const SCENE_COMPONENTS: Record<string, ComponentType> = {
  opening: Scene01,
  fragmentation: Scene02,
  plan: Scene03,
  execution: Scene04,
  evidence: Scene05,
  correctiveAction: Scene06,
  controlledDocuments: Scene07,
  dashboard: Scene08,
  roles: Scene09,
  closing: Scene10,
};

const SCENE_START_SEC: Record<string, number> = (() => {
  const offsets: Record<string, number> = {};
  let cumulativeMs = 0;
  for (const [key, duration] of Object.entries(SCENE_DURATIONS)) {
    offsets[key] = cumulativeMs / 1000;
    cumulativeMs += duration;
  }
  return offsets;
})();

const AUDIO_SEEK_EPSILON_SEC = 0.18;

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  paused = false,
  muted = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  paused?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop, paused });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSceneKeyRef = useRef<string | null>(null);
  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '');
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.45;
    if (paused) {
      audio.pause();
      return;
    }
    if (lastSceneKeyRef.current !== currentSceneKey) {
      lastSceneKeyRef.current = currentSceneKey;
      const targetTime = SCENE_START_SEC[baseSceneKey] ?? 0;
      if (Math.abs(audio.currentTime - targetTime) > AUDIO_SEEK_EPSILON_SEC) {
        audio.currentTime = targetTime;
      }
    }
    audio.play().catch(() => {});
  }, [baseSceneKey, currentSceneKey, muted, paused]);

  return (
    <VideoPausedContext.Provider value={paused}>
      <VideoCanvas
        className="video-root"
        aspectRatio={VIDEO_ASPECT_RATIO}
        style={{ background: 'var(--color-bg-dark)' }}
      >
      <motion.div
        aria-hidden="true"
        className="scene-layer"
        style={{
          background: 'radial-gradient(circle at 76% 34%, rgba(230,109,61,.18), transparent 27%), radial-gradient(circle at 13% 82%, rgba(155,183,182,.13), transparent 25%)',
          zIndex: 0,
        }}
        animate={{
          backgroundPosition: ['0% 0%', '7% 4%', '0% 0%'],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="scene-layer grid-surface"
        style={{ opacity: .28, zIndex: 1 }}
        animate={{ x: sceneIndex % 2 === 0 ? 0 : -18, y: sceneIndex % 3 === 0 ? 0 : 10 }}
        transition={{ duration: 1.3, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        style={{
          border: '1px solid rgba(242,184,75,.22)',
          borderRadius: '50%',
          height: '54vmin',
          position: 'absolute',
          right: '-18vmin',
          top: '-19vmin',
          width: '54vmin',
          zIndex: 2,
        }}
        animate={{
          rotate: sceneIndex * 24,
          scale: sceneIndex === 0 ? 1.2 : sceneIndex === 9 ? .75 : 1,
        }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.div
        aria-hidden="true"
        className="mono"
        style={{
          color: 'rgba(244,239,230,.52)',
          fontSize: 'clamp(.5rem, .85vmin, .68rem)',
          left: '6vmin',
          position: 'absolute',
          top: '3vmin',
          zIndex: 5,
        }}
        animate={{ opacity: [0.45, 0.8, 0.45] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        QA/QC // CONTROLLED QUALITY SYSTEM
      </motion.div>
      <SafeFrame>
        <AnimatePresence mode="sync" initial={false}>
          {SceneComponent && <SceneComponent key={currentSceneKey} />}
        </AnimatePresence>
      </SafeFrame>
        <audio
          ref={audioRef}
          src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`}
          preload="auto"
          autoPlay
          muted={muted}
        />
      </VideoCanvas>
    </VideoPausedContext.Provider>
  );
}
