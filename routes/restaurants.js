const express = require('express');
const router = express.Router();
const restaurants_DAL = require('../data/restaurants');
const reviews_DAL = require('../data/reviews');
const replies_DAL = require('../data/replies');
const user_DAL = require('../data/users');
const manager_DAL = require('../data/managers');
const orders_DAL = require('../data/orders');
const path = require('path');
const session = require('express-session');
const fs = require('fs');
const multer = require('multer');
const ObjectId = require('mongodb').ObjectId;
const xss = require('xss');
const upload = multer({ dest: '../uploads/'});

router.get('/', async (req, res) => {
  let isManager = false;
  let userName = null;
  let orders = []
  let user = null
  if (req.session.user && req.session.user.accountType === 'manager') {
    isManager = true
    userName = req.session.user.username
  }
  if (req.session.user && req.session.user.accountType === 'user'){
    userName = req.session.user.username
    user = await user_DAL.getUserProfileByName(userName)

    let favorites = await user_DAL.getUserProfileByName(req.session.user.username)
    favorites = favorites.favorites
    if(favorites.length > 0){
        orders = await orders_DAL.getCompletedOrdersFromIds(favorites)
    }
  }
  const allResaurants = await restaurants_DAL.getAllResaurants()
  

  res.render('restaurant/RestaurantsPage', {title: "Restaurants", page_function: "Available Restaurants", restaurantArray: allResaurants, isManager:isManager, userName, userId: user?._id, orders})
});

router.get('/create', async (req, res) => {
  if (!(req.session.user && req.session.user.accountType === 'manager')){
      return res.status(403).redirect('/restaurants')
  }
  
  res.render('restaurant/CreateRestaurantPage', {title: "Create Restaurant", page_function: "Create Restaurant"})
});

router.get('/:id', async (req, res) => {
  if (!(req.session.user)) {
    return res.status(403).redirect('/login')
  }
  else if(req.session.user.accountType === 'manager') {
    return res.status(403).redirect('/')
  }
  else {
    const id = req.params.id;
    const restaurant = await restaurants_DAL.getRestaurantFromId(id);
    const currentOrderId = await orders_DAL.findCurrentOrder(req.session.user.username, id);

    res.render('restaurant/RestaurantPage', { title: "Restaurant", page_function: `View food at ${restaurant.restaurantName}`, restaurant: restaurant })
  }
});

router.get('/:id/reviews', async (req, res) => {
  const id = req.params.id
  let restaunt = null;
  let reviewData = null;
  try {
    restaurant = await restaurants_DAL.getRestaurantFromId(id);
  } catch (e) {
    res.render('error/error', { error: e, title: "Error", page_function: "Error Display" });
  }
  try {
    reviewData = await reviews_DAL.getAllByRestaurant(id);
  } catch (e) {
    res.render('error/error', { error: e, title: "Error", page_function: "Error Display" });
  }
  
  //Get userId and manager status from session cookie
  let userId = null;
  let isManager = null;
  if (!req.session.user) {
    res.redirect('/login', 404, { title: "Login", page_function: "Log into an account NOW", error: "Need to log in" })
    return
  } else {
    if (req.session.user.accountType == "manager") {
      isManager = true;
      userId = await manager_DAL.getManagerIdByName(req.session.user.username);
    }
    else {
      isManager = false;
      userId = await user_DAL.getUserIdByName(req.session.user.username);
    }
  }

  if (reviewData.length == 0) {
    res.render('restaurant/NoReviewsPage', { title: "Reviews", page_function: `Reviews for "${restaurant.restaurantName}"`, restaurantId: id, loggedUserId: userId, loggedIsManager: isManager });
  } else {
    res.render('restaurant/ReviewsPage', { title: "Reviews", page_function: `Reviews for "${restaurant.restaurantName}"`, reviewData: reviewData, restaurantId: id, loggedUserId: userId, loggedIsManager: isManager });
  }
});

