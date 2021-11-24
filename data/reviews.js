const mongoCollections = require('../config/mongoCollections');
const ObjectId = require('mongodb').ObjectId;
const reviews = mongoCollections.reviews;
const users = mongoCollections.users;
const managers = mongoCollections.managers;
const restaurants = mongoCollections.restaurants;
//const restaurantFuncs = require('./restaurants');
//const userFuncs = require('./users');

//Function to check if input is only spaces 
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

//Create an original review 
async function create(restaurantId, userId, review, rating, isManager) {
  //Error checking
  if (!restaurantId || restaurantId == null) throw 'All fields need to have valid values';
  if (!userId || userId == null) throw 'All fields need to have valid values';
  if (!review || review == null) throw 'All fields need to have valid values';
  if (!rating || rating == null) throw 'All fields need to have valid values';
  if (isManager == null) throw 'All fields need to have valid values';
  //More error checking
  if (typeof restaurantId !== 'string') throw 'Restaurant id must be a string';
  if (typeof userId !== 'string') throw 'User id must be a string';
  if (typeof review !== 'string') throw 'Review must be a string';
  if (typeof rating !== 'number') throw 'Rating must be a number';
  if (typeof isManager !== 'boolean') throw 'isManager status must be a boolean value';
  
  //More error checking
  if (isSpaces(review)) throw 'Reviewer not be only spaces';
  if (rating > 5 || rating < 1) throw 'Rating must be in the range [1-5]';
  //Check for valid ID's
  if (!validId(restaurantId)) throw "Restaurant Id must be a string of 24 hex characters";
  if (!validId(userId)) throw "User Id must be a string of 24 hex characters";

  const likes = 0;
  const dislikes = 0;
  const replies = [];
  const date = new Date();

  const reviewsCollection = await reviews();

  //Create the new review
  const newReview = {
    restaurantId: restaurantId,
    userId: userId,
    review: review,
    rating: rating,
    likes: likes,
    isManager: isManager, //We can use this paramater to display manager reviews differently
    dislikes: dislikes,
    replies: replies,
    date: date
  };

  //Add review to the correct restaurant
  const insertInfo = await reviewsCollection.insertOne(newReview);
  if (insertInfo.insertedCount === 0) throw "Could not add new review";
  const newId = insertInfo.insertedId;

  //Add the new reviewId to the restaunt reviews array
  const restaurantCollection = await restaurants();
  const updateInfo = await restaurantCollection.updateOne({ _id: ObjectId(restaurantId) }, { $addToSet: { reviews: newId } });
  if (updateInfo.modifiedCount === 0) throw "Could not update restaurant collection";

  //Check if this was by a manager or regular user. Update the correct collection
  if (isManager) {
    //Add the new reviewId to the manager review_id array
    const managerCollection = await managers();
    await managerCollection.updateOne({ _id: ObjectId(userId) }, { $addToSet: { review_id: newId } });
  }
  else {
    //Add the new reviewId to the user review_id array
    const userCollection = await users();
    await userCollection.updateOne({ _id: ObjectId(userId) }, { $addToSet: { review_id: newId } });
  }

  //Now update the new rating average for that restaurant
  const myRestaurant = await restaurantCollection.findOne(ObjectId(restaurantId));
  const allReviews = myRestaurant.reviews;

  let sum = 0;
  let count = 0;
  for (let i = 0; i < allReviews.length; i++){
    let itemReview = await reviewsCollection.findOne(ObjectId(allReviews[i]));
    sum += itemReview.rating;
    count += 1;
  };

  const avg = sum / count;
  await restaurantCollection.updateOne({ _id: ObjectId(restaurantId) }, { $set: { rating: avg }});

  return { addedReview: true };
}

//Function returns all review objects in the database as an array
async function getAll() {
  const reviewCollection = await reviews();

  return await reviewCollection.find({}, { _id: 1, restaurant_id: 1 }).toArray();
}

