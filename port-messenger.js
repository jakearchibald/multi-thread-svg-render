class PortCaller {
  constructor(port) {
    this.port = port;

    // worker jobs awaiting response {callId: [resolve, reject]}
    this._pendingRequests = {};

    port.addEventListener('message', event => {
      const {portCallerResponseId, value, error} = event.data;

      if (!portCallerResponseId) return;

      const [resolve, reject] = this._pendingRequests[portCallerResponseId];
      delete this._pendingRequests[portCallerResponseId];

      if (error) {
        reject(new Error(error));
        return;
      }

      resolve(value);
    });

    port.start();
  }
  send(method, ...args) {
    this.port.postMessage({
      method,
      args
    });
  }
  call(method, ...args) {
    return new Promise((resolve, reject) => {
      const portCallerMessageId = Math.random();
      this._pendingRequests[portCallerMessageId] = [resolve, reject];

      this.port.postMessage({
        method,
        args,
        portCallerMessageId
      });
    });
  }
}

function portListener(port, methods) {
  port.addEventListener('message', event => {
    const {portCallerMessageId, method, args} = event.data;

    if (!method) return;

    // just a "send"
    if (!portCallerMessageId) {
      methods[method](...args);
      return;
    }

    const source = event.source || port;

    // It wants a response too
    new Promise(resolve => resolve(methods[method](...args))).then(value => {
      const transfer = [];
      //if (value instanceof ImageData) transfer.push(value);

      source.postMessage({
        portCallerResponseId: portCallerMessageId,
        value
      }, transfer);
    }, err => {
      source.postMessage({
        portCallerResponseId: portCallerMessageId,
        error: err.message
      });
    });
  });

  port.start();
}