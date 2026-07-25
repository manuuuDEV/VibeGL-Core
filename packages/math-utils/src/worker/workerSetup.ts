export function createPhysicsWorker(): Worker {
  const workerCode = `
    self.onmessage = function(e) {
      const { mass, position } = e.data;
      const newPos = [position[0], position[1] - (9.8 * 0.016), position[2]];
      self.postMessage({ newPosition: newPos });
    };
  `;
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const workerUrl = URL.createObjectURL(blob);
  const worker = new Worker(workerUrl);
  
  // Cleanup: revoke URL after worker is created to prevent memory leak
  // The worker maintains a reference to the code, so revoking is safe
  URL.revokeObjectURL(workerUrl);
  
  return worker;
}