router.get('/:id/cart', async (req, res) => {
  const id = req.params.id;

  if (!(req.session.user)) {
    return res.status(403).redirect('/login')
  } 
  else if(req.session.user.accountType === 'manager') {
    return res.status(403).redirect('/')
  }
  else {
    const id = req.params.id;
    const restaurant = await restaurants_DAL.getRestaurantFromId(id);
    let orderData = await orders_DAL.findOrderItems(req.session.user.username, id);
    res.render('restaurant/ViewCart', {title: "View Cart", page_function: `View ${req.session.user.username}'s cart at ${restaurant.restaurantName}`, orderData: orderData, restaurantId: id})
  }

});

router.get('/menu/edit/:id', async (req, res) => {
  
  const id = req.params.id

  //Check that the person attempting to access this is the manager of 
  if (!req.session.user || !id || !await manager_DAL.userIsManagerOfRestaurant(req.session.user.username, id)){
    return res.status(403).redirect('/restaurants')
  }

  //Get restaurant menu items, then display page with form for creating a new item,
  // and list existing items with remove/edit options
  const restaurant = await restaurants_DAL.getRestaurantFromId(id)
  res.render('restaurant/MenuEditPage', {title: "Edit Menu", page_function: `Edit menu for "${restaurant.restaurantName}"`, restaurant: restaurant})
});

router.get('/menu/modify/:restid/:foodid', async (req, res) => {
  
  const foodid = req.params.foodid
  const restid = req.params.restid
  const restaurant = await restaurants_DAL.getRestaurantFromId(restid)

  //Check that the person attempting to access this is the manager of 
  if (!req.session.user || !foodid || !restid || !await manager_DAL.userIsManagerOfRestaurant(req.session.user.username, restid)){
    return res.status(403).redirect('/restaurants')
  }
  let foodItem = null
  try{
      foodItem = await restaurants_DAL.getFood_Item(restid, foodid)
  }
  catch(e){
      res.status(400).render('restaurant/MenuEditPage', {title: "Edit Menu", page_function: `Edit menu for "${restaurant.restaurantName}"`, restaurant: restaurant, error: e})
      return
  }
  
  res.render('restaurant/FoodEditPage', {title: "Edit Food Item", page_function: `Edit food item ${foodItem.itemName} for ${restaurant.restaurantName}`, restaurant: restaurant, foodItem: foodItem})
  return
});

