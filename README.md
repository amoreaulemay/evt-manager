# EventManager

## Overview

`EventManager` is a TypeScript utility class designed for efficient management of event listeners in web applications. It extends the capabilities of traditional event handling by offering a disposable interface and individual control over each event listener. This class is particularly useful in scenarios where dynamic event handling and resource management are critical.

This class is using the TC39 Stage 3 proposal for Explicit Resource Management. Polyfills and/or TypeScript 5.2 are required, as well as a transpiler for `using` keyword, such as Babel with plugin `"@babel/plugin-proposal-explicit-resource-management"`

## Features

- **Disposable Interface**: Implements a disposable pattern for efficient resource management.
- **Individual Event Listener Control**: Each event listener is associated with a unique symbol, allowing for precise control.
- **Dynamic Event Handling**: Facilitates the addition and removal of event listeners on-the-fly.

## Installation

To use `EventManager` in your project, install the package:

```bash
npm i @airfair/event-manager
# -- or
yarn add @airfair/event-manager
# -- or
pnpm add @airfair/event-manager
```

## Usage

### Importing the Class

First, import the `EventManager` class into your TypeScript file.

```ts
import { EventManager } from '@airfair/event-manager';
```

### Creating an Instance

Create an instance of `EventManager` to manage your event listeners

```ts
using evtManager = new EventManager();
```

### Registering Event Listeners

Use the `register` method to add event listeners. This method returns a unique symbol for each registered event.

```ts
const myEvent = evtManager.register(targetElement, 'click', cbFunction);
```

### Deregistering Event Listeners

To remove an event listener, use the `deregister` method with the target element and the symbol returned by the `register` method.

```ts
evtManager.deregister(targetElement, myEvent);
```

### Disposal

Upon disposal, this class will automatically deregister all event listeners attached to it. By utilising the TC39 Stage 3 proposal for Explicit Resource Management, this class will auto-dispose as soon as it goes out of scope. However manual disposal can be triggered.

```ts
evtManager[Symbol.dispose]()
```

### Example

Here's a simple example of how `EventManager` can be used in a project:

```ts
class MyClass implements Disposable {
  #disposed = false;
  #disposables: DisposableStack | undefined;
  #manager: EventManager | undefined;

  constructor() {
    using stack = new DisposableStack();

    this.#manager = stack.use(new EventManager());
    this.#disposables = stack.move();
  }

  [Symbol.dispose]() {
    if (!this.#disposed) {
      this.#disposed = true;
      const disposables = this.#disposables as DisposableStack;

      this.#manager = undefined;
      this.#disposables = undefined;

      disposables[Symbol.dispose]();
    }
  }
}
```

## License

This project is licensed under the MIT License.