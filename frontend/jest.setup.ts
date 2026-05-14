// Provide a localStorage shim for Zustand persist middleware in the node test environment.
// Zustand wraps all storage access in try/catch, so a simple in-memory map is sufficient.
const localStorageStore: Record<string, string> = {}

Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: (key: string) => localStorageStore[key] ?? null,
    setItem: (key: string, value: string) => { localStorageStore[key] = value },
    removeItem: (key: string) => { delete localStorageStore[key] },
    clear: () => { Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]) },
    key: (n: number) => Object.keys(localStorageStore)[n] ?? null,
    get length() { return Object.keys(localStorageStore).length },
  },
  writable: true,
})
