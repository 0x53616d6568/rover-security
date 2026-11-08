import type { LinkStates } from "../ble/types";
import type {
  CommandAck,
  ConnectionStatus,
  RoverEvent,
  RoverTelemetry,
  SafetyState,
} from "../protocol/types";

export interface AxisState {
  forward: number;
  turn: number;
}

export interface AppState {
  connectionStatus: ConnectionStatus;
  connectionError?: string;
  authorized: boolean;
  links: LinkStates;
  safetyState: SafetyState;
  telemetry?: RoverTelemetry;
  lastCommand?: { sequence: number; frame: string; sentAt: number };
  lastAck?: CommandAck;
  axes: AxisState;
  events: RoverEvent[];
  demoMode: boolean;
  supported: boolean;
  supportMessage: string;
  lastSequence: number;
  joystickActive: boolean;
  armPending: boolean;
}

export type AppAction =
  | { type: "SET_SUPPORT"; supported: boolean; message: string }
  | { type: "SET_DEMO_MODE"; enabled: boolean }
  | { type: "CONNECTION_CHANGED"; connected: boolean; authorized: boolean; at: number }
  | { type: "LINKS_CHANGED"; links: LinkStates }
  | { type: "SET_CONNECTION_STATUS"; status: ConnectionStatus }
  | { type: "CONNECTION_ERROR"; message: string }
  | { type: "CLEAR_CONNECTION_ERROR" }
  | { type: "STATUS_RECEIVED"; telemetry: RoverTelemetry }
  | { type: "COMMAND_SENT"; sequence: number; frame: string; at: number }
  | { type: "AXES_CHANGED"; axes: AxisState; active: boolean }
  | { type: "SET_ARM_PENDING"; pending: boolean }
  | { type: "PUSH_EVENT"; event: RoverEvent }
  | { type: "RESET_SESSION" };

const MAX_EVENTS = 24;

export function createEvent(
  severity: RoverEvent["severity"],
  message: string,
  time = Date.now(),
): RoverEvent {
  return { id: `${time}-${Math.random().toString(36).slice(2, 8)}`, time, severity, message };
}

export function initialState(demoMode = false, supported = true, supportMessage = ""): AppState {
  return {
    connectionStatus: "idle",
    authorized: false,
    links: { telemetry: false, command: false },
    safetyState: "DISARMED",
    axes: { forward: 0, turn: 0 },
    events: [],
    demoMode,
    supported,
    supportMessage,
    lastSequence: 0,
    joystickActive: false,
    armPending: false,
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_SUPPORT":
      return { ...state, supported: action.supported, supportMessage: action.message };
    case "SET_DEMO_MODE":
      return { ...state, demoMode: action.enabled };
    case "SET_CONNECTION_STATUS":
      return { ...state, connectionStatus: action.status };
    case "LINKS_CHANGED":
      return { ...state, links: action.links };
    case "CONNECTION_CHANGED": {
      const connected = action.connected;
      const status: ConnectionStatus = connected ? "connected" : "disconnected";
      const event = createEvent(
        connected ? "info" : "warn",
        connected
          ? action.authorized
            ? "BLE link connected. Re-arm required."
            : "BLE link connected but not authorized."
          : "BLE link lost. Motion stopped.",
      );
      return {
        ...state,
        connectionStatus: status,
        authorized: connected && action.authorized,
        connectionError: undefined,
        safetyState: connected ? (action.authorized ? "DISARMED" : state.safetyState) : "SAFE_STOP",
        events: [event, ...state.events].slice(0, MAX_EVENTS),
        axes: { forward: 0, turn: 0 },
        joystickActive: false,
        armPending: false,
      };
    }
    case "CONNECTION_ERROR":
      return {
        ...state,
        connectionStatus: "error",
        connectionError: action.message,
        links: { telemetry: false, command: false },
        events: [createEvent("error", action.message), ...state.events].slice(0, MAX_EVENTS),
      };
    case "CLEAR_CONNECTION_ERROR":
      return { ...state, connectionError: undefined };
    case "STATUS_RECEIVED": {
      const telemetry = action.telemetry;
      const ack: CommandAck | undefined =
        telemetry.lastSequence !== undefined && telemetry.lastEvent
          ? { sequence: telemetry.lastSequence, event: telemetry.lastEvent, receivedAt: telemetry.receivedAt }
          : state.lastAck;
      const isHeartbeat = telemetry.lastEvent === "HEARTBEAT";
      const events =
        telemetry.lastEvent && !isHeartbeat
          ? [createEvent(telemetry.lastEvent === "ACCEPTED" ? "info" : telemetry.lastEvent.includes("REJECT") || telemetry.lastEvent === "FAULT" ? "error" : "warn", `Rover: ${telemetry.lastEvent}${telemetry.lastSequence !== undefined ? ` (seq ${telemetry.lastSequence})` : ""}`), ...state.events].slice(0, MAX_EVENTS)
          : state.events;
      // Avoid duplicate consecutive identical events.
      return {
        ...state,
        safetyState: telemetry.safetyState,
        telemetry,
        lastAck: ack,
        lastSequence:
          telemetry.lastSequence !== undefined
            ? Math.max(state.lastSequence, telemetry.lastSequence)
            : state.lastSequence,
        events,
      };
    }
    case "COMMAND_SENT":
      return {
        ...state,
        lastCommand: { sequence: action.sequence, frame: action.frame, sentAt: action.at },
        lastSequence: action.sequence,
      };
    case "AXES_CHANGED":
      return { ...state, axes: action.axes, joystickActive: action.active };
    case "SET_ARM_PENDING":
      return { ...state, armPending: action.pending };
    case "PUSH_EVENT":
      return { ...state, events: [action.event, ...state.events].slice(0, MAX_EVENTS) };
    case "RESET_SESSION":
      return initialState(state.demoMode, state.supported, state.supportMessage);
    default:
      return state;
  }
}