
export default function unique(arr) {
  return arr.filter(function(value, index, self) {
    return self.indexOf(value) === index;
  });
}
