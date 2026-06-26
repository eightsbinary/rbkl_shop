export interface StockLevel {
  readonly available: number;
  readonly reserved: number;
}

export class InsufficientStockError extends Error {
  constructor(requested: number, available: number) {
    super(`Insufficient stock: requested ${requested}, available ${available}`);
    this.name = 'InsufficientStockError';
  }
}

function assertPositive(qty: number, label: string): void {
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
}

export function reserve(level: StockLevel, qty: number): StockLevel {
  assertPositive(qty, 'reserve qty');
  if (level.available < qty) {
    throw new InsufficientStockError(qty, level.available);
  }
  return {
    available: level.available - qty,
    reserved: level.reserved + qty,
  };
}

export function commitReservation(level: StockLevel, qty: number): StockLevel {
  assertPositive(qty, 'commit qty');
  if (level.reserved < qty) {
    throw new Error(`Commit ${qty} exceeds reserved ${level.reserved}`);
  }
  return {
    available: level.available,
    reserved: level.reserved - qty,
  };
}

export function releaseReservation(level: StockLevel, qty: number): StockLevel {
  assertPositive(qty, 'release qty');
  if (level.reserved < qty) {
    throw new Error(`Release ${qty} exceeds reserved ${level.reserved}`);
  }
  return {
    available: level.available + qty,
    reserved: level.reserved - qty,
  };
}
