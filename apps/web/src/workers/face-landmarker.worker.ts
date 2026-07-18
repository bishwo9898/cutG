/// <reference lib="webworker" />

import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

type WorkerRequest =
  | { kind: 'init'; modelUrl: string }
  | { kind: 'frame'; bitmap: ImageBitmap; timestamp: number };

let landmarker: FaceLandmarker | null = null;

const initialize = async (modelUrl: string): Promise<void> => {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm',
  );
  landmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: modelUrl, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numFaces: 2,
    minFaceDetectionConfidence: 0.65,
    minFacePresenceConfidence: 0.65,
    minTrackingConfidence: 0.6,
  });
  self.postMessage({ kind: 'ready' });
};

self.onmessage = (event: MessageEvent<WorkerRequest>): void => {
  const message = event.data;
  if (message.kind === 'init') {
    void initialize(message.modelUrl).catch(() => self.postMessage({ kind: 'unavailable' }));
    return;
  }
  if (landmarker === null) {
    message.bitmap.close();
    return;
  }
  try {
    const result = landmarker.detectForVideo(message.bitmap, message.timestamp);
    const face = result.faceLandmarks[0];
    if (face === undefined) {
      self.postMessage({
        kind: 'result',
        faceCount: result.faceLandmarks.length,
        yaw: 0,
        centered: false,
        hairlineVisible: false,
        poseScore: 0,
      });
      return;
    }
    const nose = face[1];
    const forehead = face[10];
    const left = face[234];
    const right = face[454];
    if (nose === undefined || forehead === undefined || left === undefined || right === undefined)
      return;
    const leftDistance = Math.abs(nose.x - left.x);
    const rightDistance = Math.abs(right.x - nose.x);
    const yaw = (leftDistance - rightDistance) / Math.max(0.001, leftDistance + rightDistance);
    const centered = nose.x > 0.3 && nose.x < 0.7 && nose.y > 0.25 && nose.y < 0.68;
    self.postMessage({
      kind: 'result',
      faceCount: result.faceLandmarks.length,
      yaw,
      centered,
      hairlineVisible: forehead.y > 0.035,
      poseScore: Math.max(0, Math.min(1, 1 - Math.abs(nose.x - 0.5) * 2)),
    });
  } finally {
    message.bitmap.close();
  }
};
