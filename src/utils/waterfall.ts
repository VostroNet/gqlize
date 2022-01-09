

export default function waterfall(arr: any [] = [], func = ((val: any, prevVal: any): any => {}), start?: any) {
  if (!Array.isArray(arr)) {
    arr = [arr];
  }
  return arr.reduce(function(promise: Promise<any>, val: any) {
    return promise.then(function(prevVal) {
      return func(val, prevVal);
    });
  }, Promise.resolve(start));
}



export function waterfallSync(arr: any[] = [], func = ((val: any, prevVal: any): any => {}), start?: any) {
  if (!Array.isArray(arr)) {
    arr = [arr];
  }
  return arr.reduce(function(prevVal, val) {
    return func(val, prevVal);
  }, start);
}