//Function to return array of all reviews from a particular restaurant
//This will be needed when displaying all restaurants
async function getAllByRestuarant(restaurantId) {
  if (!restaurantId || restaurantId == null) throw 'Must provide a restaurant id';
  if (typeof restaurantId !== 'string') throw 'Restaurant id must be a string';
  if (isSpaces(restaurantId)) throw 'Restaurant name id can not be only spaces';
  if (!validId(restaurantId)) throw "Restaurant Id must be a string of 24 hex characters";

  //First get that restaurant object
  const restaurantCollection = await restaurants();
  const restaurant = await restaurantCollection.findOne(ObjectId(restaurantId));
  //const restaurant = await restaurantFuncs.get(restaurantId);
  //Now pull the review ids
  const reviewIds = restaurant.reviews;
  if (reviewIds.length == 0) throw "No reviews found";

  const restaurantReviews = [];

  const myReviews = await this.getAll();
  if (myReviews.length == 0) throw 'No reviews found'; //Redundant, but good practice

  reviewIds.forEach(id => {
    for (let i = 0; i < myReviews.length; i++) {
      if (String(id) == String(myReviews[i]._id)) {
        restaurantReviews.push(myReviews[i]);
        break; //We can stop since we found that particular id - move onto the next one
      }
    }
  });

  if (restaurantReviews.length == 0) throw 'Something went wrong'; //This really should never be triggered
  return restaurantReviews;
}

//Function to return array of all reviews from a particular user
//If we want managers to also comment, we will need to add an argument here like this:
// getAllByUser(userId, isManager), where isManager would be a boolean value. 
// We would have to check cookies to determine if user is mnager or not, then search the correct collection (users/managers)
// Would also need to add reviews array to managers collection 
//This will be needed when we display a user profile page 
async function getAllByUser(userId, isManager) {
  if (!userId || userId == null) throw 'Must provide a user id';
  if (isManager == null) throw 'Must provide a user id';
  if (typeof userId !== 'string') throw 'user id must be a string';
  if (typeof isManager !== 'boolean') throw 'user id must be a string';
  if (isSpaces(userId)) throw 'user id can not be only spaces';
  if (!validId(userId)) throw "user Id must be a string of 24 hex characters";

  const userReviews = [];
  let reviewIds = [];

  if (isManager) {
    //First get that manager object
    const managerCollection = await managers();
    const manager = await managerCollection.findOne(ObjectId(userId));
    //onst manager = await managerFuncs.get(userId);
    //Now pull the review ids
    reviewIds = manager.review_id;
    if (reviewIds.length == 0) throw "No reviews found for manager";
  }
  else {
    //First get that user object
    const userCollection = await users()
    const user = await userCollection.findOne(ObjectId(userId));
    //const user = await userFuncs.get(userId);
    //Now pull the review ids
    reviewIds = user.review_id;
    if (reviewIds.length == 0) throw "No reviews found for user";
  }


  //Pull all the reviews
  const myReviews = await this.getAll();
  if (myReviews.length == 0) throw 'No reviews found'; //Redundant, but good practice

  reviewIds.forEach(id => {
    for (let i = 0; i < myReviews.length; i++) {
      if (String(id) == String(myReviews[i]._id)) {
        userReviews.push(myReviews[i]);
        break; //We can stop since we found that particular id - move onto the next one
      }
    }
  });

  if (userReviews.length == 0) throw 'Something went wrong'; //This really should never be triggered
  return userReviews;
}

async function remove(reviewId) {
  if (!reviewId || reviewId == null) throw 'Must provide a review id';
  if (typeof reviewId !== 'string') throw 'Review id must be a string';
  if (isSpaces(reviewId)) throw 'Review id can not be only spaces';
  if (!validId(reviewId)) throw "Review Id must be a string of 24 hex characters";

  const reviewCollection = await reviews();

  //First find that review
  const target = await reviewCollection.findOne(ObjectId(reviewId));
  if (!target) {
    throw "That review doesn't exist";
  }
  //pull the needed info 
  const restaurant_id = target.restaurantId;
  const user_id = target.userId;
  const managerStatus = target.isManager;

  //Delete the review first 
  const deletionInfo = await reviewCollection.deleteOne({ _id: ObjectId(reviewId) });

  if (deletionInfo.deletedCount == 0) {
    throw "Could not remove review";
  }

  //Now remove the id from the restaurant collection
  const restaurantCollection = await restaurants();
  await restaurantCollection.updateOne({ _id: ObjectId(restaurant_id) }, { $pull: { reviews: ObjectId(reviewId) } });

  //Now remove from either the user or manager collection as well
  if (managerStatus) {
    const managerCollection = await managers();
    await managerCollection.updateOne({ _id: ObjectId(user_id) }, { $pull: { review_id: ObjectId(reviewId) } });
  } else {
    const userCollection = await users();
    await userCollection.updateOne({ _id: ObjectId(user_id) }, { $pull: { review_id: ObjectId(reviewId) } });
  }

  //Now we also need to update the overall rating
  const myRestaurant = await restaurantCollection.findOne(ObjectId(restaurant_id));
  const allReviews = myRestaurant.reviews;

  let sum = 0;
  let count = 0;
  for (let i = 0; i < allReviews.length; i++){
    let itemReview = await reviewCollection.findOne(ObjectId(allReviews[i]));
    sum += itemReview.rating;
    count += 1;
  };

  const avg = sum / count;
  await restaurantCollection.updateOne({ _id: ObjectId(restaurant_id) }, { $set: { rating: avg }});


  return { "reviewId": reviewId, "deleted": true };
}

