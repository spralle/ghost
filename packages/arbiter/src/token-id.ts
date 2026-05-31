let counter = 0;

export function generateTokenId(prefix = "token"): string {
  return `${prefix}-${counter++}`;
}

export function resetTokenCounter(): void {
  counter = 0;
}
