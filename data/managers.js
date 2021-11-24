const mongoCollections = require('../config/mongoCollections');
const managers = mongoCollections.managers;
const bcrypt = require('bcrypt');
const saltRounds = 16;
const { isValidName, isValidPassword, managerFieldChecker } = require('../dataUtils');

module.exports = {
    async createManager(userName, review_id, reply_id, password) {
        let newManager = { userName, review_id, reply_id, password };
        managerFieldChecker(newManager);

        userName = userName.toLowerCase();
        newManager.userName = userName;
        const managerCollection = await managers();
        const manager = await managerCollection.findOne({userName: userName});
        if(manager !== null) {
            throw `${userName} is occupied, try a different one`;
        }
        newManager.password = await bcrypt.hash(password, saltRounds);

        const insertInfo = await managerCollection.insertOne(newManager);
        if(insertInfo.insertedCount === 0)  { 
            throw 'creating new user failed'; 
        }

        return { managerInserted: true };
    },

    async checkManager(userName, password) {
        if(!userName || !password) {
            throw 'UserName or password not provided';
        }
        isValidName(userName);
        isValidPassword(password);

        userName = userName.toLowerCase();
        const managerCollection = await managers();
        const manager = await managerCollection.findOne({userName: userName});
        if(manager === null) {
            throw 'manager not found';
        }
        let result = await bcrypt.compare(password, manager.password);
        if(!result)    throw "Username and password don't mactch";
        return { authenticated: true };
    }
}