router.post('/menu/add/:id', upload.single("photo"), async (req, res) => {
  const id = req.params.id
  //multipart/form-data xss can't be handled by the middleware in app.js
  for (const iterator in req.body) {
    if(!Array.isArray(req.body[iterator])){
      req.body[iterator] = xss(req.body[iterator])
    }
  }

  //Filter empty, undefined, non string values 
  req.body.customOptionArray = req.body.customOptionArray?.filter(x => {
    return x !== undefined || typeof x !== 'string' || x.trim().length === 0
  })
  
  //Check that the person attempting to access this is the manager of 
  if (!req.session.user || !id || !await manager_DAL.userIsManagerOfRestaurant(req.session.user.username, id)){
    return res.status(403).redirect('/restaurants')
  }

  let imgname = new Date().getTime().toString();
  if (!req.file) imgname = "no_image.jpeg";
  else {
    const tempPath = req.file.path;
    const targetPath = path.join(__dirname, `../public/images/${imgname}`);

    if (path.extname(req.file.originalname).toLowerCase() === ".png" ||
      path.extname(req.file.originalname).toLowerCase() === ".jpg" || 
      path.extname(req.file.originalname).toLowerCase() === ".jpeg") {
      fs.rename(tempPath, targetPath, err => {
        if (err) res.render('error/error', { error: "Internal Error", title: "Error", page_function: "Error Display" });
      })
    } else {
      res.status(403);
      res.render('error/error', { error: "Only png or jpg/jpeg allowed", title: "Error", page_function: "Error Display" });
      return;
    }
  }

  const form = req.body
  const restaurant = await restaurants_DAL.getRestaurantFromId(id)

  if(!form.itemName || form.itemName.trim().length === 0 ||  !form.itemName.match(/^[ a-zA-Z]+$/)){
    res.render('restaurant/MenuEditPage', {title: "Edit Menu", page_function: `Edit menu for "${restaurant.restaurantName}"`, restaurant: restaurant, error: "Food name invalid!"})
    return
  }

  if(!form.price || !form.price.match(/^[0-9]+\.[0-9]+$/)){
    res.render('restaurant/MenuEditPage', {title: "Edit Menu", page_function: `Edit menu for "${restaurant.restaurantName}"`, restaurant: restaurant, error: "Price invalid!"})
    return
  }

  if(!form.customType || (form.customType !== 'superburger' && form.customType !== 'notsuperburger')){
    res.render('restaurant/MenuEditPage', {title: "Edit Menu", page_function: `Edit menu for "${restaurant.restaurantName}"`, restaurant: restaurant, error: "Custom type not provided!"})
    return
  }

  if (form.customType === 'superburger') {
    for (let i = 0; i < restaurant.menuItems.length; i++) {
      if (restaurant.menuItems[i].isBurger) {
        res.render('restaurant/MenuEditPage', { title: "Edit Menu", page_function: `Edit menu for "${restaurant.restaurantName}"`, restaurant: restaurant, error: "Each restaurant may only have 1 superburger!" })
        return
      }
    }
  }

  if(!form.customOptionArray){
    //It's ok for custom items to not be provided
    form.customOptionArray = []
  }
  else{
    //validate that each custom item is a non-empty string
    let invalid = form.customOptionArray.find(x => {
      return typeof x !== 'string' || x.trim().length === 0 || !x.match(/^[ a-zA-Z]+$/)
    })
    if(invalid){
        res.render('restaurant/MenuEditPage', { title: "Edit Menu", page_function: `Edit menu for "${restaurant.restaurantName}"`, restaurant: restaurant, error: "Custom option invalid!" })
        return
    }
  }

  try{
      isBurger = form.customType === "superburger"
      if(isBurger) form.customOptionArray = ["Bread-top" , "seeds" , "lettuce" , "bacon" , "cheese" , "meat" , "bread-bottom"]
      await restaurants_DAL.addFood_Item(restaurant._id, {itemName: form.itemName, price: form.price, isBurger, customizableComponents: form.customOptionArray, imageName: imgname})
  }
  catch(e){
      res.status(400).render('restaurant/MenuEditPage', {title: "Edit Menu", page_function: `Edit menu for "${restaurant.restaurantName}"`, restaurant: restaurant, error: e})
      return
  }
  
  res.redirect('/restaurants/menu/edit/' + restaurant._id)
  return
});

router.post('/menu/modify/:restid/:foodid', upload.single("photo"), async (req, res) => {
  //multipart/form-data xss can't be handled by the middleware in app.js
  for (const iterator in req.body) {
    req.body[iterator] = xss(req.body[iterator])
  }

  const foodid = req.params.foodid
  const restid = req.params.restid
  const restaurant = await restaurants_DAL.getRestaurantFromId(restid)
  
  //Check that the person attempting to access this is the manager of 
  if (!req.session.user || !foodid || !restid || !await manager_DAL.userIsManagerOfRestaurant(req.session.user.username, restid)){
    return res.status(403).redirect('/restaurants')
  }

  let imgname = new Date().getTime().toString();
  if (!req.file) imgname = "no_image.jpeg";
  else {
    const tempPath = req.file.path;
    const targetPath = path.join(__dirname, `../public/images/${imgname}`);

    if (path.extname(req.file.originalname).toLowerCase() === ".png" ||
      path.extname(req.file.originalname).toLowerCase() === ".jpg" || 
      path.extname(req.file.originalname).toLowerCase() === ".jpeg") {
      fs.rename(tempPath, targetPath, err => {
        if (err) res.render('error/error', { error: "Internal Error", title: "Error", page_function: "Error Display" });
      })
    } else {
      res.status(403);
      res.render('error/error', { error: "Only png or jpg/jpeg allowed", title: "Error", page_function: "Error Display" });
      return;
    }
  }

  const form = req.body

  if(!form.itemName){
    res.render('restaurant/FoodEditPage', {title: "Edit Menu", page_function: `Edit menu for "${restaurant.restaurantName}"`, restaurant: restaurant, error: "Food name not provided!"})
    return
  }

  if(!form.price){
    res.render('restaurant/FoodEditPage', {title: "Edit Menu", page_function: `Edit menu for "${restaurant.restaurantName}"`, restaurant: restaurant, error: "Price not provided!"})
    return
  }

  if(!form.customType){
    res.render('restaurant/FoodEditPage', {title: "Edit Menu", page_function: `Edit menu for "${restaurant.restaurantName}"`, restaurant: restaurant, error: "Custom type not provided!"})
    return
  }

  if(!form.customOptionArray){
    //It's ok for custom items to not be provided
    form.customOptionArray = []
  }
  //For some reason an extra null element is added at index 0, so remove it here
  form.customOptionArray = (form.customOptionArray).slice(1);

  try{
      isBurger = form.customType === "superburger"
      if(isBurger) form.customOptionArray = ["Bread-top" , "seeds" , "lettuce" , "bacon" , "cheese" , "meat" , "bread-bottom"]
      await restaurants_DAL.replaceFood_Item(restid, foodid, {itemName: form.itemName, price: form.price, isBurger, customizableComponents: form.customOptionArray, imageName: imgname})
  }
  catch(e){
      res.status(400).render('restaurant/FoodEditPage', {title: "Edit Menu", page_function: `Edit menu for "${restaurant.restaurantName}"`, restaurant: restaurant, error: e})
      return
  }
  
  res.redirect('/restaurants/menu/edit/' + restaurant._id)
  return
});

