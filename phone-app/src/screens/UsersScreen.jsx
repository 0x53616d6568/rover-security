import { useCallback, useEffect, useMemo, useState } from "react";

import { addRover, addUser, connectRover, deleteRover, getUsers, getUserRovers, logoutUser } from "../app/management";

const sectionClass = "rounded-2xl border border-white/10 bg-white/[0.04] p-4";
const rowClass = "rounded-xl bg-white/5 p-3";
const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-text-primary placeholder:text-white/30 focus:border-green-400/50 focus:outline-none";
const buttonClass = "rounded-xl bg-green-400/90 px-3 py-2 text-xs font-semibold text-deep";

export default function UsersScreen({ connect, disconnect, state }) {
  const [users, setUsers] = useState([]);
  const [roversByUser, setRoversByUser] = useState({});
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

  const refreshUsers = useCallback(async () => {
    const nextUsers = await getUsers();
    setUsers(nextUsers);
    return nextUsers;
  }, []);

  const refreshRovers = useCallback(async (userId) => {
    const data = await getUserRovers(userId);
    setRoversByUser((previous) => ({ ...previous, [userId]: data.rovers ?? [] }));
  }, []);

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

  const saveRover = async (userId, roverId) => {
    setAddingRover((previous) => ({ ...previous, [`${userId}:${roverId}`]: true }));
    setRoverError("");
    try {
      await addRover(userId, addRoverMacs[userId] ?? "");
      setAddRoverMacs((previous) => ({ ...previous, [userId]: "" }));
      await refreshRovers(userId);
    } catch (error) {
      setRoverError(error.message);
    } finally {
      setAddingRover((previous) => ({ ...previous, [`${userId}:${roverId}`]: false }));
    }
  };

  const removeRover = async (userId, roverId) => {
    if (window.confirm("Remove this rover binding?")) {
      setDeletingRover(true);
      try {
        await deleteRover(userId, roverId);
        await refreshRovers(userId);
      } catch (error) {
        setRoverError(error.message);
      } finally {
        setDeletingRover(false);
      }
    }
  };

  const selectRover = async (userId, rover) => {
    setConnectingRover((previous) => ({ ...previous, [rover.roverId]: true }));
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

  const usage = useMemo(() => {
    const byUser = new Map(users.map((user) => [user.id, user]));
    let connections = 0;
    let owners = 0;
    for (const rovers of Object.values(roversByUser)) {
      for (const rover of rovers) {
        if (rover.activeConnection) connections += 1;
        if (rover.userId && byUser.has(rover.userId)) owners += 1;
      }
    }
    return { connections, owners };
  }, [users, roversByUser]);

  return (
    <div className="space-y-4">
      <div className={sectionClass}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Owner and rover inventory</div>
            <div className="text-[10px] text-white/50">
              {users.length} owner(s) · {usage.owners} rover(s) · {usage.connections} active connection(s)
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedRoverId && (
              <button onClick={() => disconnect()} className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/70 hover:bg-white/15">
                Disconnect selected ({selectedRoverId})
              </button>
            )}
            <button onClick={() => void logoutUser()} className="rounded-full bg-red-500/80 px-3 py-1 text-[11px] font-semibold text-white hover:bg-red-500">
              Log out
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={addUserName}
            onChange={(event) => setAddUserName(event.target.value)}
            placeholder="Owner name"
            className={`${inputClass} min-w-36`}
          />
          <input
            type="password"
            value={addUserPassword}
            onChange={(event) => setAddUserPassword(event.target.value)}
            placeholder="Set password"
            className={`${inputClass} min-w-32`}
          />
          <button onClick={() => void addNewUser()} disabled={addingUser} className={`${buttonClass} px-4 py-2`}>
            {addingUser ? "Adding…" : "Add owner"}
          </button>
        </div>
        {userError && <p className="mt-2 text-xs text-red-300">{userError}</p>}
      </div>

      {users.map((user) => {
        const rovers = roversByUser[user.id] ?? [];
        return (
          <div key={user.id} className={sectionClass}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{user.name}</div>
                <div className="text-[10px] text-white/50">
                  Active rover: {user.activeRoverId ?? "None"} · ID: {user.id}
                </div>
              </div>
              <div className="text-[10px] text-white/50">
                {rovers.length} rover(s)
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {rovers.map((rover) => (
                <div key={rover.roverId} className={rowClass}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-white">Rover ID: {rover.roverId}</div>
                      <div className="text-[10px] text-white/50">
                        {rover.activeConnection ? "Backend connection: active" : "Backend connection: idle"}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        disabled={connectingRover[rover.roverId] || selectedRoverId === rover.roverId}
                        onClick={() => void selectRover(user.id, rover)}
                        className={`${buttonClass} px-3 py-1.5 text-[10px] ${selectedRoverId === rover.roverId ? "opacity-50" : ""}`}
                      >
                        {selectedRoverId === rover.roverId ? "Selected" : connectingRover[rover.roverId] ? "Selecting…" : "Select"}
                      </button>
                      <button disabled={deletingRover} onClick={() => void removeRover(user.id, rover.roverId)} className="rounded-xl bg-red-500/80 px-3 py-1.5 text-[10px] text-white">
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={addRoverMacs[user.id] ?? ""}
                onChange={(event) => setAddRoverMacs((previous) => ({ ...previous, [user.id]: event.target.value }))}
                placeholder="MAC address (AA:BB:CC:DD:EE:FF)"
                className={`${inputClass} min-w-56`}
              />
              <button
                disabled={addingRover[`${user.id}:new`] || !addRoverMacs[user.id]?.trim()}
                onClick={() => void saveRover(user.id, "new")}
                className={buttonClass}
              >
                Add rover
              </button>
            </div>
            {roverError && <p className="mt-2 text-xs text-red-300">{roverError}</p>}
          </div>
        );
      })}
    </div>
  );
}
