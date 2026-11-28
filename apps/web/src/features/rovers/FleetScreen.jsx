import { useCallback, useEffect, useMemo, useState } from "react";
import { LogOut, Plus, RadioTower, Trash2 } from "lucide-react";

import { addRover, addUser, connectRover, deleteRover, getUsers, getUserRovers } from "./management";
import {
  Button,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Panel,
  PanelHeader,
  StatusPill,
} from "../../shared/ui";

export default function FleetScreen({ connect, disconnect, state, auth, onLogout }) {
  const [users, setUsers] = useState([]);
  const [roversByUser, setRoversByUser] = useState({});
  const [manageByUser, setManageByUser] = useState({});
  const [addUserName, setAddUserName] = useState("");
  const [addUserPassword, setAddUserPassword] = useState("");
  const [addingUser, setAddingUser] = useState(false);
  const [userError, setUserError] = useState("");
  const [addRoverMacs, setAddRoverMacs] = useState({});
  const [addingRover, setAddingRover] = useState({});
  const [roverError, setRoverError] = useState("");
  const [deletingRover, setDeletingRover] = useState(false);
  const [connectingRover, setConnectingRover] = useState({});

  const selectedRoverId = state.selectedRoverId;
  const currentUserId = auth?.id;

  const refreshUsers = useCallback(async () => {
    const nextUsers = await getUsers();
    setUsers(nextUsers);
    return nextUsers;
  }, []);

  const refreshRovers = useCallback(
    async (userId) => {
      const data = await getUserRovers(userId);
      setRoversByUser((previous) => ({ ...previous, [userId]: data.rovers ?? [] }));
      setManageByUser((previous) => ({
        ...previous,
        [userId]: data.canManage ?? userId === currentUserId,
      }));
    },
    [currentUserId],
  );

  const refreshAll = useCallback(async () => {
    const nextUsers = await refreshUsers();
    await Promise.all(nextUsers.map((user) => refreshRovers(user.id)));
  }, [refreshRovers, refreshUsers]);

  useEffect(() => {
    void refreshAll().catch((error) => setUserError(error.message));
  }, [refreshAll]);

  const addNewUser = async () => {
    setAddingUser(true);
    setUserError("");
    try {
      await addUser(addUserName, addUserPassword);
      setAddUserName("");
      setAddUserPassword("");
      await refreshAll();
    } catch (error) {
      setUserError(error.message);
    } finally {
      setAddingUser(false);
    }
  };

  const saveRover = async (userId) => {
    if (!userId) return;
    setAddingRover((previous) => ({ ...previous, [userId]: true }));
    setRoverError("");
    try {
      await addRover(userId, addRoverMacs[userId] ?? "");
      setAddRoverMacs((previous) => ({ ...previous, [userId]: "" }));
      await refreshRovers(userId);
    } catch (error) {
      setRoverError(error.message);
    } finally {
      setAddingRover((previous) => ({ ...previous, [userId]: false }));
    }
  };

  const removeRover = async (userId, roverId) => {
    if (!window.confirm("Remove this rover binding from your account?")) return;
    setDeletingRover(true);
    setRoverError("");
    try {
      await deleteRover(userId, roverId);
      await refreshRovers(userId);
    } catch (error) {
      setRoverError(error.message);
    } finally {
      setDeletingRover(false);
    }
  };

  const selectRover = async (userId, rover) => {
    setConnectingRover((previous) => ({ ...previous, [rover.roverId]: true }));
    setRoverError("");
    try {
      await connectRover(rover.roverId, userId);
      await connect(rover.roverId);
      await refreshRovers(userId);
    } catch (error) {
      setRoverError(error.message);
    } finally {
      setConnectingRover((previous) => ({ ...previous, [rover.roverId]: false }));
    }
  };

  const summary = useMemo(() => {
    let rovers = 0;
    let connections = 0;
    for (const list of Object.values(roversByUser)) {
      for (const rover of list) {
        rovers += 1;
        if (rover.activeConnection) connections += 1;
      }
    }
    return { owners: users.length, rovers, connections };
  }, [users, roversByUser]);

  const currentOwner = users.find((user) => user.id === currentUserId);
  const otherOwners = users.filter((user) => user.id !== currentUserId);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Owners & bindings"
        title="Fleet"
        description="Each rover is bound to one owner by an encrypted MAC. You can manage and drive only the rovers bound to your own account."
        meta={
          <>
            <StatusPill tone="neutral" label={`${summary.owners} owner${summary.owners === 1 ? "" : "s"}`} dot={false} />
            <StatusPill tone="neutral" label={`${summary.rovers} rover${summary.rovers === 1 ? "" : "s"}`} dot={false} />
            <StatusPill
              tone={summary.connections > 0 ? "live" : "neutral"}
              label={`${summary.connections} active`}
            />
          </>
        }
        actions={
          <>
            {selectedRoverId && (
              <Button variant="secondary" size="sm" onClick={() => void disconnect()}>
                Disconnect
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => void onLogout()}>
              <LogOut size={13} />
              Sign out
            </Button>
          </>
        }
      />

      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-ink">{currentOwner?.name ?? auth?.name ?? "Your account"}</h2>
              <StatusPill tone="live" label="Your account" dot={false} />
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              {currentOwner?.activeRoverId
                ? `Active rover ${currentOwner.activeRoverId}`
                : "No active rover selected on the backend."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill tone="neutral" label={`${(roversByUser[currentUserId] ?? []).length} bound`} dot={false} />
          </div>
        </div>

        <div className="space-y-2 p-4">
          {(roversByUser[currentUserId] ?? []).length === 0 ? (
            <EmptyState
              title="No rover bound yet"
              description="Add the rover's MAC address below. The MAC is encrypted by the API and shown masked."
            />
          ) : (
            (roversByUser[currentUserId] ?? []).map((rover) => {
              const selected = selectedRoverId === rover.roverId;
              return (
                <div
                  key={rover.roverId}
                  className={`flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between ${
                    selected ? "border-accent/40 bg-accent-soft" : "border-line bg-bg-elevated"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <RadioTower size={14} className="text-accent" />
                      <span className="data-value truncate text-sm text-ink">{rover.macMask}</span>
                      {selected && <StatusPill tone="live" label="Selected" />}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-ink-faint">
                      <span>id {rover.roverId}</span>
                      <span>{rover.activeConnection ? "backend active" : "backend idle"}</span>
                      <span>{rover.connectionCount} connection(s)</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant={selected ? "secondary" : "primary"}
                      size="sm"
                      disabled={connectingRover[rover.roverId] || selected}
                      onClick={() => void selectRover(currentUserId, rover)}
                    >
                      {selected ? "Selected" : connectingRover[rover.roverId] ? "Selecting…" : "Select & connect"}
                    </Button>
                    <Button
                      variant="stop"
                      size="sm"
                      disabled={deletingRover}
                      onClick={() => void removeRover(currentUserId, rover.roverId)}
                      aria-label={`Remove rover ${rover.macMask}`}
                    >
                      <Trash2 size={12} />
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })
          )}

          {roverError && (
            <p role="alert" className="rounded-sm border border-danger-line bg-danger-soft px-3 py-2 text-xs text-danger">
              {roverError}
            </p>
          )}

          <div className="mt-2 grid gap-3 rounded-md border border-line bg-bg-elevated p-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field
              label="Bind a rover"
              htmlFor={`rover-mac-${currentUserId ?? "self"}`}
              hint="Accepted formats: AA:BB:CC:DD:EE:FF, AA-BB-CC-DD-EE-FF, or aabbccddeeff."
            >
              <Input
                id={`rover-mac-${currentUserId ?? "self"}`}
                value={addRoverMacs[currentUserId] ?? ""}
                onChange={(event) =>
                  setAddRoverMacs((previous) => ({ ...previous, [currentUserId]: event.target.value }))
                }
                placeholder="AA:BB:CC:DD:EE:FF"
                className="font-mono"
              />
            </Field>
            <Button
              variant="secondary"
              disabled={!currentUserId || addingRover[currentUserId] || !addRoverMacs[currentUserId]?.trim()}
              onClick={() => void saveRover(currentUserId)}
            >
              <Plus size={13} />
              {addingRover[currentUserId] ? "Adding…" : "Add rover"}
            </Button>
          </div>
        </div>
      </Panel>

      {otherOwners.length > 0 && (
        <Panel>
          <div className="p-4">
            <PanelHeader
              eyebrow="Directory"
              title="Other owners"
              description="Read-only view. Bindings and driving remain restricted to the signed-in owner."
              actions={<StatusPill tone="neutral" label="Read-only" dot={false} />}
            />
          </div>
          <div className="divide-y divide-line border-t border-line">
            {otherOwners.map((user) => {
              const rovers = roversByUser[user.id] ?? [];
              return (
                <div key={user.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-medium text-ink">{user.name}</div>
                    <div className="font-mono text-[10px] text-ink-faint">{user.id}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {rovers.length === 0 ? (
                      <span className="text-xs text-ink-faint">No rovers bound</span>
                    ) : (
                      rovers.map((rover) => (
                        <StatusPill
                          key={rover.roverId}
                          tone={rover.activeConnection ? "live" : "neutral"}
                          label={rover.macMask}
                          dot={rover.activeConnection}
                        />
                      ))
                    )}
                    {manageByUser[user.id] && <StatusPill tone="warn" label="Manageable" dot={false} />}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <Panel>
        <div className="p-4">
          <PanelHeader
            eyebrow="Provisioning"
            title="Add another owner"
            description="Creates a separate account with its own rover bindings. Passwords are hashed by the API with scrypt."
          />
        </div>
        <div className="grid gap-3 border-t border-line p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Owner name" htmlFor="new-owner-name">
            <Input
              id="new-owner-name"
              value={addUserName}
              onChange={(event) => setAddUserName(event.target.value)}
              placeholder="Owner name"
              autoComplete="off"
            />
          </Field>
          <Field label="Initial password" htmlFor="new-owner-password" hint="8–128 characters.">
            <Input
              id="new-owner-password"
              type="password"
              value={addUserPassword}
              onChange={(event) => setAddUserPassword(event.target.value)}
              placeholder="Set password"
              autoComplete="new-password"
            />
          </Field>
          <Button
            variant="secondary"
            disabled={addingUser || !addUserName.trim() || addUserPassword.length < 8}
            onClick={() => void addNewUser()}
          >
            <Plus size={13} />
            {addingUser ? "Adding…" : "Add owner"}
          </Button>
        </div>
        {userError && (
          <p role="alert" className="px-4 pb-4 text-xs text-danger">
            {userError}
          </p>
        )}
      </Panel>
    </div>
  );
}