//If we want to do this we will need to add an attribute to user for "feedback_Reviews" and "feedback_replies"
// these will be arrays, each of which store the ids of reviews/ replies that have been liked/dislike
// This way a user cannot like more than once, or like and dislike a post 
async function addLike(reviewId) {
  if (!reviewId || reviewId == null) throw 'Must provide a review id';
  if (typeof reviewId !== 'string') throw 'Review id must be a string';
  if (isSpaces(reviewId)) throw 'Review id can not be only spaces';
  if (!validId(reviewId)) throw "Review Id must be a string of 24 hex characters";

  const reviewCollection = await reviews();

  //First find that review
  const target = await reviewCollection.findOne(ObjectId(reviewId));
  if (!target) {
    throw "That review doesn't exist";
  }
  //pull the needed info 
  const user_id = target.userId;
  const managerStatus = target.isManager;
  
  //First check the user/manager's review_feedback to see if they already left feedback

  if (managerStatus) {
    const managerCollection = await managers();
    if (await managerCollection.countDocuments({ _id: ObjectId(user_id), "review_feedback.likes": reviewId } ) == 1) {
      throw "Manager has already liked review";
    }
    if (await managerCollection.countDocuments({ _id: ObjectId(user_id), "review_feedback.dislikes": reviewId }) == 1) {
      throw "Manager has already disliked review, can't simultaneously like";
    }
  } else {
    const userCollection = await users();
    if (await userCollection.countDocuments({ _id: ObjectId(user_id), "review_feedback.likes": reviewId }) == 1) {
      throw "User has already liked review";
    }
    if (await userCollection.countDocuments({ _id: ObjectId(user_id), "review_feedback.dislikes": reviewId }) == 1) {
      throw "User has already disliked review, can't simultaneously like";
    }
  }

  //Add one to the total likes of that review
  //const reviewCollection = await reviews();
  await reviewCollection.updateOne({ _id: ObjectId(reviewId) }, { $inc: { likes: 1 } });

  //Add the reviewId to the users' review_feedback so they can't like it again or dislike
  if (managerStatus) {
    const managerCollection = await managers();
    await managerCollection.updateOne({ _id: ObjectId(user_id) }, { $push: { "review_feedback.likes": reviewId } });
  } else {
    const userCollection = await users();
    await userCollection.updateOne({ _id: ObjectId(user_id) }, { $push: { "review_feedback.likes": reviewId } } );
  }

  return {"reviewId": reviewId, "liked": true}
}

async function addDislike(reviewId) {
  if (!reviewId || reviewId == null) throw 'Must provide a review id';
  if (typeof reviewId !== 'string') throw 'Review id must be a string';
  if (isSpaces(reviewId)) throw 'Review id can not be only spaces';
  if (!validId(reviewId)) throw "Review Id must be a string of 24 hex characters";

  const reviewCollection = await reviews();

  //First find that review
  const target = await reviewCollection.findOne(ObjectId(reviewId));
  if (!target) {
    throw "That review doesn't exist";
  }
  //pull the needed info 
  const user_id = target.userId;
  const managerStatus = target.isManager;
  
  //First check the user/manager's review_feedback to see if they already left feedback

  if (managerStatus) {
    const managerCollection = await managers();
    if (await managerCollection.countDocuments({ _id: ObjectId(user_id), "review_feedback.dislikes": reviewId } ) == 1) {
      throw "Manager has already disliked review";
    }
    if (await managerCollection.countDocuments({ _id: ObjectId(user_id), "review_feedback.likes": reviewId }) == 1) {
      throw "User has already liked review, can't simultaneously dislike";
    }
  } else {
    const userCollection = await users();
    if (await userCollection.countDocuments({ _id: ObjectId(user_id), "review_feedback.dislikes": reviewId } ) == 1) {
      throw "User has already disliked review";
    }
    if (await userCollection.countDocuments({ _id: ObjectId(user_id), "review_feedback.likes": reviewId }) == 1) {
      throw "User has already liked review, can't simultaneously dislike";
    }
  }

  //Add one to the total dislikes of that review
  //const reviewCollection = await reviews();
  await reviewCollection.updateOne({ _id: ObjectId(reviewId) }, { $inc: { dislikes: 1 } });

  //Add the reviewId to the users' review_feedback so they can't like it again or dislike
  if (managerStatus) {
    const managerCollection = await managers();
    await managerCollection.updateOne({ _id: ObjectId(user_id) }, { $push: { "review_feedback.dislikes": reviewId } } );
  } else {
    const userCollection = await users();
    await userCollection.updateOne({ _id: ObjectId(user_id) }, { $push: { "review_feedback.dislikes": reviewId } } );
  }

  return {"reviewId": reviewId, "disliked": true}
}