router.post('/menu/delete/:restid/:foodid', async (req, res) => {
  const foodid = req.params.foodid
  const restid = req.params.restid
  const restaurant = await restaurants_DAL.getRestaurantFromId(restid)

  //Check that the person attempting to access this is the manager of 
  if (!req.session.user || !foodid || !restid || !await manager_DAL.userIsManagerOfRestaurant(req.session.user.username, restid)){
    return res.status(403).redirect('/restaurants')
  }

  try{
      await restaurants_DAL.removeFood_Item(restid, foodid)
  }
  catch(e){
      res.status(400).render('restaurant/MenuEditPage', {title: "Edit Menu", page_function: `Edit menu for "${restaurant.restaurantName}"`, restaurant: restaurant, error: e})
      return
  }
  
  res.redirect('/restaurants/menu/edit/' + restid)
  return
});

router.post('/:id/reviews', async (req, res) => {
  if (req.body.postType == "add_like") {
    try {
      let isManager = null;
      let userId = null;
      if (req.session.user.accountType === "user") {
        isManager = false;
        userId = await user_DAL.getUserIdByName(req.session.user.username);
      }
      else if (req.session.user.accountType === "manager") {
        isManager = true;
        userId = await manager_DAL.getManagerIdByName(req.session.user.username);
      }
      else res.redirect(`/login`);

      let Data = await reviews_DAL.addLike(req.body.likeId, userId, isManager);
      res.render('partials/likes', { layout: null, _id: req.body.likeId, likes: Data })
      
    } catch (e) {
      res.status(409); //status 409 is for conflict
      res.send(e);
    }
  } else if (req.body.postType == "remove_like") {
    try {
      let isManager = null;
      let userId = null;
      if (req.session.user.accountType === "user") {
        isManager = false;
        userId = await user_DAL.getUserIdByName(req.session.user.username);
      }
      else if (req.session.user.accountType === "manager") {
        isManager = true;
        userId = await manager_DAL.getManagerIdByName(req.session.user.username);
      }
      else res.redirect(`/login`);

      let Data = await reviews_DAL.removeLike(req.body.likeId, userId, isManager);
      res.render('partials/likes', { layout: null, _id: req.body.likeId, likes: Data })

    } catch (e) {
      res.status(409); //status 409 is for conflict
      res.send(e);
    }
  } else if (req.body.postType == "add_dislike") {
    try {
      let isManager = null;
      let userId = null;
      if (req.session.user.accountType === "user") {
        isManager = false;
        userId = await user_DAL.getUserIdByName(req.session.user.username);
      }
      else if (req.session.user.accountType === "manager") {
        isManager = true;
        userId = await manager_DAL.getManagerIdByName(req.session.user.username);
      }
      else res.redirect(`/login`);

      let Data = await reviews_DAL.addDislike(req.body.likeId, userId, isManager);
      res.render('partials/dislikes', { layout: null, _id: req.body.likeId, dislikes: Data })

    } catch (e) {
      res.status(409); //status 409 is for conflict
      res.send(e);
    }
  } else if (req.body.postType == "remove_dislike") {
    try {
      let isManager = null;
      let userId = null;
      if (req.session.user.accountType === "user") {
        isManager = false;
        userId = await user_DAL.getUserIdByName(req.session.user.username);
      }
      else if (req.session.user.accountType === "manager") {
        isManager = true;
        userId = await manager_DAL.getManagerIdByName(req.session.user.username);
      }
      else res.redirect(`/login`);

     let Data = await reviews_DAL.removeDislike(req.body.likeId, userId, isManager);
      //res.redirect(`/restaurants/${req.params.id}/reviews`);
      res.render('partials/dislikes', { layout: null, _id: req.body.likeId, dislikes: Data })

    } catch (e) {
      res.status(409); //status 409 is for conflict
      res.send(e);
    }
  }
  else if (req.body.postType == "new_reply") {
    try {
      let myBool = null;
      let myId = null;
      if (req.session.user.accountType == "manager") {
        myBool = true;
        myId = await manager_DAL.getManagerIdByName(req.session.user.username);
      } else {
        myBool = false;
        myId = await user_DAL.getUserIdByName(req.session.user.username);
      }
      await replies_DAL.create(req.body.reviewId, myId, req.body.reply, myBool);
      res.redirect(`/restaurants/${req.params.id}/reviews`);
    } catch (e) {
      res.status(500);
      res.render('error/error', { error: e, title: "Error", page_function: "Error Display" });
    }
  } else {
    res.status(500);
    res.render('error/error', { error: "Internal Error" , title: "Error", page_function: "Error Display"});
  }
});

