import { Session } from "../core";
import { isFunction } from "./";

export async function usingUpstreamToProxy(
  upstream: string | ((data: Buffer, bridgedConnection: Session) => string) | Promise<string>,
  { data, bridgedConnection }: { data: Buffer; bridgedConnection: Session }
): Promise<string | false> {
  if (isFunction(upstream)) {
    // TODO: Solve with type guards/narrowing and remove ts-expect-error
    // @ts-expect-error upstream must be a function here
    let returnValue = upstream(data, bridgedConnection);
    if (returnValue instanceof Promise) {
      returnValue = await returnValue;
    }
    if (returnValue !== "localhost") {
      return returnValue;
    }
  }
  return false;
}
