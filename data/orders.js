const mongoCollections = require('../config/mongoCollections');
const ObjectId = require('mongodb').ObjectId;
const orders = mongoCollections.orders;
const restaurant_DAL = require('./restaurants');

const isSpaces = function isSpaces(input) {
  let spaces = true;
  const arr = input.split('');
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].charCodeAt(0) !== 32) {
      spaces = false;
      break; //can break here since at least one non space is found
    }
  }
  return spaces;
}

const validId = function validId(id) {
  if (id.length != 24) return false;
  for (let i = 0; i < id.length; i++) {
    let code = id.charCodeAt(i);
    if ((code < 48) ||  //check if not valid id
      ((code > 57) && (code < 65)) ||  //valid number if in range 48-57
      ((code > 70) && (code < 97)) ||  //valid letter if 65-70 or 97-102
      (code > 102)) {
      return false;
    } 
  }
  return true;
}

//We are assuming here that managers will not be able to order items
async function initOrder(userName, restaurant_id, deliveryAddr) {
  if (!userName || userName == null) throw 'All fields need to have valid values';
  if (!restaurant_id || restaurant_id == null) throw 'All fields need to have valid values';
  if (!deliveryAddr || deliveryAddr == null) throw 'All fields need to have valid values';

  if (typeof userName !== 'string') throw 'Username must be a string';
  if (typeof restaurant_id !== 'string') throw 'Restaurant id must be a string';
  if (typeof deliveryAddr !== 'string') throw 'Delivery address must be a string';

  if (isSpaces(userName)) throw 'Username can not be only spaces'
  if (!validId(restaurant_id)) throw 'Restaurant Id must be a string of 24 hex characters';
  if (isSpaces(deliveryAddr)) throw 'Delivery address can not be only spaces';

  const itemsOrdered = [];
  const totalPrice = 0;
  const orderStatus = "Not Placed";
  const discount = 0;

  const newOrder = {
    userName: userName,
    restaurant_id: restaurant_id,
    itemsOrdered: itemsOrdered,
    deliveryAddress: deliveryAddr,
    totalPrice: totalPrice,
    orderStatus: orderStatus,
    discount: discount
  };

  const orderCollection = await orders();

  //Add to order to order collection
  const insertInfo = await orderCollection.insertOne(newOrder);
  if (insertInfo.insertedCount === 0) throw "Could not create a new order";
  
  //Add order id to the restaurant that it's for
  restaurant_DAL.addOrderToRestaurant(insertInfo.insertedId, newOrder.restaurant_id)

  return { createdOrder: true };
}

//This will get passed id of order and item object 
async function addItemToOrder(orderId, item) {
  if (!orderId || orderId == null) throw 'All fields need to have valid values';
  if (!item || item == null) throw 'All fields need to have valid values';

  if (typeof orderId !== 'string') throw 'Order id must be a string';
  if (typeof item !== 'object') throw 'Item must be an object';

  if (!validId(orderId)) throw "Review Id must be a string of 24 hex characters";

  //We need to set a new object id before placing in orders collecion.
  //Otherwise each item in itemsOrdered would have the same id and we wouldn't be able to delete one
  item.item_id = item._id;
  item._id = new ObjectId();

  const orderCollection = await orders();

  //Add to order to order collection
  const updateInfo = await orderCollection.updateOne({ _id: ObjectId(orderId) }, { $push: {itemsOrdered: item}});
  if (updateInfo.modifiedCount === 0) throw "Could not add item to order";

  //Now update the order total
  let sum = 0;
  const myOrder = await orderCollection.findOne({ _id: ObjectId(orderId) });
  for (let i = 0; i < (myOrder.itemsOrdered).length; i++) {
    let test = (myOrder.itemsOrdered[i]).price;
    sum = Math.round(100 * (sum + (myOrder.itemsOrdered[i]).price))/100;
  }

  let total = sum - (sum * ((myOrder.discount)/100));
  total = Math.round(100 * total) / 100;

  await orderCollection.updateOne({ _id: ObjectId(orderId) }, { $set: { totalPrice: total } });
  if (updateInfo.modifiedCount === 0) throw "Could not update order total";
  
  return { addedItem: true };
}

