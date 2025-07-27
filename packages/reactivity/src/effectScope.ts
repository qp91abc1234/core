import type { ReactiveEffect } from './effect'
import { warn } from './warning'

export let activeEffectScope: EffectScope | undefined

/** 副作用作用域
 * 副作用管理容器
 */
export class EffectScope {
  /** 是否激活
   */
  private _active = true
  /** 分离模式下，作用域是否激活的标志
   */
  private _on = 0
  /** 作用域内的响应式副作用
   */
  effects: ReactiveEffect[] = []
  /** 清理函数
   */
  cleanups: (() => void)[] = []

  /** 是否暂停
   */
  private _isPaused = false

  /** 父作用域
   * 仅在非分离模式下存在
   */
  parent: EffectScope | undefined
  /** 子作用域
   */
  scopes: EffectScope[] | undefined
  /** 非分离模式下在父作用域中的索引
   */
  private index: number | undefined

  constructor(public detached = false) {
    this.parent = activeEffectScope
    // 非分离模式存在父子作用域
    if (!detached && activeEffectScope) {
      this.index =
        (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(
          this,
        ) - 1
    }
  }

  /** 作用域是否激活
   */
  get active(): boolean {
    return this._active
  }

  /** 暂停作用域内的子作用域以及副作用
   */
  pause(): void {
    if (this._active) {
      this._isPaused = true
      let i, l
      if (this.scopes) {
        for (i = 0, l = this.scopes.length; i < l; i++) {
          this.scopes[i].pause()
        }
      }
      for (i = 0, l = this.effects.length; i < l; i++) {
        this.effects[i].pause()
      }
    }
  }

  /** 恢复作用域内的子作用域以及副作用
   */
  resume(): void {
    if (this._active) {
      if (this._isPaused) {
        this._isPaused = false
        let i, l
        if (this.scopes) {
          for (i = 0, l = this.scopes.length; i < l; i++) {
            this.scopes[i].resume()
          }
        }
        for (i = 0, l = this.effects.length; i < l; i++) {
          this.effects[i].resume()
        }
      }
    }
  }

  /** 作用域运行函数
   * 该函数内创建的作用域以及副作用会被加入管理
   */
  run<T>(fn: () => T): T | undefined {
    if (this._active) {
      const currentEffectScope = activeEffectScope
      try {
        activeEffectScope = this
        return fn()
      } finally {
        activeEffectScope = currentEffectScope
      }
    } else if (__DEV__) {
      warn(`cannot run an inactive effect scope.`)
    }
  }

  prevScope: EffectScope | undefined

  /** 手动激活作用域
   * 仅用于分离模式的作用域
   */
  on(): void {
    if (++this._on === 1) {
      this.prevScope = activeEffectScope
      activeEffectScope = this
    }
  }

  /** 手动取消激活作用域
   * 仅用于分离模式的作用域
   */
  off(): void {
    if (this._on > 0 && --this._on === 0) {
      activeEffectScope = this.prevScope
      this.prevScope = undefined
    }
  }

  /** 作用域停用
   */
  stop(fromParent?: boolean): void {
    if (this._active) {
      this._active = false
      let i, l
      for (i = 0, l = this.effects.length; i < l; i++) {
        this.effects[i].stop()
      }
      this.effects.length = 0

      for (i = 0, l = this.cleanups.length; i < l; i++) {
        this.cleanups[i]()
      }
      this.cleanups.length = 0

      if (this.scopes) {
        for (i = 0, l = this.scopes.length; i < l; i++) {
          this.scopes[i].stop(true)
        }
        this.scopes.length = 0
      }

      // 非分离模式，stop 后会从父作用域移除
      if (!this.detached && this.parent && !fromParent) {
        // optimized O(1) removal
        const last = this.parent.scopes!.pop()
        if (last && last !== this) {
          this.parent.scopes![this.index!] = last
          last.index = this.index!
        }
      }
      this.parent = undefined
    }
  }
}

/** 创建副作用作用域
 */
export function effectScope(detached?: boolean): EffectScope {
  return new EffectScope(detached)
}

/** 获取当前激活的副作用作用域
 */
export function getCurrentScope(): EffectScope | undefined {
  return activeEffectScope
}

/** 注册 cleanup 函数
 */
export function onScopeDispose(fn: () => void, failSilently = false): void {
  if (activeEffectScope) {
    activeEffectScope.cleanups.push(fn)
  } else if (__DEV__ && !failSilently) {
    warn(
      `onScopeDispose() is called when there is no active effect scope` +
        ` to be associated with.`,
    )
  }
}
