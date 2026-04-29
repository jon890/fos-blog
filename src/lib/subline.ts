export interface SublinePart {
  num: string | number;
  suffix: string;
}

export function isSublinePart(x: string | SublinePart): x is SublinePart {
  return typeof x === "object";
}
