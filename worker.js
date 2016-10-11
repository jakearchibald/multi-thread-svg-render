importScripts('port-messenger.js');

class Rasterizer extends PortCaller {
  constructor(port) {
    super(port);
    this.available = true;
    this.ready = Promise.resolve();
  }
  rasterize(imgUrl, sx, sy, sw, sh, width, height) {
    let done;
    this.available = false;
    this.ready = new Promise(r => done = r);

    return this.call('rasterize', imgUrl, sx, sy, sw, sh, width, height).then(val => {
      this.available = true;
      done();
      return val;
    });
  }
}

const rasterizers = [];

rasterizers.getAvailable = function() {
  return new Promise(resolve => {
    for (const client of this) {
      if (client.available) {
        resolve(client);
        return;
      }
    }

    return Promise.race(
      this.map(client => client.ready.then(() => client))
    );
  });
};

const clients = [];

clients.send = function(method, ...args) {
  for (const client of this) {
    client.send(method, ...args);
  }
}

self.addEventListener('connect', event => {
  const port = event.ports[0];
  let instance = null;
  let collection = null;
  let type = '';

  portListener(port, {
    getRasterizerCount() {
      return rasterizers.length;
    },
    setType(t) {
      if (type) throw Error('Cannot set type twice');

      type = t;

      if (type == 'client') {
        instance = new PortCaller(port);
        collection = clients;
        collection.push(instance);
      }
      else if (type == 'rasterizer') {
        instance = new Rasterizer(port);
        collection = rasterizers;
        collection.push(instance);
        clients.send('updateRasterizerCount', rasterizers.length);
      }
    },
    remove() {
      const index = collection.indexOf(instance);
      if (index == -1) return;
      collection.splice(index, 1);

      if (type == 'rasterizer') {
        clients.send('updateRasterizerCount', rasterizers.length);
      }
    },
    rasterize(...args) {
      return rasterizers.getAvailable()
        .then(rasterizer => rasterizer.rasterize(...args));
    }
  });
});