async function removeLike(reviewId) {
  if (!reviewId || reviewId == null) throw 'Must provide a review id';
  if (typeof reviewId !== 'string') throw 'Review id must be a string';
  if (isSpaces(reviewId)) throw 'Review id can not be only spaces';
  if (!validId(reviewId)) throw "Review Id must be a string of 24 hex characters";

  const reviewCollection = await reviews();

  //First find that review
  const target = await reviewCollection.findOne(ObjectId(reviewId));
  if (!target) {
    throw "That review doesn't exist";
  }
  //pull the needed info 
  const user_id = target.userId;
  const managerStatus = target.isManager;
  
  //First check the user/manager's review_feedback to see if they already left feedback

  if (managerStatus) {
    const managerCollection = await managers();
    if (await managerCollection.countDocuments({ _id: ObjectId(user_id), "review_feedback.likes": reviewId } ) == 0) {
      throw "Manager hasn't liked review yet";
    }
  } else {
    const userCollection = await users();
    if (await userCollection.countDocuments({ _id: ObjectId(user_id), "review_feedback.likes": reviewId } ) == 0) {
      throw "User hasn't liked review yet";
    }
  }

  //Remove one from the total dlikes of that review
  //const reviewCollection = await reviews();
  await reviewCollection.updateOne({ _id: ObjectId(reviewId) }, { $inc: { likes: -1 } });

  //Remove the reviewId from the users' review_feedback so they can like it again or dislike
  if (managerStatus) {
    const managerCollection = await managers();
    await managerCollection.updateOne({ _id: ObjectId(user_id) }, { $pull: { "review_feedback.likes": reviewId } } );
  } else {
    const userCollection = await users();
    await userCollection.updateOne({ _id: ObjectId(user_id) }, { $pull: { "review_feedback.likes": reviewId } } );
  }

  return {"reviewId": reviewId, "liked": false}
}

async function removeDislike(reviewId) {
  if (!reviewId || reviewId == null) throw 'Must provide a review id';
  if (typeof reviewId !== 'string') throw 'Review id must be a string';
  if (isSpaces(reviewId)) throw 'Review id can not be only spaces';
  if (!validId(reviewId)) throw "Review Id must be a string of 24 hex characters";

  const reviewCollection = await reviews();

  //First find that review
  const target = await reviewCollection.findOne(ObjectId(reviewId));
  if (!target) {
    throw "That review doesn't exist";
  }
  //pull the needed info 
  const user_id = target.userId;
  const managerStatus = target.isManager;
  
  //First check the user/manager's review_feedback to see if they already left feedback

  if (managerStatus) {
    const managerCollection = await managers();
    if (await managerCollection.countDocuments({ _id: ObjectId(user_id), "review_feedback.dislikes": reviewId } ) == 0) {
      throw "Manager hasn't disliked review yet";
    }
  } else {
    const userCollection = await users();
    if (await userCollection.countDocuments({ _id: ObjectId(user_id), "review_feedback.dislikes": reviewId } ) == 0) {
      throw "User hasn't disliked review yet";
    }
  }

  //Remove one from the total dislikes of that review
  //const reviewCollection = await reviews();
  await reviewCollection.updateOne({ _id: ObjectId(reviewId) }, { $inc: { dislikes: -1 } });

  //Remove the reviewId from the users' review_feedback so they can like it again or dislike
  if (managerStatus) {
    const managerCollection = await managers();
    await managerCollection.updateOne({ _id: ObjectId(user_id) }, { $pull: { "review_feedback.dislikes": reviewId } } );
  } else {
    const userCollection = await users();
    await userCollection.updateOne({ _id: ObjectId(user_id) }, { $pull: { "review_feedback.dislikes": reviewId } } );
  }

  return {"reviewId": reviewId, "disliked": false}
}

module.exports = {
  create,
  getAll,
  getAllByRestuarant,
  getAllByUser,
  remove,
  addLike,
  addDislike,
  removeLike,
  removeDislike
};