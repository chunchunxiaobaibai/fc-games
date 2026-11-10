/** Replace this adapter with an account-scoped store when cloud saves are available. */
export interface GameSaveStore {
  read(gameId: string): Promise<unknown>;
  write(gameId: string, save: unknown): Promise<void>;
}

export const localGameSaves: GameSaveStore = {
  async read(gameId) {
    const raw = localStorage.getItem('fcgames:save:' + gameId);
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return undefined;
    }
  },
  async write(gameId, save) {
    localStorage.setItem('fcgames:save:' + gameId, JSON.stringify(save));
  },
};