async function reomveItemFromOrder(orderId, itemOrderedId) {
  if (!orderId || orderId == null) throw 'All fields need to have valid values';
  if (!itemOrderedId || itemOrderedId == null) throw 'All fields need to have valid values';

  if (typeof orderId !== 'string') throw 'Order id must be a string';
  if (typeof itemOrderedId !== 'string') throw 'Item id must be a string';

  if (!validId(orderId)) throw "Order Id must be a string of 24 hex characters";
  if (!validId(itemOrderedId)) throw "Item Id must be a string of 24 hex characters";

  const orderCollection = await orders();

  //Reomve item from order collection
  const updateInfo = await orderCollection.updateOne({ _id: ObjectId(orderId) }, { $pull: { itemsOrdered: { _id: ObjectId(itemOrderedId) }}});
  if (updateInfo.modifiedCount === 0) throw "Could not remove item from order";

  //Now update the order total
  let sum = 0;
  const myOrder = await orderCollection.findOne({ _id: ObjectId(orderId) });
  for (let i = 0; i < (myOrder.itemsOrdered).length; i++) {
    sum = Math.round(100 * (sum + (myOrder.itemsOrdered[i]).price))/100;
  }

  let total = sum - (sum * ((myOrder.discount)/100));
  total = Math.round(100 * total) / 100;

  await orderCollection.updateOne({ _id: ObjectId(orderId) }, { $set: { totalPrice: total } });
  
  return { removedItem: true };
}

async function placeOrder(orderId) {
  if (!orderId || orderId == null) throw 'All fields need to have valid values';
  if (typeof orderId !== 'string') throw 'Order id must be a string';
  if (!validId(orderId)) throw "Order Id must be a string of 24 hex characters";

  const orderCollection = await orders();

  //Change value of order status to "ordered"
  const updateInfo = await orderCollection.updateOne({ _id: ObjectId(orderId) }, { $set: { orderStatus: "order_placed"}});
  if (updateInfo.modifiedCount === 0) throw "Could not place order";

  return { orderPlaced: true };
}

async function deliveredOrder(orderId) {
  if (!orderId || orderId == null) throw 'All fields need to have valid values';
  if (typeof orderId !== 'string') throw 'Order id must be a string';
  if (!validId(orderId)) throw "Order Id must be a string of 24 hex characters";

  const orderCollection = await orders();

  //Change value of order status to "delivered"
  const updateInfo = await orderCollection.updateOne({ _id: ObjectId(orderId) }, { $set: { orderStatus: "delivered"}});
  if (updateInfo.modifiedCount === 0) throw "Could not update order status";

  return { orderDelivered: true };
 }

async function deleteOrder(orderId) {
  if (!orderId || orderId == null) throw 'All fields need to have valid values';
  if (typeof orderId !== 'string') throw 'Order id must be a string';
  if (!validId(orderId)) throw "Order Id must be a string of 24 hex characters";

  const orderCollection = await orders();
  let order = await orderCollection.findOne({ _id: ObjectId(orderId) });
  if (order === null) throw "Could not delete order";
  let restaurant_id = order.restaurant_id;
  const deletionInfo = await orderCollection.deleteOne({ _id: ObjectId(orderId) });
  if (deletionInfo.deletedCount === 0) throw "Could not delete order";
  await restaurant_DAL.removeOrderFromRestaurant(orderId, restaurant_id)

  return { deletedOrder: true };
}

async function findCurrentOrder(userName, restaurantId) {
  if (!userName) throw 'All fields need to have valid values';
  if (!restaurantId) throw 'All fields need to have valid values';
  if (typeof userName !== 'string') throw 'Username must be a string';
  if (!validId(restaurantId)) throw "Order Id must be a string of 24 hex characters";

  const orderCollection = await orders();

  const myOrder = await orderCollection.findOne({ userName: userName, restaurant_id: restaurantId, orderStatus: "Not Placed" });

  if (myOrder) return (myOrder._id).toString();
  else return null;

}

async function findOrderItems(userName, restaurantId) {
  if (!userName) throw 'All fields need to have valid values';
  if (!restaurantId) throw 'All fields need to have valid values';
  if (typeof userName !== 'string') throw 'Username must be a string';
  if (!validId(restaurantId)) throw "Order Id must be a string of 24 hex characters";

  const orderCollection = await orders();

  const myOrder = await orderCollection.findOne({ userName: userName, restaurant_id: restaurantId, orderStatus: "Not Placed" });

  return myOrder;
}

