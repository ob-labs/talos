/**
 * @talos/core - Application Layer (Talos)
 *
 * This module exports the Talos application layer components.
 */

export { TaskLifecycleManager } from "./TaskLifecycleManager";
export type { TaskLifecycleManagerDependencies } from "./TaskLifecycleManager";

export { HealthChecker } from "./HealthChecker";
export type { HealthCheckerDependencies, TaskHealthStatus } from "./HealthChecker";

export { SocketServer } from "./SocketServer";
export type { SocketServerDependencies, SocketRequest, SocketResponse } from "./SocketServer";

export { UIManager } from "./UIManager";
export type { UIManagerDependencies } from "./UIManager";

export { Talos } from "./Talos";
