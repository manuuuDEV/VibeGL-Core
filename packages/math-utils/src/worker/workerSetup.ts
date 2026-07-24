export function createPhysicsWorker(): Worker {
  const workerCode = `
    self.onmessage = function(e) {
      const { mass, position } = e.data;
      const newPos = [position[0], position[1] - (9.8 * 0.016), position[2]];
      self.postMessage({ newPosition: newPos });
    };
  `;
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
}