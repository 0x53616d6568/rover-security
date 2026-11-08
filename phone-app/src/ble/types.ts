import type { ConnectionStatus } from "../protocol/types";

export interface BleAdapter {
  readonly id: string;
  isSupported(): boolean;
  supportMessage(): string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  writeCommand(frame: string): Promise<void>;
  onStatus(listener: (raw: string, receivedAt: number) => void): () => void;
  onConnection(listener: (connected: boolean, authorized: boolean, receivedAt: number) => void): () => void;
}

export type BleFactory = () => BleAdapter;

export type { ConnectionStatus };