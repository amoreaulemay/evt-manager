/// <reference no-default-lib="true"/>
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="esnext" />


import "core-js/actual/symbol/dispose"
import "core-js/actual/disposable-stack"

/**
 * Type alias for a function that disposes an early event.
 */
type EarlyEventDispose = () => void;
/**
 * Type alias for a event listenener name.
 */
type EventName = string;

/**
 * EventManager is a utility class that provides methods for managing event listeners.
 * It implements the Disposable interface, which provides a method to release resources held by an object.
 * The class maintains a map of event targets and their associated event listeners.
 * Each event listener is associated with a unique symbol and can be disposed individually or all at once.
 *
 * @example
 * class implements Disposable {
 *   #disposed = false;
 *   #disposables: DisposableStack | undefined;
 *   #manager: EventManager | undefined;
 *
 *   constructor() {
 *     using stack = new DisposableStack();
 *
 *     this.#manager = stack.use(new EventManager());
 *     this.#disposables = stack.move();
 *   }
 *
 *   [Symbol.dispose]() {
 *     if (!this.#disposed) {
 *       this.#disposed = true;
 *       const disposables = this.#disposables as DisposableStack;
 *
 *       this.#manager = undefined;
 *       this.#disposables = undefined;
 *
 *       disposables[Symbol.dispose]();
 *     }
 *   }
 * }
 */
export class EventManager implements Disposable {
  #disposed = false;
  #events: Map<EventTarget, [DisposableStack, Map<symbol, EarlyEventDispose>]> = new Map();

  /**
   * Removes an event listener from a target.
   * @param target - The target from which the event listener is to be removed.
   * @param eventName - The name of the event for which the listener is to be removed.
   * @param callback - The callback function to be removed.
   */
  #callbackDispose(target: EventTarget, eventName: EventName, callback: EventListenerOrEventListenerObject): void {
    try {
      target.removeEventListener(eventName, callback);
    } catch (error) {
      //? This is a non-fatal error and could be the result of an early disposal.
      if (error instanceof Error) {
        console.debug(`Failed to remove event listener for target: ${target}. Error: ${error.message}`, { cause: error.cause });
      } else {
        console.debug(`Failed to remove event listener for target: ${target}. An unknown error occurred.`);
      }
    }
  }

  /**
   * Registers an event listener to a target and returns a unique symbol for the registered event.
   * @param target - The target to which the event listener is to be added.
   * @param eventName - The name of the event for which the listener is to be added.
   * @param callback - The callback function to be executed when the event is triggered.
   * @param options - Optional. An options object that specifies characteristics about the event listener.
   * @returns A unique symbol for the registered event.
   * @throws {Error} If an error occurs while removing the event listener during disposal.
   */
  register(target: EventTarget, eventName: EventName, callback: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): symbol {
    const entry = this.#events.get(target);
    let stack: DisposableStack;
    let earlyDisposeMap: Map<symbol, EarlyEventDispose>;
    if (!entry) {
      using s = new DisposableStack();
      stack = s.move();
      earlyDisposeMap = new Map();
    } else {
      stack = entry[0].move();
      earlyDisposeMap = entry[1];
    }

    target.addEventListener(eventName, callback, options);
    stack.defer(() => {
      console.debug('EventManager disposing event listener:', target, eventName, callback);
      this.#callbackDispose(target, eventName, callback);
    });

    const symbol = Symbol();
    earlyDisposeMap.set(symbol, () => {
      console.debug('EventManager disposing early event listener:', target, eventName, callback);

      this.#callbackDispose(target, eventName, callback);

      const entry = this.#events.get(target);
      if (!entry) {
        console.warn(`No event found for target: ${target}`);
        return;
      }

      const currentStack = entry[0].move();
      const currentEarlyDisposeMap = entry[1];

      currentEarlyDisposeMap.delete(symbol);
      currentEarlyDisposeMap.size === 0 ? this.#events.delete(target) : this.#events.set(target, [currentStack.move(), currentEarlyDisposeMap]);
    })

    this.#events.set(target, [stack.move(), earlyDisposeMap]);

    return symbol;
  }

  /**
   * Deregisters an event listener from the given event target using the provided symbol.
   * @param target - The event target to remove the event listener from.
   * @param symbol - The unique symbol associated with the event listener.
   * @throws {Error} If no event is found for the provided target.
   * @throws {Error} If deregistration fails for any reason.
   */
  deregister(target: EventTarget, symbol: symbol) {
    const entry = this.#events.get(target);
    if (!entry) {
      console.warn(`No event listener found for target: ${target} with symbol: ${String(symbol)}`);
      return;
    }

    const [, earlyDisposeMap] = entry;
    const dispose = earlyDisposeMap.get(symbol);
    dispose ? dispose() : console.warn(`No early event listener found for target: ${target} with symbol: ${String(symbol)}`);
  }

  [Symbol.dispose]() {
    if (!this.#disposed) {
      this.#disposed = true;
      for (const [_, entry] of this.#events.entries()) {
        entry[0][Symbol.dispose]();
      }
      this.#events.clear();
      console.debug('EventManager disposed.');
    }
  }
}