async function getAllOrdersFromUser(userName){
  const orderCollection = await orders();
  const allOrders = await orderCollection.find({userName: userName}).toArray()

  let order_ids = []
  for (const order of allOrders) {
    order_ids.push(order._id)
  }

  return order_ids
}

function validateObjectId(id){
  if( typeof id !== 'string' && !ObjectId.isValid(id) ) throw `id must be of type string or ObjectId: ${id}`
  if( typeof id === 'string' && id.length === id.split(' ').length - 1) throw `id as string must not be empty: ${id}`
  if( typeof id === 'string' ){
      try{
          id = ObjectId(id)    
      }catch(e){
          throw `Provided id not a valid ObjectId: ${id}`
      }
  }
  return id
}

async function getPlacedOrdersFromIds(order_id_array){
  const orderCollection = await orders();
  const myOrders = []
  
  for (const order_id of order_id_array) {
    const myOrder = await orderCollection.findOne({ _id: validateObjectId(order_id), orderStatus: "order_placed" })
    if(myOrder !== null) {
      myOrder._id = myOrder._id.toString()
      myOrders.push(myOrder)
    }
  }
  
  return myOrders
}

async function getCompletedOrdersFromIds(order_id_array){
  const orderCollection = await orders();
  const myOrders = []
  
  for (const order_id of order_id_array) {
    const myOrder = await orderCollection.findOne({ _id: validateObjectId(order_id), orderStatus: "delivered" })
    if(myOrder !== null) {
      myOrder._id = myOrder._id.toString()
      myOrders.push(myOrder)
    }
  }
  
  return myOrders
}

async function getIncompleteOrdersFromIds(order_id_array){
  const orderCollection = await orders();
  const myOrders = []
  
  for (const order_id of order_id_array) {
    const myOrder = await orderCollection.findOne({ _id: validateObjectId(order_id), orderStatus: "Not Placed" })
    if(myOrder !== null) {
      myOrder._id = myOrder._id.toString()
      myOrders.push(myOrder)
    }
  }
  
  return myOrders
}

async function addCoupon(orderId, code) {
  if (!orderId || orderId == null) throw 'All fields need to have valid values';
  if (!code || code == null) throw 'All fields need to have valid values';
  if (typeof orderId !== 'string') throw 'Order id must be a string';
  if (typeof code !== 'string') throw 'Coupon code must be a string';
  if (!validId(orderId)) throw "Order Id must be a string of 24 hex characters";

  const allCoupons = {
    "zero": 0,
    "matt": 15,
    "caleb": 15,
    "vikrant": 15,
    "zhixiang": 15,
    "cs546": 10,
    "finalprojectgrade100/100": 100
  }

  const orderCollection = await orders();
  const myOrder = await orderCollection.findOne({ _id: ObjectId(orderId) });

  let coupon = code.toLowerCase();
  let allCodes = Object.keys(allCoupons)
  if (allCodes.includes(coupon)) {
    
    let sum = 0;
    for (let i = 0; i < (myOrder.itemsOrdered).length; i++) {
      let test = (myOrder.itemsOrdered[i]).price;
      sum = Math.round(100 * (sum + (myOrder.itemsOrdered[i]).price)) / 100;
    }

    let discount = allCoupons[`${coupon}`];
    let total = sum - (sum * (discount / 100));
    total = Math.round(100 * total) / 100;

    let updateInfo = await orderCollection.updateOne({ _id: ObjectId(orderId) }, { $set: { totalPrice: total, discount: discount } });
    if (updateInfo.modifiedCount === 0) throw "Could not update order total";
    return { addedDiscount: true }
  }
  return { addedDiscount: false };
}

module.exports = {
  initOrder,
  addItemToOrder,
  reomveItemFromOrder,
  placeOrder,
  deliveredOrder,
  deleteOrder,
  findCurrentOrder,
  findOrderItems,
  getPlacedOrdersFromIds,
  getCompletedOrdersFromIds,
  getIncompleteOrdersFromIds,
  getAllOrdersFromUser,
  addCoupon
};