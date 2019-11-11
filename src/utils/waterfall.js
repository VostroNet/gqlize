

export default function waterfall(arr = [], func, start) {
  if (!Array.isArray(arr)) {
    arr = [arr];
  }
  return arr.reduce(function(promise, val) {
    return promise.then(function(prevVal) {
      return func(val, prevVal);
    });
  }, Promise.resolve(start));
}



export function waterfallSync(arr = [], func, start) {
  if (!Array.isArray(arr)) {
    arr = [arr];
  }
  return arr.reduce(function(prevVal, val) {
    return func(val, prevVal);
  }, start);
}
