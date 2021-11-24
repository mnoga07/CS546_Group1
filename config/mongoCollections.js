const dbConnection = require('./mongoConnection');

const getCollectionFn = (collection) => {
  let _col = undefined;

  return async () => {
    if (!_col) {
      const db = await dbConnection();
      _col = await db.collection(collection);
    }

    return _col;
  };
};

/* List collections here: */
//Adding everything we might need now. Need to uncomment as we use them 
module.exports = {
  users: getCollectionFn('users'),
  managers: getCollectionFn('managers'),
  restaurants: getCollectionFn('restaurants'),
  food_items: getCollectionFn('food_items'),
  reviews: getCollectionFn('reviews'),
  replies: getCollectionFn('replies'),
  orders_placed: getCollectionFn('orders_placed'),
};