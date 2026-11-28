export interface RoverBinding {
  roverId: string;
  macMask: string;
  userId: string;
  connectionCount: number;
  activeConnection: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ManagementUser {
  id: string;
  name: string;
  activeRoverId?: string | null;
  createdAt: string;
  /** Local-only fallback password; backend users do not expose this. */
  password?: string;
}
