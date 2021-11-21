const mongoCollections = require('../config/mongoCollections');
const users = mongoCollections.users;
const { toObjectId, isValidName, isValidPassword, userFieldChecker } = require("./userUtils"); 
const deep_equal = require('deep-equal');
const bcrypt = require('bcrypt');
const saltRounds = 16;

module.exports = {
    async createUser(userName, streetAddress, city, state, zip, 
        email, phone, favorites, review_id, review_feedback, password) {
        
        const newUser = { userName, streetAddress, city, state, zip, 
            email, phone, favorites, review_id, review_feedback, password };
        userFieldChecker(newUser, update = false);
        
        newUser.userName = userName.toLowerCase();
        const userCollection = await users();
        const user = await userCollection.findOne({userName: userName});
        if(user !== null) {
            throw `${userName} is occupied, try a different one`;
        }
        newUser.password = await bcrypt.hash(password, saltRounds);

        const insertInfo = await userCollection.insertOne(newUser);
        if(insertInfo.insertedCount === 0)  { 
            throw 'creating new user failed'; 
        }

        return { userInserted: true };
    }, 

    async checkUser(userName, password) {
        if(!userName || !password) {
            throw 'userName or password not provided';
        }

        isValidName(userName);
        isValidPassword(password);
        const userCollection = await users();
        userName = userName.toLowerCase();
        const user = await userCollection.findOne({userName: userName});
        if(user === null) {
            throw `user not found`;
        } 

        let result = await bcrypt.compare(password, user.password);
        if(!result)    throw "Username and password don't mactch";
        return { authenticated: true };

    },

    async updateUserProfile(id, userName, streetAddress, city, state, zip, 
        email, phone, favorites) {
        
        const userInfos = {userName, streetAddress, city, state, zip, 
            email, phone, favorites };
        userFieldChecker(userInfos, update = true);

        const userCollection = await users();
        const user = await userCollection.findOne({_id: toObjectId(id)});
        if(user === null) {
            throw `user not found`;
        } 

        const updatedInfo = await userCollection.updateOne({_id: toObjectId(id)}, {$set: userInfos});
        if(updatedInfo.modifiedCount === 0) {
            throw 'could not update user profile successfully';
        }
        return {updated: true};
    }
}

