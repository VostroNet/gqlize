export default class Cache {
  store: any;
  timeouts: any;
  constructor(defaultStore = {}) {
    this.store = defaultStore;
    this.timeouts = {};
  }
  set = (key: string, value: any, timeout?: number) => {
    this.store[key] = value;
    if (timeout && timeout > 0) {
      this.clearTimeout(key);
      this.timeouts[key] = setTimeout(() => {
        this.store[key] = undefined;
      }, timeout);
    }
    return this.store[key];
  }
  merge = (key: string, value: any, timeout?: number) => {
    return this.set(key, Object.assign(this.get(key, {}), value), timeout);
  }
  get = (key:string, defaultValue?: any) => {
    if (!this.store[key]) {
      return defaultValue;
    }
    return this.store[key];
  }
  clearTimeout = (key: string) => {
    if (this.timeouts[key]) {
      clearTimeout(this.timeouts[key]);
    }
  }
}