router.post('/:id/upload', upload.single("photo"), async (req, res) => {
  //multipart/form-data xss can't be handled by the middleware in app.js
  for (const iterator in req.body) {
    req.body[iterator] = xss(req.body[iterator])
  }

  //Make the image name a timestamp, this way it will be a unique identifier
  let imgname = new Date().getTime().toString();
  const id = req.params.id;
  try {
    if (!req.file) imgname = "no_image.jpeg";
    else {
      const tempPath = req.file.path;
      const targetPath = path.join(__dirname, `../public/images/${imgname}`);

      if (path.extname(req.file.originalname).toLowerCase() === ".png" ||
        path.extname(req.file.originalname).toLowerCase() === ".jpg" || 
        path.extname(req.file.originalname).toLowerCase() === ".jpeg") {
        fs.rename(tempPath, targetPath, err => {
          if (err) res.render('error/error', { error: "Internal Error", title: "Error", page_function: "Error Display" });
        })
      } else {
        res.status(403);
        res.render('error/error', { error: "Only png or jpg/jpeg allowed", title: "Error", page_function: "Error Display" });
        return;
      }
    }

    let myBool = false;
    if (req.body.isManager === 'true') myBool = true;

    await reviews_DAL.create(req.body.restaurantId, req.body.userId, req.body.review, Number(req.body.rating), myBool, imgname);
    res.redirect(`/restaurants/${req.params.id}/reviews`);

  } catch (e) {
    res.render('error/error', { error: e, title: "Error", page_function: "Error Display" });
  }
  
});

