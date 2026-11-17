/** Em produção, segredo ausente derruba o boot: um valor padrão conhecido deixaria qualquer um assinar tokens. */
export function requiredInProduction(name: string, devDefault: string): string {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} must be set in production`);
  }
  return devDefault;
}
