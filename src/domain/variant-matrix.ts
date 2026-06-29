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

function sameOptions(a: Record<string, string>, b: Record<string, string>): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  return ak.length === bk.length && ak.every((k) => a[k] === b[k]);
}

export function diffVariants(
  existing: { id: string; option_values: Record<string, string> }[],
  desired: Record<string, string>[],
): {
  keep: { id: string; option_values: Record<string, string> }[];
  add: Record<string, string>[];
  removeIds: string[];
} {
  const keep = existing.filter((e) => desired.some((d) => sameOptions(e.option_values, d)));
  const add = desired.filter((d) => !existing.some((e) => sameOptions(e.option_values, d)));
  const removeIds = existing
    .filter((e) => !desired.some((d) => sameOptions(e.option_values, d)))
    .map((e) => e.id);
  return { keep, add, removeIds };
}
