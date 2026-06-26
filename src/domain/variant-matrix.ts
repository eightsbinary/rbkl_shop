export interface VariantAxis {
  readonly name: string;
  readonly values: ReadonlyArray<string>;
}

export interface VariantDraft {
  readonly optionValues: Record<string, string>;
}

export function generateVariants(axes: ReadonlyArray<VariantAxis>): VariantDraft[] {
  if (axes.length === 0) return [];
  if (axes.some((a) => a.values.length === 0)) return [];

  return axes.reduce<VariantDraft[]>((acc, axis) => {
    if (acc.length === 0) {
      return axis.values.map((v) => ({ optionValues: { [axis.name]: v } }));
    }
    return acc.flatMap((existing) =>
      axis.values.map((v) => ({
        optionValues: { ...existing.optionValues, [axis.name]: v },
      })),
    );
  }, []);
}
