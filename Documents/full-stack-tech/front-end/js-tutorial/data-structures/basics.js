/**
 * Arrays
 */

/**
 * 1. Create and initialize an array
 */
let arr1 = new Array(); // []
arr1 = new Array(7); // create an array with certain length
arr1 = new Array(1, 2, 3, 4); // pass values to the array

const arr2 = [];

/**
 * 2. insert and remove element to an array
 * unshift/shift: insert/remove element at the beginning of an array
 * push/pop: insert/remove element at the end of an array
 * splice(start): remove all the elements from start to end and return an array of removed elements
 * splice(start, deleteCount) remove all deleteCount number of elements from start
 * splice(start, deleteCount, item1, item2, ..): return an array of removed elements
 * slice(start, end): return a new array from start to end(excluded)
 */

const arr3 = [1, 2, 3, 4, 5, 6, 7];
arr3.splice(2, 0, -1, -2);
console.log(arr3);

/**
 * 3. useful array methods
 */

// cancat: concatinate two or more arrays and return a new array
const zero = 0;
const positiveNums = [1, 2, 3];
const negativeNums = [-3, -2, -1];
const numbers = negativeNums.concat(zero, positiveNums);
console.log(numbers);

/**
 * 4. iteraors
 * every: iterate an array until return false
 * some: iterate an array until return true
 * forEach: loop through the entire array
 * map: stores the return value of callback function
 * filter: stores all element in the array when callback function returns true
 * reduce:
 */

/**
 * 5. search array
 * indexOf:
 * lastIndexOf:
 * find(callback):
 * findIndex(callback):
 * includes(searchElement, fromIndex)
 */
/**
 * 6. ways to sort an array
 * Array.sort();
 * Array.reverse();
 * Math.max.apply(null, arr);
 * Math.min.apply(null, arr);
 */

/**
 * ES6 Array methods
 * 1. @@iterator
 * 2. copyWithin
 * 3. from/ofxw
 * 4. fill(value, [start], [end])
 */
