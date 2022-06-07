/**
 * leetcode practice:
 */

/**
 * 1. Two Sum
 */

const twoSum = (array, target) => {
  const map = new Map();
  for (const [idx, val] of array.entries()) {
    let complement = target - val;
    if (map.has(complement)) {
      return [map.get(complement), idx];
    }
    map.set(val, idx);
  }
  return [-1, -1];
};

/**
 * 4. Median of Two Sorted Arrays
 */
