const mongoCollections = require('../config/mongoCollections');
const managers = mongoCollections.managers;
const user_DAL = require('./users');
const bcrypt = require('bcrypt');
const saltRounds = 16;
const { isValidName, isValidPassword, managerFieldChecker } = require('../dataUtils');

async function createManager(userName, streetAddress, city, state, zip, email, phone, password) {

    let newManager = { userName, streetAddress, city, state, zip, 
        email, phone, password};

    managerFieldChecker(newManager);
    
    newManager.restaurants = [];
    newManager.review_id = [];
    newManager.reply_id = [];
    newManager.review_feedback = {
        likes: [],
        dislikes: []
    };

    newManager.accoutType = "manager";
    
    userName = userName.toLowerCase();
    newManager.userName = userName;
    
    //Check that the user doesn't already exist, throw if it does
    let userProfile = null
    let managerProfile = null
    try{
        managerProfile = await getManagerByName(userName)
    }catch(e){
        //pass
    }
    try{
        userProfile = await user_DAL.getUserProfileByName(userName)
    }catch(e){
        //pass
    }

    if(managerProfile || userProfile){
        throw `Username already exists!`
    }

    newManager.password = await bcrypt.hash(password, saltRounds);

    const managerCollection = await managers();
    const insertInfo = await managerCollection.insertOne(newManager);
    if(insertInfo.insertedCount === 0)  { 
        throw 'creating new user failed'; 
    }

    return { managerInserted: true };
}

async function checkManager(userName, password) {
    //check whether userName and password is provided or not
    if(!userName || !password) {
        throw 'userName or password not provided';
    }
    // check whether userName and password are valid or not
    isValidName(userName);
    isValidPassword(password);

    userName = userName.toLowerCase();
    const managerCollection = await managers();
    const manager = await managerCollection.findOne({userName: userName});
    if(manager === null) {
        return false;
    }
    let result = await bcrypt.compare(password, manager.password);
    if(!result) return false
    return true;
}

async function getManagerIdByName(managerName) {
    //check whether managerName is provided or not
    if(!managerName) {
        throw "managerName not provided";
    }
    //check whether manager is valid or not
    isValidName(managerName);
    
    const managerCollection = await managers();
    const manager = await managerCollection.findOne({ userName: managerName });
    if(manager === null) {
        throw "manager not found";
    }
    return manager._id.toString();
} 

async function getManagerByName(managerName) {
    //check whether managerName is provided or not
    if(!managerName) {
        throw "managerName not provided";
    }
    //check whether manager is valid or not
    isValidName(managerName);
    const managerCollection = await managers();
    const manager = await managerCollection.findOne({userName: managerName});
    if(manager === null) {
        throw "manager not found";
    }
    manager._id = manager._id.toString();
    return manager;
}

async function addRestaurantToManager(restaurantId, managerName){
    //check whether restaurantId or managerName is provided or not
    if(!restaurantId || !managerName) {
        throw "restaurantId or managerName not supplied";
    }
    //check whether managerName is valid or not
    isValidName(managerName);
    
    const manager = await getManagerByName(managerName);
    if(manager === null) {
        throw "manager not found";
    }

    const managerCollection = await managers();
    let updateInfo = await managerCollection.updateOne({userName: managerName}, {$push: {restaurants: restaurantId}});
    if(updateInfo.matchedCount === 0) throw `Failed to add restaurant to manager: ${managerName}.`
    return { addRestaurant: true};
}

async function isManager(username){
    if(!username) {
        throw "username not supplied";
    }
    isValidName(username);
    const managerCollection = await managers();
    let find = managerCollection.findOne({userName: username})

    if(find){
        return true
    }

    return false
}

async function userIsManagerOfRestaurant(userName, restaurantId){
    if(!userName || !restaurantId) {
        throw "userName or restaurantId not supplied";
    }
    isValidName(userName);
    
    let manager = null
    try{
        manager = await getManagerByName(userName)
    }
    catch(e){
        return false
    }

    let idFound = manager.restaurants.find(x => x === restaurantId)
    return idFound
}

module.exports = {createManager, checkManager, getManagerIdByName, getManagerByName, addRestaurantToManager, isManager, userIsManagerOfRestaurant}
