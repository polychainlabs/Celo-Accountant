import log from './log';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAsync<T extends Array<any>, U>(fn: (...args: T) => U): boolean {
  return fn.constructor.name === 'AsyncFunction';
}

export function execTime(
  //eslint-disable-next-line
  target: Record<string, any>,
  propertyName: string,
  descriptor: PropertyDescriptor,
): PropertyDescriptor {
  if (descriptor.value) {
    const originalMethod = descriptor.value;

    if (isAsync(descriptor.value)) {
      //eslint-disable-next-line
      descriptor.value = async function (...args: any[]): Promise<any> {
        const start = Date.now();
        log({
          message: 'Started execution',
          class: this.constructor.name,
          method: propertyName,
        });

        const result = await originalMethod.apply(this, args);
        const duration = Math.floor(Date.now() - start) / 1000;

        log({
          message: `Finished execution in ${duration}s`,
          class: this.constructor.name,
          method: propertyName,
          duration,
        });

        return result;
      };
    } else {
      //eslint-disable-next-line
      descriptor.value = function (...args: any[]): any {
        const start = Date.now();
        log({
          message: 'Started execution',
          class: this.constructor.name,
          method: propertyName,
        });

        const result = originalMethod.apply(this, args);
        const duration = Math.floor(Date.now() - start) / 1000;

        log({
          message: `Finished execution in ${duration}s`,
          class: this.constructor.name,
          method: propertyName,
          duration,
        });

        return result;
      };
    }

    return descriptor;
  }
  throw new Error('@execTime is applicable only on a methods.');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function catchAndLogAsync<T extends Array<any>, U>(
  fn: (...args: T) => Promise<U>,
): (...args: T) => Promise<U> {
  return async function (...args: T): Promise<U> {
    try {
      return await fn(...args);
    } catch (error) {
      log({
        message: error.message,
        trace: error.stack,
        args: args,
        method: fn.name,
        investigate: true,
      });
      throw new Error(`Unexpected error in ${fn.name}`);
    }
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function catchAndReturnDefaultAsync<T extends Array<any>, U>(
  fn: (...args: T) => Promise<U>,
  defaultValue: U,
): (...args: T) => Promise<U> {
  return async function (...args: T): Promise<U> {
    try {
      return await fn(...args);
    } catch (error) {
      log({
        message: error.message,
        trace: error.stack,
        args: args,
        method: fn.name,
        investigate: true,
      });
      return defaultValue;
    }
  };
}

// This is the decorator version
export function catchAndLog(
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  target: Record<string, any>,
  propertyName: string,
  descriptor: PropertyDescriptor,
): PropertyDescriptor {
  if (descriptor.value) {
    const originalMethod = descriptor.value;

    if (isAsync(descriptor.value)) {
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
      descriptor.value = async function (...args: any[]): Promise<any> {
        try {
          const result = await originalMethod.apply(this, args);
          return result;
        } catch (error) {
          const method = `${this.constructor.name}#${propertyName}`;
          log({
            message: `Error while running ${method}: ${error.message}`,
            args,
            trace: error.stack,
            method,
            investigate: true,
          });
        }
      };
    } else {
      //eslint-disable-next-line @typescript-eslint/no-explicit-any
      descriptor.value = function (...args: any[]): any {
        try {
          const result = originalMethod.apply(this, args);
          return result;
        } catch (error) {
          const method = `${this.constructor.name}#${propertyName}`;
          log({
            message: `Error while running ${method}: ${error.message}`,
            args,
            trace: error.stack,
            method,
            investigate: true,
          });
        }
      };
    }

    return descriptor;
  }
  throw new Error('@catchAndLog is applicable only on a methods.');
}
