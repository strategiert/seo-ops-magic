export function stripUndefined<T extends object>(value: T): Partial<T> {
  const cleaned: Partial<T> = {};

  for (const key of Object.keys(value) as Array<keyof T>) {
    const entryValue = value[key];
    if (entryValue !== undefined) {
      cleaned[key] = entryValue;
    }
  }

  return cleaned;
}
