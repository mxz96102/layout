export const promisedFuncAnimationFrame = (func) => {
  let usingGlobal;

  if (typeof window !== 'undefined') {
    usingGlobal = window;
  } else if (typeof global !== 'undefined') {
    usingGlobal = global;
  }


  let callAnimationFrame;

  if (usingGlobal && usingGlobal.requestAnimationFrame) {
    callAnimationFrame = usingGlobal.requestAnimationFrame;
  } else if (usingGlobal && usingGlobal.setTimeout) {
    callAnimationFrame = (func) => {
      setTimeout(func, 0);
    };
  }

  if (!callAnimationFrame) {
    console.error('requestAnimationFrame is not supported');
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const runFunc = () => {
      const result = func();
      if (result) {
        resolve(result);
      } else {
        requestAnimationFrame(runFunc);
      }
    }
    runFunc()
  })
}