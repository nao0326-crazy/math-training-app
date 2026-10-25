/** 朝のハイスピード計算ゲートのストレージ操作 */

export type {
  SpeedGateSession,
  SpeedGateProblem,
  SpeedGateAnswer,
  SpeedGateResult,
  SpeedGateStatus,
} from '../types/speedGate';

export {
  saveSpeedGateSession,
  loadSpeedGateSession,
  listSpeedGateSessions,
  isSpeedGateCompleted,
  deleteSpeedGateSession,
} from '../storage/db';