router.post('/create', async (req, res) => {
  if (!(req.session.user && req.session.user.accountType === 'manager')){
    return res.status(403).redirect('/restaurants')
  }
  const form = req.body

  if(!form.name){
      res.status(400).render('restaurant/CreateRestaurantPage', {title: "Create Restaurant", page_function: "Create Restaurant", error: "Name invalid!"})    
      return
  }

  if(!form.streetAddress){
      res.status(400).render('restaurant/CreateRestaurantPage', {title: "Create Restaurant", page_function: "Create Restaurant", error: "Street Address invalid!"})    
      return
  }

  if(!form.city){
      res.status(400).render('restaurant/CreateRestaurantPage', {title: "Create Restaurant", page_function: "Create Restaurant", error: "City invalid!"})    
      return
  }

  if(!form.state){
      res.status(400).render('restaurant/CreateRestaurantPage', {title: "Create Restaurant", page_function: "Create Restaurant", error: "State invalid!"})    
      return
  }

  if(!form.zip){
      res.status(400).render('restaurant/CreateRestaurantPage', {title: "Create Restaurant", page_function: "Create Restaurant", error: "Zip invalid!"})    
      return
  }

  if(!form.email){
      res.status(400).render('restaurant/CreateRestaurantPage', {title: "Create Restaurant", page_function: "Create Restaurant", error: "Email invalid!"})    
      return
  }

  if(!form.phone){
      res.status(400).render('restaurant/CreateRestaurantPage', {title: "Create Restaurant", page_function: "Create Restaurant", error: "Phone invalid!"})    
      return
  }

  if(!form.priceRange){
      res.status(400).render('restaurant/CreateRestaurantPage', {title: "Create Restaurant", page_function: "Create Restaurant", error: "Price range invalid!"})    
      return
  }

  if(!(form.asian || form.american || form.italian || form.mexican || form.other)){
    res.status(400).render('restaurant/CreateRestaurantPage', {title: "Create Restaurant", page_function: "Create Restaurant", error: "Food category invalid!"})    
    return
  }

  foodTypes = []
  if(form.asian) foodTypes.push("Asian")
  if(form.american) foodTypes.push("American")
  if (form.italian) foodTypes.push("Italian")
  if (form.mexican) foodTypes.push("Mexican")
  if (form.other) foodTypes.push("Other")
  

  try{
      await restaurants_DAL.addRestaurant(form.name,
          form.streetAddress, 
          form.city, 
          form.state, 
          form.zip, 
          form.priceRange,
          foodTypes,
          form.email,
          form.phone,
          req.session.user.username)
  }
  catch(e){
      res.status(400).render('restaurant/CreateRestaurantPage', {title: "Create Restaurant", page_function: "Create Restaurant", error: e})
      return
  }
  
  res.redirect('/profile')
  return
});

router.post('/:id', async (req, res) => {
  const id = req.params.id;
  let menuItem = {};
  menuItem._id = ObjectId(req.body.id);
  menuItem.itemName = req.body.itemName;
  menuItem.price = Number(req.body.price);
  menuItem.customizableComponents = [];
  
  //This will always be from users collections since managers can't place orders
  let currentUser = await user_DAL.getUserProfileByName(req.session.user.username);
  let streetAddress = currentUser.streetAddress;
  let city = currentUser.city;
  let state = currentUser.state;
  let zip = currentUser.zip;
  let fullAddress = `${streetAddress} ${city}, ${state} ${zip}`

  if(!await orders_DAL.findCurrentOrder(req.session.user.username, id)){
    await orders_DAL.initOrder(req.session.user.username, id, fullAddress);
  }

  for (const key in req.body) {
    if (key !== 'id' && key !== 'itemName' && key !== 'price' && key !== 'quantity') {
      (menuItem.customizableComponents).push(key);
    }
  }
  const currentOrderId = await orders_DAL.findCurrentOrder(req.session.user.username, id);
  for (let i = 0; i < req.body.quantity; i++) {
    await orders_DAL.addItemToOrder(currentOrderId, menuItem);
  }
  res.redirect(`/restaurants/${id}`);
});

router.post('/items/delete', async (req, res) => { 
  const id = req.body.restaurantId;
  let deletionInfo = await orders_DAL.reomveItemFromOrder(req.body.orderId, req.body.itemId);
  res.redirect(`/restaurants/${id}/cart`);

});

router.post('/orders/place', async (req, res) => { 
  let orderInfo = await orders_DAL.placeOrder(req.body.orderId);
  res.redirect(`/restaurants/`);

});

router.post('/orders/applyDiscount', async (req, res) => {
  let orderId = req.body.orderId;
  let code = req.body.coupon;
  let restaurantId = req.body.restaurantId;
  let applyDiscount = await orders_DAL.addCoupon(orderId, code);
  let couponResult = "Discount Code is not Valid";
  if (applyDiscount.addedDiscount) couponResult = "Discount Applied!"
  
  const restaurant = await restaurants_DAL.getRestaurantFromId(restaurantId);
  let orderData = await orders_DAL.findOrderItems(req.session.user.username, restaurantId);
  res.render('restaurant/ViewCart', { title: "View Cart", page_function: `View ${req.session.user.username}'s cart at ${restaurant.restaurantName}`, orderData: orderData, restaurantId: restaurantId, couponResult: couponResult });
})


module.exports = router;