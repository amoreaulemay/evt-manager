import "disposablestack/auto"

/**
 * @class EventManager
 * @implements {Disposable}
 * 
 * This class is responsible for managing event listeners on event targets. It provides methods to register and deregister event listeners.
 * It also implements the Disposable interface to release resources when no longer needed.
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
  /**
   * @internal
   * 
   * A private map to store the registered events. Each key is an event target and the value is a map where each key is an event name and the value is an array of event listeners.
   */
  #events: Map<EventTarget, Map<string, Array<EventListenerOrEventListenerObject>>> = new Map();

  /**
   * Registers an event listener to a specified event target.
   * 
   * @param {EventTarget} target - The event target to attach the event listener to.
   * @param {string} eventName - The event type to listen for.
   * @param {EventListenerOrEventListenerObject} callback - The function to execute when the event is dispatched.
   * @param {boolean | AddEventListenerOptions} [options] - Optional. An options object that specifies characteristics about the event listener. Can also be a boolean value where true indicates that the event handler is a capturing one.
   * @throws {Error} If registration fails for any reason.
   */
  register(target: EventTarget, eventName: string, callback: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
    try {
      target.addEventListener(eventName, callback, options);
      const targetEvents = this.#events.get(target) || new Map();
      const events = targetEvents.get(eventName) || [];
      events.push(callback);
      targetEvents.set(eventName, events);
      this.#events.set(target, targetEvents);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to register event for target: ${target}. Error: ${error.message}`, { cause: error.cause });
      } else {
        throw new Error(`Failed to register event for target: ${target}. An unknown error occurred.`);
      }
    }
  }

  /**
   * Deregisters an event listener from the given event target.
   * @param target - The event target to remove the event listener from.
   * @throws {Error} If no event is found for the provided target.
   * @throws {Error} If deregistration fails for any reason.
   */
  deregister(target: EventTarget, eventName: string, callback: EventListenerOrEventListenerObject) {
    const targetEvents = this.#events.get(target);
    if (!targetEvents) {
      throw new Error(`No event found for the provided target: ${target}`);
    }
    const events = targetEvents.get(eventName);
    if (!events) {
      throw new Error(`No event found for the provided target: ${target} with event name: ${eventName}`);
    }
    const eventIndex = events.findIndex(event => event === callback);
    if (eventIndex === -1) {
      throw new Error(`No event found for the provided target: ${target} with event name: ${eventName}`);
    }
    try {
      target.removeEventListener(eventName, callback);
      events.splice(eventIndex, 1);
      if (events.length === 0) {
        targetEvents.delete(eventName);
      } else {
        targetEvents.set(eventName, events);
      }
      if (targetEvents.size === 0) {
        this.#events.delete(target);
      } else {
        this.#events.set(target, targetEvents);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to deregister event for target: ${target}. Error: ${error.message}`, { cause: error.cause });
      } else {
        throw new Error(`Failed to deregister event for target: ${target}. An unknown error occurred.`);
      }
    }
  }

  /**
   * Implements the Disposable interface's dispose method.
   * This method is called to release resources held by an object.
   * Here, it deregisters all registered event listeners.
   */
  [Symbol.dispose]() {
    for (const [target, targetEvents] of this.#events.entries()) {
      for (const [eventName, events] of targetEvents.entries()) {
        for (const event of events) {
          try {
            this.deregister(target, eventName, event);
          } catch (error) {
            if (error instanceof Error) {
              console.warn(`Failed to dispose event for target: ${target}. Error: ${error.message}`, { cause: error.cause });
            } else {
              console.warn(`Failed to dispose event for target: ${target}. An unknown error occurred.`);
            }
          }
        }
      }
    }
  }
}

/**
 * Type alias for a function that disposes an early event.
 */
type EarlyEventDispose = () => void;
/**
 * Type alias for a event listenener name.
 */
type EventName = string;

/**
 * EventManagerV2 is a utility class that provides methods for managing event listeners.
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
export class EventManagerV2 implements Disposable {
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
      console.debug('EventManagerV2 disposing event listener:', target, eventName, callback);
      this.#callbackDispose(target, eventName, callback);
    });

    const symbol = Symbol();
    earlyDisposeMap.set(symbol, () => {
      console.debug('EventManagerV2 disposing early event listener:', target, eventName, callback);

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
