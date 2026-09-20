import {
  SafeFrame,
  VideoCanvas,
  type VideoAspectRatio,
  useVideoPlayer,
} from '@/lib/video';
import { AnimatePresence, motion } from 'framer-motion';

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

const SCENE_DURATIONS = {
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

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({
    durations: SCENE_DURATIONS,
  });

  return (
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
        animate={{ x: currentScene % 2 === 0 ? 0 : -18, y: currentScene % 3 === 0 ? 0 : 10 }}
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
          rotate: currentScene * 24,
          scale: currentScene === 0 ? 1.2 : currentScene === 9 ? .75 : 1,
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
          {currentScene === 0 && <Scene01 key="opening" />}
          {currentScene === 1 && <Scene02 key="fragmentation" />}
          {currentScene === 2 && <Scene03 key="plan" />}
          {currentScene === 3 && <Scene04 key="execution" />}
          {currentScene === 4 && <Scene05 key="evidence" />}
          {currentScene === 5 && <Scene06 key="corrective-action" />}
          {currentScene === 6 && <Scene07 key="controlled-documents" />}
          {currentScene === 7 && <Scene08 key="dashboard" />}
          {currentScene === 8 && <Scene09 key="roles" />}
          {currentScene === 9 && <Scene10 key="closing" />}
        </AnimatePresence>
      </SafeFrame>
    </VideoCanvas>
  );
}
