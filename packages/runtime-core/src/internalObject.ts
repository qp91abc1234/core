/**
 * Used during vnode props/slots normalization to check if the vnode props/slots
 * are the internal attrs / slots object of a component via
 * `Object.getPrototypeOf`. This is more performant than defining a
 * non-enumerable property. (one of the optimizations done for ssr-benchmark)
 */
const internalObjectProto = {}

/** 创建内部对象
 */
export const createInternalObject = (): any =>
  Object.create(internalObjectProto)

/** 检查是否为内部对象
 */
export const isInternalObject = (obj: object): boolean =>
  Object.getPrototypeOf(obj) === internalObjectProto
